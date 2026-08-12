/**
 * Eval Runner — 驱动 agentLoop，收集事件流，运行 graders
 *
 * 依赖注入设计：
 * - 脚本 LLM 通过 EvalScenario.mockResponses + createMockStreamChat 注入
 * - 真实 LLM 时 mockResponses = undefined，不注入 override
 * - ToolRegistry 由 scenario.registerTools() 填充，默认空
 */

import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { agentLoop, DEFAULT_SYSTEM_PROMPT } from '../electron/main/agent/loop'
import { ToolRegistry } from '../electron/main/tools/registry'
import { createMockStreamChat, resetMockCounter } from './mock-llm'
import type {
  EvalScenario,
  ScenarioResult,
  EvalReport,
  EvalContext,
} from './types'
import type {
  AgentStreamEvent,
  PersonaEvalAgentInputSnapshot,
  PersonaEvalJudgeSnapshot,
} from '../src/shared/types'
import { getEvalMode, loadEvalEnvironment } from './eval-config'
import { collectAgentText } from './transcript'

// ── 单场景运行 ──

/**
 * 生成不含凭据的 Agent 初始输入快照。
 *
 * 背景：报告过去只有回复，无法知道模型收到什么。这里在进入 AgentLoop 前冻结实际参数，
 * 而不是 Debug 打开时重新组装，避免后来修改 Role Pack 后历史报告失真。
 * 约束：只记录模型名、端点、System Prompt、初始消息和工具名；绝不读取或保存 API Key。
 */
function snapshotAgentInput(
  options: {
    config: { model: string; baseUrl: string }
    systemPrompt?: string
    messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }>
    tools: Array<{ name: string }>
    executionMode?: PersonaEvalAgentInputSnapshot['executionMode']
  },
): PersonaEvalAgentInputSnapshot {
  return {
    model: options.config.model,
    baseUrl: options.config.baseUrl,
    executionMode: options.executionMode ?? 'auto',
    systemPrompt: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    messages: options.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    toolNames: options.tools.map((tool) => tool.name),
  }
}

/** Model Judge 的所有维度在 Agent 回复后合并为一次调用；Code Grader 不进入这里。 */
function snapshotJudgePlan(scenario: EvalScenario): PersonaEvalJudgeSnapshot | undefined {
  const grader = scenario.graders.find((candidate) => candidate.reportPlan?.kind === 'model-judge')
  const plan = grader?.reportPlan
  if (!grader || !plan) return undefined
  return {
    graderName: grader.name,
    invocationMode: plan.invocationMode,
    systemContext: plan.systemContext,
    checks: plan.checks.map((check) => ({ ...check })),
  }
}

export async function runScenario(scenario: EvalScenario): Promise<ScenarioResult> {
  loadEvalEnvironment()
  const mode = getEvalMode()
  const start = Date.now()
  const workdir = join(tmpdir(), `eval-${scenario.id}-${Date.now()}`)
  mkdirSync(workdir, { recursive: true })

  const transcript: AgentStreamEvent[] = []
  let agentInput: PersonaEvalAgentInputSnapshot | undefined
  const judge = snapshotJudgePlan(scenario)

  try {
    // 构建 ToolRegistry
    const registry = new ToolRegistry()
    scenario.registerTools?.(registry)

    // 构建 agentLoop options
    const baseOptions = await scenario.buildOptions(workdir, registry)

    // 优先用 buildOptions 自带的 _streamChatOverride（场景自定义 mock，如消息捕获），
    // 其次用 mockResponses 生成的标准脚本 mock，都没有则走真实 LLM。
    resetMockCounter()
    const { _streamChatOverride: overrideFromOptions, ...restBaseOptions } = baseOptions
    const streamChatOverride = overrideFromOptions
      ?? (scenario.mockResponses ? createMockStreamChat(scenario.mockResponses) : undefined)

    const loopOptions = {
      ...restBaseOptions,
      tools: restBaseOptions.tools ?? registry.getAll(),
      toolContext: {
        ...(restBaseOptions.toolContext ?? {}),
        workdir,
        sessionId: `eval-${scenario.id}`,
      },
      _streamChatOverride: streamChatOverride,
    }
    agentInput = snapshotAgentInput(loopOptions)

    // 运行 agentLoop，收集全部事件
    for await (const ev of agentLoop(loopOptions, registry)) {
      transcript.push(ev)
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      id: scenario.id,
      description: scenario.description,
      pass: false,
      durationMs: Date.now() - start,
      graderResults: [],
      agentTexts: [],
      agentInput,
      judge,
      error: errorMsg,
      mode,
    }
  }

  // 运行所有 graders
  const ctx: EvalContext = { workdir, transcript, scenarioId: scenario.id }
  const graderResults: ScenarioResult['graderResults'] = []
  let allPass = true

  for (const grader of scenario.graders) {
    try {
      const result = await grader.grade(ctx)
      graderResults.push({ graderName: grader.name, result })
      if (!result.pass) allPass = false
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      graderResults.push({
        graderName: grader.name,
        result: { pass: false, violations: [`Grader 异常: ${msg}`], evidence: [] },
      })
      allPass = false
    }
  }

  // 清理临时目录（可选，注释掉可以检查文件状态）
  try {
    rmSync(workdir, { recursive: true, force: true })
  } catch { /* 清理失败不影响结果 */ }

  return {
    id: scenario.id,
    description: scenario.description,
    pass: allPass,
    durationMs: Date.now() - start,
    graderResults,
    agentTexts: (() => {
      const text = collectAgentText(transcript)
      return text ? [text] : []
    })(),
    agentInput,
    judge,
    mode,
  }
}

// ── Suite 运行 ──

export async function runSuite(
  scenarios: EvalScenario[],
  opts: { verbose?: boolean } = {},
): Promise<EvalReport> {
  loadEvalEnvironment()
  const mode = getEvalMode()
  const results: ScenarioResult[] = []

  for (const scenario of scenarios) {
    if (opts.verbose) {
      process.stdout.write(`  ▶ ${scenario.id} — ${scenario.description} ...`)
    }
    const result = await runScenario(scenario)
    results.push(result)
    if (opts.verbose) {
      const icon = result.pass ? '✓' : '✗'
      console.log(` ${icon} (${result.durationMs}ms)`)
      if (!result.pass) {
        if (result.error) {
          console.log(`    ERROR: ${result.error}`)
        }
        for (const gr of result.graderResults) {
          if (!gr.result.pass) {
            console.log(`    [${gr.graderName}] FAIL`)
            for (const v of gr.result.violations) {
              console.log(`      · ${v}`)
            }
          }
        }
      }
    }
  }

  const passed = results.filter((r) => r.pass).length
  const failed = results.length - passed
  const required_failed = results.filter(
    (r, i) => !r.pass && scenarios[i].required,
  ).length

  return {
    timestamp: new Date().toISOString(),
    mode,
    hasApiKey: Boolean((process.env.TEST_LLM_API_KEY || process.env.LLM_API_KEY || '').trim()),
    totalScenarios: results.length,
    passed,
    failed,
    required_failed,
    results,
  }
}

/**
 * pass^k：同一场景连续跑 k 次，全部通过才算 pass（M18 可靠性度量）。
 * 无真实 LLM / mock 场景同样适用。
 */
export async function runPassK(
  scenario: EvalScenario,
  k: number,
  onTrial?: (event: { trialIndex: number; result: ScenarioResult }) => void,
): Promise<{ pass: boolean; passes: number; k: number; trials: ScenarioResult[] }> {
  const trials: ScenarioResult[] = []
  for (let i = 0; i < k; i++) {
    const result = await runScenario(scenario)
    trials.push(result)
    onTrial?.({ trialIndex: i, result })
  }
  const passes = trials.filter(t => t.pass).length
  return { pass: passes === k, passes, k, trials }
}

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
import { agentLoop } from '../electron/main/agent/loop'
import { ToolRegistry } from '../electron/main/tools/registry'
import { createMockStreamChat, resetMockCounter } from './mock-llm'
import type {
  EvalScenario,
  ScenarioResult,
  EvalReport,
  EvalContext,
} from './types'
import type { AgentStreamEvent } from '../src/shared/types'

// ── 单场景运行 ──

export async function runScenario(scenario: EvalScenario): Promise<ScenarioResult> {
  const start = Date.now()
  const workdir = join(tmpdir(), `eval-${scenario.id}-${Date.now()}`)
  mkdirSync(workdir, { recursive: true })

  const transcript: AgentStreamEvent[] = []

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
      error: errorMsg,
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
  }
}

// ── Suite 运行 ──

export async function runSuite(
  scenarios: EvalScenario[],
  opts: { verbose?: boolean } = {},
): Promise<EvalReport> {
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
): Promise<{ pass: boolean; passes: number; k: number; trials: ScenarioResult[] }> {
  const trials: ScenarioResult[] = []
  for (let i = 0; i < k; i++) {
    trials.push(await runScenario(scenario))
  }
  const passes = trials.filter(t => t.pass).length
  return { pass: passes === k, passes, k, trials }
}

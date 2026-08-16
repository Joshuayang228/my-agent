/**
 * ModelBasedGrader — B 类伙伴行为的 LLM Judge（methodology/m18-eval-persona.md）
 *
 * 设计原则（对照方法论）：
 * 1. 不打综合分，只判断具体违规项（有/没有/无法判断）
 * 2. judge prompt 把 LLM 放在"陌生用户"位置，而非"评分员"，破解同情偏差
 * 3. 每个维度独立 + "Unknown" 退路，防止无证据时强行判断
 * 4. Mock 模式跳过 Judge；Real 模式缺 API Key 必须失败，避免伪造通过
 *
 * 使用方式：
 *   import { makeModelBasedGrader } from '../graders/model-based'
 *   const toneGrader = makeModelBasedGrader('ToneCheck', context, checks)
 *
 * 注意：依赖真实 LLM API；普通 Mock Eval 会显式跳过，Real Eval 缺 Key 会失败。
 */

import type { EvalGrader, GraderResult, EvalContext, ViolationCheck } from '../types'
import type { LLMConfig, ChatMessage } from '../../src/shared/types'
import { chatComplete } from '../../electron/main/llm/index'
import { makeEvalLLMConfig } from '../types'
import { getEvalMode } from '../eval-config'
import { collectAgentText } from '../transcript'
import { buildEvalJudgePrompt } from '../../electron/main/prompts/eval-judge'
import { PROMPT_KEYS } from '../../electron/main/prompts/keys'


/**
 * 创建一个 ModelBasedGrader。
 *
 * @param graderName   可读名字，出现在报告里
 * @param systemContext  给 judge 的背景（如"你在评估一个伙伴型 AI Agent 的回复"）
 * @param checks       违规项列表，每项只判断 FOUND / NOT_FOUND / UNKNOWN
 * @param llmConfig    可选 LLM 配置；未提供时读环境变量；Real 模式没有 Key 则失败
 */
export function makeModelBasedGrader(
  graderName: string,
  systemContext: string,
  checks: ViolationCheck[],
  llmConfig?: Partial<LLMConfig>,
): EvalGrader {
  return {
    name: graderName,
    assetDefinition: {
      kind: 'model-based',
      source: 'evals/graders/model-based.ts',
      criteria: {
        invocationMode: 'single-call',
        systemContext,
        checks: checks.map((check) => ({ ...check })),
      },
    },
    reportPlan: {
      kind: 'model-judge',
      invocationMode: 'single-call',
      systemContext,
      checks: checks.map((check) => ({ ...check })),
    },

    async grade({ transcript }: EvalContext): Promise<GraderResult> {
      const mode = getEvalMode()
      if (mode === 'mock') {
        return {
          pass: true,
          violations: [],
          evidence: ['[SKIPPED] Mock 模式不运行 Model Judge'],
        }
      }

      // ── 1. 检查 API Key ──
      const cfg = makeEvalLLMConfig(llmConfig)
      if (!cfg.apiKey || cfg.apiKey === 'eval-mock-key') {
        return {
          pass: false,
          violations: ['Real Eval 缺少 LLM API Key'],
          evidence: [],
        }
      }

      // ── 2. 收集被测 Agent 的文本回复 ──
      const agentTexts = collectAgentText(transcript)

      if (!agentTexts) {
        return {
          pass: false,
          violations: ['transcript 中没有 text 事件，无法评估'],
          evidence: [],
        }
      }

      // ── 3. 构建 judge prompt ──
      const checkList = checks
        .map((c, i) => `${i + 1}. [${c.id}] ${c.question}`)
        .join('\n')

      const judgePrompt = buildEvalJudgePrompt({
        systemContext,
        agentTexts,
        checkList,
      })

      // ── 4. 调用 LLM judge ──
      const judgeMsg: ChatMessage = {
        id: 'judge-q',
        role: 'user',
        content: judgePrompt,
        timestamp: Date.now(),
      }

      let judgeResponse: string
      try {
        judgeResponse = await chatComplete({
          config: cfg,
          messages: [judgeMsg],
          caller: 'eval-judge',
          promptAssetKeys: [PROMPT_KEYS.evalJudge],
        })
      } catch (err) {
        return {
          pass: false,
          violations: [`Judge LLM 调用失败: ${err instanceof Error ? err.message : String(err)}`],
          evidence: [],
        }
      }

      // ── 5. 解析 judge 回复 ──
      const violations: string[] = []
      const evidence: string[] = []

      for (let i = 0; i < checks.length; i++) {
        // Judge 偶尔省略方括号，或添加 Markdown 列表/粗体；同时接受 `[1]`、`1`、`1.`，并逐行解析，禁止 `\s` 跨行吞掉下一条结论。
        const pattern = new RegExp(
          `^[ \\t]*(?:[-*][ \\t]*)?(?:\\*\\*)?(?:\\[${i + 1}\\]|${i + 1}[.)、]?)(?:\\*\\*)?[ \\t]*[:：-]?[ \\t]*`
          + `(?:\\*\\*)?(VIOLATION_FOUND|NOT_FOUND|UNKNOWN)(?:\\*\\*)?`
          + `[ \\t]*(?::|：|-)?[ \\t]*([^\\r\\n]*)$`,
          'im',
        )
        const m = judgeResponse.match(pattern)

        if (!m) {
          evidence.push(`[${i + 1}] UNKNOWN: 无法解析 Judge 回复；原始 Judge：${judgeResponse.slice(0, 500)}`)
          violations.push(`${checks[i].id}: Judge 未返回可解析结论`)
          continue
        }

        const verdict = m[1].toUpperCase()
        const detail = (m[2] || '').trim()
        const evidenceLine = `[${i + 1}] ${verdict}${detail ? ': ' + detail : ''}`
        evidence.push(evidenceLine)

        if (verdict === 'VIOLATION_FOUND') {
          violations.push(`${checks[i].id}: ${detail || checks[i].question}`)
        } else if (verdict === 'UNKNOWN') {
          violations.push(`${checks[i].id}: Judge 返回 UNKNOWN${detail ? `：${detail}` : ''}`)
        }
      }

      return { pass: violations.length === 0, violations, evidence }
    },
  }
}

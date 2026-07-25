/**
 * ModelBasedGrader — B 类伙伴行为的 LLM judge（m12-eval-persona.md §8）
 *
 * 设计原则（对照方法论）：
 * 1. 不打综合分，只判断具体违规项（有/没有/无法判断）
 * 2. judge prompt 把 LLM 放在"陌生用户"位置，而非"评分员"，破解同情偏差
 * 3. 每个维度独立 + "Unknown" 退路，防止无证据时强行判断
 * 4. 无 API key 时直接跳过，不阻断 eval pipeline
 *
 * 使用方式：
 *   import { makeModelBasedGrader } from '../graders/model-based'
 *   const toneGrader = makeModelBasedGrader('ToneCheck', context, checks)
 *
 * 注意：依赖真实 LLM API，在 CI 或没有 API Key 时自动跳过（pass=true + 说明）。
 */

import type { EvalGrader, GraderResult, EvalContext } from '../types'
import type { LLMConfig, ChatMessage } from '../../src/shared/types'
import { chatComplete } from '../../electron/main/llm/index'
import { makeEvalLLMConfig } from '../types'

export interface ViolationCheck {
  /** 便于引用的短 ID（如 'cliche' / 'report'） */
  id: string
  /**
   * 具体的二元判断问题。
   * 示例：
   *   "Does any response contain customer service clichés like '您好', '请问' or '为您服务'?"
   * 要求：具体、可在文本里找证据，避免模糊的感受类问题。
   */
  question: string
}

/**
 * 创建一个 ModelBasedGrader。
 *
 * @param graderName   可读名字，出现在报告里
 * @param systemContext  给 judge 的背景（如"你在评估一个伙伴型 AI Agent 的回复"）
 * @param checks       违规项列表，每项只判断 FOUND / NOT_FOUND / UNKNOWN
 * @param llmConfig    可选 LLM 配置；未提供时读环境变量；没有 key 则跳过
 */
export function makeModelBasedGrader(
  graderName: string,
  systemContext: string,
  checks: ViolationCheck[],
  llmConfig?: Partial<LLMConfig>,
): EvalGrader {
  return {
    name: graderName,

    async grade({ transcript }: EvalContext): Promise<GraderResult> {
      // ── 1. 检查 API Key ──
      const cfg = makeEvalLLMConfig(llmConfig)
      if (!cfg.apiKey || cfg.apiKey === 'eval-mock-key') {
        return {
          pass: true,
          violations: [],
          evidence: ['[SKIPPED] 无 LLM API Key，B 类场景跳过（设置 LLM_API_KEY 后手动运行）'],
        }
      }

      // ── 2. 收集被测 Agent 的文本回复 ──
      const agentTexts = transcript
        .filter(ev => ev.type === 'text')
        .map(ev => (ev as { type: 'text'; content: string }).content)
        .join('\n\n---\n\n')
        .trim()

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

      const judgePrompt = `${systemContext}

你的任务：阅读以下 AI 助手的回复，判断是否存在违规。
请以"陌生用户"的视角阅读，不要为回复的意图辩护，只看实际文字效果。

<ai_responses>
${agentTexts}
</ai_responses>

对以下每个问题，回答 VIOLATION_FOUND / NOT_FOUND / UNKNOWN，如有违规请引用原文：

${checkList}

格式（每行一个）：
[序号] VIOLATION_FOUND: <引用原文>
[序号] NOT_FOUND
[序号] UNKNOWN`

      // ── 4. 调用 LLM judge ──
      const judgeMsg: ChatMessage = {
        id: 'judge-q',
        role: 'user',
        content: judgePrompt,
        timestamp: Date.now(),
      }

      let judgeResponse: string
      try {
        const result = await chatComplete({
          config: cfg,
          messages: [judgeMsg],
          caller: 'eval-judge',
        })
        judgeResponse = result.content || ''
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
        const pattern = new RegExp(`\\[${i + 1}\\]\\s+(VIOLATION_FOUND|NOT_FOUND|UNKNOWN)([:\\s]*)([^\\n]*)`, 'i')
        const m = judgeResponse.match(pattern)

        if (!m) {
          evidence.push(`[${i + 1}] (无法解析 judge 回复)`)
          continue
        }

        const verdict = m[1].toUpperCase()
        const detail = (m[3] || '').trim()
        const evidenceLine = `[${i + 1}] ${verdict}${detail ? ': ' + detail : ''}`
        evidence.push(evidenceLine)

        if (verdict === 'VIOLATION_FOUND') {
          violations.push(`${checks[i].id}: ${detail || checks[i].question}`)
        }
      }

      return { pass: violations.length === 0, violations, evidence }
    },
  }
}

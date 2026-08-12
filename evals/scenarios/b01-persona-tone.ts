/**
 * B01 — B 类伙伴语气（真实 LLM + ModelBasedGrader）
 * 无 LLM_API_KEY / TEST_LLM_API_KEY 时 grader 自动 skip（不阻断 CI）。
 */

import type { EvalScenario } from '../types'
import { makeEvalLLMConfig } from '../types'
import { makeModelBasedGrader } from '../graders/model-based'
import { getEvalMode, hasEvalApiKey } from '../eval-config'

export const B01: EvalScenario = {
  id: 'B01',
  description: '伙伴语气：无客服套话（真实 LLM + Judge）',
  required: false,
  // 不设 mockResponses → 走真实 LLM；无 key 时 loop 会失败，grader skip 仍可能判失败
  // 因此 buildOptions 在无 key 时注入极简 mock，仅让 pipeline 跑通，由 grader 标记 SKIPPED
  async buildOptions(_workdir, _registry) {
    const cfg = makeEvalLLMConfig({
      apiKey: process.env.TEST_LLM_API_KEY || process.env.LLM_API_KEY || '',
    })
    const realMode = getEvalMode() === 'real'
    const hasKey = hasEvalApiKey()

    if (!realMode) {
      return {
        config: makeEvalLLMConfig(),
        messages: [{ id: 'u1', role: 'user' as const, content: '你好', timestamp: Date.now() }],
        systemPrompt: '你是用户的数字伙伴，说话自然，不要用客服套话。',
        _streamChatOverride: async function* () {
          yield { type: 'text' as const, content: '嘿，在呢。' }
          return {
            content: '嘿，在呢。',
            toolCalls: [],
            usage: { promptTokens: 10, completionTokens: 5 },
            stopReason: 'stop',
          }
        },
      }
    }
    if (!hasKey) throw new Error('Real Eval 缺少 LLM API Key')

    return {
      config: cfg,
      messages: [
        {
          id: 'u1',
          role: 'user' as const,
          content: '你好，今天有点累。',
          timestamp: Date.now(),
        },
      ],
      systemPrompt: '你是用户的数字伙伴，说话自然有温度，不要用「您好请问有什么可以帮您」之类客服套话。',
    }
  },
  graders: [
    makeModelBasedGrader(
      'NoClicheTone',
      '你在评估一个伙伴型 AI 的回复是否像真人朋友而非客服。',
      [
        {
          id: 'cliche',
          question:
            "回复中是否包含“您好”“请问有什么可以帮您”“为您服务”等客服套话？",
        },
      ],
    ),
  ],
}

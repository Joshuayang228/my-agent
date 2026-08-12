/**
 * P05 — 语气一致性（B类，需真实 LLM）
 * P06 — 记忆使用自然度（B类，需真实 LLM）
 *
 * B 类场景特点：
 * - 不使用 mockResponses，走真实 LLM
 * - required: false（需要 API Key，不进 CI，发版前手动运行）
 * - 用 ModelBasedGrader 评估主观感知质量
 *
 * 运行方式：
 *   LLM_API_KEY=xxx EVAL_ID=P05 npm run eval:run
 *   LLM_API_KEY=xxx npm run eval:run  # 全部场景
 */

import type { EvalScenario } from '../types'
import { makeTerminalReasonGrader } from '../graders/index'
import { makeModelBasedGrader } from '../graders/model-based'
import { makeEvalLLMConfig } from '../types'
import { createMockStreamChat } from '../mock-llm'
import { buildTool } from '../../electron/main/tools/builder'
import { getEvalMode, hasEvalApiKey } from '../eval-config'

/** 没有真实 API key 时注入占位 mock，让场景以 completed 结束但 ModelBasedGrader 自动跳过 */
function skipMockIfNoApiKey() {
  if (getEvalMode() === 'mock') {
    return createMockStreamChat([{ content: '[B类场景跳过：Mock 模式]' }])
  }
  if (!hasEvalApiKey()) throw new Error('Real Eval 缺少 LLM API Key')
  return undefined
}

// ── P05：语气一致性 ──

export const P05: EvalScenario = {
  id: 'P05',
  description: '语气一致性：多轮对话中没有客服话术，没有"汇报感"（B类，需真实LLM）',
  required: false,

  registerTools(_registry) { /* 不需要工具 */ },

  async buildOptions(workdir, _registry) {
    return {
      config: makeEvalLLMConfig(),
      messages: [
        { id: 'u1', role: 'user' as const, content: '今天心情不太好，随便聊聊', timestamp: Date.now() - 20000 },
        { id: 'a1', role: 'assistant' as const, content: '', timestamp: Date.now() - 19000 },
        { id: 'u2', role: 'user' as const, content: '最近工作压力比较大', timestamp: Date.now() - 18000 },
        { id: 'a2', role: 'assistant' as const, content: '', timestamp: Date.now() - 17000 },
        { id: 'u3', role: 'user' as const, content: '算了，说点轻松的', timestamp: Date.now() - 16000 },
      ],
      tools: [],
      executionMode: 'auto' as const,
      toolContext: { workdir, sessionId: 'eval-P05' },
      _streamChatOverride: skipMockIfNoApiKey(),
    }
  },

  graders: [
    makeTerminalReasonGrader('completed'),
    makeModelBasedGrader(
      'ToneConsistency',
      '你在评估一个人格化伙伴 AI（类似私人助手，不是客服）的回复质量。',
      [
        {
          id: 'cliche',
          question: '任何一条回复中有没有出现客服标准话术，如"您好"/"请问"/"为您服务"/"感谢您"/"请放心"/"很抱歉给您带来不便"等格式用语？',
        },
        {
          id: 'report_style',
          question: '任何一条回复是否像在"汇报情况"而不是在"和朋友说话"？（如：以"我理解您的感受，……"开头，或结构过于工整，或每段都以总结句收尾）',
        },
      ],
    ),
  ],
}

// ── P06：记忆使用自然度 ──

export const P06: EvalScenario = {
  id: 'P06',
  description: '记忆召回自然度：使用用户偏好时不机械嵌入"因为您说过X"格式（B类，需真实LLM）',
  required: false,

  registerTools(registry) {
    registry.register(buildTool({
      name: 'remember',
      description: '记住关于用户的事实',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['category', 'content'],
      },
      metadata: { isReadOnly: false, isDestructive: false, isConcurrencySafe: false },
      execute: async (args: Record<string, unknown>) => `已记录: ${args.content}`,
    }))
  },

  async buildOptions(workdir, registry) {
    const mockMemoryInjection = '[已知用户偏好] 喜欢简洁直接的回答，不喜欢废话。'

    return {
      config: makeEvalLLMConfig(),
      messages: [
        { id: 'u1', role: 'user' as const, content: '帮我解释一下什么是 TCP 三次握手', timestamp: Date.now() },
      ],
      tools: registry.getAll(),
      systemPrompt: mockMemoryInjection,
      executionMode: 'auto' as const,
      toolContext: { workdir, sessionId: 'eval-P06' },
      _streamChatOverride: skipMockIfNoApiKey(),
    }
  },

  graders: [
    makeTerminalReasonGrader('completed'),
    makeModelBasedGrader(
      'MemoryNaturalness',
      '你在评估一个AI助手如何使用关于用户的记忆信息。评估它是自然地使用了偏好，还是机械地引用了偏好。',
      [
        {
          id: 'mechanical_citation',
          question: '回复中有没有出现机械引用记忆的格式，如"因为您说过/告诉我您喜欢简洁，所以我给您简洁的回答"或"您之前提到了X，所以……"这类直接说出记忆的表述？',
        },
        {
          id: 'natural_usage',
          question: '回复是否没有体现用户偏好的简洁风格，例如内容冗长、重复或包含明显无关铺垫？',
        },
      ],
    ),
  ],
}

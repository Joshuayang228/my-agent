/**
 * F08 — 上下文压缩后，system prompt preamble（任务说明 + 人格锚点）保留
 *
 * 验证 M4 A1（getPreambleEndIndex 保护）+ M9 G1（结尾锚点）联合生效：
 * 即使消息历史被压缩，system prompt 首段不应被截断或重写。
 *
 * 实现策略：
 * - 用 createCapturingMockStreamChat 记录每次 LLM 调用时的 messages
 * - 压缩发生在第一次 LLM 调用之前（lastPromptTokens = undefined → 用 estimateTokens）
 * - 捕获到的 messages[0] 应包含 PREAMBLE_MARKER
 */

import type { EvalScenario, EvalGrader, GraderResult } from '../types'
import { makeTerminalReasonGrader } from '../graders/index'
import { createCapturingMockStreamChat, type CapturedLLMCall } from '../mock-llm'
import { buildSystemPrompt, rolePackToPromptParts } from '../../electron/main/agent/prompt-builder'
import { loadRolePack } from '../../electron/main/companion/identity/loader'
import { makeEvalLLMConfig } from '../types'
import type { ChatMessage } from '../../src/shared/types'

const PREAMBLE_MARKER = '__EVAL_F08_PREAMBLE__'

// captured 和 grader 在模块级定义，通过闭包共享。
// buildOptions 每次调用前重置 captured.calls，保证多次 run 之间不互相污染。
const captured: { calls: CapturedLLMCall[] } = { calls: [] }

const preambleGrader: EvalGrader = {
  name: 'PreamblePreservedAfterCompression',
  assetDefinition: {
    kind: 'preamble-preserved-after-compression',
    source: 'evals/scenarios/f08.ts',
    criteria: {
      capturedCall: 'first',
      messageRole: 'system',
      requiredMarker: PREAMBLE_MARKER,
    },
  },
  grade(): GraderResult {
    if (captured.calls.length === 0) {
      return { pass: false, violations: ['没有捕获到任何 LLM 调用——压缩可能未触发'] , evidence: [] }
    }

    // 取第一次 LLM 调用的 messages（压缩发生在第一次调用之前）
    const firstCall = captured.calls[0]
    const sysMsg = firstCall.messages.find(m => m.role === 'system')

    if (!sysMsg) {
      return {
        pass: false,
        violations: ['压缩后 system message 不存在'],
        evidence: [`firstCall.messages.length = ${firstCall.messages.length}`],
      }
    }

    if (!sysMsg.content.includes(PREAMBLE_MARKER)) {
      return {
        pass: false,
        violations: [`system prompt 不含 preamble marker "${PREAMBLE_MARKER}"（M4 A1 保护失效）`],
        evidence: [
          `system msg 前100字符: ${sysMsg.content.slice(0, 100)}`,
          `messages.length after compress: ${firstCall.messages.length}`,
        ],
      }
    }

    return {
      pass: true,
      violations: [],
      evidence: [
        `preamble marker 存在 ✓`,
        `压缩后消息数: ${firstCall.messages.length}`,
      ],
    }
  },
}

export const F08: EvalScenario = {
  id: 'F08',
  description: '上下文压缩后 system prompt preamble 保留（M4 A1 + M9 G1）',
  required: true,

  registerTools(_registry) { /* 不需要工具 */ },

  async buildOptions(workdir, _registry) {
    // 重置捕获记录，保证多次 run 互不干扰
    captured.calls = []

    const persona = rolePackToPromptParts(loadRolePack('lin'))
    // 在 system prompt 最前面加标记，压缩后检查是否保留
    const baseSystemPrompt = buildSystemPrompt({ persona, toolNames: [] })
    const markedSystemPrompt = `${PREAMBLE_MARKER}\n${baseSystemPrompt}`

    // 构造足够长的消息历史，让 estimateTokens 超过压缩阈值
    // 60 对消息 × 每条助手消息500字符 ≈ estimateTokens = (60*500+60*20)/4 ≈ 7,800 tokens
    // DEFAULT_MAX_TOKENS 通常为 8192，0.7 阈值 = 5734——应当触发 L1/Snip 或更高层压缩
    const messages: ChatMessage[] = [
      { id: 'u0', role: 'user', content: '请帮我做一个长期任务', timestamp: Date.now() - 120000 },
    ]
    const padding = 'EVAL_CONTENT_PADDING '.repeat(25) // ~500 chars per assistant message
    for (let i = 1; i <= 60; i++) {
      messages.push({
        id: `a${i}`,
        role: 'assistant',
        content: `回复 ${i}：${padding}`,
        timestamp: Date.now() - 120000 + i * 1000,
      })
      messages.push({
        id: `u${i}`,
        role: 'user',
        content: `继续 ${i}`,
        timestamp: Date.now() - 120000 + i * 1000 + 500,
      })
    }

    return {
      config: makeEvalLLMConfig(),
      messages,
      tools: [],
      systemPrompt: markedSystemPrompt,
      executionMode: 'auto' as const,
      toolContext: { workdir, sessionId: 'eval-F08' },
      // 注入捕获 mock：记录每次 LLM 调用时的 messages（压缩后已处理的版本）
      _streamChatOverride: createCapturingMockStreamChat(
        [{ content: 'F08 任务完成，preamble 已验证' }],
        captured,
      ),
    }
  },

  graders: [
    makeTerminalReasonGrader('completed'),
    preambleGrader,
  ],
}

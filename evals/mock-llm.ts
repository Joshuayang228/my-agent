/**
 * Mock LLM 实现 — 脚本 LLM（预设响应序列）
 *
 * 接受 MockTurn[] 序列，每次调用消费下一条。
 * 用于 eval 场景的确定性测试：零 API 消耗，完全可重现。
 *
 * 使用方式：
 *   const mock = createMockStreamChat(turns)
 *   // 注入 agentLoop options._streamChatOverride
 */

import type { AgentStreamEvent } from '../src/shared/types'
import type { StreamChatResult } from '../electron/main/llm/index'
import type { MockTurn } from './types'

let _callCounter = 0

/**
 * 工厂函数，返回一个符合 streamChat 签名的 mock 函数。
 * 每次调用消费 turns 数组里的下一条 MockTurn；超出范围时
 * 默认返回一个空文本回复，防止 loop 因 LLM 失败而异常退出。
 */
export function createMockStreamChat(turns: MockTurn[]) {
  let idx = 0

  return async function* mockStreamChat(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: unknown,
  ): AsyncGenerator<AgentStreamEvent, StreamChatResult> {
    _callCounter++
    const turn = turns[idx++] ?? { content: '[mock end]', toolCalls: [] }

    // 先 yield 文本 delta（如有）
    if (turn.content) {
      yield { type: 'text', content: turn.content }
    }

    // 如果有工具调用，yield streaming tool_call_delta（简化版：直接 yield tool_calls）
    const toolCalls = (turn.toolCalls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: JSON.stringify(tc.arguments),
    }))

    const result: StreamChatResult = {
      content: turn.content ?? null,
      toolCalls,
      usage: {
        promptTokens: turn.usage?.promptTokens ?? 10,
        completionTokens: turn.usage?.completionTokens ?? 5,
      },
      stopReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    }

    return result
  }
}

/** 重置调用计数（每个场景开始前调用） */
export function resetMockCounter() {
  _callCounter = 0
}

/** 获取 mock 被调用的次数（用于断言 LLM 调用次数） */
export function getMockCallCount() {
  return _callCounter
}

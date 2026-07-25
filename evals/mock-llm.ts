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

/**
 * 消息捕获接口 — 记录每次 LLM 调用时传入的 messages
 */
export interface CapturedLLMCall {
  messages: import('../src/shared/types').ChatMessage[]
  turnIndex: number
}

/**
 * createCapturingMockStreamChat — 在 createMockStreamChat 基础上，
 * 在每次调用时把 messages 记录进 captured，供断言压缩后 preamble 是否保留。
 *
 * 用法（F08 场景）：
 *   const captured: { calls: CapturedLLMCall[] } = { calls: [] }
 *   const mock = createCapturingMockStreamChat(turns, captured)
 *   // buildOptions 返回 _streamChatOverride: mock
 *   // grader 通过 captured 读取调用历史
 */
export function createCapturingMockStreamChat(
  turns: MockTurn[],
  captured: { calls: CapturedLLMCall[] },
) {
  let callIdx = 0
  const baseFn = createMockStreamChat(turns)

  // 必须手动 forward 而非 yield*，以保证 AsyncGenerator 的 return value 正确传播
  return async function* capturingMock(options: unknown): AsyncGenerator<import('../src/shared/types').AgentStreamEvent, import('../electron/main/llm/index').StreamChatResult> {
    const opts = options as { messages: import('../src/shared/types').ChatMessage[] }
    callIdx++
    // 拷贝一份：loop 内部可能会修改 messages 数组
    captured.calls.push({ messages: [...opts.messages], turnIndex: callIdx })

    const gen = baseFn(options)
    let step = await gen.next()
    while (!step.done) {
      yield step.value as import('../src/shared/types').AgentStreamEvent
      step = await gen.next()
    }
    return step.value as import('../electron/main/llm/index').StreamChatResult
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

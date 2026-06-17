import { describe, it, expect } from 'vitest'
import { estimateTokens, compressContext } from '../../electron/main/agent/context-manager'
import type { ChatMessage } from '../../src/shared/types'

function msg(role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: Date.now(),
    ...extra,
  }
}

describe('estimateTokens', () => {
  it('空消息列表返回 0', () => {
    expect(estimateTokens([])).toBe(0)
  })

  it('短消息估算合理（每条 = ceil(len/2.5) + 4）', () => {
    const messages = [msg('user', 'hello')]
    const tokens = estimateTokens(messages)
    // "hello" = 5 chars → ceil(5/2.5) + 4 = 2 + 4 = 6
    expect(tokens).toBe(6)
  })

  it('带 toolCalls 的消息额外计算参数 token', () => {
    const messages = [msg('assistant', '', {
      toolCalls: [{ id: 'tc1', name: 'echo', arguments: '{"text":"hi"}' }],
    })]
    const tokens = estimateTokens(messages)
    // content "" → ceil(0/2.5) + 4 = 4
    // toolCall arguments 13 chars → ceil(13/3) + 10 = 5 + 10 = 15
    expect(tokens).toBe(4 + 15)
  })
})

describe('compressContext', () => {
  it('短对话不压缩', async () => {
    const messages = [
      msg('system', 'You are helpful'),
      msg('user', 'Hi'),
      msg('assistant', 'Hello'),
    ]

    const result = await compressContext(messages)
    expect(result).toHaveLength(3)
    expect(result[0].role).toBe('system')
  })

  it('system prompt 永远保留', async () => {
    const system = msg('system', 'Important system prompt')
    const filler = Array.from({ length: 50 }, (_, i) =>
      msg(i % 2 === 0 ? 'user' : 'assistant', 'x'.repeat(500)))

    const messages = [system, ...filler]
    const result = await compressContext(messages, { maxTokens: 500 })

    expect(result[0].id).toBe(system.id)
    expect(result[0].content).toBe(system.content)
  })

  it('L1 Snip 删除早期工具调用轮次', async () => {
    const system = msg('system', 'sys')
    const toolCallMsg = msg('assistant', '', {
      toolCalls: [{ id: 'tc1', name: 'echo', arguments: '{}' }],
    })
    const toolResult = msg('tool', 'result', { toolCallId: 'tc1' })
    const recent = Array.from({ length: 7 }, (_, i) =>
      msg(i % 2 === 0 ? 'user' : 'assistant', 'recent message'))

    const messages = [system, toolCallMsg, toolResult, ...recent]
    const result = await compressContext(messages, { maxTokens: 80 })

    const hasToolCall = result.some(m => m.role === 'assistant' && m.toolCalls?.length)
    const hasToolResult = result.some(m => m.role === 'tool' && m.toolCallId === 'tc1')
    expect(hasToolCall).toBe(false)
    expect(hasToolResult).toBe(false)
  })

  it('L3 Collapse 生成摘要占位符并保留近期消息', async () => {
    const system = msg('system', 'sys')
    const old = Array.from({ length: 30 }, (_, i) =>
      msg(i % 2 === 0 ? 'user' : 'assistant', 'x'.repeat(2000)))
    const recent = Array.from({ length: 3 }, (_, i) =>
      msg('user', 'recent'))

    const messages = [system, ...old, ...recent]
    const result = await compressContext(messages, { maxTokens: 2000 })

    const hasSummary = result.some(m => m.content.includes('[Context compressed'))
    expect(hasSummary).toBe(true)
    expect(result[0].role).toBe('system')
    expect(result.length).toBeLessThan(messages.length)
  })
})

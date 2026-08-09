import { describe, expect, it } from 'vitest'
import {
  buildConversationDebugCalls,
  formatTokenK,
  formatDuration,
  parseConversationDebugMode,
  tokenUsageRatio,
} from '../../src/components/chat/conversation-debug'

describe('conversation-debug helpers', () => {
  it('parseConversationDebugMode', () => {
    expect(parseConversationDebugMode('true')).toBe(true)
    expect(parseConversationDebugMode('1')).toBe(true)
    expect(parseConversationDebugMode('false')).toBe(false)
    expect(parseConversationDebugMode('')).toBe(false)
    expect(parseConversationDebugMode(undefined)).toBe(false)
  })

  it('tokenUsageRatio', () => {
    expect(tokenUsageRatio(500, 500, 2000)).toBe(0.5)
    expect(tokenUsageRatio(3000, 0, 2000)).toBe(1)
    expect(tokenUsageRatio(100, 0, 0)).toBe(0)
  })

  it('formatTokenK', () => {
    expect(formatTokenK(420)).toBe('420')
    expect(formatTokenK(1500)).toBe('1.5k')
  })

  it('formatDuration', () => {
    expect(formatDuration(420)).toBe('420ms')
    expect(formatDuration(1500)).toBe('1.5s')
  })

  it('将流式事件聚合为 LLM 调用链', () => {
    const events = [
      { time: 100, type: 'thinking', detail: '...' },
      { time: 120, type: 'usage', detail: 'in:1200 out:80' },
      { time: 130, type: 'tool_start', detail: 'file_read(path)' },
      { time: 140, type: 'tool_end', detail: 'file_read → OK' },
      { time: 200, type: 'text', detail: 'done' },
      { time: 220, type: 'usage', detail: 'in:800 out:40' },
      { time: 230, type: 'done', detail: '' },
    ]
    const calls = buildConversationDebugCalls(events, 'openai/gpt-4o')

    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      model: 'openai/gpt-4o',
      status: 'success',
      promptTokens: 1200,
      completionTokens: 80,
      durationMs: 20,
      toolNames: ['file_read'],
    })
    expect(calls[1]).toMatchObject({
      status: 'success',
      promptTokens: 800,
      completionTokens: 40,
      durationMs: 20,
    })
  })

  it('没有 usage 时也能保留失败调用', () => {
    const calls = buildConversationDebugCalls([
      { time: 100, type: 'thinking', detail: '...' },
      { time: 160, type: 'error', detail: '请求失败' },
    ], 'deepseek/deepseek-chat')

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      status: 'error',
      error: '请求失败',
      durationMs: 60,
    })
  })
})

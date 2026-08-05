import { describe, expect, it } from 'vitest'
import {
  filterDebugEvents,
  formatTokenK,
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

  it('filterDebugEvents 优先保留调试相关类型', () => {
    const events = [
      { type: 'text', detail: 'hi' },
      { type: 'tool_start', detail: 'ls' },
      { type: 'usage', detail: 'in:1' },
      { type: 'thinking', detail: '...' },
    ]
    const filtered = filterDebugEvents(events)
    expect(filtered.map((e) => e.type)).toEqual(['tool_start', 'usage'])
  })
})

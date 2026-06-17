import { describe, it, expect } from 'vitest'
import {
  sanitizeMessages,
  sanitizeToolCallPairs,
  removeOrphanToolResults,
  mergeConsecutiveRoles,
} from '../../electron/main/agent/message-pipeline'
import type { ChatMessage } from '../../src/shared/types'

function msg(role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id: `${role}-${Date.now()}-${Math.random()}`, role, content, timestamp: Date.now(), ...extra }
}

describe('sanitizeToolCallPairs', () => {
  it('正常 toolCall + tool 对不变', () => {
    const messages: ChatMessage[] = [
      msg('user', 'hi'),
      msg('assistant', '', { toolCalls: [{ id: 'tc1', name: 'echo', arguments: '{}' }] }),
      msg('tool', 'result', { toolCallId: 'tc1' }),
    ]
    const result = sanitizeToolCallPairs(messages)
    expect(result).toHaveLength(3)
  })

  it('孤儿 toolCall 补充占位 tool 消息', () => {
    const messages: ChatMessage[] = [
      msg('user', 'hi'),
      msg('assistant', '', { toolCalls: [{ id: 'tc1', name: 'echo', arguments: '{}' }] }),
      msg('user', 'next'),
    ]
    const result = sanitizeToolCallPairs(messages)
    expect(result.some(m => m.role === 'tool' && m.toolCallId === 'tc1')).toBe(true)
  })
})

describe('removeOrphanToolResults', () => {
  it('移除没有对应 toolCall 的 tool 消息', () => {
    const messages: ChatMessage[] = [
      msg('user', 'hi'),
      msg('tool', 'orphan result', { toolCallId: 'tc-nonexistent' }),
      msg('assistant', 'reply'),
    ]
    const result = removeOrphanToolResults(messages)
    expect(result.some(m => m.role === 'tool')).toBe(false)
  })

  it('保留有对应 toolCall 的 tool 消息', () => {
    const messages: ChatMessage[] = [
      msg('assistant', '', { toolCalls: [{ id: 'tc1', name: 'echo', arguments: '{}' }] }),
      msg('tool', 'result', { toolCallId: 'tc1' }),
    ]
    const result = removeOrphanToolResults(messages)
    expect(result).toHaveLength(2)
  })
})

describe('mergeConsecutiveRoles', () => {
  it('合并连续的同角色消息', () => {
    const messages: ChatMessage[] = [
      msg('user', 'hello'),
      msg('user', 'world'),
      msg('assistant', 'hi'),
    ]
    const result = mergeConsecutiveRoles(messages)
    expect(result).toHaveLength(2)
    expect(result[0].content).toContain('hello')
    expect(result[0].content).toContain('world')
  })

  it('不合并 tool 和 system 消息', () => {
    const messages: ChatMessage[] = [
      msg('system', 'a'),
      msg('system', 'b'),
    ]
    const result = mergeConsecutiveRoles(messages)
    expect(result).toHaveLength(2)
  })
})

describe('sanitizeMessages', () => {
  it('完整管道处理正常消息不出错', () => {
    const messages: ChatMessage[] = [
      msg('user', 'hi'),
      msg('assistant', 'hello'),
      msg('user', 'bye'),
    ]
    const result = sanitizeMessages(messages)
    expect(result).toHaveLength(3)
  })

  it('空消息数组返回空', () => {
    expect(sanitizeMessages([])).toHaveLength(0)
  })
})

/**
 * Debug 世界态快照：截断助手
 */
import { describe, expect, it } from 'vitest'
import { __test } from '../../electron/main/agent/debug-world-snapshot'

describe('debug-world-snapshot clip', () => {
  it('短文本原样返回', () => {
    expect(__test.clip('hello', 10)).toBe('hello')
  })

  it('超长截断并加省略号', () => {
    expect(__test.clip('abcdefghij', 5)).toBe('abcde…')
  })

  it('限制常量合理', () => {
    expect(__test.MEMORY_LIMIT).toBeLessThanOrEqual(50)
    expect(__test.MOMENT_LIMIT).toBeLessThanOrEqual(20)
    expect(__test.SLOT_LIMIT).toBeLessThanOrEqual(24)
    expect(__test.EVENT_LIMIT).toBeLessThanOrEqual(50)
  })

  it('世界态快照过滤其他人物反馈，并保留共享记忆范围', () => {
    expect(__test.filterMemoriesForRole([
      { id: 'shared', category: 'fact', content: '共享', updatedAt: 1 },
      { id: 'current', category: 'feedback', content: '当前', updatedAt: 2, roleId: 'luffy' },
      { id: 'other', category: 'feedback', content: '其他', updatedAt: 3, roleId: 'zoro' },
    ], 'luffy')).toEqual([
      expect.objectContaining({ id: 'shared', scope: 'shared' }),
      expect.objectContaining({ id: 'current', scope: 'role' }),
    ])
  })
})

import { describe, expect, it, beforeEach } from 'vitest'
import {
  _resetSessionFileChangesForTests,
  clearSessionFileChanges,
  listSessionFileChanges,
  recordSessionFileChange,
} from '../../electron/main/agent/session-file-changes'
import { formatUnifiedDiff } from '../../electron/main/utils/simple-diff'

describe('session-file-changes', () => {
  beforeEach(() => {
    _resetSessionFileChangesForTests()
  })

  it('按 path 去重并保留最近一次', () => {
    recordSessionFileChange('s1', { path: '/a.ts', toolName: 'file_write', before: null })
    recordSessionFileChange('s1', { path: '/a.ts', toolName: 'file_edit', before: 'old' })
    const list = listSessionFileChanges('s1')
    expect(list).toHaveLength(1)
    expect(list[0].toolName).toBe('file_edit')
    expect(list[0].before).toBe('old')
  })

  it('clear 清空会话', () => {
    recordSessionFileChange('s1', { path: '/a.ts', toolName: 'file_write', before: null })
    clearSessionFileChanges('s1')
    expect(listSessionFileChanges('s1')).toEqual([])
  })
})

describe('formatUnifiedDiff', () => {
  it('新文件全加号', () => {
    const d = formatUnifiedDiff('n.md', null, 'hello')
    expect(d).toContain('+++ n.md')
    expect(d).toContain('+hello')
  })


  it('大行数乘积不会构造超大 LCS 矩阵，而是退化为内容节选', () => {
    const before = Array.from({ length: 1200 }, (_, i) => `old-${i}`).join('\n')
    const after = Array.from({ length: 1200 }, (_, i) => `new-${i}`).join('\n')
    const d = formatUnifiedDiff('large.txt', before, after)
    expect(d).toContain('省略逐行 diff')
    expect(d).toContain('new-0')
  })

  it('简单替换', () => {
    const d = formatUnifiedDiff('a.ts', 'a\nb\n', 'a\nc\n')
    expect(d).toContain('-b')
    expect(d).toContain('+c')
    expect(d).toContain(' a')
  })
})

import { describe, expect, it } from 'vitest'
import { formatCompanionStatusSummary } from '../../electron/main/companion/orchestrator'

describe('companion status summary', () => {
  it('uses narrative state and relationship without exposing numeric attributes', () => {
    const summary = formatCompanionStatusSummary({
      world: { mood: 82, energy: 38, socialNeed: 75 },
      relationships: [{ subjectId: 'user', phase: 'rapport', note: '最近一起完成了一件事' }],
      emotions: [{ label: '期待', note: '未展示内部笔记' }],
    })
    expect(summary).toContain('明亮有劲')
    expect(summary).toContain('需要缓一缓')
    expect(summary).toContain('已经很有默契')
    expect(summary).toContain('最近有些期待')
    expect(summary).not.toMatch(/\d+\/100/)
    expect(summary).not.toContain('未展示内部笔记')
  })

  it('does not invent a current status when runtime facts are absent', () => {
    expect(formatCompanionStatusSummary({ world: undefined, relationships: [], emotions: [] })).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { worldSnapshotIssue } from '../../src/components/debug/world-snapshot'

describe('世界快照诊断差异', () => {
  it('只比较解析投影已有字段，不修改保存值，也不对相同值补警告', () => {
    const parsed = Object.freeze({ currentLocation: '书房', statusTags: ['阅读'] })
    const stored = Object.freeze({ statusTags: ['阅读'], currentLocation: '书房', extra: '原始额外字段' })
    expect(worldSnapshotIssue(parsed, stored)).toBeUndefined()
    expect(stored.extra).toBe('原始额外字段')
  })
  it('缺字段或实际值差异提示核对，不替用户推断回退原因', () => {
    expect(worldSnapshotIssue({ currentLocation: '未设定' }, { schemaVersion: 0, currentLocation: '旧地点' })).toContain('保存值与运行时解析快照存在差异')
    expect(worldSnapshotIssue({ currentActivity: '' }, {})).toContain('请展开完整来源核对')
  })
  it('保留主进程已经报告的解析提示', () => {
    expect(worldSnapshotIssue({}, '存储世界 JSON 不可解析')).toBe('存储世界 JSON 不可解析')
    expect(worldSnapshotIssue(undefined, undefined)).toBeUndefined()
  })
})

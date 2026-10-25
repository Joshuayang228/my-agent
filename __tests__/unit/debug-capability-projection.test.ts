import { describe, it, expect } from 'vitest'
import { capabilityRecords } from '../../src/components/debug/DebugCapabilitiesContent'

describe('能力读取按来源投影', () => {
  it('同名定义保留独立稳定身份，注册不升级为当前可用', () => {
    const tool = { name: 'same', description: '工具', parameters: { type: 'object' }, metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true } }
    const records = capabilityRecords([tool], { skills: { total: 1, items: [{ name: 'same', source: 'builtin', description: '技能' }], truncated: false }, mcp: [{ id: 'same', name: 'same', status: 'error', toolCount: 0, error: '无法连接' }] })
    expect(records.map(record => record.id)).toEqual(['tool:same', 'skill:same', 'mcp:same'])
    expect(records[0].status).toBe('已注册')
    expect(records[0].schema).toEqual(tool.parameters)
    expect(records[0].metadata).toEqual(tool.metadata)
    expect(records[2].detail).toContain('工具数量未知')
    expect(records[2].detail).not.toContain('0 个工具')
    expect(records[2].status).toBe('连接失败')
    expect(records.every(record => !record.usage)).toBe(true)
  })
  it('来源未读取时不伪造条目或可用性', () => {
    expect(capabilityRecords(null, null)).toEqual([])
    expect(capabilityRecords([], null)).toEqual([])
    const records = capabilityRecords(null, { skills: { total: 0, items: [], truncated: false }, mcp: [{ id: 'ready', name: '已连接来源', status: 'connected', toolCount: 0 }] })
    expect(records).toHaveLength(1)
    expect(records[0].detail).toBe('0 个工具')
  })
})

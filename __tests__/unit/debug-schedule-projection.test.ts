import { describe, it, expect } from 'vitest'
import type { DebugEvidenceRecord } from '../../src/shared/debug-evidence'
import { projectScheduleSlots } from '../../src/components/debug/schedule-projection'

const day = (slots: unknown, source = 'days'): DebugEvidenceRecord => ({ id: 'same-day', source, roleId: 'lin', kind: 'day', title: '计划', body: '', time: 99, status: 'published', truncated: false, links: [], data: { payload: { slots } } })
describe('正式日程时段投影', () => {
  it('按真实时钟排序副本，同名来源与原数组位置不混为事件身份', () => {
    const record = day([{ hour: 14, minute: 30, activity: '午后', location: '书房' }, { hour: 9, minute: 15, activity: '早间', location: '阳台' }])
    const before = JSON.stringify(record)
    const result = projectScheduleSlots([record, day([{ hour: 11, minute: 0, activity: '另一来源' }], 'other')])
    expect(result.slots.map(slot => slot.time)).toEqual(['09:15', '11:00', '14:30'])
    expect(result.slots[0].index).toBe(1)
    expect(new Set(result.slots.map(slot => slot.id)).size).toBe(3)
    expect(JSON.stringify(record)).toBe(before)
    expect(result.slots[0]).not.toHaveProperty('eventId')
    expect(result.slots[0]).not.toHaveProperty('executionStatus')
  })
  it('坏数组、缺字段、空数组分开；异常项与原文保留，不补时间', () => {
    expect(projectScheduleSlots([day({ wrong: true })]).issues).toEqual([expect.stringContaining('不是数组')])
    const missing = day([]); missing.data = { payload: {} }
    expect(projectScheduleSlots([missing]).issues[0]).toContain('字段未提供')
    expect(projectScheduleSlots([day([])])).toEqual({ issues: [], slots: [] })
    const result = projectScheduleSlots([day([{ hour: 25, minute: 1, activity: '坏时间' }, null, { hour: 10, activity: '缺分钟' }])])
    expect(result.slots).toHaveLength(3)
    expect(result.slots[0].time).toBe('10:00')
    expect(result.slots[0].notice).toContain('执行默认值 00')
    expect(result.slots[1].time).toBe('时间未记录')
    expect(result.slots[1].notice).toContain('时间字段异常')
    expect(result.slots[2].slot).toBeNull()
  })
  it('位置内容变更后签名不同，不能把新时段当作原选中项', () => {
    const first = projectScheduleSlots([day([{ hour: 9, minute: 0, activity: '原计划' }])]).slots[0]
    const next = projectScheduleSlots([day([{ hour: 9, minute: 0, activity: '新计划' }])]).slots[0]
    expect(first.id).toBe(next.id)
    expect(first.signature).not.toBe(next.signature)
  })
})

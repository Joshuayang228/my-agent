import { describe, expect, it } from 'vitest'
import { snapshotTime } from '../../src/components/debug/NowStateReading'

describe('当前快照时间边界', () => {
  it('缺失、零值、非有限及越界日期不显示为有效世界更新时间', () => {
    for (const value of [undefined, null, 0, -1, NaN, Infinity, 1e20, '1792908000000']) expect(snapshotTime(value, 'Asia/Shanghai')).toBe('未记录')
    expect(snapshotTime(Date.parse('2026-10-25T06:32:00Z'), 'Asia/Shanghai')).toBe('2026/10/25 14:32')
  })
})

import { describe, expect, it } from 'vitest'
import { previewTripDates, TRAVEL_PREVIEWS, visiblePreviewTrips } from '../../src/components/playground/FootprintsExperienceCandidate'

describe('足迹隔离旅行候选', () => {
  it('只展示实际出发的旅行，不把计划与取消变成历史', () => {
    expect(visiblePreviewTrips(TRAVEL_PREVIEWS).map(item => item.id)).toEqual(['weekend', 'day', 'multi'])
    expect(visiblePreviewTrips([{ ...TRAVEL_PREVIEWS[0], start: null }])).toEqual([])
  })
  it('进行中优先但不修改输入，普通旅行按实际出发日期倒序', () => {
    const input = [...TRAVEL_PREVIEWS, { ...TRAVEL_PREVIEWS[2], id: 'active', status: 'active' as const, end: null }]
    expect(visiblePreviewTrips(input)[0].id).toBe('active')
    expect(input[0].id).toBe('weekend')
  })
  it('单日日期只写一次，进行中不使用预计结束日期', () => {
    expect(previewTripDates(TRAVEL_PREVIEWS[1])).toBe('2026-09-12')
    expect(previewTripDates({ ...TRAVEL_PREVIEWS[0], status: 'active' })).toBe('2026-09-26 至今')
    expect(previewTripDates(TRAVEL_PREVIEWS[3])).toBe('')
  })
  it('多城市与重复停留属于同一旅行，而非首页独立地点', () => {
    expect(TRAVEL_PREVIEWS[2].stops).toHaveLength(2)
    expect(TRAVEL_PREVIEWS[0].stops.filter(stop => stop.name === '老城街巷')).toHaveLength(2)
  })
})

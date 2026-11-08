/**
 * 今日生活轨迹（Today Timeline）单测
 *
 * 覆盖：
 * 1. getTodayTimelineForRole 数据结构与时段状态（past / current / upcoming）计算
 * 2. 槽位时间戳与关联事件/动态 ID 解析
 * 3. currentSlotIndex 当前进行中槽位推导
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getTodayTimelineForRole } from '../../electron/main/companion/life/timeline'
import { WorldTodayTimeline } from '../../src/components/world/WorldTodayTimeline'
import * as store from '../../electron/main/companion/life/store'
import { localDateTimeMs } from '../../electron/main/companion/life/dates'

vi.mock('../../electron/main/companion/life/store', () => ({
  getDayScript: vi.fn(),
  listEvents: vi.fn(),
  getMomentByEventId: vi.fn(),
}))

vi.mock('../../electron/main/companion/life/engine', () => ({
  ensureDayScripts: vi.fn(),
}))

describe('今日生活轨迹服务 (Today Timeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('根据传入的固定时间正确计算 past, current, upcoming 状态与时段列表', async () => {
    const roleId = 'luffy'
    const today = '2026-11-08'
    // 假设当前时间是 2026-11-08 12:30:00 (处于 12:00 ~ 15:00 槽位之间)
    const mockNow = localDateTimeMs(today, 12, 30)

    vi.mocked(store.getDayScript).mockResolvedValue({
      id: 'script-1',
      roleId,
      date: today,
      createdAt: 1000,
      payload: {
        date: today,
        theme: '航向天空之海的一天',
        slots: [
          { hour: 8, minute: 0, activity: '晨间瞭望', mood: '期待', location: '瞭望台', type: 'activity' },
          { hour: 12, minute: 0, activity: '烤肉午宴', mood: '大满足', location: '甲板厨房', type: 'moment' },
          { hour: 15, minute: 0, activity: '练习橡胶枪', mood: '专注', location: '前甲板', type: 'activity' },
          { hour: 19, minute: 0, activity: '晚间看夕阳', mood: '惬意', location: '船头狮子头', type: 'moment' },
        ],
      },
    })

    vi.mocked(store.listEvents).mockResolvedValue([
      {
        id: 'event-1',
        roleId,
        scheduledAt: localDateTimeMs(today, 8, 0),
        status: 'published',
        type: 'activity',
        payload: { activity: '晨间瞭望', location: '瞭望台' },
        dayScriptId: 'script-1',
      },
      {
        id: 'event-2',
        roleId,
        scheduledAt: localDateTimeMs(today, 12, 0),
        status: 'published',
        type: 'moment',
        payload: { activity: '烤肉午宴', location: '甲板厨房' },
        dayScriptId: 'script-1',
      },
      {
        id: 'event-3',
        roleId,
        scheduledAt: localDateTimeMs(today, 15, 0),
        status: 'planned',
        type: 'activity',
        payload: { activity: '练习橡胶枪', location: '前甲板' },
        dayScriptId: 'script-1',
      },
    ])

    vi.mocked(store.getMomentByEventId).mockImplementation(async (_roleId, eventId) => {
      if (eventId === 'event-2') {
        return {
          id: 'moment-meat-feast',
          roleId,
          eventId: 'event-2',
          text: '今天吃到了山治做的大块带骨烤肉！太棒了！',
          publishedAt: localDateTimeMs(today, 12, 5),
          meta: {},
        }
      }
      return null
    })

    const timeline = await getTodayTimelineForRole(roleId, mockNow)

    expect(timeline.roleId).toBe('luffy')
    expect(timeline.date).toBe(today)
    expect(timeline.theme).toBe('航向天空之海的一天')
    expect(timeline.slots).toHaveLength(4)

    // 08:00 槽位 (now > 12:00 -> past)
    expect(timeline.slots[0].timeStr).toBe('08:00')
    expect(timeline.slots[0].status).toBe('past')
    expect(timeline.slots[0].eventId).toBe('event-1')

    // 12:00 槽位 (12:00 <= mockNow 12:30 < 15:00 -> current)
    expect(timeline.slots[1].timeStr).toBe('12:00')
    expect(timeline.slots[1].status).toBe('current')
    expect(timeline.slots[1].activity).toBe('烤肉午宴')
    expect(timeline.slots[1].eventId).toBe('event-2')
    expect(timeline.slots[1].momentId).toBe('moment-meat-feast')

    // 15:00 槽位 (mockNow 12:30 < 15:00 -> upcoming)
    expect(timeline.slots[2].timeStr).toBe('15:00')
    expect(timeline.slots[2].status).toBe('upcoming')

    // 19:00 槽位 (upcoming)
    expect(timeline.slots[3].timeStr).toBe('19:00')
    expect(timeline.slots[3].status).toBe('upcoming')

    // currentSlotIndex 应该指向 index 1 (12:00 进行中槽位)
    expect(timeline.currentSlotIndex).toBe(1)
  })

  it('若当日剧本缺失，则自动回退至确定性剧本生成', async () => {
    const roleId = 'luffy'
    const today = '2026-11-08'
    const mockNow = localDateTimeMs(today, 7, 0) // 早晨 7 点，所有槽位 upcoming

    vi.mocked(store.getDayScript).mockResolvedValue(null)
    vi.mocked(store.listEvents).mockResolvedValue([])

    const timeline = await getTodayTimelineForRole(roleId, mockNow)

    expect(timeline.roleId).toBe('luffy')
    expect(timeline.theme).toBeTruthy()
    expect(timeline.slots.length).toBeGreaterThanOrEqual(4)
    expect(timeline.slots[0].status).toBe('upcoming')
    expect(timeline.currentSlotIndex).toBe(0)
  })

  it('WorldTodayTimeline 组件静态渲染正确呈现今日主题与当前进行中槽位及和TA聊聊入口', () => {
    const mockTimeline = {
      roleId: 'luffy',
      date: '2026-11-08',
      theme: '航向天空之海的一天',
      currentSlotIndex: 1,
      slots: [
        { hour: 8, minute: 0, timeStr: '08:00', activity: '晨间瞭望', mood: '期待', location: '瞭望台', type: 'activity' as const, status: 'past' as const, scheduledAt: 1000 },
        { hour: 12, minute: 0, timeStr: '12:00', activity: '烤肉午宴', mood: '大满足', location: '甲板厨房', type: 'moment' as const, status: 'current' as const, scheduledAt: 2000, momentId: 'm-1' },
      ],
    }

    const html = renderToStaticMarkup(createElement(WorldTodayTimeline, {
      initialTimeline: mockTimeline,
      onTakeToChat: () => {},
    }))

    expect(html).toContain('今日轨迹 · 《航向天空之海的一天》')
    expect(html).toContain('12:00 烤肉午宴')
    expect(html).toContain('聊聊此刻')
    expect(html).toContain('全天日程')
  })
})

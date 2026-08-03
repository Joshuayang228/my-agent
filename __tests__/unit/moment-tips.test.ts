/**
 * M31-G1 / M31-G2：新 Moment 轻提示决策
 */
import { describe, expect, it } from 'vitest'
import {
  decideMomentTip,
  formatMomentTipToast,
  isInQuietHours,
  MOMENT_TIP_MIN_INTERVAL_MS,
  parseDayTipStats,
  parseMaxPerDay,
  tipsSentToday,
} from '../../electron/main/companion/life/moment-tips'

describe('decideMomentTip', () => {
  const base = {
    muted: false,
    published: 1,
    lastAt: 0,
    now: 1_000_000,
    hasMoment: true,
    localHour: 12,
    quietStartHour: 22,
    quietEndHour: 8,
    tipsSentToday: 0,
    maxPerDay: 3,
  }

  it('允许：有发布、未静音、无冷却', () => {
    expect(decideMomentTip(base)).toEqual({ allow: true, reason: 'ok' })
  })

  it('静音时拒绝', () => {
    expect(decideMomentTip({ ...base, muted: true })).toEqual({
      allow: false,
      reason: 'muted',
    })
  })

  it('无发布时拒绝', () => {
    expect(decideMomentTip({ ...base, published: 0 })).toEqual({
      allow: false,
      reason: 'no-publish',
    })
  })

  it('无 Moment 文案时拒绝', () => {
    expect(decideMomentTip({ ...base, hasMoment: false })).toEqual({
      allow: false,
      reason: 'no-moment',
    })
  })

  it('冷却期内拒绝', () => {
    const r = decideMomentTip({
      ...base,
      lastAt: base.now - MOMENT_TIP_MIN_INTERVAL_MS + 1,
    })
    expect(r).toEqual({ allow: false, reason: 'cooldown' })
  })

  it('冷却过后允许', () => {
    const r = decideMomentTip({
      ...base,
      lastAt: base.now - MOMENT_TIP_MIN_INTERVAL_MS,
    })
    expect(r.allow).toBe(true)
  })

  it('勿扰时段拒绝（深夜）', () => {
    expect(decideMomentTip({ ...base, localHour: 23 })).toEqual({
      allow: false,
      reason: 'quiet-hours',
    })
  })

  it('勿扰时段拒绝（清晨）', () => {
    expect(decideMomentTip({ ...base, localHour: 7 })).toEqual({
      allow: false,
      reason: 'quiet-hours',
    })
  })

  it('日预算用尽拒绝', () => {
    expect(decideMomentTip({ ...base, tipsSentToday: 3, maxPerDay: 3 })).toEqual({
      allow: false,
      reason: 'daily-budget',
    })
  })

  it('maxPerDay=0 不限条数', () => {
    expect(
      decideMomentTip({ ...base, tipsSentToday: 99, maxPerDay: 0 }).allow,
    ).toBe(true)
  })
})

describe('isInQuietHours', () => {
  it('跨午夜窗', () => {
    expect(isInQuietHours(22, 22, 8)).toBe(true)
    expect(isInQuietHours(3, 22, 8)).toBe(true)
    expect(isInQuietHours(8, 22, 8)).toBe(false)
    expect(isInQuietHours(12, 22, 8)).toBe(false)
  })

  it('同日窗', () => {
    expect(isInQuietHours(13, 12, 14)).toBe(true)
    expect(isInQuietHours(14, 12, 14)).toBe(false)
  })

  it('起止相同关闭勿扰', () => {
    expect(isInQuietHours(22, 22, 22)).toBe(false)
  })
})

describe('day stats helpers', () => {
  it('parseDayTipStats + tipsSentToday', () => {
    const s = parseDayTipStats('{"day":"2026-08-03","count":2}')
    expect(s).toEqual({ day: '2026-08-03', count: 2 })
    expect(tipsSentToday(s, '2026-08-03')).toBe(2)
    expect(tipsSentToday(s, '2026-08-04')).toBe(0)
  })

  it('parseMaxPerDay', () => {
    expect(parseMaxPerDay('5')).toBe(5)
    expect(parseMaxPerDay('')).toBe(3)
  })
})

describe('formatMomentTipToast', () => {
  it('单条带预览', () => {
    expect(
      formatMomentTipToast({
        roleName: '小林',
        preview: '午后在咖啡馆改稿',
        published: 1,
      }),
    ).toBe('小林有新动态：午后在咖啡馆改稿')
  })

  it('多条汇总', () => {
    expect(
      formatMomentTipToast({
        roleName: '小林',
        preview: '最近一条',
        published: 3,
      }),
    ).toBe('小林有 3 条新动态，最近：最近一条')
  })
})

/**
 * M31-G1：新 Moment 轻提示决策
 */
import { describe, expect, it } from 'vitest'
import {
  decideMomentTip,
  formatMomentTipToast,
  MOMENT_TIP_MIN_INTERVAL_MS,
} from '../../electron/main/companion/life/moment-tips'

describe('decideMomentTip', () => {
  const base = {
    muted: false,
    published: 1,
    lastAt: 0,
    now: 1_000_000,
    hasMoment: true,
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

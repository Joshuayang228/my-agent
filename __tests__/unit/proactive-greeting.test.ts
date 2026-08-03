/**
 * M31-G3：定时主动问候决策
 */
import { describe, expect, it } from 'vitest'
import {
  decideProactiveGreeting,
  formatProactiveGreetingToast,
} from '../../electron/main/companion/life/proactive-greeting'

const base = {
  enabled: true,
  muted: false,
  localHour: 14,
  quietStartHour: 22,
  quietEndHour: 8,
  lastGreetingDay: '',
  today: '2026-08-03',
  hasFreshMoment: true,
}

describe('decideProactiveGreeting', () => {
  it('允许：开启且有近 Moment', () => {
    expect(decideProactiveGreeting(base)).toEqual({ allow: true, reason: 'ok' })
  })

  it('默认关闭时拒绝', () => {
    expect(decideProactiveGreeting({ ...base, enabled: false })).toEqual({
      allow: false,
      reason: 'disabled',
    })
  })

  it('静音时拒绝', () => {
    expect(decideProactiveGreeting({ ...base, muted: true })).toEqual({
      allow: false,
      reason: 'muted',
    })
  })

  it('勿扰时段拒绝', () => {
    expect(decideProactiveGreeting({ ...base, localHour: 23 })).toEqual({
      allow: false,
      reason: 'quiet-hours',
    })
  })

  it('当日已问候拒绝', () => {
    expect(
      decideProactiveGreeting({ ...base, lastGreetingDay: '2026-08-03' }),
    ).toEqual({ allow: false, reason: 'already-today' })
  })

  it('无近 Moment 拒绝（禁止空喊）', () => {
    expect(decideProactiveGreeting({ ...base, hasFreshMoment: false })).toEqual({
      allow: false,
      reason: 'no-fresh-moment',
    })
  })
})

describe('formatProactiveGreetingToast', () => {
  it('挂在动态预览上', () => {
    expect(
      formatProactiveGreetingToast({
        roleName: '小林',
        preview: '午后改稿',
      }),
    ).toContain('午后改稿')
  })
})

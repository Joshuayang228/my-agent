import { describe, expect, it } from 'vitest'
import { resolveMomentVisibilityDays } from '../../electron/main/companion/life/moment-visibility'

describe('moment visibility', () => {
  it('private hides moments completely', () => {
    expect(resolveMomentVisibilityDays('private', 'rapport')).toBeNull()
  })

  it('three_days is a user controlled upper bound', () => {
    expect(resolveMomentVisibilityDays('three_days', 'rapport')).toBe(3)
  })

  it('ai adapts the window to relationship phase', () => {
    expect(resolveMomentVisibilityDays('ai', 'rapport')).toBe(14)
    expect(resolveMomentVisibilityDays('ai', 'stranger')).toBe(3)
    expect(resolveMomentVisibilityDays('ai', 'familiar')).toBe(7)
    expect(resolveMomentVisibilityDays('ai', undefined)).toBe(7)
  })

  it('legacy always setting follows the neutral fallback when passed directly', () => {
    expect(resolveMomentVisibilityDays('always', 'familiar')).toBe(7)
  })
})

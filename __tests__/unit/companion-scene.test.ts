import { describe, expect, it } from 'vitest'
import {
  extractLocationHint,
  resolveCompanionScene,
} from '../../src/shared/companion-scene'

describe('companion-scene', () => {
  it('extracts location from presence parentheses', () => {
    expect(extractLocationHint('午饭散步（附近街道）')).toBe('附近街道')
    expect(extractLocationHint('在家休息')).toBe('在家休息')
  })

  it('maps known locations', () => {
    expect(resolveCompanionScene({ location: '咖啡馆' })).toBe('cafe')
    expect(resolveCompanionScene({ location: '工位' })).toBe('office')
    expect(resolveCompanionScene({ presence: '通勤/开工（路上/工位）' })).toBe('commute')
    expect(resolveCompanionScene({ location: '附近街道' })).toBe('street')
  })

  it('maps home to night late', () => {
    const night = new Date('2026-08-02T23:00:00').getTime()
    const day = new Date('2026-08-02T14:00:00').getTime()
    expect(resolveCompanionScene({ location: '家', now: night })).toBe('night')
    expect(resolveCompanionScene({ location: '家', now: day })).toBe('home')
  })

  it('falls back to default', () => {
    const day = new Date('2026-08-02T14:00:00').getTime()
    expect(resolveCompanionScene({ presence: '', now: day })).toBe('default')
  })
})

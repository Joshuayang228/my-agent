import { afterEach, describe, expect, it } from 'vitest'
import {
  getTraceSampleRate,
  sessionSampleBucket,
  setTraceSampleRate,
  shouldSampleSession,
} from '../../electron/main/utils/session-sampler'

const originalRate = getTraceSampleRate()

afterEach(() => {
  setTraceSampleRate(originalRate)
})

describe('session-sampler', () => {
  it('bucket 对同一 sessionId 稳定且落在 [0,1)', () => {
    const a = sessionSampleBucket('sess-alpha')
    const b = sessionSampleBucket('sess-alpha')
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(1)
  })

  it('rate=1 全收；无 sessionId 始终收', () => {
    setTraceSampleRate(1)
    expect(shouldSampleSession('any')).toBe(true)
    setTraceSampleRate(0)
    expect(shouldSampleSession(undefined)).toBe(true)
    expect(shouldSampleSession('')).toBe(true)
    expect(shouldSampleSession('any')).toBe(false)
  })

  it('同一会话在给定 rate 下结论恒定', () => {
    setTraceSampleRate(0.5)
    const id = 'stable-session-xyz'
    const first = shouldSampleSession(id)
    expect(shouldSampleSession(id)).toBe(first)
    expect(first).toBe(sessionSampleBucket(id) < 0.5)
  })

  it('setTraceSampleRate 钳制到 [0,1]', () => {
    expect(setTraceSampleRate(2)).toBe(1)
    expect(setTraceSampleRate(-1)).toBe(0)
  })
})

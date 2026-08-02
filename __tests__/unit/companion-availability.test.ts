import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => {
    throw new Error('no db in availability unit')
  }),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/companion/life/store', () => ({
  listEvents: vi.fn(async () => []),
  getDayScript: vi.fn(async () => null),
}))

const { checkCastAvailability } = await import(
  '../../electron/main/companion/cast/availability'
)

describe('cast availability (Alice-inspired)', () => {
  it('空闲随机源下可用', async () => {
    const wedMorning = new Date(2026, 7, 5, 8, 0, 0).getTime()
    const r = await checkCastAvailability('ayu', {
      now: wedMorning,
      random: () => 0.99,
    })
    expect(r.available).toBe(true)
    expect(r.name).toBe('阿雨')
  })

  it('忙时段 + 低随机 → 婉拒并给改约', async () => {
    const wedAfternoon = new Date(2026, 7, 5, 15, 0, 0).getTime()
    const r = await checkCastAvailability('chen', {
      now: wedAfternoon,
      random: () => 0,
    })
    expect(r.available).toBe(false)
    expect(r.reason).toContain('陈姐')
    expect(r.alternative).toBeTruthy()
  })
})

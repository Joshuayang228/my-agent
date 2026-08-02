/**
 * W3：Catch-up ≤7×24h 细窗 + Moments 投影；朋友圈按 role 隔离
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import initSqlJs from 'sql.js'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: { getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>
let activeRoleId = 'lin'

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === 'universeId') return 'default'
    if (key === 'activeRoleId') return activeRoleId
    return ''
  }),
  setSetting: vi.fn(async (key: string, value: string) => {
    if (key === 'activeRoleId') activeRoleId = value
  }),
  getAllSettings: vi.fn(async () => ({
    llmApiKey: '',
    llmBaseUrl: 'http://localhost',
    llmModel: 'test',
    auxModel: '',
    llmTemperature: '',
    llmTopP: '',
    llmMaxTokens: '',
    universeId: 'default',
    activeRoleId: 'lin',
  })),
}))

const { runCatchup, computeFineStart, CATCHUP_FINE_MS } =
  await import('../../electron/main/companion/life/catchup')
const { localDateTimeMs, toLocalDateString, eachLocalDateInclusive } =
  await import('../../electron/main/companion/life/dates')
const { __lifeStore, pauseRole, tickActiveRole } =
  await import('../../electron/main/companion/life/engine')
const { listMomentsForRole } = await import('../../electron/main/companion/life/moments')

describe('Catch-up + Moments', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    activeRoleId = 'lin'
  })

  afterEach(() => {
    memDb.close()
  })

  it('computeFineStart：空洞 >7 日时细窗从 now-7d 起', () => {
    const now = localDateTimeMs('2026-08-12', 12, 0)
    const pausedAt = localDateTimeMs('2026-08-02', 12, 0)
    expect(computeFineStart(pausedAt, now)).toBe(now - CATCHUP_FINE_MS)
  })

  it('暂停 10 日后 Catch-up：summary 有值且细补近窗剧本', async () => {
    const now = localDateTimeMs('2026-08-12', 15, 0)
    const pausedAt = localDateTimeMs('2026-08-02', 15, 0)

    const result = await runCatchup('lin', pausedAt, now)
    expect(result.summaryUpdated).toBe(true)
    expect(result.fineDays).toBeGreaterThanOrEqual(7)
    expect(result.fineDays).toBeLessThanOrEqual(8)

    const state = await __lifeStore.getRoleState('lin')
    expect(state?.pausedAt).toBeNull()
    expect(state?.catchupSummary).toContain('生活追赶摘要')
    expect(state?.catchupSummary.length).toBeGreaterThan(10)

    const fineStart = computeFineStart(pausedAt, now)
    const dates = eachLocalDateInclusive(toLocalDateString(fineStart), toLocalDateString(now))
    expect(await __lifeStore.countDayScripts('lin')).toBe(dates.length)
    expect(result.published).toBeGreaterThan(0)
    expect(await __lifeStore.countMoments('lin')).toBeGreaterThan(0)
  })

  it('空洞 ≤7 日不写概况摘要，仍补齐细窗', async () => {
    const now = localDateTimeMs('2026-08-12', 12, 0)
    const pausedAt = localDateTimeMs('2026-08-10', 12, 0)
    const result = await runCatchup('lin', pausedAt, now)
    expect(result.summaryUpdated).toBe(false)
    const state = await __lifeStore.getRoleState('lin')
    expect(state?.catchupSummary ?? '').toBe('')
    expect(await __lifeStore.countDayScripts('lin')).toBe(result.fineDays)
  })

  it('朋友圈按 role 隔离：other 的 moments 不混入 lin', async () => {
    const now = localDateTimeMs('2026-08-12', 18, 0)
    await runCatchup('lin', localDateTimeMs('2026-08-11', 10, 0), now)
    await runCatchup('other', localDateTimeMs('2026-08-11', 10, 0), now)

    const linMoments = await listMomentsForRole('lin')
    const otherMoments = await listMomentsForRole('other')
    expect(linMoments.length).toBeGreaterThan(0)
    expect(otherMoments.length).toBeGreaterThan(0)
    expect(linMoments.every((m) => m.roleId === 'lin')).toBe(true)
    expect(otherMoments.every((m) => m.roleId === 'other')).toBe(true)

    // IPC 语义：仅 active — 此处模拟 active=lin 时不应读到 other
    activeRoleId = 'lin'
    const activeOnly = await listMomentsForRole(activeRoleId)
    expect(activeOnly.every((m) => m.roleId === 'lin')).toBe(true)
    expect(activeOnly.some((m) => m.roleId === 'other')).toBe(false)
  })

  it('tick 发布到期事件时同步投影 moments', async () => {
    const now = localDateTimeMs('2026-08-05', 20, 0)
    await tickActiveRole(now)
    expect(await __lifeStore.countMoments('lin')).toBeGreaterThan(0)
  })

  it('pause 后 tick 跳过，不新增 moments', async () => {
    await pauseRole('lin', Date.now())
    const before = await __lifeStore.countMoments('lin')
    await tickActiveRole(localDateTimeMs('2026-08-06', 12, 0))
    expect(await __lifeStore.countMoments('lin')).toBe(before)
  })
})

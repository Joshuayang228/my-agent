import { runLocalTransaction } from '../helpers/local-transaction'
/**
 * W3：Catch-up ≤7×24h 细窗 + Moments 投影；朋友圈按 role 隔离
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import initSqlJs from 'sql.js'
import { invalidateCompanionLifecycle } from '../../electron/main/utils/companion-lifecycle'

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
let activeRoleId = 'luffy'

vi.mock('../../electron/main/storage/database', () => ({
  withDatabaseTransaction: async (work: (db: typeof memDb) => Promise<unknown>) => runLocalTransaction(memDb, work),
  getDatabase: vi.fn(async () => memDb),
  getInitializedDatabase: () => memDb,
  persist: vi.fn(),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  isActiveRole: vi.fn(async (roleId: string) => roleId === activeRoleId),
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
    activeRoleId: 'luffy',
  })),
}))

const { runCatchup, recoverActiveCatchup, computeFineStart, CATCHUP_FINE_MS } =
  await import('../../electron/main/companion/life/catchup')
const { localDateTimeMs, toLocalDateString, eachLocalDateInclusive } =
  await import('../../electron/main/companion/life/dates')
const { __lifeStore, pauseRole, tickActiveRole } =
  await import('../../electron/main/companion/life/engine')
const { listMomentsForRole } = await import('../../electron/main/companion/life/moments')
const { getCompanionRuntimeState } = await import('../../electron/main/companion/core/state/runtime-state')

describe('Catch-up + Moments', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    activeRoleId = 'luffy'
  })

  afterEach(() => {
    memDb.close()
    vi.restoreAllMocks()
  })

  it('computeFineStart：空洞 >7 日时细窗从 now-7d 起', () => {
    const now = localDateTimeMs('2026-08-12', 12, 0)
    const pausedAt = localDateTimeMs('2026-08-02', 12, 0)
    expect(computeFineStart(pausedAt, now)).toBe(now - CATCHUP_FINE_MS)
  })

  it('暂停 10 日后 Catch-up：summary 有值且细补近窗剧本', async () => {
    const now = localDateTimeMs('2026-08-12', 15, 0)
    const pausedAt = localDateTimeMs('2026-08-02', 15, 0)

    const result = await runCatchup('luffy', pausedAt, now)
    expect(result.summaryUpdated).toBe(true)
    expect(result.fineDays).toBeGreaterThanOrEqual(7)
    expect(result.fineDays).toBeLessThanOrEqual(8)

    const state = await getCompanionRuntimeState('luffy')
    expect(state?.pausedAt).toBeNull()
    expect(state?.catchupSummary).toContain('生活追赶摘要')
    expect(state?.catchupSummary.length).toBeGreaterThan(10)

    const fineStart = computeFineStart(pausedAt, now)
    const dates = eachLocalDateInclusive(toLocalDateString(fineStart), toLocalDateString(now))
    expect(await __lifeStore.countDayScripts('luffy')).toBe(dates.length)
    expect(result.published).toBeGreaterThan(0)
    expect(await __lifeStore.countMoments('luffy')).toBeGreaterThan(0)
  })

  it('空洞 ≤7 日不写概况摘要，仍补齐细窗', async () => {
    const now = localDateTimeMs('2026-08-12', 12, 0)
    const pausedAt = localDateTimeMs('2026-08-10', 12, 0)
    const result = await runCatchup('luffy', pausedAt, now)
    expect(result.summaryUpdated).toBe(false)
    const state = await getCompanionRuntimeState('luffy')
    expect(state?.catchupSummary ?? '').toBe('')
    expect(await __lifeStore.countDayScripts('luffy')).toBe(result.fineDays)
  })

  it('活跃角色重启后恢复补叙，结算失败保留暂停标记且重试不重复发布', async () => {
    const pausedAt = Date.now() - 8 * 86_400_000
    await pauseRole('luffy', pausedAt)
    memDb.run(`CREATE TRIGGER reject_catchup_completion BEFORE UPDATE ON companion_runtime_state
      WHEN OLD.paused_at IS NOT NULL AND NEW.paused_at IS NULL
      BEGIN SELECT RAISE(ABORT, 'fixture-catchup-completion'); END`)
    const snapshot = memDb.export()
    memDb.close()
    memDb = new SQL.Database(snapshot)

    const first = recoverActiveCatchup()
    const duplicate = recoverActiveCatchup()
    expect(first).toBe(duplicate)
    await expect(first).rejects.toThrow('fixture-catchup-completion')
    expect(await getCompanionRuntimeState('luffy')).toMatchObject({ pausedAt, catchupSummary: '' })
    const published = await __lifeStore.countMoments('luffy')
    expect(published).toBeGreaterThan(0)

    memDb.run('DROP TRIGGER reject_catchup_completion')
    await recoverActiveCatchup()
    expect(await getCompanionRuntimeState('luffy')).toMatchObject({ pausedAt: null, catchupSummary: expect.stringContaining('生活追赶摘要') })
    expect(await __lifeStore.countMoments('luffy')).toBe(published)
  })

  it('摘要生成等待期间切走再切回，旧补叙不能发布生活事件或清除暂停状态', async () => {
    const pausedAt = Date.now() - 8 * 86_400_000
    await pauseRole('luffy', pausedAt)
    const llm = await import('../../electron/main/llm/index')
    const config = await import('../../electron/main/llm/aux-config')
    vi.spyOn(config, 'loadAuxLLMConfig').mockResolvedValue({ apiKey: 'fixture', baseUrl: 'http://127.0.0.1', model: 'fixture' })
    let entered!: () => void
    let finish!: (summary: string) => void
    const started = new Promise<void>(resolve => { entered = resolve })
    vi.spyOn(llm, 'chatComplete').mockImplementationOnce(() => new Promise(resolve => {
      finish = resolve
      entered()
    }))
    const oldRun = recoverActiveCatchup()
    const cancelled = expect(oldRun).rejects.toThrow('人物世界运行范围已变更')
    await started
    activeRoleId = 'other'
    invalidateCompanionLifecycle()
    activeRoleId = 'luffy'
    invalidateCompanionLifecycle()
    finish('这是已经失效的人物生活补叙，不应写入。')
    await cancelled
    expect(await getCompanionRuntimeState('luffy')).toMatchObject({ pausedAt, catchupSummary: '' })
    expect(await __lifeStore.countDayScripts('luffy')).toBe(0)
    expect(await __lifeStore.countMoments('luffy')).toBe(0)
  })

  it('朋友圈按 role 隔离：other 的 moments 不混入 lin', async () => {
    const now = localDateTimeMs('2026-08-12', 18, 0)
    await runCatchup('luffy', localDateTimeMs('2026-08-11', 10, 0), now)
    await runCatchup('other', localDateTimeMs('2026-08-11', 10, 0), now)

    const linMoments = await listMomentsForRole('luffy')
    const otherMoments = await listMomentsForRole('other')
    expect(linMoments.length).toBeGreaterThan(0)
    expect(otherMoments.length).toBeGreaterThan(0)
    expect(linMoments.every((m) => m.roleId === 'luffy')).toBe(true)
    expect(otherMoments.every((m) => m.roleId === 'other')).toBe(true)

    // IPC 语义：仅 active — 此处模拟 active=lin 时不应读到 other
    activeRoleId = 'luffy'
    const activeOnly = await listMomentsForRole(activeRoleId)
    expect(activeOnly.every((m) => m.roleId === 'luffy')).toBe(true)
    expect(activeOnly.some((m) => m.roleId === 'other')).toBe(false)
  })

  it('tick 发布到期事件时同步投影 moments', async () => {
    const now = localDateTimeMs('2026-08-05', 20, 0)
    await tickActiveRole(now)
    expect(await __lifeStore.countMoments('luffy')).toBeGreaterThan(0)
  })

  it('pause 后 tick 跳过，不新增 moments', async () => {
    await pauseRole('luffy', Date.now())
    const before = await __lifeStore.countMoments('luffy')
    await tickActiveRole(localDateTimeMs('2026-08-06', 12, 0))
    expect(await __lifeStore.countMoments('luffy')).toBe(before)
  })
})

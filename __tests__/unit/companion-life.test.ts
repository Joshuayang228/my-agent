/**
 * W2：LifeEngine — pause / ensureDayScripts / tick 仅 active
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
}))

const {
  pauseRole,
  resumeRole,
  ensureDayScripts,
  tickActiveRole,
  __lifeStore,
} = await import('../../electron/main/companion/life/engine')

const { eachLocalDateInclusive, toLocalDateString, localDateTimeMs } =
  await import('../../electron/main/companion/life/dates')

const { generateDayScript } = await import('../../electron/main/companion/life/script-generator')

const { requestSwitch } = await import('../../electron/main/companion/orchestrator')
const { registerStreamingProbe } = await import('../../electron/main/companion/streaming-gate')
const identity = await import('../../electron/main/companion/identity/loader')

describe('life dates', () => {
  it('eachLocalDateInclusive 含两端共 3 日', () => {
    expect(eachLocalDateInclusive('2026-08-01', '2026-08-03')).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ])
  })

  it('generateDayScript 同输入稳定', () => {
    expect(generateDayScript('lin', '2026-08-01')).toEqual(
      generateDayScript('lin', '2026-08-01'),
    )
  })

  it('generateDayScript 不同主角同分味', () => {
    const lin = generateDayScript('lin', '2026-08-01')
    const zhou = generateDayScript('zhou', '2026-08-01')
    const xia = generateDayScript('xia', '2026-08-01')
    expect(lin.slots[0].activity).not.toEqual(zhou.slots[0].activity)
    expect(zhou.slots.some((s) => /点子|约人|拍张/.test(s.activity))).toBe(true)
    expect(xia.slots.some((s) => /安静|静坐|公园|窗/.test(s.activity))).toBe(true)
  })
})

describe('LifeEngine', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    activeRoleId = 'lin'
    registerStreamingProbe(() => false)
  })

  afterEach(() => {
    memDb.close()
  })

  it('ensureDayScripts 补齐缺失 3 日', async () => {
    const { created } = await ensureDayScripts('lin', '2026-08-01', '2026-08-03')
    expect(created).toBe(3)
    expect(await __lifeStore.countDayScripts('lin')).toBe(3)
    // 再 ensure 幂等
    const again = await ensureDayScripts('lin', '2026-08-01', '2026-08-03')
    expect(again.created).toBe(0)
    expect(await __lifeStore.countDayScripts('lin')).toBe(3)
    expect(await __lifeStore.countEvents('lin')).toBeGreaterThan(0)
  })

  it('pause / resume 读写 paused_at', async () => {
    const at = 1_700_000_000_000
    await pauseRole('lin', at)
    expect((await __lifeStore.getRoleState('lin'))?.pausedAt).toBe(at)
    await resumeRole('lin')
    expect((await __lifeStore.getRoleState('lin'))?.pausedAt).toBeNull()
  })

  it('tickActiveRole 仅为 active 生成/推进；非活跃不新增', async () => {
    // 固定「下午」时刻，使部分槽位可 published
    const now = localDateTimeMs('2026-08-02', 15, 0)
    const r1 = await tickActiveRole(now)
    expect(r1.roleId).toBe('lin')
    expect(r1.scriptsCreated).toBe(1)
    const scriptsAfterActive = await __lifeStore.countDayScripts('lin')
    const eventsAfterActive = await __lifeStore.countEvents('lin')
    expect(scriptsAfterActive).toBe(1)
    expect(eventsAfterActive).toBeGreaterThan(0)
    expect(await __lifeStore.listEvents('lin', { status: 'published' }).then((e) => e.length)).toBeGreaterThan(0)

    // 切到「假」活跃角色：spy 已知主角 + 改 active
    const spy = vi
      .spyOn(identity, 'isKnownProtagonist')
      .mockImplementation((id) => id === 'lin' || id === 'other')
    activeRoleId = 'other'

    const later = localDateTimeMs('2026-08-03', 12, 0)
    await tickActiveRole(later)

    // lin 作为非活跃：剧本/事件数不变
    expect(await __lifeStore.countDayScripts('lin')).toBe(scriptsAfterActive)
    expect(await __lifeStore.countEvents('lin')).toBe(eventsAfterActive)

    // other 作为活跃：应有今日剧本
    expect(await __lifeStore.countDayScripts('other')).toBe(1)
    spy.mockRestore()
  })

  it('requestSwitch pause 旧角色并在曾暂停时 catchupQueued', async () => {
    const spy = vi
      .spyOn(identity, 'isKnownProtagonist')
      .mockImplementation((id) => id === 'lin' || id === 'other')

    // 先让 lin 有过活跃态
    await resumeRole('lin')
    const r1 = await requestSwitch('other')
    expect(r1).toEqual({ ok: true, catchupQueued: false })
    expect((await __lifeStore.getRoleState('lin'))?.pausedAt).not.toBeNull()
    expect((await __lifeStore.getRoleState('other'))?.pausedAt).toBeNull()

    const r2 = await requestSwitch('lin')
    expect(r2).toEqual({ ok: true, catchupQueued: true })
    expect((await __lifeStore.getRoleState('other'))?.pausedAt).not.toBeNull()
    expect((await __lifeStore.getRoleState('lin'))?.pausedAt).toBeNull()

    spy.mockRestore()
  })

  it('active 仍 paused 时 tick 跳过', async () => {
    await pauseRole('lin', Date.now())
    // 不 resume，但 settings 仍指向 lin
    const r = await tickActiveRole(localDateTimeMs(toLocalDateString(Date.now()), 18, 0))
    expect(r.scriptsCreated).toBe(0)
    expect(r.published).toBe(0)
    expect(await __lifeStore.countDayScripts('lin')).toBe(0)
  })
})

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
const { getLifeSliceForRole } = await import('../../electron/main/companion/life/slices')
const lifeStore = await import('../../electron/main/companion/life/store')
const { createAsset } = await import('../../electron/main/companion/life/assets')
const { projectMomentFromEvent } = await import('../../electron/main/companion/life/moments')
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

  it('listEvents 支持为 Debug 时间线倒序限量读取', async () => {
    await ensureDayScripts('lin', '2026-08-01', '2026-08-03')
    const recent = await __lifeStore.listEvents('lin', {
      status: 'planned',
      order: 'desc',
      limit: 2,
    })
    expect(recent).toHaveLength(2)
    expect(recent[0].scheduledAt).toBeGreaterThanOrEqual(recent[1].scheduledAt)
  })

  it('生活切片按事件聚合动态并拒绝跨主角读取', async () => {
    const now = localDateTimeMs('2026-08-02', 15, 0)
    await tickActiveRole(now)
    const published = await __lifeStore.listEvents('lin', { status: 'published', order: 'desc', limit: 1 })
    expect(published).toHaveLength(1)
    const slice = await getLifeSliceForRole('lin', published[0].id)
    expect(slice?.event.id).toBe(published[0].id)
    expect(slice?.moment?.eventId).toBe(published[0].id)
    expect(await getLifeSliceForRole('other', published[0].id)).toBeNull()
  })

  it('事件关联按角色幂等保存，并由 Moment 投影写入资产与图片关系', async () => {
    const assetResult = await createAsset({
      roleId: 'lin',
      kind: 'wardrobe',
      name: '蓝色外套',
    })
    expect(assetResult.ok).toBe(true)
    if (!assetResult.ok) return

    const event = await __lifeStore.insertEvent({
      roleId: 'lin',
      scheduledAt: localDateTimeMs('2026-08-02', 15, 0),
      status: 'published',
      type: 'moment',
      payload: {
        assetId: assetResult.asset.id,
        imageId: 'image-1',
        location: '街道',
      },
      dayScriptId: null,
    })
    await projectMomentFromEvent(event)

    const first = await lifeStore.listEventLinks('lin', event.id)
    expect(first).toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetType: 'asset',
        targetId: assetResult.asset.id,
        relation: 'wears',
      }),
      expect.objectContaining({
        targetType: 'image',
        targetId: 'image-1',
        relation: 'depicts',
      }),
    ]))
    const slice = await getLifeSliceForRole('lin', event.id)
    expect(slice?.links).toHaveLength(first.length)

    await lifeStore.replaceEventLinks('lin', event.id, first.map((link) => ({
      eventId: link.eventId,
      roleId: link.roleId,
      targetType: link.targetType,
      targetId: link.targetId,
      relation: link.relation,
      metadata: link.metadata,
    })))
    expect(await lifeStore.listEventLinks('lin', event.id)).toHaveLength(first.length)
    await lifeStore.replaceEventLinks('lin', event.id, [{
      eventId: event.id,
      roleId: 'lin',
      targetType: 'image',
      targetId: 'image-only',
      relation: 'depicts',
    }])
    expect(await lifeStore.listEventLinks('lin', event.id)).toEqual([
      expect.objectContaining({ targetId: 'image-only', relation: 'depicts' }),
    ])
    expect(await lifeStore.listEventLinks('other', event.id)).toEqual([])
    await expect(lifeStore.replaceEventLinks('other', event.id, [])).rejects.toThrow('事件不属于当前主角')
  })

  it('没有 Moment 时，生活切片仍返回事件与已保存关联', async () => {
    const event = await __lifeStore.insertEvent({
      roleId: 'lin',
      scheduledAt: localDateTimeMs('2026-08-03', 10, 0),
      status: 'planned',
      type: 'plan',
      payload: {},
      dayScriptId: null,
    })
    await lifeStore.replaceEventLinks('lin', event.id, [{
      eventId: event.id,
      roleId: 'lin',
      targetType: 'image',
      targetId: 'image-2',
      relation: 'depicts',
    }])

    const slice = await getLifeSliceForRole('lin', event.id)
    expect(slice?.event.id).toBe(event.id)
    expect(slice?.moment).toBeNull()
    expect(slice?.links).toEqual([
      expect.objectContaining({ targetId: 'image-2', relation: 'depicts' }),
    ])
  })

  it('事件关联替换中途失败保留整组旧关联', async () => {
    const event = await lifeStore.insertEvent({ roleId: 'lin', scheduledAt: 1, status: 'published', type: 'moment', payload: {}, dayScriptId: null })
    const link = (targetId: string) => ({ eventId: event.id, roleId: 'lin', targetType: 'image', targetId, relation: 'depicts' })
    await lifeStore.replaceEventLinks('lin', event.id, [link('original')])
    const original = await lifeStore.listEventLinks('lin', event.id)
    memDb.run("CREATE TEMP TRIGGER reject_link BEFORE INSERT ON companion_event_links WHEN NEW.target_id = 'rejected' BEGIN SELECT RAISE(ABORT, 'link rejected'); END")
    await expect(lifeStore.replaceEventLinks('lin', event.id, [link('new'), link('rejected')])).rejects.toThrow('link rejected')
    expect(await lifeStore.listEventLinks('lin', event.id)).toEqual(original)
  })

  it('删除事件按角色清理 Moment、用户互动和事件关联', async () => {
    const event = await __lifeStore.insertEvent({
      roleId: 'lin',
      scheduledAt: localDateTimeMs('2026-08-03', 11, 0),
      status: 'published',
      type: 'moment',
      payload: {},
      dayScriptId: null,
    })
    const moment = (await __lifeStore.insertMoment({
      roleId: 'lin',
      eventId: event.id,
      publishedAt: event.scheduledAt,
      text: '需要清理的动态',
    }))!
    await lifeStore.replaceEventLinks('lin', event.id, [{
      eventId: event.id,
      roleId: 'lin',
      targetType: 'image',
      targetId: 'image-delete',
      relation: 'depicts',
    }])
    await lifeStore.insertMomentUserInteraction({
      momentId: moment.id,
      roleId: 'lin',
      kind: 'comment',
      actorId: 'user',
      text: '会一起清理',
    })

    await expect(lifeStore.deleteEvent('other', event.id)).rejects.toThrow('事件不属于当前主角')
    const linksBeforeDelete = await lifeStore.listEventLinks('lin', event.id)
    const interactionsBeforeDelete = await lifeStore.listMomentUserInteractions('lin')
    memDb.run("CREATE TEMP TRIGGER reject_event_delete BEFORE DELETE ON companion_events BEGIN SELECT RAISE(ABORT, 'event delete rejected'); END")
    await expect(lifeStore.deleteEvent('lin', event.id)).rejects.toThrow('event delete rejected')
    expect(await lifeStore.getMomentByEventId('lin', event.id)).toEqual(moment)
    expect(await lifeStore.listEventLinks('lin', event.id)).toEqual(linksBeforeDelete)
    expect(await lifeStore.listMomentUserInteractions('lin')).toEqual(interactionsBeforeDelete)
    memDb.run('DROP TRIGGER reject_event_delete')
    expect(await lifeStore.deleteEvent('lin', event.id)).toBe(true)
    expect(await lifeStore.getEventById(event.id)).toBeNull()
    expect(await lifeStore.getMomentByEventId('lin', event.id)).toBeNull()
    expect(await lifeStore.listEventLinks('lin', event.id)).toEqual([])
    expect(await lifeStore.listMomentUserInteractions('lin')).toEqual([])
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
    expect(r1).toMatchObject({ ok: true, catchupQueued: false })
    if (r1.ok) {
      expect(r1.reacquaint.toast).toContain('又见面了')
      expect(r1.reacquaint.body).toMatch(/不是教程重开|成长与记忆/)
    }
    expect((await __lifeStore.getRoleState('lin'))?.pausedAt).not.toBeNull()
    expect((await __lifeStore.getRoleState('other'))?.pausedAt).toBeNull()

    const r2 = await requestSwitch('lin')
    expect(r2).toMatchObject({ ok: true, catchupQueued: true })
    if (r2.ok) {
      expect(r2.reacquaint.toast).toContain('成长未重置')
    }
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

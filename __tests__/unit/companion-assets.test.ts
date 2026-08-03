/**
 * W4：Assets 衣柜按 role 隔离；事件可引用 assetId
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

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === 'universeId') return 'default'
    if (key === 'activeRoleId') return 'lin'
    return ''
  }),
  setSetting: vi.fn(async () => {}),
}))

const {
  ensureStarterWardrobe,
  listAssets,
  addAsset,
  updateAsset,
  deleteAsset,
  pickWardrobeAssetId,
  maybeGrantFromEvent,
  normalizeGrantAsset,
} = await import('../../electron/main/companion/life/assets')

const { ensureDayScripts, __lifeStore } =
  await import('../../electron/main/companion/life/engine')

const { publishAndProjectRange } =
  await import('../../electron/main/companion/life/moments')

const { parseDayScriptPayload } =
  await import('../../electron/main/companion/life/script-generator')

describe('Companion Assets', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
  })

  afterEach(() => {
    memDb.close()
  })

  it('ensureStarterWardrobe 播种且幂等', async () => {
    const r1 = await ensureStarterWardrobe('lin')
    expect(r1.created).toBe(3)
    const r2 = await ensureStarterWardrobe('lin')
    expect(r2.created).toBe(0)
    const items = await listAssets('lin', { kind: 'wardrobe' })
    expect(items).toHaveLength(3)
    expect(items.every((a) => a.roleId === 'lin')).toBe(true)
  })

  it('资产按 role 隔离', async () => {
    await ensureStarterWardrobe('lin')
    await ensureStarterWardrobe('other')
    await addAsset({
      roleId: 'other',
      kind: 'wardrobe',
      name: '专属外套',
      payload: { color: '黑' },
    })

    const lin = await listAssets('lin', { kind: 'wardrobe' })
    const other = await listAssets('other', { kind: 'wardrobe' })
    expect(lin.every((a) => a.roleId === 'lin')).toBe(true)
    expect(other.every((a) => a.roleId === 'other')).toBe(true)
    expect(other.some((a) => a.name === '专属外套')).toBe(true)
    expect(lin.some((a) => a.name === '专属外套')).toBe(false)
  })

  it('日剧本 moment 事件 payload 含 assetId', async () => {
    await ensureDayScripts('lin', '2026-08-10', '2026-08-10')
    const events = await __lifeStore.listEvents('lin')
    const moments = events.filter((e) => e.type === 'moment')
    expect(moments.length).toBeGreaterThan(0)
    expect(moments.every((e) => typeof e.payload.assetId === 'string')).toBe(true)

    const assetId = moments[0].payload.assetId as string
    const wardrobe = await listAssets('lin', { kind: 'wardrobe' })
    expect(wardrobe.some((a) => a.id === assetId)).toBe(true)
  })

  it('pickWardrobeAssetId 同 seed 稳定', async () => {
    const a = await pickWardrobeAssetId('lin', 42)
    const b = await pickWardrobeAssetId('lin', 42)
    expect(a).toBe(b)
    expect(a).toBeTruthy()
  })

  it('updateAsset 可改名与 payload，角色不匹配则失败', async () => {
    const created = await addAsset({
      roleId: 'lin',
      kind: 'wardrobe',
      name: '旧名外套',
      payload: { color: '灰', style: '简约', occasion: '日常' },
    })
    const ok = await updateAsset(
      created.id,
      { name: '新名外套', payload: { color: '黑' } },
      { expectedRoleId: 'lin' },
    )
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    expect(ok.asset.name).toBe('新名外套')
    expect(ok.asset.payload.color).toBe('黑')
    expect(ok.asset.payload.style).toBe('简约')

    const wrong = await updateAsset(
      created.id,
      { name: '黑客' },
      { expectedRoleId: 'other' },
    )
    expect(wrong.ok).toBe(false)
    if (wrong.ok) return
    expect(wrong.code).toBe('ROLE_MISMATCH')
  })

  it('deleteAsset 仅本人可删', async () => {
    const created = await addAsset({
      roleId: 'lin',
      kind: 'wardrobe',
      name: '待删外套',
      payload: { color: '白', style: '休闲', occasion: '日常' },
    })
    const deny = await deleteAsset(created.id, { expectedRoleId: 'other' })
    expect(deny.ok).toBe(false)
    if (!deny.ok) expect(deny.code).toBe('ROLE_MISMATCH')

    const ok = await deleteAsset(created.id, { expectedRoleId: 'lin' })
    expect(ok.ok).toBe(true)
    const again = await deleteAsset(created.id, { expectedRoleId: 'lin' })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.code).toBe('NOT_FOUND')
  })

  it('maybeGrantFromEvent 幂等入库，非法 grant 跳过', async () => {
    expect(normalizeGrantAsset({ kind: '', name: 'x' })).toBeNull()
    const a = await maybeGrantFromEvent({
      roleId: 'lin',
      eventId: 'ev-grant-1',
      grant: { kind: 'wardrobe', name: '跳蚤市场围巾', payload: { color: '红' } },
    })
    expect(a?.id).toBe('grant:ev-grant-1')
    expect(a?.sourceEventId).toBe('ev-grant-1')
    const b = await maybeGrantFromEvent({
      roleId: 'lin',
      eventId: 'ev-grant-1',
      eventPayload: {
        grantAsset: { kind: 'wardrobe', name: '应被忽略的重复' },
      },
    })
    expect(b?.id).toBe(a?.id)
    expect(b?.name).toBe('跳蚤市场围巾')
  })

  it('publish 路径：payload.grantAsset 自动入库', async () => {
    const ev = await __lifeStore.insertEvent({
      roleId: 'lin',
      scheduledAt: Date.UTC(2026, 7, 2, 10, 0),
      status: 'planned',
      type: 'moment',
      dayScriptId: null,
      payload: {
        activity: '淘到一条围巾',
        mood: '开心',
        location: '跳蚤市场',
        grantAsset: { kind: 'wardrobe', name: '旧羊绒围巾', payload: { color: '驼' } },
      },
    })
    const n = await publishAndProjectRange('lin', 0, Date.UTC(2026, 7, 3))
    expect(n).toBeGreaterThanOrEqual(1)
    const granted = await listAssets('lin', { kind: 'wardrobe' })
    expect(granted.some((a) => a.id === `grant:${ev.id}` && a.name === '旧羊绒围巾')).toBe(true)
  })

  it('parseDayScriptPayload 每天最多保留一件 grantAsset', () => {
    const base = (hour: number, activity: string, type: 'moment' | 'activity') => ({
      hour,
      minute: 0,
      activity,
      mood: '平静',
      location: '家',
      type,
    })
    const parsed = parseDayScriptPayload(
      {
        theme: '小收获的一天',
        slots: [
          {
            ...base(9, '买咖啡', 'activity'),
            location: '咖啡馆',
            grantAsset: { kind: 'wardrobe', name: '帆布袋' },
          },
          base(11, '开工', 'activity'),
          {
            ...base(14, '散步', 'moment'),
            location: '公园',
            grantAsset: { kind: 'wardrobe', name: '第二件不该留下' },
          },
          base(16, '回信', 'activity'),
          base(19, '晚饭', 'moment'),
        ],
      },
      '2026-08-02',
    )
    expect(parsed).toBeTruthy()
    const grants = parsed!.slots.filter((s) => s.grantAsset)
    expect(grants).toHaveLength(1)
    expect(grants[0].grantAsset?.name).toBe('帆布袋')
  })
})

/**
 * W4：Assets 衣柜按 role 隔离；事件可引用 assetId
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import initSqlJs from 'sql.js'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
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
  pickWardrobeAssetId,
} = await import('../../electron/main/companion/life/assets')

const { ensureDayScripts, __lifeStore } =
  await import('../../electron/main/companion/life/engine')

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
})

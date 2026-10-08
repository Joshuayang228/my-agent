import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
let db: InstanceType<typeof SQL.Database>
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: vi.fn(async () => db), persist: vi.fn() }))
vi.mock('../../electron/main/utils/logger', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }))
const { createAsset, addAsset, maybeGrantFromEvent, updateAsset, getAsset, changeWardrobe, listAssets, deleteAsset, attachWorldAssetImage } = await import('../../electron/main/companion/life/assets')

describe('world records use the real asset persistence path', () => {
  beforeEach(() => { db = new SQL.Database() })
  afterEach(() => { db.close() })

  it('内部新增也拒绝失效或跨角色空间引用，不把非法事件发放落库', async () => {
    const foreign = await addAsset({ roleId: 'yao', kind: 'home', name: '另一空间', payload: { recordType: 'space' } })
    for (const spaceId of ['missing', foreign.id]) {
      await expect(addAsset({ roleId: 'lin', kind: 'furniture', name: '不应保存', payload: { spaceId } })).rejects.toThrow()
      expect(await listAssets('lin')).toEqual([])
      expect(await maybeGrantFromEvent({ roleId: 'lin', eventId: spaceId, grant: { kind: 'furniture', name: '不应发放', payload: { spaceId } } })).toBeNull()
      expect(await listAssets('lin')).toEqual([])
    }
  })

  it('内部新增保留长旧正文，完整校验新笔记和旅行，不允许直接写当前穿搭', async () => {
    const text = '旧资料正文'.repeat(120)
    const record = await addAsset({ roleId: 'lin', kind: 'culture', name: '旧作品', payload: { note: text, readingNotes: [{ id: 'n1', text }] } })
    expect(record.payload.note).toBe(text)
    expect(record.payload.readingNotes).toEqual([{ id: 'n1', text }])
    await expect(addAsset({ roleId: 'lin', kind: 'culture', name: '无效笔记', payload: { readingNotes: [{ id: 'n1', text: '' }] } })).rejects.toThrow()
    await expect(addAsset({ roleId: 'lin', kind: 'footprint', name: '无效旅行', payload: { recordType: 'trip', status: 'completed', destination: '苏州', start: '2026-09-02', end: '2026-09-01' } })).rejects.toThrow()
    await expect(addAsset({ roleId: 'lin', kind: 'wardrobe', name: '绕过换衣', payload: { recordType: 'wear-state', slots: {} } })).rejects.toThrow()
    expect(await listAssets('lin')).toHaveLength(1)
  })

  it('事件发放的幂等 ID 不能返回另一角色已有资产', async () => {
    await addAsset({ id: 'grant:shared', roleId: 'yao', kind: 'wardrobe', name: '另一角色衣物' })
    expect(await maybeGrantFromEvent({ roleId: 'lin', eventId: 'shared', grant: { kind: 'wardrobe', name: '衣物' } })).toBeNull()
    expect(await listAssets('lin')).toEqual([])
  })

  it('合法内部套装按分类引用并绑定初始版本，事件发放重开后幂等', async () => {
    const top = await addAsset({ roleId: 'lin', kind: 'wardrobe', name: '上装', payload: { category: 'top' } })
    const bottom = await addAsset({ roleId: 'lin', kind: 'wardrobe', name: '下装', payload: { category: 'bottom' } })
    const shoes = await addAsset({ roleId: 'lin', kind: 'wardrobe', name: '鞋子', payload: { category: 'shoes' } })
    const grant = { kind: 'wardrobe', name: '套装', payload: { recordType: 'outfit', slots: { top: top.id, bottom: bottom.id, shoes: shoes.id } } }
    const result = await maybeGrantFromEvent({ roleId: 'lin', eventId: 'outfit', grant })
    expect(result?.payload).toEqual({ ...grant.payload, outfitVersion: 1 })
    const bytes = db.export(); db.close(); db = new SQL.Database(bytes)
    expect(await maybeGrantFromEvent({ roleId: 'lin', eventId: 'outfit', grant })).toEqual(result)
    expect(await listAssets('lin')).toHaveLength(4)
    await expect(addAsset({ roleId: 'lin', kind: 'wardrobe', name: '错槽位', payload: { ...grant.payload, slots: { ...grant.payload.slots, top: bottom.id } } })).rejects.toThrow()
  })

  it('事件发放只跳过字段错误，不吞数据库写入异常', async () => {
    await listAssets('lin')
    const run = db.run.bind(db)
    const fault = vi.spyOn(db, 'run').mockImplementation((sql, params) => {
      if (sql.includes('INSERT INTO companion_assets')) throw new Error('数据库写入失败')
      return run(sql, params)
    })
    try {
      await expect(maybeGrantFromEvent({ roleId: 'lin', eventId: 'failure', grant: { kind: 'wardrobe', name: '衣物' } })).rejects.toThrow('数据库写入失败')
      expect(await listAssets('lin')).toEqual([])
    } finally { fault.mockRestore() }
  })

  it('换装一次写完整槽位，拒绝过期并发和失效引用，整套不遗留外套且重载保持', async () => {
    const create = async (category: string, roleId = 'lin') => {
      const result = await createAsset({ roleId, kind: 'wardrobe', name: category, payload: { recordType: 'garment', category } })
      if (!result.ok) throw new Error(result.error)
      return result.asset
    }
    const top = await create('top'), bottom = await create('bottom'), shoes = await create('shoes'), outerwear = await create('outerwear'), foreign = await create('top', 'yao')
    const outfit = await createAsset({ roleId: 'lin', kind: 'wardrobe', name: '套装', payload: { recordType: 'outfit', slots: { top: top.id, bottom: bottom.id, shoes: shoes.id } } })
    if (!outfit.ok) throw new Error(outfit.error)
    const first = await changeWardrobe({ roleId: 'lin', assetId: outerwear.id, expectedVersion: 0 })
    expect(first).toMatchObject({ ok: true, asset: { payload: { slots: { outerwear: outerwear.id }, outfitVersion: 1 } } })
    const races = await Promise.all([changeWardrobe({ roleId: 'lin', assetId: outfit.asset.id, expectedVersion: 1 }), changeWardrobe({ roleId: 'lin', assetId: top.id, expectedVersion: 1 })])
    expect(races.map(result => result.ok)).toEqual([true, false])
    const state = (await listAssets('lin')).find(item => item.payload.recordType === 'wear-state')!
    expect(state.payload.slots).toEqual({ top: top.id, bottom: bottom.id, shoes: shoes.id })
    expect(await changeWardrobe({ roleId: 'lin', assetId: foreign.id, expectedVersion: 2 })).toMatchObject({ ok: false })
    expect(await updateAsset(state.id, { payload: { slots: { top: top.id } } }, { expectedRoleId: 'lin' })).toMatchObject({ ok: false })
    await deleteAsset(bottom.id, { expectedRoleId: 'lin' })
    expect(await changeWardrobe({ roleId: 'lin', assetId: outfit.asset.id, expectedVersion: 2 })).toMatchObject({ ok: false })
    expect((await getAsset(state.id))?.payload).toEqual(state.payload)
    const bytes = db.export(); db.close(); db = new SQL.Database(bytes)
    expect((await getAsset(state.id))?.payload).toEqual(state.payload)
  })

  it('套装新引用拒绝错分类和跨角色，改槽位提升版本并使旧图片失效', async () => {
    const garment = async (category: string, roleId = 'lin') => {
      const result = await createAsset({ roleId, kind: 'wardrobe', name: category, payload: { category } })
      if (!result.ok) throw new Error(result.error)
      return result.asset
    }
    const top = await garment('top'), bottom = await garment('bottom'), shoes = await garment('shoes'), nextTop = await garment('top'), foreign = await garment('top', 'yao')
    const slots = { top: top.id, bottom: bottom.id, shoes: shoes.id }
    for (const id of [foreign.id, bottom.id, 'missing']) expect(await createAsset({ roleId: 'lin', kind: 'wardrobe', name: '无效套装', payload: { recordType: 'outfit', slots: { ...slots, top: id } } })).toMatchObject({ ok: false })
    const outfit = await createAsset({ roleId: 'lin', kind: 'wardrobe', name: '套装', payload: { recordType: 'outfit', slots } })
    if (!outfit.ok) throw new Error(outfit.error)
    const image = { id: 'a'.repeat(64), path: 'C:/images/image.png', mimeType: 'image/png' as const, width: 1, height: 1, byteLength: 1 }
    expect(await attachWorldAssetImage(outfit.asset.id, image, { expectedRoleId: 'lin', expectedOutfitVersion: 1 })).toMatchObject({ ok: true })
    expect(await changeWardrobe({ roleId: 'lin', assetId: outfit.asset.id, expectedVersion: 0 })).toMatchObject({ ok: true, asset: { payload: { image, imageOutfitVersion: 1 } } })
    expect(await updateAsset(outfit.asset.id, { payload: { slots: { ...slots, top: nextTop.id } } })).toMatchObject({ ok: true, asset: { payload: { outfitVersion: 2 } } })
    expect((await getAsset(outfit.asset.id))?.payload).not.toHaveProperty('image')
    expect(await attachWorldAssetImage(outfit.asset.id, image, { expectedRoleId: 'lin', expectedOutfitVersion: 1 })).toMatchObject({ ok: false })
    expect(await attachWorldAssetImage(outfit.asset.id, image, { expectedRoleId: 'yao', expectedOutfitVersion: 2 })).toMatchObject({ ok: false })
    expect((await getAsset(outfit.asset.id))?.payload).not.toHaveProperty('image')
  })

  it('persists multiple full notes, reloads them, and rejects cross-role or malformed writes without partial changes', async () => {
    const text = '给日常留一点空白。'.repeat(70)
    const result = await createAsset({ roleId: 'lin', kind: 'culture', name: '一本书', payload: { type: 'reading', readingNotes: [{ id: 'n1', text, page: 36 }, { id: 'n2', text: '另一条笔记' }] } })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected persisted culture asset')
    const id = result.asset.id
    const saved = db.export()
    db.close()
    db = new SQL.Database(saved)
    expect((await getAsset(id))?.payload.readingNotes).toEqual([{ id: 'n1', text, page: 36 }, { id: 'n2', text: '另一条笔记' }])
    expect(await updateAsset(id, { name: '不能保存的名称', payload: { readingNotes: [{ id: 'n1', text: '' }] } }, { expectedRoleId: 'lin' })).toMatchObject({ ok: false, code: 'INVALID' })
    expect(await updateAsset(id, { payload: { readingNotes: [] } }, { expectedRoleId: 'yao' })).toMatchObject({ ok: false, code: 'ROLE_MISMATCH' })
    expect((await getAsset(id))?.name).toBe('一本书')
    expect((await getAsset(id))?.payload.readingNotes).toHaveLength(2)
    expect(await updateAsset(id, { payload: { readingNotes: [] } }, { expectedRoleId: 'lin' })).toMatchObject({ ok: true })
    expect((await getAsset(id))?.payload.readingNotes).toEqual([])
  })

  it('rejects invalid travel dates on create and update, preserving the prior trip after failure', async () => {
    const payload = { recordType: 'trip', destination: '苏州', status: 'completed', start: '2026-09-26', end: '2026-09-27', story: '雨后的巷子。'.repeat(80), stops: [{ id: 'alley', name: '老城', date: '2026-09-26', story: '走了一会儿。' }] }
    expect(await createAsset({ roleId: 'lin', kind: 'footprint', name: '旅行', payload: { ...payload, start: '2026-02-30' } })).toMatchObject({ ok: false, code: 'INVALID' })
    const result = await createAsset({ roleId: 'lin', kind: 'footprint', name: '旅行', payload })
    if (!result.ok) throw new Error('expected persisted travel record')
    expect(result.asset.payload.story).toBe(payload.story)
    expect(await updateAsset(result.asset.id, { payload: { end: '2026-09-25' } }, { expectedRoleId: 'lin' })).toMatchObject({ ok: false, code: 'INVALID' })
    expect((await getAsset(result.asset.id))?.payload).toEqual(payload)
  })

  it('validates owned residence and room references before writes, and preserves an object after failed reassignment', async () => {
    const create = async (roleId: string, kind: string, name: string, payload: Record<string, unknown>) => {
      const result = await createAsset({ roleId, kind, name, payload })
      if (!result.ok) throw new Error(result.error)
      return result.asset
    }
    const house = await create('lin', 'home', '住所', { recordType: 'residence' })
    const foreignHouse = await create('yao', 'home', '另一住所', { recordType: 'residence' })
    expect(await createAsset({ roleId: 'lin', kind: 'home', name: '房间', payload: { recordType: 'space', residenceId: foreignHouse.id } })).toMatchObject({ ok: false, code: 'INVALID' })
    const room = await create('lin', 'home', '卧室', { recordType: 'space', residenceId: house.id })
    const foreignRoom = await create('yao', 'home', '另一卧室', { recordType: 'space', residenceId: foreignHouse.id })
    const object = await create('lin', 'furniture', '纪念杯', { spaceId: room.id, displayInHome: true, displayReason: '礼物', displayEvidence: ['来历'] })
    for (const spaceId of [foreignRoom.id, house.id, 'deleted']) {
      expect(await updateAsset(object.id, { name: '不应保存', payload: { spaceId } }, { expectedRoleId: 'lin' })).toMatchObject({ ok: false, code: 'INVALID' })
      expect((await getAsset(object.id))?.name).toBe('纪念杯')
      expect((await getAsset(object.id))?.payload.spaceId).toBe(room.id)
    }
    expect(await updateAsset(object.id, { payload: { spaceId: null } }, { expectedRoleId: 'lin' })).toMatchObject({ ok: true })
    expect((await getAsset(object.id))?.payload).not.toHaveProperty('spaceId')
  })
})

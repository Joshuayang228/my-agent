/**
 * W4：Assets 衣柜按 role 隔离；事件可引用 assetId
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import initSqlJs from 'sql.js'
import { BACKUP_LIVING_ASSET_KINDS } from '../../src/shared/types'
import * as identityLoader from '../../electron/main/companion/identity/loader'

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
  ensureStarterBookshelf,
  ensureStarterAssets,
  ensureStarterHome,
  ensureStarterFootprints,
  getStarterAssetDefinitions,
  ensureWorldDefaultPossessions,
  listAssets,
  addAsset,
  createAsset,
  changeWardrobe,
  updateAsset,
  deleteAsset,
  pickWardrobeAssetId,
  maybeGrantFromEvent,
  normalizeGrantAsset,
  formatBookshelfSliceForPrompt,
  ASSET_KIND_BOOKSHELF,
  USER_CREATABLE_ASSET_KINDS,
} = await import('../../electron/main/companion/life/assets')

const { readGeneratedImageReference } =
  await import('../../electron/main/storage/generated-images')

const { ensureDayScripts, __lifeStore } =
  await import('../../electron/main/companion/life/engine')

const { publishAndProjectRange } =
  await import('../../electron/main/companion/life/moments')

const { parseDayScriptPayload } =
  await import('../../electron/main/companion/life/script-generator')

describe('Companion Assets', () => {
  it.each(['lin', 'zhou', 'xia', 'hang', 'unknown-role'])('未定义生活资产的 %s 不从服务默认值生成衣物或文化记录', async roleId => {
    expect(getStarterAssetDefinitions(roleId)).toEqual([])
    expect(await ensureStarterAssets(roleId)).toEqual({ created: 0 })
    expect(await listAssets(roleId)).toEqual([])
    expect(await pickWardrobeAssetId(roleId, 42)).toBeNull()
  })

  beforeEach(() => {
    memDb = new SQL.Database()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    memDb.close()
  })

  it('文化与书架正文保存完整，超限和错误类型不得部分更新', async () => {
    for (const kind of ['culture', 'bookshelf']) {
      const asset = await addAsset({ roleId: 'lin', kind, name: '原作品', payload: { type: 'reading' } })
      const note = '长笔记。\n'.repeat(800)
      expect(note.length).toBe(4000)
      const saved = await updateAsset(asset.id, { payload: { note, detail: '摘要'.repeat(100) } }, { expectedRoleId: 'lin' })
      expect(saved.ok).toBe(true)
      expect((await listAssets('lin', { kind }))[0].payload.note).toBe(note)
      const rejected = await updateAsset(asset.id, { name: '不得保存的新名', payload: { note: `${note}多` } }, { expectedRoleId: 'lin' })
      expect(rejected).toMatchObject({ ok: false, code: 'INVALID' })
      expect(await updateAsset(asset.id, { payload: { note: { invalid: true } } })).toMatchObject({ ok: false, code: 'INVALID' })
      expect((await listAssets('lin', { kind }))[0]).toMatchObject({ name: '原作品', payload: { note } })
      expect(await updateAsset(asset.id, { payload: { note: '跨角色覆盖' } }, { expectedRoleId: 'zhou' })).toMatchObject({ ok: false, code: 'ROLE_MISMATCH' })
      await updateAsset(asset.id, { payload: { note: '' } })
      expect((await listAssets('lin', { kind }))[0].payload.note).toBeUndefined()
    }
  })

  it('书架全文存储不扩张 Prompt 摘要，衣柜短标签保持原规则', async () => {
    const book = await addAsset({ roleId: 'lin', kind: 'bookshelf', name: '书', payload: { note: '文'.repeat(300) } })
    const prompt = formatBookshelfSliceForPrompt([book])
    expect(prompt).toContain('文'.repeat(24))
    expect(prompt).not.toContain('文'.repeat(25))
    const shirt = await addAsset({ roleId: 'lin', kind: 'wardrobe', name: '外套' })
    await updateAsset(shirt.id, { payload: { color: '蓝'.repeat(50) } })
    expect((await listAssets('lin', { kind: 'wardrobe' }))[0].payload.color).toBe('蓝'.repeat(24))
  })

  it('listAssets 支持有界读取并保持角色与 kind 过滤', async () => {
    await addAsset({ roleId: 'lin', kind: 'bookshelf', name: '第一本' })
    await addAsset({ roleId: 'lin', kind: 'bookshelf', name: '第二本' })
    await addAsset({ roleId: 'lin', kind: 'culture', name: '摄影' })
    expect((await listAssets('lin', { kind: 'bookshelf', limit: 1 })).map(item => item.name)).toEqual(['第一本'])
  })

  function useWorldFixture() {
    const load = identityLoader.loadRoleWorldDefaults
    const world = structuredClone(load('hang')!)
    world.home = { ...world.home, shortName: '测试住所', residence: '测试房间', interior: '测试书桌' }
    world.city.name = '测试城市'
    world.favoritePlaces = [{ id: 'park', name: '测试公园', kind: 'park', description: '树荫下', travelMinutes: 10 }]
    world.possessions = [{ id: 'lamp', kind: 'furniture', name: '测试台灯', description: '放在桌上', condition: '完好' }]
    vi.spyOn(identityLoader, 'loadRoleWorldDefaults').mockImplementation((id, universe) => id.startsWith('fixture-') ? structuredClone(world) : load(id, universe))
    return world
  }

  it('住所和常去地点不阻断物件播种，目录与数据库同源并按角色隔离', async () => {
    useWorldFixture()
    await ensureStarterAssets('fixture-a')
    const assets = await listAssets('fixture-a')
    expect(assets.filter((item) => ['home', 'footprint', 'furniture'].includes(item.kind)).map((item) => item.name).sort()).toEqual(['测试住所', '测试公园', '测试台灯'].sort())
    expect(await listAssets('fixture-b')).toEqual([])
    const definitions = getStarterAssetDefinitions('fixture-a').filter((item) => ['home', 'footprint'].includes(item.kind))
    expect(definitions).toHaveLength(2)
    for (const definition of definitions) {
      expect(assets.find((item) => item.kind === definition.kind)).toMatchObject({ name: definition.name, payload: definition.payload })
    }
    definitions[0].payload.residence = '污染副本'
    expect(getStarterAssetDefinitions('fixture-a').find((item) => item.kind === 'home')?.payload.residence).toBe('测试房间')
  })

  it('住所与地点并发播种幂等，编辑保留，全部删除重载数据库后不复活', async () => {
    useWorldFixture()
    await Promise.all([ensureStarterHome('fixture-a'), ensureStarterHome('fixture-a'), ensureStarterFootprints('fixture-a'), ensureStarterFootprints('fixture-a')])
    const assets = await listAssets('fixture-a')
    expect(assets).toHaveLength(2)
    const home = assets.find((item) => item.kind === 'home')!
    await updateAsset(home.id, { name: '新的住所名' }, { expectedRoleId: 'fixture-a' })
    await ensureStarterHome('fixture-a')
    expect((await listAssets('fixture-a', { kind: 'home' }))[0].name).toBe('新的住所名')
    for (const asset of assets) await deleteAsset(asset.id, { expectedRoleId: 'fixture-a' })
    const bytes = memDb.export()
    memDb.close()
    memDb = new SQL.Database(bytes)
    await ensureStarterHome('fixture-a')
    await ensureStarterFootprints('fixture-a')
    expect(await listAssets('fixture-a')).toEqual([])
    await ensureStarterHome('fixture-b')
    expect(await listAssets('fixture-b')).toHaveLength(1)
  })

  it('衣柜读取不补种，用户创建和删除后保持真实状态', async () => {
    expect(await ensureStarterWardrobe('lin')).toEqual({ created: 0 })
    const item = await addAsset({ roleId: 'lin', kind: 'wardrobe', name: '用户外套' })
    expect(await ensureStarterWardrobe('lin')).toEqual({ created: 0 })
    expect(await listAssets('lin', { kind: 'wardrobe' })).toHaveLength(1)
    await deleteAsset(item.id, { expectedRoleId: 'lin' })
    await ensureStarterWardrobe('lin')
    expect(await listAssets('lin', { kind: 'wardrobe' })).toEqual([])
  })

  it('小林未确认的阅读、音乐与影像经历不进入生产目录', () => {
    expect(getStarterAssetDefinitions('lin').filter(item => item.kind === 'culture')).toEqual([])
  })

  it('小林没有 world.default.json，不播种家居或足迹', () => {
    const definitions = getStarterAssetDefinitions('lin')
    expect(definitions.some((item) => item.kind === 'home')).toBe(false)
    expect(definitions.some((item) => item.kind === 'footprint')).toBe(false)
    expect(JSON.stringify(definitions)).not.toContain('城西小公寓')
  })

  it('书架只保留真实写入，初始化不补书且角色隔离', async () => {
    await addAsset({ roleId: 'lin', kind: ASSET_KIND_BOOKSHELF, name: '用户读物' })
    expect(await ensureStarterBookshelf('lin')).toEqual({ created: 0 })
    expect(await ensureStarterBookshelf('zhou')).toEqual({ created: 0 })
    expect((await listAssets('lin', { kind: ASSET_KIND_BOOKSHELF })).map(item => item.name)).toEqual(['用户读物'])
    expect(await listAssets('zhou', { kind: ASSET_KIND_BOOKSHELF })).toEqual([])
  })

  it('打开生活面不凭空填充衣柜、书架与文化记录', async () => {
    expect(await ensureStarterAssets('xia')).toEqual({ created: 0 })
    expect(await listAssets('xia')).toEqual([])
  })

  it('住所事务失败不留下资产或完成标记，修复后可以重试', async () => {
    useWorldFixture()
    await listAssets('fixture-a')
    memDb.run(`CREATE TRIGGER reject_home BEFORE INSERT ON companion_assets
      WHEN NEW.kind = 'home' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`)
    await expect(ensureStarterHome('fixture-a')).rejects.toThrow('fixture failure')
    expect(await listAssets('fixture-a')).toEqual([])
    expect(memDb.exec('SELECT * FROM companion_asset_seeds')).toEqual([])
    memDb.run('DROP TRIGGER reject_home')
    expect(await ensureStarterHome('fixture-a')).toEqual({ created: 1 })
  })

  it('无世界设定不写播种标记，已有运行态住所优先于出厂值', async () => {
    expect(await ensureStarterHome('hang')).toEqual({ created: 0 })
    expect(await ensureStarterFootprints('hang')).toEqual({ created: 0 })
    useWorldFixture()
    await addAsset({ id: 'custom-home', roleId: 'fixture-a', kind: 'home', name: '用户已有住所' })
    expect(await ensureStarterHome('fixture-a')).toEqual({ created: 0 })
    expect((await listAssets('fixture-a'))[0].name).toBe('用户已有住所')
    await deleteAsset('custom-home', { expectedRoleId: 'fixture-a' })
    expect(await ensureStarterHome('fixture-a')).toEqual({ created: 0 })
  })

  it('人物故事未定时，小航不播种默认世界物品', async () => {
    const first = await ensureStarterAssets('hang')
    expect(first.created).toBe(0)
    const seeded = (await listAssets('hang')).filter((asset) => asset.payload.seededFrom === 'world.default')
    expect(seeded).toHaveLength(0)
    const second = await ensureWorldDefaultPossessions('hang')
    expect(second.created).toBe(0)
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

  it('日剧本 moment 仅引用已入库衣物', async () => {
    await addAsset({ roleId: 'lin', kind: 'wardrobe', name: '测试衣物' })
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
    await addAsset({ roleId: 'lin', kind: 'wardrobe', name: '测试衣物' })
    const a = await pickWardrobeAssetId('lin', 42)
    const b = await pickWardrobeAssetId('lin', 42)
    expect(a).toBe(b)
    expect(a).toBeTruthy()
  })

  it('createAsset 与备份使用同一生活资产白名单', () => {
    expect(USER_CREATABLE_ASSET_KINDS).not.toContain('symbolic-item')
    expect(BACKUP_LIVING_ASSET_KINDS).toContain('symbolic-item')
  })

  it('createAsset 只允许白名单类型，超限拒绝且按角色隔离', async () => {
    expect(await createAsset({ roleId: 'lin', kind: 'grant', name: '非法类型' })).toMatchObject({ ok: false, code: 'INVALID' })
    const bounded = '文'.repeat(4000)
    const culture = await createAsset({ roleId: 'lin', kind: 'culture', name: '用户新增作品', payload: { type: 'reading', note: bounded } })
    expect(culture.ok).toBe(true)
    if (!culture.ok) return
    expect(culture.asset.payload.note).toBe(bounded)
    expect(await createAsset({ roleId: 'lin', kind: 'culture', name: '超限作品', payload: { note: `${bounded}多` } })).toMatchObject({ ok: false, code: 'INVALID' })
    expect((await listAssets('lin', { kind: 'culture' })).some((item) => item.name === '超限作品')).toBe(false)
    const furniture = await createAsset({ roleId: 'zhou', kind: 'furniture', name: '用户台灯', payload: { description: '桌边' } })
    expect(furniture.ok).toBe(true)
    expect((await listAssets('lin', { kind: 'furniture' }))).toEqual([])
    expect((await listAssets('zhou', { kind: 'furniture' })).map((item) => item.name)).toEqual(['用户台灯'])
    const wardrobe = await createAsset({ roleId: 'lin', kind: 'wardrobe', name: '用户外套', payload: { color: '蓝'.repeat(50) } })
    expect(wardrobe.ok).toBe(true)
    if (!wardrobe.ok) return
    expect(wardrobe.asset.payload.color).toBe('蓝'.repeat(24))
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

  it('路飞初始化包为千里阳光号、共享甲板、草帽、高处足迹、三件衣物和初始套装全部挂载可读取配图', async () => {
    const seeded = await ensureStarterAssets('luffy')
    expect(seeded.created).toBe(8)

    const assets = await listAssets('luffy')
    expect(assets.filter((item) => item.payload.recordType === 'wear-state')).toEqual([])

    const expectedIds = [
      'home:luffy:residence',
      'home:luffy:space:shared-deck',
      'world:luffy:straw-hat',
      'footprint:luffy:lookout',
      'wardrobe:luffy:red-vest',
      'wardrobe:luffy:blue-shorts',
      'wardrobe:luffy:deck-sandals',
      'wardrobe:luffy:starter-outfit',
    ]
    expect(assets.map((item) => item.id).sort()).toEqual([...expectedIds].sort())

    const space = assets.find((item) => item.id === 'home:luffy:space:shared-deck')!
    expect(space.payload).toMatchObject({
      recordType: 'space',
      residenceId: 'home:luffy:residence',
      visualPath: 'visual/thousand-sunny-interior-v1.png',
      seededFrom: 'world.default',
    })

    const strawHat = assets.find((item) => item.id === 'world:luffy:straw-hat')!
    expect(strawHat.payload).toMatchObject({
      spaceId: 'home:luffy:space:shared-deck',
      visualPath: 'visual/straw-hat-v1.png',
      seededFrom: 'world.default',
    })

    for (const id of expectedIds) {
      const asset = assets.find((item) => item.id === id)!
      const image = asset.payload.image as { id: string; width: number; height: number } | undefined
      expect(image, `${id} 应挂载出厂图片`).toBeTruthy()
      const readResult = await readGeneratedImageReference(image, image!.id)
      expect(readResult.ok).toBe(true)
      if (readResult.ok) {
        expect(readResult.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
      }
    }

    const changed = await changeWardrobe({
      roleId: 'luffy',
      assetId: 'wardrobe:luffy:starter-outfit',
      expectedVersion: 0,
    })
    expect(changed.ok).toBe(true)
    if (changed.ok) {
      expect(changed.asset.payload).toMatchObject({
        recordType: 'wear-state',
        outfitVersion: 1,
        imageOutfitVersion: 1,
      })
      expect(changed.asset.payload.image).toBeTruthy()
    }
  })

  it('旧库已播种的路飞资产在 ensureStarterAssets 时无损补齐配图与空间，删除套装后不复活', async () => {
    await addAsset({
      id: 'home:luffy:residence',
      roleId: 'luffy',
      kind: 'home',
      name: '用户自定义千里阳光号',
      payload: { shortName: '千里阳光号', residence: '用户改过的描述', seededFrom: 'world.default' },
    })
    await addAsset({
      id: 'footprint:luffy:lookout',
      roleId: 'luffy',
      kind: 'footprint',
      name: '能看见远处的高处',
      payload: { placeKind: 'viewpoint', description: '旧库地点', travelMinutes: 10, city: '海上航路', seededFrom: 'world.default' },
    })
    await addAsset({
      id: 'world:luffy:straw-hat',
      roleId: 'luffy',
      kind: 'symbolic-item',
      name: '草帽',
      payload: { description: '旧库草帽', condition: '完好', seededFrom: 'world.default' },
    })
    for (const [key, name, category] of [
      ['red-vest', '轻便红色背心', 'top'],
      ['blue-shorts', '深蓝短裤', 'bottom'],
      ['deck-sandals', '甲板凉鞋', 'shoes'],
    ] as const) {
      await addAsset({
        id: `wardrobe:luffy:${key}`,
        roleId: 'luffy',
        kind: 'wardrobe',
        name,
        payload: { recordType: 'garment', category, seededFrom: 'role-pack:luffy' },
      })
    }
    memDb.run(`CREATE TABLE IF NOT EXISTS companion_asset_seeds (role_id TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY (role_id, kind))`)
    memDb.run(`INSERT INTO companion_asset_seeds (role_id, kind) VALUES ('luffy', 'home'), ('luffy', 'footprint')`)

    await ensureStarterAssets('luffy')
    const after = await listAssets('luffy')
    const residence = after.find((item) => item.id === 'home:luffy:residence')!
    expect(residence.name).toBe('用户自定义千里阳光号')
    expect(residence.payload.residence).toBe('用户改过的描述')
    expect(residence.payload.image).toBeTruthy()
    expect(after.find((item) => item.id === 'home:luffy:space:shared-deck')?.payload.image).toBeTruthy()
    expect(after.find((item) => item.id === 'world:luffy:straw-hat')?.payload).toMatchObject({
      spaceId: 'home:luffy:space:shared-deck',
    })
    expect(after.find((item) => item.id === 'world:luffy:straw-hat')?.payload.image).toBeTruthy()
    expect(after.find((item) => item.id === 'wardrobe:luffy:starter-outfit')?.payload.image).toBeTruthy()

    await deleteAsset('wardrobe:luffy:starter-outfit', { expectedRoleId: 'luffy' })
    await ensureStarterAssets('luffy')
    expect((await listAssets('luffy')).some((item) => item.id === 'wardrobe:luffy:starter-outfit')).toBe(false)
  })
})

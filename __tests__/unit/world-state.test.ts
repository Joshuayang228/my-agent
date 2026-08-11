/**
 * M23-G2：世界状态编解码 + 情境刷新
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

vi.mock('../../electron/main/storage/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../electron/main/storage/database')>()
  return {
    ...actual,
    getDatabase: vi.fn(async () => memDb),
    persist: vi.fn(),
  }
})

const {
  defaultWorldState,
  formatWorldSliceForPrompt,
  parseWorldJson,
} = await import('../../electron/main/companion/life/world-codec')

const {
  ensureWorldState,
  refreshSituationFromLife,
} = await import('../../electron/main/companion/life/world-state')

const store = await import('../../electron/main/companion/life/store')

describe('world-codec', () => {
  it('主角出厂居所分味', () => {
    expect(defaultWorldState('lin').home).toContain('公寓')
    expect(defaultWorldState('zhou').home).toContain('合租')
    expect(defaultWorldState('xia').home).toContain('小屋')
  })

  it('有 world.default.json 时优先使用 Role Pack 默认世界', () => {
    const world = defaultWorldState('hang')
    expect(world.home).toBe('未设定')
    expect(world.timezone).toBe('Asia/Shanghai')
  })

  it('formatWorldSliceForPrompt 拼一行', () => {
    const line = formatWorldSliceForPrompt({
      ...defaultWorldState('lin'),
      home: '城西小公寓',
      timezone: 'Asia/Shanghai',
      situation: '午饭散步@附近街道',
      currentLocation: '附近街道',
      currentActivity: '午饭散步',
      updatedAt: 1,
    })
    expect(line).toContain('居所城西小公寓')
    expect(line).toContain('时区Asia/Shanghai')
    expect(line).toContain('近况午饭散步@附近街道')
    expect(line).toContain('心情60/100')
    expect(line).toContain('当前地点附近街道')
  })

  it('parseWorldJson 坏 JSON 直接重置为当前角色出厂世界', () => {
    const w = parseWorldJson('{bad', 'hang')
    expect(w.schemaVersion).toBe(1)
    expect(w.home).toBe('未设定')
    expect(w.timezone).toBe('Asia/Shanghai')
    expect(w.energy).toBe(60)
  })

  it('旧三字段 world_json 不迁移，直接丢弃并重置', () => {
    const w = parseWorldJson(JSON.stringify({
      home: '旧住处',
      timezone: 'Asia/Shanghai',
      situation: '看书@家',
      updatedAt: 3,
    }), 'hang')
    expect(w.schemaVersion).toBe(1)
    expect(w.home).toBe('未设定')
    expect(w.situation).toBe('')
    expect(w.currentLocation).toBe('未设定')

    const existingRole = parseWorldJson(JSON.stringify({
      home: '自定义旧住处',
      timezone: 'Asia/Shanghai',
      situation: '看书@家',
      updatedAt: 3,
    }), 'lin')
    expect(existingRole.home).toBe('城西小公寓')
    expect(existingRole.situation).toBe('')
  })
})

describe('world-state store', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
  })

  afterEach(() => {
    memDb.close()
  })

  it('ensureWorldState 写入出厂居所', async () => {
    const w = await ensureWorldState('lin')
    expect(w.home).toBe('城西小公寓')
    const again = await store.getRoleState('lin')
    expect(again?.world.home).toBe('城西小公寓')
  })

  it('ensureWorldState 将旧 world_json 覆盖为 schemaVersion 1', async () => {
    await ensureWorldState('hang')
    memDb.run(
      `UPDATE companion_role_state SET world_json = ? WHERE role_id = ?`,
      [JSON.stringify({ home: '旧住处', timezone: 'Asia/Shanghai', situation: '' }), 'hang'],
    )
    const world = await ensureWorldState('hang')
    expect(world.schemaVersion).toBe(1)
    expect(world.home).toBe('未设定')
    const row = memDb.exec(`SELECT world_json FROM companion_role_state WHERE role_id = 'hang'`)
    const saved = JSON.parse(String(row[0].values[0][0]))
    expect(saved.schemaVersion).toBe(1)
    expect(saved.home).toBe('未设定')
  })

  it('refreshSituationFromLife 用最近 published 事件', async () => {
    await ensureWorldState('lin')
    const now = Date.now()
    await store.insertEvent({
      roleId: 'lin',
      scheduledAt: now - 1000,
      status: 'published',
      type: 'moment',
      dayScriptId: null,
      payload: { activity: '午饭散步', location: '附近街道' },
    })
    const w = await refreshSituationFromLife('lin', now)
    expect(w.situation).toBe('午饭散步@附近街道')
    expect(w.currentLocation).toBe('附近街道')
    expect(w.locationDetail).toBe('')
    expect(w.currentActivity).toBe('午饭散步')
  })

  it('情境短句相同但结构字段缺失时仍补齐当前位置与活动', async () => {
    const now = Date.now()
    await store.setWorldState('lin', {
      ...defaultWorldState('lin'),
      situation: '午饭散步@附近街道',
      currentLocation: '',
      currentActivity: '',
      updatedAt: now - 1,
    })
    await store.insertEvent({
      roleId: 'lin',
      scheduledAt: now,
      type: 'moment',
      status: 'published',
      payload: { activity: '午饭散步', location: '附近街道' },
      dayScriptId: null,
    })
    const world = await refreshSituationFromLife('lin', now)
    expect(world.currentLocation).toBe('附近街道')
    expect(world.currentActivity).toBe('午饭散步')
  })
})

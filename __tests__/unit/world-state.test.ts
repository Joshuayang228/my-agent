import { runLocalTransaction } from '../helpers/local-transaction'
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
    withDatabaseTransaction: async (work: (db: typeof memDb) => Promise<unknown>) => runLocalTransaction(memDb, work), getDatabase: vi.fn(async () => memDb),
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
  settleVitalsAfterChat,
} = await import('../../electron/main/companion/life/world-state')

const store = await import('../../electron/main/companion/core/persistence/life-repository')

const { getCompanionRuntimeState, replaceCompanionRuntimeState } = await import('../../electron/main/companion/core/state/runtime-state')

async function setWorldState(roleId: string, world: ReturnType<typeof defaultWorldState>) {
  const current = await getCompanionRuntimeState(roleId)
  await replaceCompanionRuntimeState({ ...current, ...world })
}

describe('world-codec', () => {
  it('没有 world.default.json 时不编造住所或当前位置', () => {
    for (const roleId of ['lin', 'zhou', 'xia', 'unknown-role']) {
      const world = defaultWorldState(roleId)
      expect(world.home).toBe('未设定')
      expect(world.currentLocation).toBe('未设定')
      expect(world.home).not.toContain('公寓')
      expect(formatWorldSliceForPrompt(world)).not.toContain('城西小公寓')
      expect(formatWorldSliceForPrompt(world)).not.toContain('日常住处')
    }
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
    expect(existingRole.home).toBe('未设定')
    expect(existingRole.currentLocation).toBe('未设定')
    expect(existingRole.situation).toBe('')
  })

  it('读取时回收旧 codec 编造的居所，不改用户后来写的地点', () => {
    const invented = parseWorldJson(JSON.stringify({
      schemaVersion: 1,
      home: '城西小公寓',
      timezone: 'Asia/Shanghai',
      situation: '午饭散步@附近街道',
      mood: 60,
      energy: 70,
      socialNeed: 45,
      currentLocation: '家',
      locationDetail: '',
      currentActivity: '午饭散步',
      statusTags: [],
      updatedAt: 9,
    }), 'lin')
    expect(invented.home).toBe('未设定')
    expect(invented.currentLocation).toBe('未设定')
    expect(invented.situation).toBe('午饭散步@附近街道')

    const userEdited = parseWorldJson(JSON.stringify({
      schemaVersion: 1,
      home: '自己后来写的房间',
      timezone: 'Asia/Shanghai',
      situation: '看书@咖啡馆',
      mood: 60,
      energy: 70,
      socialNeed: 45,
      currentLocation: '咖啡馆',
      locationDetail: '',
      currentActivity: '看书',
      statusTags: [],
      updatedAt: 9,
    }), 'lin')
    expect(userEdited.home).toBe('自己后来写的房间')
    expect(userEdited.currentLocation).toBe('咖啡馆')
  })
})

describe('world-state store', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
  })

  afterEach(() => {
    memDb.close()
  })

  it('ensureWorldState 写入未确认居所，不编造公寓', async () => {
    const w = await ensureWorldState('lin')
    expect(w.home).toBe('未设定')
    expect(w.currentLocation).toBe('未设定')
    const again = await getCompanionRuntimeState('lin')
    expect(again?.home).toBe('未设定')
    expect(again?.currentLocation).toBe('未设定')
  })

  it('Core 缺少状态时从 Role Pack 初始化，不创建旧状态镜像', async () => {
    const world = await ensureWorldState('hang')
    expect(world.schemaVersion).toBe(1)
    expect(world.home).toBe('未设定')
    expect(memDb.exec("SELECT name FROM sqlite_master WHERE name = 'companion_role_state'")[0]?.values ?? []).toEqual([])
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
    await setWorldState('lin', {
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

  it('refreshSituationFromLife 结算新生活事件并波动 mood / energy / socialNeed', async () => {
    const baseNow = 1000000000000
    await setWorldState('lin', {
      ...defaultWorldState('lin'),
      mood: 60,
      energy: 70,
      socialNeed: 45,
      updatedAt: baseNow,
    })
    // 插入比 updatedAt 晚的午睡事件
    await store.insertEvent({
      roleId: 'lin',
      scheduledAt: baseNow + 1000,
      type: 'moment',
      status: 'published',
      payload: { activity: '甲板下午打盹小憩', location: '甲板' },
      dayScriptId: null,
    })
    const updated = await refreshSituationFromLife('lin', baseNow + 2000)
    // 睡眠应恢复精力
    expect(updated.energy).toBeGreaterThan(70)
    expect(updated.updatedAt).toBe(baseNow + 2000)
  })

  it('settleVitalsAfterChat 对话后释放社交渴望并微升心情', async () => {
    await setWorldState('lin', {
      ...defaultWorldState('lin'),
      mood: 60,
      energy: 70,
      socialNeed: 80,
      updatedAt: 12345,
    })
    const after = await settleVitalsAfterChat('lin')
    expect(after.socialNeed).toBe(65)
    expect(after.mood).toBe(62)
    // 保持原有的 updatedAt，不污染事件结算水位线
    expect(after.updatedAt).toBe(12345)
  })
})

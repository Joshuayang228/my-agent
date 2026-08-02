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
  mergeWorldDefaults,
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

  it('formatWorldSliceForPrompt 拼一行', () => {
    const line = formatWorldSliceForPrompt({
      home: '城西小公寓',
      timezone: 'Asia/Shanghai',
      situation: '午饭散步@附近街道',
      updatedAt: 1,
    })
    expect(line).toContain('居所城西小公寓')
    expect(line).toContain('时区Asia/Shanghai')
    expect(line).toContain('近况午饭散步@附近街道')
  })

  it('parseWorldJson 坏 JSON 回落空片', () => {
    const w = parseWorldJson('{bad')
    expect(w.home).toBe('')
    expect(w.timezone).toBe('Asia/Shanghai')
  })

  it('mergeWorldDefaults 不覆盖已有 home', () => {
    const m = mergeWorldDefaults('lin', {
      home: '自定义窝',
      timezone: '',
      situation: '在忙',
      updatedAt: 0,
    })
    expect(m.home).toBe('自定义窝')
    expect(m.timezone).toBe('Asia/Shanghai')
    expect(m.situation).toBe('在忙')
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
  })
})

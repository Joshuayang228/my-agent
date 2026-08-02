/**
 * 召唤子会话：装载非 active Pack，不改 activeRoleId，标记 session_kind=summon
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

vi.mock('../../electron/main/companion/streaming-gate', () => ({
  isStreamingActive: () => false,
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

const { startSummonSession, getActiveRoleId } = await import(
  '../../electron/main/companion/orchestrator'
)
const { getSession } = await import('../../electron/main/storage/session-store')

describe('companion summon session', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    activeRoleId = 'lin'
    memDb.run(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '新对话',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        total_prompt_tokens INTEGER NOT NULL DEFAULT 0,
        total_completion_tokens INTEGER NOT NULL DEFAULT 0,
        role_id TEXT NOT NULL DEFAULT '',
        session_kind TEXT NOT NULL DEFAULT 'main'
      )
    `)
    memDb.run(`
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT,
        tool_call_id TEXT,
        created_at INTEGER NOT NULL,
        sort_order INTEGER NOT NULL
      )
    `)
  })

  afterEach(() => {
    memDb.close()
  })

  it('startSummonSession 创建 summon 会话且不改 active', async () => {
    const result = await startSummonSession('chen', { force: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.sessionKind).toBe('summon')
    expect(result.roleId).toBe('chen')
    expect(result.name).toBe('陈姐')
    expect(await getActiveRoleId()).toBe('lin')

    const session = await getSession(result.sessionId)
    expect(session?.roleId).toBe('chen')
    expect(session?.sessionKind).toBe('summon')
    expect(session?.messages).toEqual([])
  })

  it('召唤活跃主角退化为 main 会话', async () => {
    const result = await startSummonSession('lin')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sessionKind).toBe('main')
    expect(result.roleId).toBe('lin')
  })

  it('忙时婉拒（可 force）', async () => {
    // 固定到陈姐忙时段：周三 15 点；random 恒 0 → 必婉拒
    const busyNow = new Date(2026, 7, 5, 15, 0, 0).getTime() // Aug 5 2026 Wed
    const busy = await startSummonSession('chen', {
      now: busyNow,
      random: () => 0,
    })
    expect(busy.ok).toBe(false)
    if (busy.ok) return
    expect(busy.error).toBe('BUSY')
    expect(busy.reason).toBeTruthy()

    const forced = await startSummonSession('chen', {
      force: true,
      now: busyNow,
      random: () => 0,
    })
    expect(forced.ok).toBe(true)
  })

  it('未知角色失败', async () => {
    const result = await startSummonSession('no-such-role')
    expect(result.ok).toBe(false)
  })
})

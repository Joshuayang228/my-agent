/**
 * 工作区会话持久化与伙伴直通连通（Workspace Session Persistence & Companion Link）测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import initSqlJs from 'sql.js'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: {
    getAllWindows: () => [],
  },
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

vi.mock('../../electron/main/storage/database', async () => {
  const actual = await vi.importActual<typeof import('../../electron/main/storage/database')>('../../electron/main/storage/database')
  return {
    ...actual,
    getDatabase: vi.fn(async () => memDb),
    persist: vi.fn(),
  }
})

vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === 'activeRoleId') return 'luffy'
    return ''
  }),
  setSetting: vi.fn(async () => {}),
}))

vi.mock('../../electron/main/storage/llm-debug-store', () => ({
  llmDebugStore: {
    clear: vi.fn(async () => {}),
  },
}))

const {
  getOrCreateWorkspaceSession,
  clearWorkspaceSession,
  saveMessage,
  getSession,
  listSessions,
} = await import('../../electron/main/storage/session-store')

describe('工作区会话持久化（Workspace Session Persistence）', () => {
  beforeEach(async () => {
    memDb = new SQL.Database()
    memDb.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id                       TEXT PRIMARY KEY,
        title                    TEXT NOT NULL DEFAULT '新对话',
        created_at               INTEGER NOT NULL,
        updated_at               INTEGER NOT NULL,
        total_prompt_tokens      INTEGER NOT NULL DEFAULT 0,
        total_completion_tokens  INTEGER NOT NULL DEFAULT 0,
        role_id                  TEXT NOT NULL DEFAULT '',
        session_kind             TEXT NOT NULL DEFAULT 'main',
        parent_session_id        TEXT
      );
      CREATE TABLE IF NOT EXISTS messages (
        id                TEXT PRIMARY KEY,
        session_id        TEXT NOT NULL,
        role              TEXT NOT NULL,
        content           TEXT NOT NULL,
        created_at        INTEGER NOT NULL,
        sort_order        INTEGER NOT NULL,
        tool_calls        TEXT,
        tool_call_id      TEXT,
        generated_images  TEXT
      );
      CREATE TABLE IF NOT EXISTS system_state (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    memDb.run("INSERT INTO system_state (key, value) VALUES ('schema_version', '25')")
  })

  it('首次调用 getOrCreateWorkspaceSession 自动创建，再次调用复用已有会话并保留消息历史', async () => {
    const parentId = 'main-session-abc'
    const session1 = await getOrCreateWorkspaceSession(parentId)
    expect(session1).not.toBeNull()
    expect(session1.sessionKind).toBe('workspace')
    expect(session1.parentSessionId).toBe(parentId)
    expect(session1.messages).toEqual([])

    // 在该工作区会话中保存一条讨论消息
    await saveMessage(session1.id, {
      id: 'msg-ws-1',
      role: 'user',
      content: '请帮我重构一下这个函数',
      timestamp: Date.now(),
    })

    // 模拟组件重新挂载或切换回该主会话
    const session2 = await getOrCreateWorkspaceSession(parentId)
    expect(session2.id).toBe(session1.id)
    expect(session2.parentSessionId).toBe(parentId)
    expect(session2.messages.length).toBe(1)
    expect(session2.messages[0].content).toBe('请帮我重构一下这个函数')
  })

  it('不同主会话的工作区侧聊完全隔离', async () => {
    const sessionA = await getOrCreateWorkspaceSession('main-session-A')
    const sessionB = await getOrCreateWorkspaceSession('main-session-B')

    expect(sessionA.id).not.toBe(sessionB.id)
    expect(sessionA.parentSessionId).toBe('main-session-A')
    expect(sessionB.parentSessionId).toBe('main-session-B')

    // 工作区会话不出现在主会话列表（listSessions 排除 workspace）
    const allSummaries = await listSessions()
    const workspaceInList = allSummaries.find((s) => s.sessionKind === 'workspace')
    expect(workspaceInList).toBeUndefined()
  })

  it('clearWorkspaceSession 能够清空旧会话并开启全新的空白工作区会话', async () => {
    const parentId = 'main-session-clear-test'
    const oldSession = await getOrCreateWorkspaceSession(parentId)
    await saveMessage(oldSession.id, {
      id: 'msg-to-delete',
      role: 'user',
      content: '旧讨论内容',
      timestamp: Date.now(),
    })

    const newSession = await clearWorkspaceSession(parentId)
    expect(newSession.id).not.toBe(oldSession.id)
    expect(newSession.parentSessionId).toBe(parentId)
    expect(newSession.messages).toEqual([])

    // 旧会话已被删除
    const oldCheck = await getSession(oldSession.id)
    expect(oldCheck).toBeNull()

    // 再次查询该 parentId 获取到的是清空后的新会话
    const reCheck = await getOrCreateWorkspaceSession(parentId)
    expect(reCheck.id).toBe(newSession.id)
  })
})

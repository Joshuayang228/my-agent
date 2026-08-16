import { describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: {},
  BrowserWindow: {},
  safeStorage: { isEncryptionAvailable: () => false },
}))

vi.mock('../../electron/main/storage/session-store', () => ({}))
vi.mock('../../electron/main/storage/memory-store', () => ({}))
vi.mock('../../electron/main/storage/settings-store', () => ({
  isAppSettingKey: (key: string) => ['currentProject', 'recentProjects', 'llmModel'].includes(key),
}))
vi.mock('../../electron/main/storage/database', () => ({}))

import { collectExportSessions, importSessionsIntoDatabase, isSafeBackupSettingKey, isValidExportData } from '../../electron/main/ipc/data-export'
import { buildSafeChildProcessEnv } from '../../electron/main/utils/safe-process-env'
import { isAuthorizedProjectSelection, isPathInsideRoot } from '../../electron/main/ipc/project'
import { isRendererWritableSettingKey } from '../../electron/main/ipc/settings'
import { isBlockedAddress, validateFetchUrl } from '../../electron/main/tools/builtins/url-fetch'

const validExport = {
  version: 1 as const,
  exportedAt: Date.now(),
  sessions: [{
    id: "session-' OR 1=1 --",
    title: '测试',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    roleId: 'role-1',
    sessionKind: 'main' as const,
    messages: [{
      id: 'message-1',
      role: 'user' as const,
      content: '你好',
      timestamp: Date.now(),
    }],
  }],
  memories: [],
  settings: { llmModel: 'test-model' },
}

describe('安全边界', () => {
  it('导入校验允许普通文本 ID，但拒绝错误结构', () => {
    expect(isValidExportData(validExport)).toBe(true)
    expect(isValidExportData({ ...validExport, sessions: 'not-an-array' })).toBe(false)
    expect(isValidExportData({ ...validExport, settings: { llmModel: 'x'.repeat(1_000_001) } })).toBe(false)
    expect(isValidExportData({ ...validExport, memories: [{ id: 'm1', category: 'arbitrary', content: 'x', createdAt: 1, updatedAt: 1 }] })).toBe(false)
    expect(isValidExportData({ ...validExport, memories: [{ id: 'm1', category: 'fact', content: 'api_key=sk-secret-value', createdAt: 1, updatedAt: 1 }] })).toBe(false)
  })



  it('备份导出/导入 SQL 与当前 snake_case schema 一致，并保留消息顺序', async () => {
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    db.run(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        role_id TEXT NOT NULL DEFAULT '',
        session_kind TEXT NOT NULL DEFAULT 'main'
      );
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT,
        tool_call_id TEXT,
        created_at INTEGER NOT NULL,
        sort_order INTEGER NOT NULL
      );
    `)

    const count = importSessionsIntoDatabase(db, validExport.sessions)
    expect(count).toBe(1)
    expect(importSessionsIntoDatabase(db, validExport.sessions)).toBe(0)

    const messageRows = db.exec('SELECT session_id, content, sort_order FROM messages ORDER BY sort_order')
    expect(messageRows[0]?.values).toEqual([[validExport.sessions[0].id, '你好', 0]])

    const sessions = await collectExportSessions(db, async (sessionId) => ({
      id: sessionId,
      createdAt: validExport.sessions[0].createdAt,
      roleId: 'role-1',
      sessionKind: 'main',
      messages: validExport.sessions[0].messages,
    }))
    expect(sessions[0]).toMatchObject({
      id: validExport.sessions[0].id,
      roleId: 'role-1',
      sessionKind: 'main',
      messages: [{ content: '你好', timestamp: validExport.sessions[0].messages[0].timestamp }],
    })
    db.close()
  })

  it('备份设置白名单排除凭据、执行入口、权限和本机路径', () => {
    expect(isSafeBackupSettingKey('llmModel')).toBe(true)
    expect(isSafeBackupSettingKey('llmApiKey')).toBe(false)
    expect(isSafeBackupSettingKey('mcpServers')).toBe(false)
    expect(isSafeBackupSettingKey('permissionRules')).toBe(false)
    expect(isSafeBackupSettingKey('executionMode')).toBe(false)
    expect(isSafeBackupSettingKey('currentProject')).toBe(false)
  })


  it('Renderer 不能通过 settings/project IPC 任意扩大工作区', () => {
    expect(isRendererWritableSettingKey('currentProject')).toBe(false)
    expect(isRendererWritableSettingKey('recentProjects')).toBe(false)
    expect(isRendererWritableSettingKey('llmModel')).toBe(true)

    const recents = [{ path: 'C:/work/app', name: 'app' }]
    expect(isAuthorizedProjectSelection('C:/work/app', null, recents)).toBe(true)
    expect(isAuthorizedProjectSelection('C:/Users/demo', null, recents)).toBe(false)
    expect(isAuthorizedProjectSelection('C:/work/current', 'C:/work/current', [])).toBe(true)
  })

  it('项目文件 IPC 的路径守卫拒绝项目外路径和相邻目录前缀', () => {
    expect(isPathInsideRoot('C:/work/app/src/index.ts', 'C:/work/app')).toBe(true)
    expect(isPathInsideRoot('C:/work/app/../secrets.txt', 'C:/work/app')).toBe(false)
    expect(isPathInsideRoot('C:/work/app-evil/file.txt', 'C:/work/app')).toBe(false)
  })

  it('URL 抓取阻止环回、私网和链路本地地址', async () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true)
    expect(isBlockedAddress('192.168.1.10')).toBe(true)
    expect(isBlockedAddress('169.254.169.254')).toBe(true)
    expect(isBlockedAddress('::ffff:7f00:1')).toBe(true)
    expect(isBlockedAddress('8.8.8.8')).toBe(false)
    await expect(validateFetchUrl('http://127.0.0.1:9222/json')).resolves.toMatchObject({ ok: false })
    await expect(validateFetchUrl('https://user:pass@example.com')).resolves.toMatchObject({ ok: false })
  })

  it('子进程环境默认过滤凭据键，显式覆盖仍由调用方负责', () => {
    const original = process.env
    vi.stubEnv('LLM_API_KEY', 'secret-value')
    vi.stubEnv('PATH', 'safe-path')
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'aws-secret')
    vi.stubEnv('DATABASE_URL', 'postgres://secret')
    const env = buildSafeChildProcessEnv({ EXPLICIT_TOKEN: 'user-supplied' })
    expect(env.LLM_API_KEY).toBeUndefined()
    expect(env.PATH).toBe('safe-path')
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined()
    expect(env.DATABASE_URL).toBeUndefined()
    expect(env.EXPLICIT_TOKEN).toBe('user-supplied')
    process.env = original
  })
})

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
  MAX_SETTING_VALUE_LENGTH: 1_000_000,
  isAppSettingKey: (key: string) => ['currentProject', 'recentProjects', 'llmModel'].includes(key),
}))
vi.mock('../../electron/main/storage/database', () => ({}))

import { collectExportLivingAssets, collectExportLivingAssetSeeds, collectExportSessions, importBackupPayload, importLivingAssetsIntoDatabase, importSessionsIntoDatabase, isSafeBackupSettingKey, isValidExportData, redactModelConnections } from '../../electron/main/ipc/data-export'
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

const livingAsset = {
  id: 'culture:lin:backup-book',
  roleId: 'lin',
  kind: 'culture',
  name: '备份验收作品',
  payload: { type: 'reading', note: '真实备份应带回这条笔记' },
  acquiredAt: 1,
  sourceEventId: null,
}

describe('安全边界', () => {
  it('导入校验允许普通文本 ID，但拒绝错误结构', () => {
    expect(isValidExportData(validExport)).toBe(true)
    expect(isValidExportData({ ...validExport, livingAssets: undefined, livingAssetSeeds: undefined })).toBe(true)
    expect(isValidExportData({ ...validExport, sessions: 'not-an-array' })).toBe(false)
    expect(isValidExportData({ ...validExport, settings: { llmModel: 'x'.repeat(1_000_001) } })).toBe(false)
    expect(isValidExportData({ ...validExport, memories: [{ id: 'm1', category: 'arbitrary', content: 'x', createdAt: 1, updatedAt: 1 }] })).toBe(false)
    expect(isValidExportData({ ...validExport, memories: [{ id: 'm1', category: 'fact', content: 'api_key=sk-secret-value', createdAt: 1, updatedAt: 1 }] })).toBe(false)
    expect(isValidExportData({ ...validExport, livingAssets: [{ ...livingAsset, kind: 'secret' }] })).toBe(false)
    expect(isValidExportData({ ...validExport, livingAssets: [{ ...livingAsset, name: '超长'.repeat(30) }] })).toBe(false)
  })



  it('生活资产备份按 id 合并，失败时会话与资产一起回滚', async () => {
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
    db.run(`
      CREATE TABLE companion_assets (
        id TEXT PRIMARY KEY,
        role_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        acquired_at INTEGER NOT NULL,
        source_event_id TEXT
      );
      CREATE TABLE companion_asset_seeds (
        role_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        PRIMARY KEY (role_id, kind)
      );
    `)
    db.run(
      `INSERT INTO companion_assets (id, role_id, kind, name, payload_json, acquired_at, source_event_id)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [livingAsset.id, livingAsset.roleId, livingAsset.kind, '已有作品', JSON.stringify({ type: 'reading' }), 9],
    )

    const first = importLivingAssetsIntoDatabase(db, [livingAsset, {
      ...livingAsset,
      id: 'furniture:lin:lamp',
      kind: 'furniture',
      name: '备份台灯',
      payload: { description: '桌边一盏灯' },
    }], [{ roleId: 'lin', kind: 'home' }])
    expect(first).toEqual({ assets: 1, seeds: 1 })
    expect(importLivingAssetsIntoDatabase(db, [livingAsset], [{ roleId: 'lin', kind: 'home' }])).toEqual({ assets: 0, seeds: 0 })
    expect(db.exec("SELECT name FROM companion_assets WHERE id = 'culture:lin:backup-book'")[0]?.values).toEqual([['已有作品']])

    db.run(`CREATE TRIGGER reject_bad_asset BEFORE INSERT ON companion_assets
      BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`)
    expect(() => importBackupPayload(db, {
      sessions: [{ ...validExport.sessions[0], id: 'session-rollback' }],
      livingAssets: [{ ...livingAsset, id: 'furniture:lin:rollback-lamp', kind: 'furniture', name: '回滚台灯' }],
      livingAssetSeeds: [{ roleId: 'lin', kind: 'footprint' }],
    })).toThrow()
    db.run('DROP TRIGGER reject_bad_asset')
    expect(db.exec("SELECT id FROM sessions WHERE id = 'session-rollback'")).toEqual([])
    expect(db.exec("SELECT id FROM companion_assets WHERE id = 'furniture:lin:rollback-lamp'")).toEqual([])
    expect(db.exec("SELECT kind FROM companion_asset_seeds WHERE kind = 'footprint'")).toEqual([])

    const collected = collectExportLivingAssets(db)
    expect(collected.find((item) => item.id === 'furniture:lin:lamp')?.payload).toEqual({ description: '桌边一盏灯' })
    expect(collectExportLivingAssetSeeds(db)).toEqual([{ roleId: 'lin', kind: 'home' }])
    db.close()
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
    expect(isSafeBackupSettingKey('companionResponseNote')).toBe(true)
    expect(isSafeBackupSettingKey('llmModel')).toBe(true)
    expect(isSafeBackupSettingKey('llmApiKey')).toBe(false)
    expect(isSafeBackupSettingKey('mcpServers')).toBe(false)
    expect(isSafeBackupSettingKey('permissionRules')).toBe(false)
    expect(isSafeBackupSettingKey('executionMode')).toBe(false)
    expect(isSafeBackupSettingKey('currentProject')).toBe(false)
    expect(isSafeBackupSettingKey('modelConnections')).toBe(true)
    expect(redactModelConnections(JSON.stringify([{ id: 'c', apiKey: 'secret', baseUrl: 'https://example.test', model: 'm' }]))).not.toContain('secret')
    expect(redactModelConnections(JSON.stringify([{ id: 'c', apiKey: 'secret', baseUrl: 'https://example.test', model: 'm' }]))).toContain('"apiKey":""')
  })

  it('导入在写库前拒绝超长相处偏好，兼容旧备份', () => {
    expect(isValidExportData(validExport)).toBe(true)
    expect(isValidExportData({ ...validExport, settings: { companionResponseNote: '好'.repeat(4000) } })).toBe(true)
    expect(isValidExportData({ ...validExport, settings: { companionResponseNote: '好'.repeat(4001) } })).toBe(false)
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

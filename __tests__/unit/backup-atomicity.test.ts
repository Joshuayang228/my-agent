import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import initSqlJs from 'sql.js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ handlers: new Map<string, Function>(), open: vi.fn(), persist: vi.fn(), vector: vi.fn() }))
vi.mock('electron', () => ({
  app: { getPath: () => root }, ipcMain: { handle: (name: string, handler: Function) => state.handlers.set(name, handler) },
  dialog: { showOpenDialog: state.open }, BrowserWindow: { fromWebContents: (sender: any) => sender.window },
  safeStorage: { isEncryptionAvailable: () => true, encryptString: (s: string) => Buffer.from(s), decryptString: (b: Buffer) => b.toString() },
}))
vi.mock('../../electron/main/storage/database', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../electron/main/storage/database')>(), getDatabase: async () => db, persist: state.persist,
}))
vi.mock('../../electron/main/memory/vector-store', () => ({ addToVectorStore: state.vector, removeFromVectorStore: vi.fn() }))
vi.mock('../../electron/main/llm/aux-config', () => ({ loadMainLLMConfig: async () => ({ apiKey: 'test-only' }) }))
vi.mock('../../electron/main/utils/asset-usage', () => ({ recordAssetUsage: vi.fn() }))
import { isValidExportData, registerDataExportIPC } from '../../electron/main/ipc/data-export'
import { drainMemoryBackgroundTasks } from '../../electron/main/storage/memory-store'
import { atomicWriteFileSync } from '../../electron/main/storage/database'

const SQL = await initSqlJs()
let db: InstanceType<typeof SQL.Database>
let root: string
let backupPath: string
let databasePath: string
beforeEach(() => {
  vi.clearAllMocks()
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-atomicity-'))
  backupPath = path.join(root, 'backup.json')
  databasePath = path.join(root, 'database.db')
  db = new SQL.Database()
  db.run(`CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT, created_at INTEGER, updated_at INTEGER, role_id TEXT, session_kind TEXT);
    CREATE TABLE messages (id TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE, role TEXT, content TEXT, tool_calls TEXT, tool_call_id TEXT, generated_images TEXT, created_at INTEGER, sort_order INTEGER);
    CREATE TABLE memories (id TEXT PRIMARY KEY, category TEXT, content TEXT, createdAt INTEGER, updatedAt INTEGER, role_id TEXT);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE companion_assets (id TEXT PRIMARY KEY, role_id TEXT, kind TEXT, name TEXT, payload_json TEXT, acquired_at INTEGER, source_event_id TEXT);
    CREATE TABLE companion_asset_seeds (role_id TEXT, kind TEXT, PRIMARY KEY(role_id, kind));
    PRAGMA foreign_keys = ON;`)
  state.persist.mockImplementation(() => atomicWriteFileSync(databasePath, db.export()))
  state.persist()
  state.persist.mockClear()
  fs.writeFileSync(backupPath, JSON.stringify({ version: 1, exportedAt: 1,
    sessions: [{ id: 'import-session', title: '恢复会话', createdAt: 1, updatedAt: 1, messages: [{ id: 'import-message', role: 'user', content: '恢复正文', timestamp: 1 }] }],
    memories: [{ id: 'memory', category: 'fact', content: '喜欢在清晨散步', createdAt: 1, updatedAt: 1 }], settings: { companionResponseNote: '请直接回答' },
    livingAssets: [{ id: 'asset', roleId: 'role', kind: 'culture', name: '书架', payload: {}, acquiredAt: 1, sourceEventId: null }],
    livingAssetSeeds: [{ roleId: 'role', kind: 'culture' }],
  }))
  state.open.mockResolvedValue({ canceled: false, filePaths: [backupPath] })
  registerDataExportIPC()
})
afterEach(async () => {
  await drainMemoryBackgroundTasks()
  vi.restoreAllMocks()
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})
function invoke() {
  expect(isValidExportData(JSON.parse(fs.readFileSync(backupPath, 'utf8')))).toBe(true)
  const sender = Object.assign(new EventEmitter(), { mainFrame: {}, isDestroyed: () => false, window: { isDestroyed: () => false } })
  return state.handlers.get('data:import')!({ sender, senderFrame: sender.mainFrame })
}
function counts(database = db) {
  return ['sessions', 'messages', 'memories', 'settings', 'companion_assets', 'companion_asset_seeds']
    .map(table => database.exec(`SELECT COUNT(*) FROM ${table}`)[0].values[0][0])
}

it('设置写入失败时会话、记忆、生活资产和磁盘均不留下部分导入，向量任务不提前发布', async () => {
  db.run("CREATE TRIGGER reject_import_setting BEFORE INSERT ON settings BEGIN SELECT RAISE(ABORT, 'test failure'); END")
  const before = counts()
  expect(await invoke()).toMatchObject({ success: false })
  await drainMemoryBackgroundTasks()
  expect(counts()).toEqual(before)
  const reopened = new SQL.Database(fs.readFileSync(databasePath))
  try { expect(counts(reopened)).toEqual(before) } finally { reopened.close() }
  expect(state.vector).not.toHaveBeenCalled()
})

it('最后写盘失败时恢复内存数据且不发向量任务，随后可以完整重试并只落盘一次', async () => {
  const originalBytes = fs.readFileSync(databasePath)
  vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('test rename failure') })
  expect(await invoke()).toMatchObject({ success: false })
  await drainMemoryBackgroundTasks()
  expect(counts()).toEqual([0, 0, 0, 0, 0, 0])
  expect(state.vector).not.toHaveBeenCalled()
  expect(fs.readFileSync(databasePath)).toEqual(originalBytes)
  state.persist.mockClear()
  expect(await invoke()).toMatchObject({ success: true, stats: { sessions: 1, memories: 1, settings: 1, livingAssets: 1, livingAssetSeeds: 1 } })
  expect(state.persist).toHaveBeenCalledTimes(1)
  expect(counts()).toEqual([1, 1, 1, 1, 1, 1])
  const reopened = new SQL.Database(fs.readFileSync(databasePath))
  try { expect(counts(reopened)).toEqual([1, 1, 1, 1, 1, 1]) } finally { reopened.close() }
})

it('导入与普通记忆共用语义去重，设置密文在提交前准备，重复导入不覆盖当前数据', async () => {
  const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
  data.memories.push({ ...data.memories[0], id: 'near-duplicate', content: '喜欢在清晨散步。' })
  data.settings.modelConnections = JSON.stringify([{ id: 'connection', apiKey: '', baseUrl: 'https://example.invalid', models: [] }])
  fs.writeFileSync(backupPath, JSON.stringify(data))
  expect(await invoke()).toMatchObject({ success: true, stats: { memories: 1, settings: 2 } })
  expect(db.exec("SELECT value FROM settings WHERE key = 'modelConnections'")[0].values[0][0]).toMatch(/^enc:v1:/)
  db.run("UPDATE sessions SET title = '当前名称'")
  expect(await invoke()).toMatchObject({ success: true, stats: { sessions: 0, memories: 0, settings: 0, livingAssets: 0, livingAssetSeeds: 0 } })
  expect(db.exec('SELECT title FROM sessions')[0].values[0][0]).toBe('当前名称')
})

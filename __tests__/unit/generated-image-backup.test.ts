import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import initSqlJs from 'sql.js'
import sharp from 'sharp'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ handlers: new Map<string, Function>(), save: vi.fn(), open: vi.fn(), persist: vi.fn() }))
vi.mock('electron', () => ({
  app: { getPath: () => root }, ipcMain: { handle: (name: string, handler: Function) => state.handlers.set(name, handler) },
  dialog: { showSaveDialog: state.save, showOpenDialog: state.open },
  BrowserWindow: { fromWebContents: (sender: any) => sender.window },
}))
vi.mock('../../electron/main/llm/index', () => ({ chatComplete: vi.fn() }))
vi.mock('../../electron/main/storage/llm-debug-store', () => ({ llmDebugStore: { clear: vi.fn() } }))
vi.mock('../../electron/main/storage/settings-store', () => ({ getSetting: async () => 'role', getAllSettings: async () => ({}), setSetting: vi.fn() }))
vi.mock('../../electron/main/storage/memory-store', () => ({ listMemories: async () => [], addMemory: vi.fn(), assertMemoryContentAllowed: vi.fn() }))
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: async () => db, persist: state.persist }))

import { collectExportSessions, isValidExportData, registerDataExportIPC, type ExportData } from '../../electron/main/ipc/data-export'
import { collectBackupImageMedia, prepareBackupImages } from '../../electron/main/storage/generated-image-backup'
import { createSession, deleteSession, getSession, saveMessage } from '../../electron/main/storage/session-store'
import { readGeneratedImage } from '../../electron/main/storage/generated-images'

const SQL = await initSqlJs()
let db: InstanceType<typeof SQL.Database>
let root: string
let backup: string
beforeEach(() => {
  vi.clearAllMocks()
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'image-backup-')))
  backup = path.join(root, 'backup.json')
  db = new SQL.Database()
  db.run(`CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT, created_at INTEGER, updated_at INTEGER, role_id TEXT, session_kind TEXT);
    CREATE TABLE messages (id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, tool_calls TEXT, tool_call_id TEXT, generated_images TEXT, created_at INTEGER, sort_order INTEGER);`)
  state.save.mockResolvedValue({ canceled: false, filePath: backup })
  state.open.mockResolvedValue({ canceled: false, filePaths: [backup] })
  registerDataExportIPC()
})
afterEach(() => { vi.restoreAllMocks(); db.close(); fs.rmSync(root, { recursive: true, force: true }) })

function invoke(action: 'export' | 'import') {
  const sender = Object.assign(new EventEmitter(), { mainFrame: {}, isDestroyed: () => false, window: { isDestroyed: () => false } })
  return state.handlers.get(`data:${action}`)!({ sender, senderFrame: sender.mainFrame })
}
async function fixture() {
  const session = await createSession('role')
  const bytes = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#348368' } }).png().toBuffer()
  const id = createHash('sha256').update(bytes).digest('hex')
  const folder = path.join(root, 'project', 'images')
  fs.mkdirSync(folder, { recursive: true })
  const file = path.join(folder, 'test.png')
  fs.writeFileSync(file, bytes)
  await saveMessage(session.id, { id: 'assistant', role: 'assistant', content: '', timestamp: 1, toolCalls: [{ id: 'call', name: 'image_generate', arguments: '{"prompt":"测试","path":"images/test.png"}' }] })
  await saveMessage(session.id, { id: 'result', role: 'tool', content: '图片已保存', timestamp: 2, toolCallId: 'call', generatedImages: [{ id, path: file, width: 3, height: 2, byteLength: bytes.length, mimeType: 'image/png' }] })
  return { session, bytes, id, file }
}
const restoredDirectories = () => fs.readdirSync(root).filter(name => name.startsWith('restored-images-'))

it('真实备份在原图和会话删除后恢复工具卡及图片，重开 SQLite 后可读取且重复导入不复制媒体', async () => {
  const { session, file } = await fixture()
  expect(await invoke('export')).toMatchObject({ success: true, stats: { sessions: 1 } })
  const data = JSON.parse(fs.readFileSync(backup, 'utf8')) as ExportData
  expect(isValidExportData(data)).toBe(true)
  expect(data.generatedImageMedia).toHaveLength(1)
  expect(JSON.stringify(data)).not.toContain(root.replaceAll('\\', '\\\\'))
  expect(data.sessions[0].messages[1].generatedImages![0]).not.toHaveProperty('path')
  await deleteSession(session.id)
  fs.unlinkSync(file)
  expect(await invoke('import')).toMatchObject({ success: true, stats: { sessions: 1 } })
  const snapshot = db.export(); db.close(); db = new SQL.Database(snapshot)
  const restored = (await getSession(session.id))!
  expect(restored.messages[0].toolCalls?.[0].id).toBe('call')
  expect(restored.messages[1].toolCallId).toBe('call')
  const image = restored.messages[1].generatedImages![0]
  expect(image.path.startsWith(root + path.sep)).toBe(true)
  expect(image.path).not.toBe(file)
  expect(await readGeneratedImage(session.id, image.id)).toMatchObject({ ok: true, fileName: 'test.png' })
  const folders = restoredDirectories()
  expect(await invoke('import')).toMatchObject({ success: true, stats: { sessions: 0 } })
  expect(restoredDirectories()).toEqual(folders)
  expect((await getSession(session.id))!.messages[1].generatedImages![0].path).toBe(image.path)
  expect(await invoke('export')).toMatchObject({ success: true })
  expect(isValidExportData(JSON.parse(fs.readFileSync(backup, 'utf8')))).toBe(true)
})

it('原图缺失或被替换时导出明确失败，不写残缺备份', async () => {
  const { file } = await fixture()
  fs.writeFileSync(file, 'changed')
  expect(await invoke('export')).toMatchObject({ success: false, error: expect.stringContaining('无法读取') })
  expect(fs.existsSync(backup)).toBe(false)
  fs.unlinkSync(file)
  expect(await invoke('export')).toMatchObject({ success: false })
  expect(fs.existsSync(backup)).toBe(false)
})

it.each(['path', 'filename', 'missing', 'orphan', 'role', 'pair', 'duplicate', 'dimensions', 'bytes', 'count'])('导入预检拒绝非法图片包 %s，零业务写入', async kind => {
  const { session } = await fixture()
  expect(await invoke('export')).toMatchObject({ success: true })
  const data = JSON.parse(fs.readFileSync(backup, 'utf8'))
  const reference = data.sessions[0].messages[1].generatedImages[0]
  if (kind === 'path') reference.path = 'C:/private/file.png'
  if (kind === 'filename') reference.fileName = '../../outside.png'
  if (kind === 'missing') data.generatedImageMedia = []
  if (kind === 'orphan') data.sessions[0].messages[1].generatedImages = []
  if (kind === 'role') data.sessions[0].messages[1].role = 'user'
  if (kind === 'pair') data.sessions[0].messages[1].toolCallId = 'unknown'
  if (kind === 'duplicate') data.generatedImageMedia.push(data.generatedImageMedia[0])
  if (kind === 'dimensions') reference.width = 8193
  if (kind === 'bytes') data.generatedImageMedia[0].data = '*'.repeat(data.generatedImageMedia[0].data.length)
  if (kind === 'count') data.generatedImageMedia = Array(33).fill(data.generatedImageMedia[0])
  fs.writeFileSync(backup, JSON.stringify(data))
  await deleteSession(session.id)
  expect(await invoke('import')).toMatchObject({ success: false })
  expect(await getSession(session.id)).toBeNull()
  expect(restoredDirectories()).toEqual([])
})

it('带正确摘要的坏 PNG 或虚假尺寸也不能通过完整解码', async () => {
  const { bytes } = await fixture()
  const sessions = await collectExportSessions(db)
  const media = await collectBackupImageMedia(sessions)
  await expect(prepareBackupImages([{ ...media[0], width: 4 }])).rejects.toThrow('损坏')
  const broken = bytes.subarray(0, 40)
  await expect(prepareBackupImages([{ ...media[0], data: broken.toString('base64'), byteLength: broken.length, id: createHash('sha256').update(broken).digest('hex') }])).rejects.toThrow('损坏')
})

it('图片落盘后会话事务失败时回滚记录并清理本批目录，保留原项目文件', async () => {
  const { session, file } = await fixture()
  expect(await invoke('export')).toMatchObject({ success: true })
  await deleteSession(session.id)
  db.run(`CREATE TRIGGER reject_restore BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`)
  expect(await invoke('import')).toMatchObject({ success: false })
  expect(await getSession(session.id)).toBeNull()
  expect(restoredDirectories()).toEqual([])
  expect(fs.existsSync(file)).toBe(true)
})

it('写图片失败时没有残留恢复目录或会话，重试仍能成功', async () => {
  const { session, file } = await fixture()
  expect(await invoke('export')).toMatchObject({ success: true })
  await deleteSession(session.id)
  const write = fs.writeFileSync
  const failure = vi.spyOn(fs, 'writeFileSync').mockImplementation((...args: Parameters<typeof fs.writeFileSync>) => {
    if (typeof args[0] === 'number') throw new Error('fixture disk full')
    return write(...args)
  })
  expect(await invoke('import')).toMatchObject({ success: false })
  expect(await getSession(session.id)).toBeNull()
  expect(restoredDirectories()).toEqual([])
  expect(fs.existsSync(file)).toBe(true)
  failure.mockRestore()
  expect(await invoke('import')).toMatchObject({ success: true })
})

it('新会话与已有消息 ID 冲突时不静默丢消息，也不留下未引用图片', async () => {
  const { session } = await fixture()
  expect(await invoke('export')).toMatchObject({ success: true })
  const data = JSON.parse(fs.readFileSync(backup, 'utf8'))
  data.sessions[0].id = 'conflicting-new-session'
  fs.writeFileSync(backup, JSON.stringify(data))
  expect(await invoke('import')).toMatchObject({ success: false })
  expect(await getSession('conflicting-new-session')).toBeNull()
  expect((await getSession(session.id))!.messages).toHaveLength(2)
  expect(restoredDirectories()).toEqual([])
})

it('最终数据库快照失败时撤销新会话与媒体，重试仍能恢复', async () => {
  const { session } = await fixture()
  expect(await invoke('export')).toMatchObject({ success: true })
  await deleteSession(session.id)
  state.persist.mockImplementationOnce(() => { throw new Error('fixture persist failure') })
  expect(await invoke('import')).toMatchObject({ success: false })
  expect(await getSession(session.id)).toBeNull()
  expect(restoredDirectories()).toEqual([])
  expect(await invoke('import')).toMatchObject({ success: true })
  expect(await getSession(session.id)).not.toBeNull()
})

it('拒绝超过 16MB 的媒体总量及重复消息 ID', async () => {
  await fixture()
  expect(await invoke('export')).toMatchObject({ success: true })
  const data = JSON.parse(fs.readFileSync(backup, 'utf8'))
  const media = data.generatedImageMedia[0]
  const large = 'A'.repeat(4 * Math.ceil(8 * 1024 * 1024 / 3))
  data.generatedImageMedia = ['a', 'b', 'c'].map(value => ({ ...media, id: value.repeat(64), byteLength: 8 * 1024 * 1024, data: large }))
  expect(isValidExportData(data)).toBe(false)
  await expect(prepareBackupImages(data.generatedImageMedia)).rejects.toThrow('超出限制')
  const duplicate = JSON.parse(fs.readFileSync(backup, 'utf8'))
  duplicate.sessions[0].messages.push(duplicate.sessions[0].messages[0])
  expect(isValidExportData(duplicate)).toBe(false)
})

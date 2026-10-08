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
vi.mock('../../electron/main/storage/settings-store', () => ({ getSetting: async () => 'role', getAllSettings: async () => ({}), setSetting: vi.fn(), publishModelConfigurationCommitted: vi.fn() }))
vi.mock('../../electron/main/storage/memory-store', () => ({ listMemories: async () => [], addMemory: vi.fn(), assertMemoryContentAllowed: vi.fn() }))
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: async () => db, persist: state.persist }))

import { collectExportSessions, isValidExportData, registerDataExportIPC, type ExportData } from '../../electron/main/ipc/data-export'
import { collectBackupImageMedia, prepareBackupImages } from '../../electron/main/storage/generated-image-backup'
import { createSession, deleteSession, getSession, saveMessage } from '../../electron/main/storage/session-store'
import { readGeneratedImage } from '../../electron/main/storage/generated-images'
import { insertEvent, insertMoment, replaceEventLinks } from '../../electron/main/companion/life/store'
import { momentImageIdsForRole, readMomentImageForRole } from '../../electron/main/companion/life/moment-images'

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
async function fixture(compressionLevel = 6) {
  const session = await createSession('role')
  const bytes = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#348368' } }).png({ compressionLevel }).toBuffer()
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

it('图片恢复重新编码改变摘要时，朋友圈事件和图片关联同步到新媒体并可读取', async () => {
  const { session, file, id } = await fixture(0)
  const event = await insertEvent({ roleId: 'role', status: 'published', scheduledAt: 1, type: 'walk', dayScriptId: null, payload: { imageId: id, imageIds: [id], activity: '真实散步' } })
  const post = await insertMoment({ roleId: 'role', eventId: event.id, publishedAt: 1, text: '带配图的真实动态' })
  if (!post) throw new Error('fixture moment missing')
  await replaceEventLinks('role', event.id, [{ targetType: 'image', targetId: id, relation: 'depicts', metadata: { position: 0 } }])
  expect(await invoke('export')).toMatchObject({ success: true })
  for (const table of ['companion_event_links', 'companion_moments', 'companion_events']) db.run(`DELETE FROM ${table}`)
  await deleteSession(session.id)
  fs.unlinkSync(file)
  expect(await invoke('import')).toMatchObject({ success: true })
  const restoredSession = (await getSession(session.id))!
  const restoredImage = restoredSession.messages[1].generatedImages![0]
  expect(restoredImage.id).not.toBe(id)
  expect(await momentImageIdsForRole('role', post.id)).toEqual([restoredImage.id])
  expect(await readMomentImageForRole('role', post.id, restoredImage.id)).toMatchObject({ ok: true })
  const payload = JSON.parse(String(db.exec('SELECT payload_json FROM companion_events')[0].values[0][0]))
  expect(payload).toMatchObject({ imageId: restoredImage.id, imageIds: [restoredImage.id], activity: '真实散步' })
  const snapshot = db.export(); db.close(); db = new SQL.Database(snapshot)
  expect(await readMomentImageForRole('role', post.id, restoredImage.id)).toMatchObject({ ok: true })
  const folders = restoredDirectories()
  expect(await invoke('import')).toMatchObject({ success: true, stats: { sessions: 0 } })
  expect(restoredDirectories()).toEqual(folders)
})

it.each([false, true])('同像素图片恢复合并不重复导入，说明冲突则零写入（冲突=%s）', async conflicting => {
  const { session, file, id, bytes } = await fixture(0)
  const secondBytes = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#348368' } }).png({ compressionLevel: 9 }).toBuffer()
  const secondId = createHash('sha256').update(secondBytes).digest('hex')
  expect(secondId).not.toBe(id)
  const secondFile = path.join(path.dirname(file), 'second.png')
  fs.writeFileSync(secondFile, secondBytes)
  const refs = [{ id, path: file, width: 3, height: 2, byteLength: bytes.length, mimeType: 'image/png' }, { id: secondId, path: secondFile, width: 3, height: 2, byteLength: secondBytes.length, mimeType: 'image/png' }]
  db.run('UPDATE messages SET generated_images = ? WHERE id = ?', [JSON.stringify(refs), 'result'])
  const event = await insertEvent({ roleId: 'role', status: 'published', scheduledAt: 1, type: 'walk', dayScriptId: null, payload: { imageIds: [id, secondId] } })
  const post = await insertMoment({ roleId: 'role', eventId: event.id, publishedAt: 1, text: '同像素两种编码' })
  if (!post) throw new Error('fixture moment missing')
  await replaceEventLinks('role', event.id, refs.map((ref, position) => ({ targetType: 'image', targetId: ref.id, relation: 'depicts', metadata: { position, ...(conflicting ? { caption: `说明-${position}` } : {}) } })))
  expect(await invoke('export')).toMatchObject({ success: true })
  for (const table of ['companion_event_links', 'companion_moments', 'companion_events']) db.run(`DELETE FROM ${table}`)
  await deleteSession(session.id)
  fs.unlinkSync(file); fs.unlinkSync(secondFile)
  const result = await invoke('import')
  if (conflicting) {
    expect(result).toMatchObject({ success: false })
    expect(await getSession(session.id)).toBeNull()
    expect(db.exec('SELECT COUNT(*) FROM companion_event_links')[0].values[0][0]).toBe(0)
    expect(restoredDirectories()).toEqual([])
    return
  }
  expect(result).toMatchObject({ success: true })
  const restored = (await getSession(session.id))!.messages[1].generatedImages!
  expect(restored[0].id).toBe(restored[1].id)
  expect(await momentImageIdsForRole('role', post.id)).toEqual([restored[0].id])
  expect(await invoke('import')).toMatchObject({ success: true, stats: { sessions: 0 } })
  expect(await momentImageIdsForRole('role', post.id)).toEqual([restored[0].id])
  expect(db.exec('SELECT COUNT(*) FROM companion_event_links')[0].values[0][0]).toBe(1)
})

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

it('人物世界资产图片与会话图片共用媒体备份，并在导入时重写为新路径', async () => {
  const { session, file, id, bytes } = await fixture()
  db.run(`CREATE TABLE companion_assets (
    id TEXT PRIMARY KEY, role_id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL,
    payload_json TEXT NOT NULL, acquired_at INTEGER NOT NULL, source_event_id TEXT
  );`)
  db.run(`INSERT INTO companion_assets (id, role_id, kind, name, payload_json, acquired_at, source_event_id)
    VALUES (?, ?, ?, ?, ?, ?, NULL)`, ['home:role:tea', 'role', 'home', '窗边茶桌', JSON.stringify({ image: { id, path: file, mimeType: 'image/png', width: 3, height: 2, byteLength: bytes.length } }), 1])
  expect(await invoke('export')).toMatchObject({ success: true, stats: { livingAssets: 1 } })
  const data = JSON.parse(fs.readFileSync(backup, 'utf8')) as ExportData
  expect(data.generatedImageMedia).toHaveLength(1)
  expect(data.livingAssets?.[0].payload.image).not.toHaveProperty('path')
  db.run('DELETE FROM companion_assets')
  await deleteSession(session.id)
  fs.unlinkSync(file)
  expect(await invoke('import')).toMatchObject({ success: true, stats: { livingAssets: 1 } })
  const row = db.exec("SELECT payload_json FROM companion_assets WHERE id = 'home:role:tea'")[0]?.values[0]?.[0]
  const restored = JSON.parse(String(row)) as { image: { id: string; path: string } }
  expect(restored.image.id).toBe(id)
  expect(restored.image.path).not.toBe(file)
  expect(restored.image.path.startsWith(root + path.sep)).toBe(true)
})

it('人物世界结构化记录与共享穿搭配图经真实备份恢复和数据库重开不丢字段', async () => {
  const { session, file, id, bytes } = await fixture()
  db.run(`CREATE TABLE companion_assets (
    id TEXT PRIMARY KEY, role_id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL,
    payload_json TEXT NOT NULL, acquired_at INTEGER NOT NULL, source_event_id TEXT
  );`)
  const image = { id, path: file, mimeType: 'image/png', width: 3, height: 2, byteLength: bytes.length }
  const slots = { top: 'top', bottom: 'bottom', shoes: 'shoes' }
  const records = [
    { id: 'top', kind: 'wardrobe', payload: { recordType: 'garment', category: 'top' } },
    { id: 'bottom', kind: 'wardrobe', payload: { recordType: 'garment', category: 'bottom' } },
    { id: 'shoes', kind: 'wardrobe', payload: { recordType: 'garment', category: 'shoes' } },
    { id: 'outfit', kind: 'wardrobe', payload: { recordType: 'outfit', slots, outfitVersion: 2, imageOutfitVersion: 2, image } },
    { id: 'wear', kind: 'wardrobe', payload: { recordType: 'wear-state', slots, outfitVersion: 7, imageOutfitVersion: 7, image } },
    { id: 'reading', kind: 'bookshelf', payload: { type: 'reading', readingStatus: 'reading', readingNotes: Array.from({ length: 200 }, (_, index) => ({ id: `note-${index}`, text: '完整笔记'.repeat(1000), page: index + 1, occurredAt: 42 })) } },
    { id: 'residence', kind: 'home', payload: { recordType: 'residence', description: '真实住所' } },
    { id: 'room', kind: 'home', payload: { recordType: 'space', residenceId: 'residence', description: '真实房间' } },
    { id: 'object', kind: 'furniture', payload: { spaceId: 'room', displayInHome: true, displayReason: '有真实故事', displayEvidence: ['事件记录', '长期习惯'] } },
    { id: 'trip', kind: 'footprint', payload: { recordType: 'trip', status: 'completed', destination: '苏州', start: '2026-09-26', end: '2026-09-27', story: '旅途故事', stops: [{ id: 'stop-one', name: '老街', date: '2026-09-26', story: '停留经历' }] } },
  ]
  for (const record of records) db.run('INSERT INTO companion_assets VALUES (?, ?, ?, ?, ?, ?, NULL)', [record.id, 'role', record.kind, record.id, JSON.stringify(record.payload), 1])
  db.run('INSERT INTO companion_assets VALUES (?, ?, ?, ?, ?, ?, NULL)', ['other-book', 'other', 'bookshelf', '其他角色书籍', JSON.stringify({ readingNotes: [{ id: 'other-note', text: '其他人物的笔记' }] }), 2])
  expect(await invoke('export')).toMatchObject({ success: true, stats: { livingAssets: 11 } })
  const data = JSON.parse(fs.readFileSync(backup, 'utf8')) as ExportData
  expect(isValidExportData(data)).toBe(true)
  expect(data.generatedImageMedia).toHaveLength(1)
  db.run('DELETE FROM companion_assets')
  await deleteSession(session.id)
  fs.unlinkSync(file)
  expect(await invoke('import')).toMatchObject({ success: true, stats: { livingAssets: 11 } })
  const snapshot = db.export(); db.close(); db = new SQL.Database(snapshot)
  const restored = new Map(db.exec('SELECT id, role_id, payload_json FROM companion_assets')[0].values.map(row => [String(row[0]), { roleId: String(row[1]), payload: JSON.parse(String(row[2])) }]))
  for (const record of records) {
    const expected = { ...record.payload } as Record<string, unknown>
    delete expected.image
    expect(restored.get(record.id)).toMatchObject({ roleId: 'role', payload: expected })
  }
  const restoredImage = restored.get('outfit')!.payload.image
  expect(restored.get('wear')!.payload.image).toEqual(restoredImage)
  expect(restoredImage.path).not.toBe(file)
  expect(fs.existsSync(restoredImage.path)).toBe(true)
  expect(restored.get('other-book')).toMatchObject({ roleId: 'other', payload: { readingNotes: [{ id: 'other-note', text: '其他人物的笔记' }] } })
  const folders = restoredDirectories()
  expect(await invoke('import')).toMatchObject({ success: true, stats: { livingAssets: 0 } })
  expect(restoredDirectories()).toEqual(folders)
})

it('扩容后的生活记录备份仍在业务写入前拒绝单资产超限和超大文件', async () => {
  const { session } = await fixture()
  expect(await invoke('export')).toMatchObject({ success: true })
  const data = JSON.parse(fs.readFileSync(backup, 'utf8')) as ExportData
  data.livingAssets = [{ id: 'oversized', roleId: 'role', kind: 'bookshelf', name: '超限书籍', acquiredAt: 1, sourceEventId: null, payload: { note: 'x'.repeat(6_000_001) } }]
  expect(isValidExportData(data)).toBe(false)
  fs.writeFileSync(backup, JSON.stringify(data))
  await deleteSession(session.id)
  state.persist.mockClear()
  expect(await invoke('import')).toMatchObject({ success: false, error: '备份文件格式无效或包含超限数据' })
  expect(await getSession(session.id)).toBeNull()
  expect(state.persist).not.toHaveBeenCalled()
  expect(restoredDirectories()).toEqual([])
  fs.writeFileSync(backup, ' '.repeat(25 * 1024 * 1024 + 1))
  expect(await invoke('import')).toMatchObject({ success: false, error: '备份文件过大，无法导入' })
  expect(state.persist).not.toHaveBeenCalled()
  expect(restoredDirectories()).toEqual([])
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

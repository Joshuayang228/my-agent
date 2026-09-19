import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { loadGeneratedImageFile, readGeneratedImage } from '../../electron/main/storage/generated-images'
import { runMigrations } from '../../electron/main/storage/database'

vi.mock('electron', () => ({ app: { getPath: () => '.' } }))
vi.mock('../../electron/main/llm/index', () => ({ chatComplete: vi.fn() }))
vi.mock('../../electron/main/storage/llm-debug-store', () => ({ llmDebugStore: { clear: vi.fn() } }))
vi.mock('../../electron/main/storage/settings-store', () => ({ getSetting: vi.fn(async () => 'role') }))
vi.mock('../../electron/main/storage/database', async importOriginal => ({ ...await importOriginal<typeof import('../../electron/main/storage/database')>(), getDatabase: async () => db, persist: vi.fn() }))

const SQL = await initSqlJs()
let db: InstanceType<typeof SQL.Database>
let root: string
const { createSession, saveMessage, getSession, forkSession, deleteSession } = await import('../../electron/main/storage/session-store')
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'generated-image-read-'))
  db = new SQL.Database()
  db.run(`CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO meta VALUES ('schema_version', '16');
    CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT, created_at INTEGER, updated_at INTEGER, role_id TEXT, session_kind TEXT);
    CREATE TABLE messages (id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, tool_calls TEXT, tool_call_id TEXT, created_at INTEGER, sort_order INTEGER);`)
  runMigrations(db)
})
afterEach(() => { db.close(); fs.rmSync(root, { recursive: true, force: true }) })

it('生成引用经真实 SQLite 保存、导出重开、分支后不丢失，删除不影响分支', async () => {
  const session = await createSession('role')
  const generatedImages = [{ id: 'image-1', path: 'images/result.png', mimeType: 'image/png' as const, width: 1, height: 1, byteLength: 68 }]
  await saveMessage(session.id, { id: 'tool-call', role: 'tool', content: '已生成图片', timestamp: 1, toolCallId: 'call', generatedImages })
  const exported = db.export(); db.close(); db = new SQL.Database(exported)
  expect((await getSession(session.id))?.messages[0]).toMatchObject({ generatedImages, content: '已生成图片' })
  const fork = await forkSession(session.id, 'tool-call')
  expect(fork.messages[0].generatedImages).toEqual(generatedImages)
  expect((await getSession(fork.id))?.messages[0].generatedImages).toEqual(generatedImages)
  await deleteSession(session.id)
  expect(await getSession(session.id)).toBeNull()
  expect((await getSession(fork.id))?.messages[0].generatedImages).toEqual(generatedImages)
})

it('用户消息不能持久化伪造生成引用，普通文本消息不附加媒体字段', async () => {
  const session = await createSession('role')
  await saveMessage(session.id, { id: 'user', role: 'user', content: '你好', timestamp: 1, generatedImages: [{ id: 'fake', path: '/secret', mimeType: 'image/png', width: 1, height: 1, byteLength: 1 }] })
  expect((await getSession(session.id))?.messages[0]).not.toHaveProperty('generatedImages')
})

it('读取仅接受本会话图片 ID，真实文件替换、移动及跨会话引用失败', async () => {
  const session = await createSession('role')
  const other = await createSession('role')
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'green' } }).png().toBuffer()
  const id = createHash('sha256').update(bytes).digest('hex')
  const directory = path.join(root, 'images'); fs.mkdirSync(directory)
  const filePath = path.join(directory, 'test.png'); fs.writeFileSync(filePath, bytes)
  await saveMessage(session.id, { id: 'image-result', role: 'tool', content: '已生成图片', timestamp: 1, toolCallId: 'call', generatedImages: [{ id, path: filePath, mimeType: 'image/png', width: 2, height: 2, byteLength: bytes.length }] })
  expect(await readGeneratedImage(session.id, id)).toEqual({ ok: true, fileName: 'test.png', dataUrl: `data:image/png;base64,${bytes.toString('base64')}` })
  expect(await loadGeneratedImageFile(session.id, id)).toEqual({ ok: true, bytes, filePath })
  expect((await readGeneratedImage(other.id, id)).ok).toBe(false)
  expect((await loadGeneratedImageFile(other.id, id)).ok).toBe(false)
  expect((await readGeneratedImage(session.id, filePath)).ok).toBe(false)
  const tampered = Buffer.from(bytes); tampered[tampered.length - 1] ^= 1; fs.writeFileSync(filePath, tampered)
  expect((await readGeneratedImage(session.id, id)).ok).toBe(false)
  expect((await loadGeneratedImageFile(session.id, id)).ok).toBe(false)
  fs.unlinkSync(filePath)
  expect((await readGeneratedImage(session.id, id)).ok).toBe(false)
})

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import initSqlJs from 'sql.js'
import sharp from 'sharp'

const SQL = await initSqlJs()
let db: InstanceType<typeof SQL.Database>
let root: string
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: async () => db, persist: vi.fn() }))
vi.mock('../../electron/main/utils/logger', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }))
const { insertEvent, insertMoment, replaceEventLinks } = await import('../../electron/main/companion/life/store')
const { momentImageIdsForRole, readMomentImageForRole } = await import('../../electron/main/companion/life/moment-images')
beforeEach(() => {
  db = new SQL.Database()
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'moment-images-')))
  fs.mkdirSync(path.join(root, 'images'))
  db.run(`CREATE TABLE sessions (id TEXT PRIMARY KEY, role_id TEXT);
    CREATE TABLE messages (session_id TEXT, role TEXT, generated_images TEXT, created_at INTEGER);
    CREATE TABLE companion_assets (id TEXT PRIMARY KEY, role_id TEXT, payload_json TEXT);`)
})
afterEach(() => { db.close(); fs.rmSync(root, { recursive: true, force: true }) })

async function image() {
  const bytes = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#348368' } }).png().toBuffer()
  const id = createHash('sha256').update(bytes).digest('hex')
  const file = path.join(root, 'images', 'moment.png')
  fs.writeFileSync(file, bytes)
  return { id, path: file, mimeType: 'image/png', width: 3, height: 2, byteLength: bytes.length }
}
async function moment(roleId: string, imageId: string, status: 'published' | 'planned' = 'published') {
  const event = await insertEvent({ roleId, status, scheduledAt: 1, type: 'walk', dayScriptId: null, payload: {} })
  await replaceEventLinks(roleId, event.id, [{ targetType: 'image', targetId: imageId, relation: 'depicts' }])
  return insertMoment({ roleId, eventId: event.id, publishedAt: 1, text: '真实动态' })
}

it('已发布动态仅读取同角色工具图片，数据库重开后关联仍有效', async () => {
  const reference = await image()
  db.run('INSERT INTO sessions VALUES (?, ?)', ['session', 'lin'])
  db.run('INSERT INTO messages VALUES (?, ?, ?, ?)', ['session', 'tool', JSON.stringify([reference]), 1])
  const post = await moment('lin', reference.id)
  const snapshot = db.export(); db.close(); db = new SQL.Database(snapshot)
  expect(await momentImageIdsForRole('lin', post.id)).toEqual([reference.id])
  expect(await readMomentImageForRole('lin', post.id, reference.id)).toMatchObject({ ok: true, fileName: 'moment.png', dataUrl: expect.stringMatching(/^data:image\/png;base64,/) })
  expect(await readMomentImageForRole('other', post.id, reference.id)).toMatchObject({ ok: false })
  expect(await readMomentImageForRole('lin', post.id, 'b'.repeat(64))).toMatchObject({ ok: false })
})

it('多图关联按显式顺序展示并限制九张，不依赖随机关联 ID 排序', async () => {
  const post = await moment('lin', 'a'.repeat(64))
  const ids = Array.from({ length: 10 }, (_, index) => index.toString(16).repeat(64))
  await replaceEventLinks('lin', post.eventId, ids.toReversed().map((targetId, index) => ({ targetType: 'image', targetId, relation: 'depicts', metadata: { position: 9 - index } })))
  expect(await momentImageIdsForRole('lin', post.id)).toEqual(ids.slice(0, 9))
})

it('事件多图投影保留旧单图入口，去重并持久化图片顺序', async () => {
  const { projectMomentFromEvent } = await import('../../electron/main/companion/life/moments')
  const ids = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)]
  const event = await insertEvent({ roleId: 'lin', status: 'published', scheduledAt: 1, type: 'walk', dayScriptId: null, payload: { imageId: ids[0], imageIds: [ids[1], ids[0], 'invalid', ids[2]], activity: '散步' } })
  const post = await projectMomentFromEvent(event)
  expect(post).not.toBeNull()
  expect(await momentImageIdsForRole('lin', post!.id)).toEqual(ids)
  const second = await projectMomentFromEvent(event)
  expect(second).toBeNull()
  expect(await momentImageIdsForRole('lin', post!.id)).toEqual(ids)
})

it('计划事件与其他角色媒体不可借图片摘要读取，用户消息伪装图片也不读', async () => {
  const reference = await image()
  db.run('INSERT INTO sessions VALUES (?, ?)', ['session', 'other'])
  db.run('INSERT INTO messages VALUES (?, ?, ?, ?)', ['session', 'tool', JSON.stringify([reference]), 1])
  db.run('INSERT INTO sessions VALUES (?, ?)', ['own', 'lin'])
  db.run('INSERT INTO messages VALUES (?, ?, ?, ?)', ['own', 'user', JSON.stringify([reference]), 1])
  const post = await moment('lin', reference.id)
  expect(await readMomentImageForRole('lin', post.id, reference.id)).toMatchObject({ ok: false })
  db.run('INSERT INTO companion_assets VALUES (?, ?, ?)', ['owned', 'lin', JSON.stringify({ image: reference })])
  const planned = await moment('lin', reference.id, 'planned')
  expect(await momentImageIdsForRole('lin', planned.id)).toEqual([])
  expect(await readMomentImageForRole('lin', planned.id, reference.id)).toMatchObject({ ok: false })
})

it('同角色资产图片可读取，原图被替换或删除时明确失败，不采纳事件中的任意路径', async () => {
  const reference = await image()
  db.run('INSERT INTO companion_assets VALUES (?, ?, ?)', ['owned', 'lin', JSON.stringify({ image: reference })])
  const post = await moment('lin', reference.id)
  expect(await readMomentImageForRole('lin', post.id, reference.id)).toMatchObject({ ok: true })
  fs.writeFileSync(reference.path, 'changed')
  expect(await readMomentImageForRole('lin', post.id, reference.id)).toMatchObject({ ok: false })
  fs.unlinkSync(reference.path)
  expect(await readMomentImageForRole('lin', post.id, reference.id)).toMatchObject({ ok: false })
})

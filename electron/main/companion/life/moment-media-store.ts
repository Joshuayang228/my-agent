import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../storage/database'

export type MomentMediaAttemptStatus = 'started' | 'stored' | 'failed' | 'skipped'
export interface MomentMediaAttempt { id: string; roleId: string; eventId: string; momentId: string | null; status: MomentMediaAttemptStatus; reason: string; imageId: string | null; attemptedAt: number; completedAt: number | null }
export interface StoredMomentMedia { id: string; roleId: string; eventId: string; momentId: string; path: string; mimeType: 'image/png'; width: number; height: number; byteLength: number; createdAt: number }

function mediaRoot(): string {
  const userData = app?.getPath?.('userData') || path.join(process.cwd(), '.agent-data')
  return path.join(path.resolve(userData), 'companion-media', 'moments')
}

async function ensureTables(): Promise<void> {
  const db = await getDatabase()
  db.run(`CREATE TABLE IF NOT EXISTS companion_moment_media (
    id TEXT PRIMARY KEY, role_id TEXT NOT NULL, event_id TEXT NOT NULL, moment_id TEXT NOT NULL,
    path TEXT NOT NULL, mime_type TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
    byte_length INTEGER NOT NULL, created_at INTEGER NOT NULL, UNIQUE(event_id, id)
  )`)
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_moment_media_role_time ON companion_moment_media(role_id, created_at DESC)')
  db.run(`CREATE TABLE IF NOT EXISTS companion_moment_media_attempts (
    id TEXT PRIMARY KEY, role_id TEXT NOT NULL, event_id TEXT NOT NULL, moment_id TEXT,
    status TEXT NOT NULL, reason TEXT NOT NULL, image_id TEXT, attempted_at INTEGER NOT NULL, completed_at INTEGER
  )`)
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_moment_media_attempts_role_time ON companion_moment_media_attempts(role_id, attempted_at DESC)')
}

export async function recordMomentMediaAttempt(input: Omit<MomentMediaAttempt, 'id'>): Promise<MomentMediaAttempt> {
  await ensureTables()
  const row = { ...input, id: randomUUID() }
  const db = await getDatabase()
  db.run('INSERT INTO companion_moment_media_attempts (id, role_id, event_id, moment_id, status, reason, image_id, attempted_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [row.id, row.roleId, row.eventId, row.momentId, row.status, row.reason, row.imageId, row.attemptedAt, row.completedAt])
  persist()
  return row
}

export async function storeMomentMedia(input: Omit<StoredMomentMedia, 'id' | 'path' | 'createdAt'> & { bytes: Buffer }): Promise<StoredMomentMedia> {
  await ensureTables()
  const id = createHash('sha256').update(input.bytes).digest('hex')
  const root = mediaRoot()
  fs.mkdirSync(root, { recursive: true, mode: 0o700 })
  if (fs.realpathSync(root) !== root) throw new Error('图片目录不是受控目录。')
  const target = path.join(root, `${id}.png`)
  if (!fs.existsSync(target)) {
    const temporary = path.join(root, `.${id}.${randomUUID()}.tmp`)
    fs.writeFileSync(temporary, input.bytes, { flag: 'wx', mode: 0o600 })
    try { fs.renameSync(temporary, target) } finally { try { fs.unlinkSync(temporary) } catch { /* 已完成 rename */ } }
  }
  const createdAt = Date.now()
  const db = await getDatabase()
  db.run('INSERT OR IGNORE INTO companion_moment_media (id, role_id, event_id, moment_id, path, mime_type, width, height, byte_length, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, input.roleId, input.eventId, input.momentId, target, input.mimeType, input.width, input.height, input.bytes.length, createdAt])
  persist()
  return { id, roleId: input.roleId, eventId: input.eventId, momentId: input.momentId, path: target, mimeType: 'image/png', width: input.width, height: input.height, byteLength: input.bytes.length, createdAt }
}

export async function listMomentMediaAttempts(roleId: string, limit = 50): Promise<MomentMediaAttempt[]> {
  await ensureTables()
  const db = await getDatabase()
  const rows = db.exec('SELECT id, role_id, event_id, moment_id, status, reason, image_id, attempted_at, completed_at FROM companion_moment_media_attempts WHERE role_id = ? ORDER BY attempted_at DESC, id DESC LIMIT ?', [roleId, Math.max(1, Math.min(100, Math.floor(limit)))])[0]
  return (rows?.values ?? []).map(row => ({ id: String(row[0]), roleId: String(row[1]), eventId: String(row[2]), momentId: row[3] == null ? null : String(row[3]), status: String(row[4]) as MomentMediaAttemptStatus, reason: String(row[5] ?? ''), imageId: row[6] == null ? null : String(row[6]), attemptedAt: Number(row[7]) || 0, completedAt: row[8] == null ? null : Number(row[8]) }))
}

export async function readStoredMomentMedia(roleId: string, momentId: string, imageId: string): Promise<{ ok: true; dataUrl: string; fileName: string } | { ok: false; error: string }> {
  if (!/^[a-f0-9]{64}$/.test(imageId)) return { ok: false, error: '图片引用无效。' }
  await ensureTables()
  const db = await getDatabase()
  const rows = db.exec('SELECT path, byte_length FROM companion_moment_media WHERE id = ? AND role_id = ? AND moment_id = ? LIMIT 1', [imageId, roleId, momentId])[0]
  const row = rows?.values[0]
  if (!row || typeof row[0] !== 'string') return { ok: false, error: '图片暂时无法读取。' }
  const filePath = path.resolve(row[0])
  const root = path.resolve(mediaRoot())
  const relative = path.relative(root, filePath)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || fs.realpathSync(root) !== root || fs.realpathSync(filePath) !== filePath) return { ok: false, error: '图片位置不受控。' }
  try {
    const bytes = fs.readFileSync(filePath)
    if (bytes.length !== Number(row[1]) || createHash('sha256').update(bytes).digest('hex') !== imageId) return { ok: false, error: '图片内容已变化。' }
    return { ok: true, dataUrl: `data:image/png;base64,${bytes.toString('base64')}`, fileName: path.basename(filePath) }
  } catch { return { ok: false, error: '图片暂时无法读取。' }
  }
}

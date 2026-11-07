import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../storage/database'

export type MaterialObservationAttemptStatus = 'started' | 'succeeded' | 'failed'
export interface MaterialObservationAttempt {
  id: string
  roleId: string
  sessionId: string
  messageId: string
  imageIndex: number
  source: string
  status: MaterialObservationAttemptStatus
  reason: string
  attemptedAt: number
  completedAt: number | null
}

async function ensureTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`CREATE TABLE IF NOT EXISTS companion_material_observation_attempts (
    id TEXT PRIMARY KEY, role_id TEXT NOT NULL, session_id TEXT NOT NULL,
    message_id TEXT NOT NULL, image_index INTEGER NOT NULL, source TEXT NOT NULL,
    status TEXT NOT NULL, reason TEXT NOT NULL, attempted_at INTEGER NOT NULL, completed_at INTEGER
  )`)
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_material_observation_role_time ON companion_material_observation_attempts(role_id, attempted_at DESC)')
}

export async function recordMaterialObservationAttempt(input: Omit<MaterialObservationAttempt, 'id'>): Promise<MaterialObservationAttempt> {
  await ensureTable()
  const row = { ...input, id: randomUUID() }
  const db = await getDatabase()
  db.run('INSERT INTO companion_material_observation_attempts (id, role_id, session_id, message_id, image_index, source, status, reason, attempted_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [row.id, row.roleId, row.sessionId, row.messageId, row.imageIndex, row.source, row.status, row.reason, row.attemptedAt, row.completedAt])
  persist()
  return row
}

export async function listMaterialObservationAttempts(roleId: string, limit = 30): Promise<MaterialObservationAttempt[]> {
  await ensureTable()
  const db = await getDatabase()
  const rows = db.exec('SELECT id, role_id, session_id, message_id, image_index, source, status, reason, attempted_at, completed_at FROM companion_material_observation_attempts WHERE role_id = ? ORDER BY attempted_at DESC, id DESC LIMIT ?', [roleId, Math.max(1, Math.min(100, Math.floor(limit)))])[0]
  return (rows?.values ?? []).map(row => ({ id: String(row[0]), roleId: String(row[1]), sessionId: String(row[2]), messageId: String(row[3]), imageIndex: Number(row[4]) || 0, source: String(row[5] ?? ''), status: String(row[6]) as MaterialObservationAttemptStatus, reason: String(row[7] ?? ''), attemptedAt: Number(row[8]) || 0, completedAt: row[9] == null ? null : Number(row[9]) }))
}

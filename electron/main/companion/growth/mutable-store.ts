/**
 * Growth — MUTABLE 覆盖与版本（W1）
 *
 * 背景：Role Pack 的 mutable.default.md 是出厂默认；用户态按 role 分桶覆盖，需可回滚。
 * 意图：getMutable / setMutable / rollbackMutable；无覆盖时回落 pack 默认。
 * 约束：仅写用户态 SQLite；不改仓库内 Pack 文件。
 */

import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../storage/database'
import { loadRolePack } from '../identity/loader'
import { createLogger } from '../../utils/logger'

const log = createLogger('MutableStore')

export interface MutableVersion {
  id: string
  roleId: string
  version: number
  body: string
  createdAt: number
  summary: string
}

async function ensureTables(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_mutable (
      role_id    TEXT PRIMARY KEY,
      body       TEXT NOT NULL,
      version    INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_mutable_versions (
      id         TEXT PRIMARY KEY,
      role_id    TEXT NOT NULL,
      version    INTEGER NOT NULL,
      body       TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      summary    TEXT NOT NULL DEFAULT '',
      UNIQUE(role_id, version)
    )
  `)
}

/**
 * 读取当前 MUTABLE 正文：有用户覆盖用覆盖，否则用 Pack 默认。
 */
export async function getMutable(roleId: string, universeId = 'default'): Promise<string> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT body FROM companion_mutable WHERE role_id = ?')
  stmt.bind([roleId])
  if (stmt.step()) {
    const row = stmt.getAsObject() as { body: string }
    stmt.free()
    return row.body
  }
  stmt.free()
  return loadRolePack(roleId, universeId).mutableDefault
}

export async function getMutableMeta(
  roleId: string,
): Promise<{ body: string; version: number; updatedAt: number } | null> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    'SELECT body, version, updated_at FROM companion_mutable WHERE role_id = ?',
  )
  stmt.bind([roleId])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const row = stmt.getAsObject() as { body: string; version: number; updated_at: number }
  stmt.free()
  return { body: row.body, version: row.version, updatedAt: row.updated_at }
}

/**
 * 写入 MUTABLE 覆盖并追加版本历史。
 */
export async function setMutable(
  roleId: string,
  body: string,
  summary: string,
): Promise<{ version: number }> {
  await ensureTables()
  const db = await getDatabase()
  const now = Date.now()

  const existing = db.prepare('SELECT version FROM companion_mutable WHERE role_id = ?')
  existing.bind([roleId])
  let nextVersion = 1
  if (existing.step()) {
    const row = existing.getAsObject() as { version: number }
    nextVersion = (row.version || 0) + 1
  }
  existing.free()

  db.run(
    `INSERT INTO companion_mutable (role_id, body, version, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(role_id) DO UPDATE SET
       body = excluded.body,
       version = excluded.version,
       updated_at = excluded.updated_at`,
    [roleId, body, nextVersion, now],
  )

  db.run(
    `INSERT INTO companion_mutable_versions (id, role_id, version, body, created_at, summary)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), roleId, nextVersion, body, now, summary || `v${nextVersion}`],
  )

  persist()
  log.info('Mutable updated', { roleId, version: nextVersion })
  return { version: nextVersion }
}

export async function listMutableVersions(roleId: string): Promise<MutableVersion[]> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT id, role_id, version, body, created_at, summary
     FROM companion_mutable_versions
     WHERE role_id = ?
     ORDER BY version DESC`,
  )
  stmt.bind([roleId])
  const out: MutableVersion[] = []
  while (stmt.step()) {
    const r = stmt.getAsObject() as Record<string, unknown>
    out.push({
      id: r.id as string,
      roleId: r.role_id as string,
      version: r.version as number,
      body: r.body as string,
      createdAt: r.created_at as number,
      summary: (r.summary as string) || '',
    })
  }
  stmt.free()
  return out
}

/**
 * 回滚到指定历史版本：把该版 body 写为新版本（不删除历史）。
 */
export async function rollbackMutable(
  roleId: string,
  toVersion: number,
): Promise<{ version: number }> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    'SELECT body FROM companion_mutable_versions WHERE role_id = ? AND version = ?',
  )
  stmt.bind([roleId, toVersion])
  if (!stmt.step()) {
    stmt.free()
    throw new Error(`Mutable version not found: ${roleId}@${toVersion}`)
  }
  const body = (stmt.getAsObject() as { body: string }).body
  stmt.free()
  return setMutable(roleId, body, `rollback to v${toVersion}`)
}

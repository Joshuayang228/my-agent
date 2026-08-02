/**
 * 反思运行日志（按 role 分桶）
 *
 * 对照 Alice persona-reflection.json：lastRunAt + runs[]（保留最近 30 条）。
 */

import { getDatabase, persist } from '../../storage/database'

export interface ReflectionRun {
  at: number
  changed: boolean
  summary: string
}

export interface ReflectionState {
  roleId: string
  lastRunAt: number
  runs: ReflectionRun[]
}

async function ensureTables(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_reflection_state (
      role_id     TEXT PRIMARY KEY,
      last_run_at INTEGER NOT NULL DEFAULT 0,
      runs_json   TEXT NOT NULL DEFAULT '[]',
      updated_at  INTEGER NOT NULL
    )
  `)
}

export async function getReflectionState(roleId: string): Promise<ReflectionState> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    'SELECT role_id, last_run_at, runs_json FROM companion_reflection_state WHERE role_id = ?',
  )
  stmt.bind([roleId])
  if (!stmt.step()) {
    stmt.free()
    return { roleId, lastRunAt: 0, runs: [] }
  }
  const row = stmt.getAsObject() as {
    role_id: string
    last_run_at: number
    runs_json: string
  }
  stmt.free()
  let runs: ReflectionRun[] = []
  try {
    const parsed = JSON.parse(row.runs_json || '[]')
    if (Array.isArray(parsed)) runs = parsed as ReflectionRun[]
  } catch { /* ignore */ }
  return { roleId: row.role_id, lastRunAt: row.last_run_at || 0, runs }
}

export async function recordReflectionRun(
  roleId: string,
  run: ReflectionRun,
): Promise<void> {
  await ensureTables()
  const prev = await getReflectionState(roleId)
  const runs = [...prev.runs, run].slice(-30)
  const now = Date.now()
  const db = await getDatabase()
  db.run(
    `INSERT INTO companion_reflection_state (role_id, last_run_at, runs_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(role_id) DO UPDATE SET
       last_run_at = excluded.last_run_at,
       runs_json = excluded.runs_json,
       updated_at = excluded.updated_at`,
    [roleId, run.at, JSON.stringify(runs), now],
  )
  persist()
}

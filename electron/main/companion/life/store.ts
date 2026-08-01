/**
 * LifeEngine 用户态存储（role_state / day_scripts / events）
 *
 * 背景：暂停点、日剧本、结构化事件按 role_id 分桶。
 * 意图：CRUD + ensureTables；与 schema v5 migration 对齐。
 * 约束：不 import agent/；写后 persist。
 */

import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../storage/database'
import type {
  CompanionEvent,
  CompanionEventStatus,
  CompanionMoment,
  CompanionRoleState,
  DayScriptPayload,
  DayScriptRow,
} from '../types'

async function ensureTables(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_role_state (
      role_id         TEXT PRIMARY KEY,
      paused_at       INTEGER,
      last_tick_at    INTEGER NOT NULL DEFAULT 0,
      catchup_summary TEXT NOT NULL DEFAULT '',
      updated_at      INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_day_scripts (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      date         TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      UNIQUE(role_id, date)
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_day_scripts_role_date
      ON companion_day_scripts(role_id, date)
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_events (
      id            TEXT PRIMARY KEY,
      role_id       TEXT NOT NULL,
      scheduled_at  INTEGER NOT NULL,
      status        TEXT NOT NULL,
      type          TEXT NOT NULL,
      payload_json  TEXT NOT NULL,
      day_script_id TEXT
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_events_role_sched
      ON companion_events(role_id, scheduled_at)
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_moments (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      event_id     TEXT NOT NULL,
      published_at INTEGER NOT NULL,
      text         TEXT NOT NULL,
      meta_json    TEXT NOT NULL DEFAULT '{}'
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_moments_role_pub
      ON companion_moments(role_id, published_at DESC)
  `)
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_moments_event
      ON companion_moments(event_id)
  `)
}

export async function getRoleState(roleId: string): Promise<CompanionRoleState | null> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT role_id, paused_at, last_tick_at, catchup_summary, updated_at
     FROM companion_role_state WHERE role_id = ?`,
  )
  stmt.bind([roleId])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const r = stmt.getAsObject() as Record<string, unknown>
  stmt.free()
  return {
    roleId: r.role_id as string,
    pausedAt: (r.paused_at as number | null) ?? null,
    lastTickAt: (r.last_tick_at as number) || 0,
    catchupSummary: (r.catchup_summary as string) || '',
    updatedAt: r.updated_at as number,
  }
}

/** 暂停：写入 paused_at（覆盖） */
export async function writePausedAt(roleId: string, at: number): Promise<void> {
  await ensureTables()
  const db = await getDatabase()
  const now = Date.now()
  const prev = db.prepare(
    'SELECT last_tick_at, catchup_summary FROM companion_role_state WHERE role_id = ?',
  )
  prev.bind([roleId])
  let lastTick = 0
  let summary = ''
  if (prev.step()) {
    const row = prev.getAsObject() as { last_tick_at: number; catchup_summary: string }
    lastTick = row.last_tick_at || 0
    summary = row.catchup_summary || ''
  }
  prev.free()
  db.run(
    `INSERT INTO companion_role_state (role_id, paused_at, last_tick_at, catchup_summary, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(role_id) DO UPDATE SET
       paused_at = excluded.paused_at,
       updated_at = excluded.updated_at`,
    [roleId, at, lastTick, summary, now],
  )
  persist()
}

/** 清除暂停并可选更新 catchup_summary / last_tick */
export async function clearPausedAt(
  roleId: string,
  opts?: { catchupSummary?: string; lastTickAt?: number },
): Promise<void> {
  await ensureTables()
  const db = await getDatabase()
  const now = Date.now()
  const existing = await getRoleState(roleId)
  const summary = opts?.catchupSummary ?? existing?.catchupSummary ?? ''
  const lastTick = opts?.lastTickAt ?? existing?.lastTickAt ?? 0
  db.run(
    `INSERT INTO companion_role_state (role_id, paused_at, last_tick_at, catchup_summary, updated_at)
     VALUES (?, NULL, ?, ?, ?)
     ON CONFLICT(role_id) DO UPDATE SET
       paused_at = NULL,
       last_tick_at = excluded.last_tick_at,
       catchup_summary = excluded.catchup_summary,
       updated_at = excluded.updated_at`,
    [roleId, lastTick, summary, now],
  )
  persist()
}

export async function touchLastTick(roleId: string, at: number): Promise<void> {
  await ensureTables()
  const db = await getDatabase()
  const now = Date.now()
  const existing = await getRoleState(roleId)
  db.run(
    `INSERT INTO companion_role_state (role_id, paused_at, last_tick_at, catchup_summary, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(role_id) DO UPDATE SET
       last_tick_at = excluded.last_tick_at,
       updated_at = excluded.updated_at`,
    [
      roleId,
      existing?.pausedAt ?? null,
      at,
      existing?.catchupSummary ?? '',
      now,
    ],
  )
  persist()
}

export async function getDayScript(
  roleId: string,
  date: string,
): Promise<DayScriptRow | null> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT id, role_id, date, payload_json, created_at
     FROM companion_day_scripts WHERE role_id = ? AND date = ?`,
  )
  stmt.bind([roleId, date])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const r = stmt.getAsObject() as Record<string, unknown>
  stmt.free()
  return {
    id: r.id as string,
    roleId: r.role_id as string,
    date: r.date as string,
    payload: JSON.parse(r.payload_json as string) as DayScriptPayload,
    createdAt: r.created_at as number,
  }
}

export async function countDayScripts(roleId: string): Promise<number> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    'SELECT COUNT(*) AS c FROM companion_day_scripts WHERE role_id = ?',
  )
  stmt.bind([roleId])
  stmt.step()
  const c = (stmt.getAsObject() as { c: number }).c
  stmt.free()
  return c
}

export async function insertDayScript(
  roleId: string,
  date: string,
  payload: DayScriptPayload,
): Promise<DayScriptRow> {
  await ensureTables()
  const db = await getDatabase()
  const id = randomUUID()
  const createdAt = Date.now()
  db.run(
    `INSERT INTO companion_day_scripts (id, role_id, date, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, roleId, date, JSON.stringify(payload), createdAt],
  )
  persist()
  return { id, roleId, date, payload, createdAt }
}

export async function listEvents(
  roleId: string,
  opts?: { status?: CompanionEventStatus },
): Promise<CompanionEvent[]> {
  await ensureTables()
  const db = await getDatabase()
  const sql = opts?.status
    ? `SELECT id, role_id, scheduled_at, status, type, payload_json, day_script_id
       FROM companion_events WHERE role_id = ? AND status = ?
       ORDER BY scheduled_at ASC`
    : `SELECT id, role_id, scheduled_at, status, type, payload_json, day_script_id
       FROM companion_events WHERE role_id = ?
       ORDER BY scheduled_at ASC`
  const stmt = db.prepare(sql)
  if (opts?.status) stmt.bind([roleId, opts.status])
  else stmt.bind([roleId])
  const out: CompanionEvent[] = []
  while (stmt.step()) {
    const r = stmt.getAsObject() as Record<string, unknown>
    out.push({
      id: r.id as string,
      roleId: r.role_id as string,
      scheduledAt: r.scheduled_at as number,
      status: r.status as CompanionEventStatus,
      type: r.type as string,
      payload: JSON.parse((r.payload_json as string) || '{}') as Record<string, unknown>,
      dayScriptId: (r.day_script_id as string) || null,
    })
  }
  stmt.free()
  return out
}

export async function countEvents(roleId: string): Promise<number> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT COUNT(*) AS c FROM companion_events WHERE role_id = ?')
  stmt.bind([roleId])
  stmt.step()
  const c = (stmt.getAsObject() as { c: number }).c
  stmt.free()
  return c
}

export async function insertEvent(input: {
  roleId: string
  scheduledAt: number
  status: CompanionEventStatus
  type: string
  payload: Record<string, unknown>
  dayScriptId: string | null
}): Promise<CompanionEvent> {
  await ensureTables()
  const db = await getDatabase()
  const id = randomUUID()
  db.run(
    `INSERT INTO companion_events
       (id, role_id, scheduled_at, status, type, payload_json, day_script_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.roleId,
      input.scheduledAt,
      input.status,
      input.type,
      JSON.stringify(input.payload),
      input.dayScriptId,
    ],
  )
  persist()
  return {
    id,
    roleId: input.roleId,
    scheduledAt: input.scheduledAt,
    status: input.status,
    type: input.type,
    payload: input.payload,
    dayScriptId: input.dayScriptId,
  }
}

/** 将到期 planned 事件标为 published，返回更新条数 */
export async function publishDueEvents(roleId: string, now: number): Promise<number> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT id FROM companion_events
     WHERE role_id = ? AND status = 'planned' AND scheduled_at <= ?`,
  )
  stmt.bind([roleId, now])
  const ids: string[] = []
  while (stmt.step()) {
    ids.push((stmt.getAsObject() as { id: string }).id)
  }
  stmt.free()
  for (const id of ids) {
    db.run(`UPDATE companion_events SET status = 'published' WHERE id = ?`, [id])
  }
  if (ids.length) persist()
  return ids.length
}

/** 某剧本是否已有关联事件（防重复 ensure） */
export async function hasEventsForScript(dayScriptId: string): Promise<boolean> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    'SELECT 1 AS x FROM companion_events WHERE day_script_id = ? LIMIT 1',
  )
  stmt.bind([dayScriptId])
  const ok = stmt.step()
  stmt.free()
  return ok
}

export async function setCatchupSummary(roleId: string, summary: string): Promise<void> {
  await ensureTables()
  const db = await getDatabase()
  const now = Date.now()
  const existing = await getRoleState(roleId)
  db.run(
    `INSERT INTO companion_role_state (role_id, paused_at, last_tick_at, catchup_summary, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(role_id) DO UPDATE SET
       catchup_summary = excluded.catchup_summary,
       updated_at = excluded.updated_at`,
    [
      roleId,
      existing?.pausedAt ?? null,
      existing?.lastTickAt ?? 0,
      summary,
      now,
    ],
  )
  persist()
}

/** 将指定 id 标为 published */
export async function markEventPublished(eventId: string): Promise<void> {
  await ensureTables()
  const db = await getDatabase()
  db.run(`UPDATE companion_events SET status = 'published' WHERE id = ?`, [eventId])
  persist()
}

export async function getEventById(eventId: string): Promise<CompanionEvent | null> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT id, role_id, scheduled_at, status, type, payload_json, day_script_id
     FROM companion_events WHERE id = ?`,
  )
  stmt.bind([eventId])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const r = stmt.getAsObject() as Record<string, unknown>
  stmt.free()
  return {
    id: r.id as string,
    roleId: r.role_id as string,
    scheduledAt: r.scheduled_at as number,
    status: r.status as CompanionEventStatus,
    type: r.type as string,
    payload: JSON.parse((r.payload_json as string) || '{}') as Record<string, unknown>,
    dayScriptId: (r.day_script_id as string) || null,
  }
}

export async function insertMoment(input: {
  roleId: string
  eventId: string
  publishedAt: number
  text: string
  meta?: Record<string, unknown>
}): Promise<CompanionMoment | null> {
  await ensureTables()
  const db = await getDatabase()
  const exists = db.prepare('SELECT 1 AS x FROM companion_moments WHERE event_id = ? LIMIT 1')
  exists.bind([input.eventId])
  if (exists.step()) {
    exists.free()
    return null
  }
  exists.free()

  const id = randomUUID()
  db.run(
    `INSERT INTO companion_moments (id, role_id, event_id, published_at, text, meta_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.roleId,
      input.eventId,
      input.publishedAt,
      input.text,
      JSON.stringify(input.meta ?? {}),
    ],
  )
  persist()
  return {
    id,
    roleId: input.roleId,
    eventId: input.eventId,
    publishedAt: input.publishedAt,
    text: input.text,
    meta: input.meta ?? {},
  }
}

export async function listMoments(
  roleId: string,
  opts?: { limit?: number; offset?: number },
): Promise<CompanionMoment[]> {
  await ensureTables()
  const db = await getDatabase()
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200)
  const offset = Math.max(opts?.offset ?? 0, 0)
  const stmt = db.prepare(
    `SELECT id, role_id, event_id, published_at, text, meta_json
     FROM companion_moments
     WHERE role_id = ?
     ORDER BY published_at DESC
     LIMIT ? OFFSET ?`,
  )
  stmt.bind([roleId, limit, offset])
  const out: CompanionMoment[] = []
  while (stmt.step()) {
    const r = stmt.getAsObject() as Record<string, unknown>
    out.push({
      id: r.id as string,
      roleId: r.role_id as string,
      eventId: r.event_id as string,
      publishedAt: r.published_at as number,
      text: r.text as string,
      meta: JSON.parse((r.meta_json as string) || '{}') as Record<string, unknown>,
    })
  }
  stmt.free()
  return out
}

export async function countMoments(roleId: string): Promise<number> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT COUNT(*) AS c FROM companion_moments WHERE role_id = ?')
  stmt.bind([roleId])
  stmt.step()
  const c = (stmt.getAsObject() as { c: number }).c
  stmt.free()
  return c
}

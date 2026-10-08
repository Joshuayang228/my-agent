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
  CompanionWorldState,
  DayScriptPayload,
  DayScriptRow,
} from '../types'
import type { CompanionEventLink } from '../../../../src/shared/types'
import type { MomentUserInteraction, MomentUserInteractionKind } from '../../../../src/shared/moment-user-interactions'
import { defaultWorldState, parseWorldJson, serializeWorldState } from './world-codec'

async function ensureTables(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_role_state (
      role_id         TEXT PRIMARY KEY,
      paused_at       INTEGER,
      last_tick_at    INTEGER NOT NULL DEFAULT 0,
      catchup_summary TEXT NOT NULL DEFAULT '',
      world_json      TEXT NOT NULL DEFAULT '{}',
      updated_at      INTEGER NOT NULL
    )
  `)
  // 旧表缺列时补齐（单测 memDb / 未跑完 schema migrate 的路径）
  try {
    db.run(`ALTER TABLE companion_role_state ADD COLUMN world_json TEXT NOT NULL DEFAULT '{}'`)
  } catch {
    // 列已存在
  }
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
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_moment_user_interactions (
      id         TEXT PRIMARY KEY,
      moment_id  TEXT NOT NULL,
      role_id    TEXT NOT NULL,
      kind       TEXT NOT NULL,
      actor_id   TEXT NOT NULL,
      text       TEXT,
      created_at INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_moment_user_role_moment
      ON companion_moment_user_interactions(role_id, moment_id, created_at)
  `)
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_moment_user_like
      ON companion_moment_user_interactions(moment_id, actor_id)
      WHERE kind = 'like'
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_event_links (
      id            TEXT PRIMARY KEY,
      event_id      TEXT NOT NULL,
      role_id       TEXT NOT NULL,
      target_type   TEXT NOT NULL,
      target_id     TEXT NOT NULL,
      relation      TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at    INTEGER NOT NULL,
      UNIQUE(event_id, target_type, target_id, relation)
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_event_links_event
      ON companion_event_links(role_id, event_id)
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_event_links_target
      ON companion_event_links(role_id, target_type, target_id)
  `)
}

export async function getRoleState(roleId: string): Promise<CompanionRoleState | null> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT role_id, paused_at, last_tick_at, catchup_summary, world_json, updated_at
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
    world: parseWorldJson((r.world_json as string) || '', roleId),
    updatedAt: r.updated_at as number,
  }
}

/** 暂停：写入 paused_at（覆盖） */
export async function writePausedAt(roleId: string, at: number): Promise<void> {
  await ensureTables()
  const db = await getDatabase()
  const now = Date.now()
  const existing = await getRoleState(roleId)
  const lastTick = existing?.lastTickAt ?? 0
  const summary = existing?.catchupSummary ?? ''
  const worldJson = serializeWorldState(existing?.world ?? defaultWorldState(roleId))
  db.run(
    `INSERT INTO companion_role_state
       (role_id, paused_at, last_tick_at, catchup_summary, world_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(role_id) DO UPDATE SET
       paused_at = excluded.paused_at,
       updated_at = excluded.updated_at`,
    [roleId, at, lastTick, summary, worldJson, now],
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
  const worldJson = serializeWorldState(existing?.world ?? defaultWorldState(roleId))
  db.run(
    `INSERT INTO companion_role_state
       (role_id, paused_at, last_tick_at, catchup_summary, world_json, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?)
     ON CONFLICT(role_id) DO UPDATE SET
       paused_at = NULL,
       last_tick_at = excluded.last_tick_at,
       catchup_summary = excluded.catchup_summary,
       updated_at = excluded.updated_at`,
    [roleId, lastTick, summary, worldJson, now],
  )
  persist()
}

export async function touchLastTick(roleId: string, at: number): Promise<void> {
  await ensureTables()
  const db = await getDatabase()
  const now = Date.now()
  const existing = await getRoleState(roleId)
  const worldJson = serializeWorldState(existing?.world ?? defaultWorldState(roleId))
  db.run(
    `INSERT INTO companion_role_state
       (role_id, paused_at, last_tick_at, catchup_summary, world_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(role_id) DO UPDATE SET
       last_tick_at = excluded.last_tick_at,
       updated_at = excluded.updated_at`,
    [
      roleId,
      existing?.pausedAt ?? null,
      at,
      existing?.catchupSummary ?? '',
      worldJson,
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
  opts?: { status?: CompanionEventStatus; order?: 'asc' | 'desc'; limit?: number },
): Promise<CompanionEvent[]> {
  await ensureTables()
  const db = await getDatabase()
  const order = opts?.order === 'desc' ? 'DESC' : 'ASC'
  const limit = Number.isFinite(opts?.limit)
    ? Math.max(1, Math.min(500, Math.floor(opts?.limit as number)))
    : null
  const baseSql = opts?.status
    ? `SELECT id, role_id, scheduled_at, status, type, payload_json, day_script_id
       FROM companion_events WHERE role_id = ? AND status = ?`
    : `SELECT id, role_id, scheduled_at, status, type, payload_json, day_script_id
       FROM companion_events WHERE role_id = ?`
  const sql = `${baseSql} ORDER BY scheduled_at ${order}${limit === null ? '' : ' LIMIT ?'}`
  const stmt = db.prepare(sql)
  const params: Array<string | number> = opts?.status ? [roleId, opts.status] : [roleId]
  if (limit !== null) params.push(limit)
  stmt.bind(params)
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
  const worldJson = serializeWorldState(existing?.world ?? defaultWorldState(roleId))
  db.run(
    `INSERT INTO companion_role_state
       (role_id, paused_at, last_tick_at, catchup_summary, world_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(role_id) DO UPDATE SET
       catchup_summary = excluded.catchup_summary,
       updated_at = excluded.updated_at`,
    [
      roleId,
      existing?.pausedAt ?? null,
      existing?.lastTickAt ?? 0,
      summary,
      worldJson,
      now,
    ],
  )
  persist()
}

/** M23-G2：写入世界状态薄片 */
export async function setWorldState(
  roleId: string,
  world: CompanionWorldState,
): Promise<void> {
  await ensureTables()
  const db = await getDatabase()
  const now = Date.now()
  const existing = await getRoleState(roleId)
  const worldJson = serializeWorldState(world)
  db.run(
    `INSERT INTO companion_role_state
       (role_id, paused_at, last_tick_at, catchup_summary, world_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(role_id) DO UPDATE SET
       world_json = excluded.world_json,
       updated_at = excluded.updated_at`,
    [
      roleId,
      existing?.pausedAt ?? null,
      existing?.lastTickAt ?? 0,
      existing?.catchupSummary ?? '',
      worldJson,
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

/**
 * 背景：事件被撤销或清理时，Moment、用户互动和结构化关联不能继续指向不存在的事实。
 * 设计意图：由生活存储层按固定顺序一次性清理整条投影链，不让调用方分别删除多张表而漏掉 event_links。
 * 关键约束：只能删除明确属于 roleId 的事件；先删叶子投影再删事件，整组同步提交或回滚，跨角色请求拒绝且不产生任何写入。
 */
export async function deleteEvent(roleId: string, eventId: string): Promise<boolean> {
  await ensureTables()
  const db = await getDatabase()
  const event = await getEventById(eventId)
  if (!event) return false
  if (event.roleId !== roleId) throw new Error('事件不属于当前主角')

  db.run('SAVEPOINT delete_life_event')
  try {
    db.run(
      `DELETE FROM companion_moment_user_interactions
       WHERE role_id = ? AND moment_id IN (
         SELECT id FROM companion_moments WHERE role_id = ? AND event_id = ?
       )`,
      [roleId, roleId, eventId],
    )
    db.run('DELETE FROM companion_moments WHERE role_id = ? AND event_id = ?', [roleId, eventId])
    db.run('DELETE FROM companion_event_links WHERE role_id = ? AND event_id = ?', [roleId, eventId])
    db.run('DELETE FROM companion_events WHERE role_id = ? AND id = ?', [roleId, eventId])
    db.run('RELEASE SAVEPOINT delete_life_event')
  } catch (error) {
    db.run('ROLLBACK TO SAVEPOINT delete_life_event')
    db.run('RELEASE SAVEPOINT delete_life_event')
    throw error
  }
  persist()
  return true
}

export interface CompanionEventLinkInput {
  eventId: string
  roleId: string
  targetType: string
  targetId: string
  relation: string
  metadata?: Record<string, unknown>
}

function mapEventLink(row: Record<string, unknown>): CompanionEventLink {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    roleId: row.role_id as string,
    targetType: row.target_type as string,
    targetId: row.target_id as string,
    relation: row.relation as string,
    metadata: JSON.parse((row.metadata_json as string) || '{}') as Record<string, unknown>,
    createdAt: Number(row.created_at) || 0,
  }
}

/**
 * 背景：生活切片需要把事件和资产、卡司、图片的关系作为可查询事实保存，不能只从 Moment 的展示 metadata 猜回去。
 * 设计意图：按事件整体替换关联，保证重复投影不会留下已经撤销的旧关系；比逐条追加更容易保持回放结果稳定。
 * 关键约束：事件与角色必须匹配，资产目标须同角色；整组替换同步提交或回滚，不能留下半组关系。SAVEPOINT 支持调用方已有事务，不提交其余写入。
 */
export async function replaceEventLinks(
  roleId: string,
  eventId: string,
  links: CompanionEventLinkInput[],
): Promise<CompanionEventLink[]> {
  await ensureTables()
  const db = await getDatabase()
  const eventStmt = db.prepare('SELECT role_id FROM companion_events WHERE id = ? LIMIT 1')
  eventStmt.bind([eventId])
  if (!eventStmt.step()) {
    eventStmt.free()
    throw new Error('事件不存在')
  }
  const eventRoleId = (eventStmt.getAsObject() as { role_id: string }).role_id
  eventStmt.free()
  if (eventRoleId !== roleId) throw new Error('事件不属于当前主角')

  const normalized = links.map((link) => ({
    ...link,
    eventId,
    roleId,
    targetType: link.targetType.trim(),
    targetId: link.targetId.trim(),
    relation: link.relation.trim(),
  })).filter((link) => link.targetType && link.targetId && link.relation)

  for (const link of normalized) {
    if (link.targetType !== 'asset') continue
    const assetStmt = db.prepare(
      'SELECT 1 AS x FROM companion_assets WHERE id = ? AND role_id = ? LIMIT 1',
    )
    assetStmt.bind([link.targetId, roleId])
    const exists = assetStmt.step()
    assetStmt.free()
    if (!exists) throw new Error('关联资产不属于当前主角')
  }

  db.run('SAVEPOINT replace_event_links')
  try {
    db.run('DELETE FROM companion_event_links WHERE event_id = ? AND role_id = ?', [eventId, roleId])
    const createdAt = Date.now()
    for (const link of normalized) {
      db.run(
        `INSERT INTO companion_event_links
         (id, event_id, role_id, target_type, target_id, relation, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(event_id, target_type, target_id, relation) DO UPDATE SET
         role_id = excluded.role_id,
         metadata_json = excluded.metadata_json`,
        [
          randomUUID(),
          eventId,
          roleId,
          link.targetType,
          link.targetId,
          link.relation,
          JSON.stringify(link.metadata ?? {}),
          createdAt,
        ],
      )
    }
    db.run('RELEASE SAVEPOINT replace_event_links')
  } catch (error) {
    db.run('ROLLBACK TO SAVEPOINT replace_event_links')
    db.run('RELEASE SAVEPOINT replace_event_links')
    throw error
  }
  persist()
  return listEventLinks(roleId, eventId)
}

export async function listEventLinks(
  roleId: string,
  eventId: string,
): Promise<CompanionEventLink[]> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT id, event_id, role_id, target_type, target_id, relation, metadata_json, created_at
     FROM companion_event_links
     WHERE role_id = ? AND event_id = ?
     ORDER BY created_at ASC, id ASC`,
  )
  stmt.bind([roleId, eventId])
  const out: CompanionEventLink[] = []
  while (stmt.step()) out.push(mapEventLink(stmt.getAsObject() as Record<string, unknown>))
  stmt.free()
  return out
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


function mapMomentUserInteraction(row: Record<string, unknown>): MomentUserInteraction {
  const kind: MomentUserInteractionKind = row.kind === 'comment' ? 'comment' : 'like'
  return {
    id: row.id as string,
    momentId: row.moment_id as string,
    roleId: row.role_id as string,
    kind,
    actorId: row.actor_id as string,
    text: typeof row.text === 'string' ? row.text : null,
    createdAt: Number(row.created_at) || 0,
  }
}

export async function getMomentById(momentId: string): Promise<CompanionMoment | null> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT id, role_id, event_id, published_at, text, meta_json
     FROM companion_moments WHERE id = ?`,
  )
  stmt.bind([momentId])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const r = stmt.getAsObject() as Record<string, unknown>
  stmt.free()
  return {
    id: r.id as string,
    roleId: r.role_id as string,
    eventId: r.event_id as string,
    publishedAt: r.published_at as number,
    text: r.text as string,
    meta: JSON.parse((r.meta_json as string) || '{}') as Record<string, unknown>,
  }
}

export async function getMomentByEventId(roleId: string, eventId: string): Promise<CompanionMoment | null> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT id, role_id, event_id, published_at, text, meta_json
     FROM companion_moments WHERE role_id = ? AND event_id = ? LIMIT 1`,
  )
  stmt.bind([roleId, eventId])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const r = stmt.getAsObject() as Record<string, unknown>
  stmt.free()
  return {
    id: r.id as string,
    roleId: r.role_id as string,
    eventId: r.event_id as string,
    publishedAt: r.published_at as number,
    text: r.text as string,
    meta: JSON.parse((r.meta_json as string) || '{}') as Record<string, unknown>,
  }
}

export async function listMomentUserInteractions(
  roleId: string,
): Promise<MomentUserInteraction[]> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT id, moment_id, role_id, kind, actor_id, text, created_at
     FROM companion_moment_user_interactions
     WHERE role_id = ?
     ORDER BY created_at ASC`,
  )
  stmt.bind([roleId])
  const out: MomentUserInteraction[] = []
  while (stmt.step()) {
    out.push(mapMomentUserInteraction(stmt.getAsObject() as Record<string, unknown>))
  }
  stmt.free()
  return out
}

export async function findMomentUserLike(
  momentId: string,
  actorId: string,
): Promise<MomentUserInteraction | null> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT id, moment_id, role_id, kind, actor_id, text, created_at
     FROM companion_moment_user_interactions
     WHERE moment_id = ? AND actor_id = ? AND kind = 'like'
     LIMIT 1`,
  )
  stmt.bind([momentId, actorId])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const row = mapMomentUserInteraction(stmt.getAsObject() as Record<string, unknown>)
  stmt.free()
  return row
}

export async function insertMomentUserInteraction(input: {
  momentId: string
  roleId: string
  kind: MomentUserInteractionKind
  actorId: string
  text?: string | null
}): Promise<MomentUserInteraction> {
  await ensureTables()
  const db = await getDatabase()
  const id = randomUUID()
  const createdAt = Date.now()
  db.run(
    `INSERT INTO companion_moment_user_interactions
       (id, moment_id, role_id, kind, actor_id, text, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.momentId,
      input.roleId,
      input.kind,
      input.actorId,
      input.text ?? null,
      createdAt,
    ],
  )
  persist()
  return {
    id,
    momentId: input.momentId,
    roleId: input.roleId,
    kind: input.kind,
    actorId: input.actorId,
    text: input.text ?? null,
    createdAt,
  }
}

export async function deleteMomentUserInteraction(
  id: string,
  roleId: string,
): Promise<boolean> {
  await ensureTables()
  const db = await getDatabase()
  const existing = db.prepare(
    'SELECT id FROM companion_moment_user_interactions WHERE id = ? AND role_id = ? LIMIT 1',
  )
  existing.bind([id, roleId])
  const found = existing.step()
  existing.free()
  if (!found) return false
  db.run('DELETE FROM companion_moment_user_interactions WHERE id = ? AND role_id = ?', [id, roleId])
  persist()
  return true
}

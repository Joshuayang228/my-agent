import type { Database } from 'sql.js'
import { MOMENT_USER_ACTOR_ID, normalizeMomentCommentText, type MomentUserInteraction } from '../../../src/shared/moment-user-interactions'

interface PublishedEvent {
  id: string
  roleId: string
  scheduledAt: number
  status: 'published'
  type: string
  payload: Record<string, unknown>
}
interface MomentSnapshot {
  id: string
  roleId: string
  eventId: string
  publishedAt: number
  text: string
  meta: Record<string, unknown>
}
export interface MomentBackup {
  events: PublishedEvent[]
  moments: MomentSnapshot[]
  interactions: MomentUserInteraction[]
}
const MAX_ROWS = 10_000
const object = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const timestamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const jsonObject = (v: unknown): v is Record<string, unknown> => object(v) && JSON.stringify(v).length <= 20_000

/** 外部历史只能恢复既有 published 截面；校验完整角色链，不能借导入创造待执行事件。 */
export function isValidMomentBackup(value: unknown): value is MomentBackup {
  if (!object(value)) return false
  for (const key of ['events', 'moments', 'interactions']) {
    if (!Array.isArray(value[key]) || value[key].length > MAX_ROWS) return false
  }
  const events = new Map<string, string>()
  for (const row of value.events as unknown[]) {
    if (!object(row) || !text(row.id) || events.has(row.id) || !text(row.roleId) || !timestamp(row.scheduledAt)
      || row.status !== 'published' || !text(row.type, 100) || !jsonObject(row.payload)) return false
    events.set(row.id, row.roleId)
  }
  const moments = new Map<string, string>()
  const projected = new Set<string>()
  for (const row of value.moments as unknown[]) {
    if (!object(row) || !text(row.id) || moments.has(row.id) || !text(row.roleId) || !text(row.eventId)
      || events.get(row.eventId) !== row.roleId || projected.has(row.eventId) || !timestamp(row.publishedAt)
      || !text(row.text, 20_000) || !jsonObject(row.meta)) return false
    moments.set(row.id, row.roleId)
    projected.add(row.eventId)
  }
  if (projected.size !== events.size) return false
  const ids = new Set<string>()
  const likes = new Set<string>()
  for (const row of value.interactions as unknown[]) {
    if (!object(row) || !text(row.id) || ids.has(row.id) || !text(row.momentId) || !text(row.roleId)
      || moments.get(row.momentId) !== row.roleId || row.actorId !== MOMENT_USER_ACTOR_ID || !timestamp(row.createdAt)) return false
    ids.add(row.id)
    if (row.kind === 'like') {
      if (row.text !== null || likes.has(row.momentId)) return false
      likes.add(row.momentId)
    } else if (row.kind === 'comment') {
      const normalized = normalizeMomentCommentText(row.text)
      if (!normalized.ok || normalized.text !== row.text) return false
    } else return false
  }
  return true
}

function rows(db: Database, sql: string, bindings: string[] = []): Record<string, unknown>[] {
  const statement = db.prepare(sql)
  const result: Record<string, unknown>[] = []
  try {
    statement.bind(bindings)
    while (statement.step()) {
      if (result.length >= MAX_ROWS) throw new Error('朋友圈历史超出备份条数限制')
      result.push(statement.getAsObject())
    }
    return result
  } finally { statement.free() }
}

export function collectMomentBackup(db: Database): MomentBackup {
  const tables = rows(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('companion_events', 'companion_moments', 'companion_moment_user_interactions')")
  const names = new Set(tables.map(row => row.name))
  const moments = names.has('companion_moments') ? rows(db, 'SELECT * FROM companion_moments ORDER BY published_at, id').map(row => ({
    id: row.id as string, roleId: row.role_id as string, eventId: row.event_id as string,
    publishedAt: row.published_at as number, text: row.text as string, meta: JSON.parse(String(row.meta_json)),
  })) : []
  const events = names.has('companion_events') && moments.length ? rows(db,
    'SELECT e.* FROM companion_events e JOIN companion_moments m ON m.event_id = e.id ORDER BY e.scheduled_at, e.id').map(row => ({
    id: row.id as string, roleId: row.role_id as string, scheduledAt: row.scheduled_at as number,
    status: row.status as 'published', type: row.type as string, payload: JSON.parse(String(row.payload_json)),
  })) : []
  const interactions = names.has('companion_moment_user_interactions') ? rows(db, 'SELECT * FROM companion_moment_user_interactions ORDER BY created_at, id').map(row => ({
    id: row.id as string, momentId: row.moment_id as string, roleId: row.role_id as string, kind: row.kind as MomentUserInteraction['kind'],
    actorId: row.actor_id as string, text: row.text as string | null, createdAt: row.created_at as number,
  })) : []
  const result = { events, moments, interactions }
  if (!isValidMomentBackup(result)) throw new Error('朋友圈历史关联不完整，无法导出')
  return result
}

/**
 * 背景：赞评离开原动态不可展示，单独恢复还可能误挂到另一角色的动态。
 * 意图：同步恢复 published 事件、原截面和用户互动，交给外层整份事务及落盘补偿。
 * 约束：不调用投影 / 奖励 / 调度器，不覆盖已有行，冲突归属整笔失败；undo 只含本次新增行。
 */
export function importMomentBackup(db: Database, bundle: MomentBackup, undo: Array<() => void>): void {
  if (!isValidMomentBackup(bundle)) throw new Error('朋友圈历史格式无效')
  for (const event of bundle.events) {
    const existing = rows(db, 'SELECT role_id, status FROM companion_events WHERE id = ?', [event.id])[0]
    if (existing) {
      if (existing.role_id !== event.roleId || existing.status !== 'published') throw new Error('生活事件归属冲突')
      continue
    }
    db.run('INSERT INTO companion_events (id, role_id, scheduled_at, status, type, payload_json, day_script_id) VALUES (?, ?, ?, ?, ?, ?, NULL)',
      [event.id, event.roleId, event.scheduledAt, 'published', event.type, JSON.stringify(event.payload)])
    undo.push(() => { db.run('DELETE FROM companion_events WHERE id = ?', [event.id]) })
  }
  for (const moment of bundle.moments) {
    const matches = rows(db, 'SELECT id, role_id, event_id FROM companion_moments WHERE id = ? OR event_id = ?', [moment.id, moment.eventId])
    const existing = matches[0]
    if (existing) {
      if (matches.length !== 1) throw new Error('动态身份与事件分别占用')
      if (existing.id !== moment.id || existing.role_id !== moment.roleId || existing.event_id !== moment.eventId) throw new Error('动态归属冲突')
      continue
    }
    db.run('INSERT INTO companion_moments (id, role_id, event_id, published_at, text, meta_json) VALUES (?, ?, ?, ?, ?, ?)',
      [moment.id, moment.roleId, moment.eventId, moment.publishedAt, moment.text, JSON.stringify(moment.meta)])
    undo.push(() => { db.run('DELETE FROM companion_moments WHERE id = ?', [moment.id]) })
  }
  for (const item of bundle.interactions) {
    const existing = rows(db, 'SELECT moment_id, role_id, kind, actor_id FROM companion_moment_user_interactions WHERE id = ?', [item.id])[0]
    if (existing) {
      if (existing.moment_id !== item.momentId || existing.role_id !== item.roleId || existing.kind !== item.kind || existing.actor_id !== item.actorId) throw new Error('用户互动归属冲突')
      continue
    }
    if (item.kind === 'like' && rows(db, "SELECT id FROM companion_moment_user_interactions WHERE moment_id = ? AND actor_id = ? AND kind = 'like'", [item.momentId, item.actorId]).length) continue
    db.run('INSERT INTO companion_moment_user_interactions (id, moment_id, role_id, kind, actor_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [item.id, item.momentId, item.roleId, item.kind, item.actorId, item.text, item.createdAt])
    undo.push(() => { db.run('DELETE FROM companion_moment_user_interactions WHERE id = ?', [item.id]) })
  }
}

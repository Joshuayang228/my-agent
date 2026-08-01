/**
 * Assets / 衣柜（W4）
 *
 * 背景：着装等是角色世界状态截面，按 role_id 隔离；非独立内容真相。
 * 意图：list/add/ensureStarter；事件 payload 可引用 assetId。
 * 约束：IPC 只暴露 active role；不 import agent/。
 */

import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../storage/database'
import { createLogger } from '../../utils/logger'
import type { CompanionAsset } from '../types'

const log = createLogger('CompanionAssets')

async function ensureTables(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_assets (
      id               TEXT PRIMARY KEY,
      role_id          TEXT NOT NULL,
      kind             TEXT NOT NULL,
      name             TEXT NOT NULL,
      payload_json     TEXT NOT NULL DEFAULT '{}',
      acquired_at      INTEGER NOT NULL,
      source_event_id  TEXT
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_assets_role_kind
      ON companion_assets(role_id, kind)
  `)
}

function rowToAsset(r: Record<string, unknown>): CompanionAsset {
  return {
    id: r.id as string,
    roleId: r.role_id as string,
    kind: r.kind as string,
    name: r.name as string,
    payload: JSON.parse((r.payload_json as string) || '{}') as Record<string, unknown>,
    acquiredAt: r.acquired_at as number,
    sourceEventId: (r.source_event_id as string) || null,
  }
}

export async function listAssets(
  roleId: string,
  opts?: { kind?: string },
): Promise<CompanionAsset[]> {
  await ensureTables()
  const db = await getDatabase()
  const sql = opts?.kind
    ? `SELECT id, role_id, kind, name, payload_json, acquired_at, source_event_id
       FROM companion_assets WHERE role_id = ? AND kind = ?
       ORDER BY acquired_at ASC`
    : `SELECT id, role_id, kind, name, payload_json, acquired_at, source_event_id
       FROM companion_assets WHERE role_id = ?
       ORDER BY kind ASC, acquired_at ASC`
  const stmt = db.prepare(sql)
  if (opts?.kind) stmt.bind([roleId, opts.kind])
  else stmt.bind([roleId])
  const out: CompanionAsset[] = []
  while (stmt.step()) {
    out.push(rowToAsset(stmt.getAsObject() as Record<string, unknown>))
  }
  stmt.free()
  return out
}

export async function getAsset(assetId: string): Promise<CompanionAsset | null> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT id, role_id, kind, name, payload_json, acquired_at, source_event_id
     FROM companion_assets WHERE id = ?`,
  )
  stmt.bind([assetId])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const asset = rowToAsset(stmt.getAsObject() as Record<string, unknown>)
  stmt.free()
  return asset
}

export async function addAsset(input: {
  roleId: string
  kind: string
  name: string
  payload?: Record<string, unknown>
  acquiredAt?: number
  sourceEventId?: string | null
  /** 可选固定 id（starter 种子用，幂等） */
  id?: string
}): Promise<CompanionAsset> {
  await ensureTables()
  const db = await getDatabase()
  const id = input.id || randomUUID()
  const acquiredAt = input.acquiredAt ?? Date.now()
  db.run(
    `INSERT INTO companion_assets
       (id, role_id, kind, name, payload_json, acquired_at, source_event_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.roleId,
      input.kind,
      input.name,
      JSON.stringify(input.payload ?? {}),
      acquiredAt,
      input.sourceEventId ?? null,
    ],
  )
  persist()
  log.info('Asset added', { roleId: input.roleId, kind: input.kind, name: input.name, id })
  return {
    id,
    roleId: input.roleId,
    kind: input.kind,
    name: input.name,
    payload: input.payload ?? {},
    acquiredAt,
    sourceEventId: input.sourceEventId ?? null,
  }
}

/** 确定性 starter 衣柜：每角色空库时播种，id 稳定可幂等跳过 */
const STARTER_WARDROBE: Array<{ key: string; name: string; payload: Record<string, unknown> }> = [
  { key: 'tee-white', name: '白 T 恤', payload: { color: '白', style: '休闲' } },
  { key: 'hoodie-gray', name: '灰色连帽衫', payload: { color: '灰', style: '日常' } },
  { key: 'sneakers', name: '运动鞋', payload: { color: '白', style: '出行' } },
]

export async function ensureStarterWardrobe(roleId: string): Promise<{ created: number }> {
  await ensureTables()
  const existing = await listAssets(roleId, { kind: 'wardrobe' })
  if (existing.length > 0) return { created: 0 }

  let created = 0
  const base = Date.now()
  for (let i = 0; i < STARTER_WARDROBE.length; i++) {
    const item = STARTER_WARDROBE[i]
    const id = `wardrobe:${roleId}:${item.key}`
    const db = await getDatabase()
    const check = db.prepare('SELECT 1 AS x FROM companion_assets WHERE id = ?')
    check.bind([id])
    const exists = check.step()
    check.free()
    if (exists) continue
    await addAsset({
      id,
      roleId,
      kind: 'wardrobe',
      name: item.name,
      payload: item.payload,
      acquiredAt: base + i,
      sourceEventId: null,
    })
    created += 1
  }
  return { created }
}

/** 为事件挑选一件衣柜（确定性：按 scheduledAt 取模） */
export async function pickWardrobeAssetId(
  roleId: string,
  seed: number,
): Promise<string | null> {
  await ensureStarterWardrobe(roleId)
  const items = await listAssets(roleId, { kind: 'wardrobe' })
  if (!items.length) return null
  return items[Math.abs(seed) % items.length].id
}

/**
 * 从事件获得新资产（若 payload.grantAsset 指定）；返回新建或 null。
 */
export async function maybeGrantFromEvent(input: {
  roleId: string
  eventId: string
  grant?: { kind: string; name: string; payload?: Record<string, unknown> }
}): Promise<CompanionAsset | null> {
  if (!input.grant) return null
  return addAsset({
    roleId: input.roleId,
    kind: input.grant.kind,
    name: input.grant.name,
    payload: input.grant.payload,
    sourceEventId: input.eventId,
  })
}

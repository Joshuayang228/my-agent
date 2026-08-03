/**
 * Assets / 衣柜（W4 / M25-G1·G2）
 *
 * 背景：着装等是角色世界状态截面，按 role_id 隔离；非独立内容真相。
 * 意图：list/add/update/delete/ensureStarter；publish 可 grant；事件可引用 assetId。
 * 约束：IPC 只暴露 active role；删除后 Moment 着装引用自然降级；不 import agent/。
 */

import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../storage/database'
import { createLogger } from '../../utils/logger'
import type { CompanionAsset, GrantAssetSpec } from '../types'
import { normalizeGrantAsset } from './grant-asset'

export { normalizeGrantAsset } from './grant-asset'

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

export type AssetMutationResult =
  | { ok: true; asset: CompanionAsset }
  | { ok: false; code: 'NOT_FOUND' | 'ROLE_MISMATCH' | 'INVALID'; error: string }

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

type StarterItem = { key: string; name: string; payload: Record<string, unknown> }

/** 默认 starter；各主角可覆盖以体现分味（仅空库时播种） */
const STARTER_DEFAULT: StarterItem[] = [
  { key: 'tee-white', name: '白 T 恤', payload: { color: '白', style: '休闲' } },
  { key: 'hoodie-gray', name: '灰色连帽衫', payload: { color: '灰', style: '日常' } },
  { key: 'sneakers', name: '运动鞋', payload: { color: '白', style: '出行' } },
]

const STARTER_BY_ROLE: Record<string, StarterItem[]> = {
  lin: [
    { key: 'shirt-navy', name: '藏青衬衫', payload: { color: '深蓝', style: '通勤', occasion: '工位' } },
    { key: 'cardigan-beige', name: '米色针织开衫', payload: { color: '米', style: '日常', occasion: '家' } },
    { key: 'loafers', name: '棕色乐福鞋', payload: { color: '棕', style: '出行', occasion: '路上' } },
  ],
  zhou: [
    { key: 'tee-graphic', name: '印花短袖', payload: { color: '白', style: '街头', occasion: '户外' } },
    { key: 'denim-jacket', name: '浅色牛仔外套', payload: { color: '浅蓝', style: '轻快', occasion: '咖啡馆' } },
    { key: 'sneakers-color', name: '撞色运动鞋', payload: { color: '彩', style: '出行', occasion: '路上' } },
  ],
  xia: [
    { key: 'linen-shirt', name: '亚麻衬衫', payload: { color: '浅灰', style: '安静', occasion: '家' } },
    { key: 'soft-hoodie', name: '软乎乎连帽衫', payload: { color: '雾蓝', style: '宅家', occasion: '家' } },
    { key: 'quiet-sneakers', name: '低饱和运动鞋', payload: { color: '灰白', style: '散步', occasion: '户外' } },
  ],
}

export async function ensureStarterWardrobe(roleId: string): Promise<{ created: number }> {
  await ensureTables()
  const existing = await listAssets(roleId, { kind: 'wardrobe' })
  if (existing.length > 0) return { created: 0 }

  const starter = STARTER_BY_ROLE[roleId] ?? STARTER_DEFAULT
  let created = 0
  const base = Date.now()
  for (let i = 0; i < starter.length; i++) {
    const item = starter[i]
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
 * 更新资产名称 / payload（合并写入）。
 * expectedRoleId：若提供则必须属于该角色（IPC 用 active）。
 */
export async function updateAsset(
  assetId: string,
  patch: { name?: string; payload?: Record<string, unknown> },
  opts?: { expectedRoleId?: string },
): Promise<AssetMutationResult> {
  const existing = await getAsset(assetId)
  if (!existing) {
    return { ok: false, code: 'NOT_FOUND', error: '资产不存在' }
  }
  if (opts?.expectedRoleId && existing.roleId !== opts.expectedRoleId) {
    return { ok: false, code: 'ROLE_MISMATCH', error: '只能改当前活跃主角的衣柜' }
  }

  const name = typeof patch.name === 'string' ? patch.name.trim() : existing.name
  if (!name || name.length > 40) {
    return { ok: false, code: 'INVALID', error: '名称无效（1–40 字）' }
  }

  let payload = existing.payload
  if (patch.payload && typeof patch.payload === 'object') {
    const next: Record<string, unknown> = { ...existing.payload }
    for (const [k, v] of Object.entries(patch.payload)) {
      if (v === null || v === undefined || v === '') {
        delete next[k]
        continue
      }
      if (typeof v === 'string') {
        const t = v.trim().slice(0, 24)
        if (t) next[k] = t
        else delete next[k]
      } else {
        next[k] = v
      }
    }
    payload = next
  }

  const db = await getDatabase()
  db.run(
    `UPDATE companion_assets SET name = ?, payload_json = ? WHERE id = ?`,
    [name, JSON.stringify(payload), assetId],
  )
  persist()
  const asset: CompanionAsset = { ...existing, name, payload }
  log.info('Asset updated', { assetId, roleId: existing.roleId, name })
  return { ok: true, asset }
}

/**
 * 删除资产。expectedRoleId 用于防改他人衣柜。
 */
export async function deleteAsset(
  assetId: string,
  opts?: { expectedRoleId?: string },
): Promise<{ ok: true } | { ok: false; code: 'NOT_FOUND' | 'ROLE_MISMATCH'; error: string }> {
  const existing = await getAsset(assetId)
  if (!existing) {
    return { ok: false, code: 'NOT_FOUND', error: '资产不存在' }
  }
  if (opts?.expectedRoleId && existing.roleId !== opts.expectedRoleId) {
    return { ok: false, code: 'ROLE_MISMATCH', error: '只能删当前活跃主角的衣柜' }
  }
  const db = await getDatabase()
  db.run(`DELETE FROM companion_assets WHERE id = ?`, [assetId])
  persist()
  log.info('Asset deleted', { assetId, roleId: existing.roleId })
  return { ok: true }
}

/**
 * 从事件获得新资产（payload.grantAsset 或显式 grant）。
 * 背景：M25-G2 挂 publish；幂等 id=`grant:{eventId}`，重复发布不刷柜。
 * 约束：仅在调用方已决定「该事件可 grant」时调用；哈希日剧本默认不带 grant。
 */
export async function maybeGrantFromEvent(input: {
  roleId: string
  eventId: string
  grant?: GrantAssetSpec | null
  /** 事件 payload；若未传 grant 则读 grantAsset */
  eventPayload?: Record<string, unknown>
}): Promise<CompanionAsset | null> {
  const grant =
    input.grant ??
    normalizeGrantAsset(input.eventPayload?.grantAsset)
  if (!grant) return null

  const id = `grant:${input.eventId}`
  const existing = await getAsset(id)
  if (existing) return existing

  return addAsset({
    id,
    roleId: input.roleId,
    kind: grant.kind,
    name: grant.name,
    payload: grant.payload,
    sourceEventId: input.eventId,
  })
}

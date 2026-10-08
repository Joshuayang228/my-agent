/**
 * Assets / 物什（W4 / M25-G1–G3）
 *
 * 背景：着装/书籍等是角色世界状态截面，按 role_id + kind 隔离；非独立内容真相。
 * 意图：list/add/update/delete/ensureStarter(wardrobe|bookshelf)；publish 可 grant。
 * 约束：IPC 只暴露 active role；删除后引用自然降级；不 import agent/。
 */

import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { getDatabase, persist } from '../../storage/database'
import { createLogger } from '../../utils/logger'
import type { CompanionAsset, GrantAssetSpec } from '../types'
import type { GeneratedImageReference } from '../../../../src/shared/types'
import { BACKUP_LIVING_ASSET_KINDS } from '../../../../src/shared/types'
import { loadRoleWorldDefaults } from '../identity/loader'
import { normalizeGrantAsset } from './grant-asset'
import { normalizeWorldRecordField, wardrobeCategorySchema, wardrobeSlotsSchema, worldRecordConsistencyError } from '../../../../src/shared/world-records'
import type { CompanionWardrobeChangeInput } from '../../../../src/shared/types'

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

class InvalidInternalAssetError extends Error {}

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
  // 内部播种和事件发放也会进入六面；只规范新登记字段，保留旧正文而不套用短标签截断。
  // 引用校验与 INSERT 同步执行；非法发放可被明确跳过，真实数据库失败不得被吞掉。
  const payload = { ...input.payload }
  for (const [key, value] of Object.entries(payload)) {
    const field = normalizeWorldRecordField(input.kind, key, value)
    if (!field.handled) continue
    if (!field.ok) throw new InvalidInternalAssetError(field.error)
    payload[key] = field.value
  }
  if (input.kind === 'wardrobe' && payload.recordType === 'wear-state') throw new InvalidInternalAssetError('当前穿搭请通过换上操作更新。')
  const invalid = worldRecordConsistencyError(input.kind, payload)
    ?? homeReferenceError(db, input.roleId, input.kind, payload)
    ?? wardrobeReferenceError(db, input.roleId, input.kind, payload)
  if (invalid) throw new InvalidInternalAssetError(invalid)
  if (input.kind === 'wardrobe' && payload.recordType === 'outfit') {
    if (payload.image) throw new InvalidInternalAssetError('套装配图请通过受控生图绑定。')
    payload.outfitVersion = 1
    delete payload.imageOutfitVersion
  }
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
      JSON.stringify(payload),
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
    payload,
    acquiredAt,
    sourceEventId: input.sourceEventId ?? null,
  }
}

export const ASSET_KIND_WARDROBE = 'wardrobe'
export const ASSET_KIND_BOOKSHELF = 'bookshelf'
export const ASSET_KIND_CULTURE = 'culture'
export const ASSET_KIND_HOME = 'home'
export const ASSET_KIND_FOOTPRINT = 'footprint'
export const ASSET_KIND_FURNITURE = 'furniture'

export const USER_CREATABLE_ASSET_KINDS = BACKUP_LIVING_ASSET_KINDS

export type UserCreatableAssetKind = (typeof USER_CREATABLE_ASSET_KINDS)[number]

const LONG_TEXT_FIELDS = new Set([
  'note',
  'detail',
  'description',
  'residence',
  'interior',
  'layout',
  'view',
  'surroundings',
])

function normalizeImageReference(value: unknown): GeneratedImageReference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const image = value as Partial<GeneratedImageReference>
  if (typeof image.id !== 'string' || !/^[a-f0-9]{64}$/.test(image.id) || typeof image.path !== 'string'
    || !path.isAbsolute(image.path) || image.mimeType !== 'image/png'
    || typeof image.width !== 'number' || !Number.isSafeInteger(image.width) || image.width <= 0 || typeof image.height !== 'number' || !Number.isSafeInteger(image.height) || image.height <= 0
    || typeof image.byteLength !== 'number' || !Number.isSafeInteger(image.byteLength) || image.byteLength <= 0) return null
  return { id: image.id, path: image.path, mimeType: image.mimeType, width: image.width, height: image.height, byteLength: image.byteLength }
}

function allowsLongText(kind: string): boolean {
  return kind === ASSET_KIND_CULTURE
    || kind === ASSET_KIND_BOOKSHELF
    || kind === ASSET_KIND_HOME
    || kind === ASSET_KIND_FOOTPRINT
    || kind === ASSET_KIND_FURNITURE
}

export function normalizeAssetName(name: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = typeof name === 'string' ? name.trim() : ''
  if (!value || value.length > 40) return { ok: false, error: '名称无效（1–40 字）' }
  return { ok: true, value }
}

/**
 * 背景：衣柜短标签与文化 / 家居 / 足迹正文共用同一写入入口，统一截成 24 字会静默丢掉住所和地点描述。
 * 设计意图：按资产类型识别正文白名单，超限拒绝整次写入；短标签保持兼容截断。
 * 关键约束：先规范化全部字段再交给 SQL；不得部分保存；正文不做日志。
 */
export function applyAssetPayloadPatch(
  kind: string,
  current: Record<string, unknown>,
  patch?: Record<string, unknown>,
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  if (!patch || typeof patch !== 'object') return { ok: true, payload: current }
  const next: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '') {
      delete next[key]
      continue
    }
    const worldField = normalizeWorldRecordField(kind, key, value)
    if (worldField.handled) {
      if (!worldField.ok) return { ok: false, error: worldField.error }
      next[key] = worldField.value
      continue
    }
    if (allowsLongText(kind) && LONG_TEXT_FIELDS.has(key)) {
      if (typeof value !== 'string' || value.length > 4000) {
        return { ok: false, error: '正文须为文本，长度不能超过 4000 字符' }
      }
      if (value.trim()) next[key] = value
      else delete next[key]
      continue
    }
    if (key === 'image') {
      const image = normalizeImageReference(value)
      if (!image) return { ok: false, error: '图片引用无效，未保存。' }
      next[key] = image
      continue
    }
    if (typeof value === 'string') {
      const text = value.trim().slice(0, 24)
      if (text) next[key] = text
      else delete next[key]
    } else {
      next[key] = value
    }
  }
  const consistencyError = worldRecordConsistencyError(kind, next)
  return consistencyError ? { ok: false, error: consistencyError } : { ok: true, payload: next }
}

export function isUserCreatableAssetKind(kind: string): kind is UserCreatableAssetKind {
  return (USER_CREATABLE_ASSET_KINDS as readonly string[]).includes(kind)
}

/**
 * 背景：生活面需要用户主动写入衣柜、文化、家居和足迹，但内部播种和事件 grant 仍走 addAsset。
 * 设计意图：用户创建走白名单 kind 与同一套名称 / 正文校验，避免 IPC 直接插入任意类型。
 * 关键约束：只给调用方传入的 roleId 写入；不补种、不覆盖已有 id。
 */
export async function createAsset(input: {
  roleId: string
  kind: string
  name: string
  payload?: Record<string, unknown>
}): Promise<AssetMutationResult> {
  const kind = typeof input.kind === 'string' ? input.kind.trim() : ''
  if (!isUserCreatableAssetKind(kind)) {
    return { ok: false, code: 'INVALID', error: '不支持的生活资产类型' }
  }
  if (kind === ASSET_KIND_WARDROBE && input.payload?.recordType === 'wear-state') return { ok: false, code: 'INVALID', error: '当前穿搭请通过换上操作更新。' }
  const name = normalizeAssetName(input.name)
  if (!name.ok) return { ok: false, code: 'INVALID', error: name.error }
  const payload = applyAssetPayloadPatch(kind, {}, input.payload)
  if (!payload.ok) return { ok: false, code: 'INVALID', error: payload.error }
  await ensureTables()
  const db = await getDatabase()
  const referenceError = homeReferenceError(db, input.roleId, kind, payload.payload)
  if (referenceError) return { ok: false, code: 'INVALID', error: referenceError }
  const wardrobeError = wardrobeReferenceError(db, input.roleId, kind, payload.payload)
  if (wardrobeError) return { ok: false, code: 'INVALID', error: wardrobeError }
  if (kind === ASSET_KIND_WARDROBE && payload.payload.recordType === 'outfit') payload.payload.outfitVersion = 1
  const asset: CompanionAsset = { id: randomUUID(), roleId: input.roleId, kind, name: name.value, payload: payload.payload, acquiredAt: Date.now(), sourceEventId: null }
  db.run('INSERT INTO companion_assets (id, role_id, kind, name, payload_json, acquired_at, source_event_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [asset.id, asset.roleId, asset.kind, asset.name, JSON.stringify(asset.payload), asset.acquiredAt, null])
  persist()
  log.info('Asset added', { roleId: asset.roleId, kind, id: asset.id })
  return { ok: true, asset }
}

/**
 * 背景：正式换装不能依赖动态名称或候选内存，也不能逐件写入造成半套状态。
 * 设计意图：复用资产表，以版本核验和同步引用检查后的一次 SQL 保存完整槽位。
 * 关键约束：检查到写入间无 await；只引用同角色有效分类衣物，整套替换不遗留外套，图片只在内容版本匹配时沿用。
 */
export async function changeWardrobe(input: CompanionWardrobeChangeInput): Promise<AssetMutationResult> {
  if (!input || typeof input.roleId !== 'string' || !input.roleId.trim() || typeof input.assetId !== 'string' || !input.assetId.trim()
    || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) return { ok: false, code: 'INVALID', error: '换装信息无效，请重新读取衣柜。' }
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT * FROM companion_assets WHERE role_id = ? AND kind = ?')
  const items: CompanionAsset[] = []
  try { stmt.bind([input.roleId, ASSET_KIND_WARDROBE]); while (stmt.step()) items.push(rowToAsset(stmt.getAsObject())) } finally { stmt.free() }
  const states = items.filter(asset => asset.payload.recordType === 'wear-state')
  if (states.length > 1) return { ok: false, code: 'INVALID', error: '当前穿搭记录冲突，请重新读取衣柜。' }
  const current = states[0]
  const version = current ? current.payload.outfitVersion : 0
  if (version !== input.expectedVersion || !Number.isSafeInteger(version)) return { ok: false, code: 'INVALID', error: '穿搭已发生变化，请重新读取后再换上。' }
  const target = items.find(asset => asset.id === input.assetId)
  if (!target) return { ok: false, code: 'NOT_FOUND', error: '衣物或套装不存在于当前衣柜。' }
  const isOutfit = target.payload.recordType === 'outfit'
  const category = wardrobeCategorySchema.safeParse(target.payload.category)
  if (!isOutfit && (!category.success || target.payload.recordType && target.payload.recordType !== 'garment')) return { ok: false, code: 'INVALID', error: '这条记录不是可换上的衣物或套装。' }
  const slots = wardrobeSlotsSchema.safeParse(isOutfit ? target.payload.slots : { ...(current?.payload.slots as Record<string, unknown> ?? {}), [category.success ? category.data : '']: target.id })
  if (!slots.success || isOutfit && worldRecordConsistencyError(ASSET_KIND_WARDROBE, target.payload)) return { ok: false, code: 'INVALID', error: '套装衣物不完整，当前穿着仍保留。' }
  for (const [slot, id] of Object.entries(slots.data)) {
    const garment = items.find(asset => asset.id === id)
    if (!garment || garment.payload.category !== slot || garment.payload.recordType && garment.payload.recordType !== 'garment') return { ok: false, code: 'INVALID', error: '穿搭引用了失效或分类不匹配的衣物，当前穿着仍保留。' }
  }
  const nextVersion = Number(version) + 1
  if (!Number.isSafeInteger(nextVersion)) return { ok: false, code: 'INVALID', error: '穿搭版本无效，请重新读取衣柜。' }
  const payload: Record<string, unknown> = { recordType: 'wear-state', slots: slots.data, outfitVersion: nextVersion }
  if (isOutfit && Number.isSafeInteger(target.payload.outfitVersion) && target.payload.outfitVersion === target.payload.imageOutfitVersion) {
    const image = normalizeImageReference(target.payload.image)
    if (image) { payload.image = image; payload.imageOutfitVersion = nextVersion }
  }
  const asset: CompanionAsset = { id: current?.id ?? randomUUID(), roleId: input.roleId, kind: ASSET_KIND_WARDROBE, name: '当前穿搭', payload, acquiredAt: current?.acquiredAt ?? Date.now(), sourceEventId: null }
  if (current) db.run('UPDATE companion_assets SET name = ?, payload_json = ? WHERE id = ? AND role_id = ?', [asset.name, JSON.stringify(payload), asset.id, input.roleId])
  else db.run('INSERT INTO companion_assets (id, role_id, kind, name, payload_json, acquired_at, source_event_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [asset.id, asset.roleId, asset.kind, asset.name, JSON.stringify(payload), asset.acquiredAt, null])
  persist()
  log.info('Wardrobe changed', { roleId: input.roleId, assetId: target.id, outfitVersion: nextVersion })
  return { ok: true, asset }
}

/**
 * 背景：远程生图返回前，套装或当前穿搭可能已改变，旧结果不能覆盖新内容。
 * 设计意图：生成前捕获版本，绑定时同步重读资产并核验，而不是用早先快照调用通用编辑。
 * 关键约束：角色、内容版本和衣物引用均有效才一次写入；失败保留原图片，普通生活资产无需穿搭版本。
 */
export async function attachWorldAssetImage(assetId: string, image: GeneratedImageReference, opts: { expectedRoleId: string; expectedOutfitVersion?: number }): Promise<AssetMutationResult> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT * FROM companion_assets WHERE id = ?')
  let asset: CompanionAsset | null = null
  try { stmt.bind([assetId]); if (stmt.step()) asset = rowToAsset(stmt.getAsObject()) } finally { stmt.free() }
  if (!asset) return { ok: false, code: 'NOT_FOUND', error: '资产不存在，未绑定图片。' }
  if (asset.roleId !== opts.expectedRoleId) return { ok: false, code: 'ROLE_MISMATCH', error: '图片不属于当前伙伴。' }
  const normalized = normalizeImageReference(image)
  if (!normalized) return { ok: false, code: 'INVALID', error: '图片引用无效，未保存。' }
  const payload: Record<string, unknown> = { ...asset.payload, image: normalized }
  if (asset.kind === ASSET_KIND_WARDROBE && ['outfit', 'wear-state'].includes(String(asset.payload.recordType))) {
    if (!Number.isSafeInteger(opts.expectedOutfitVersion) || asset.payload.outfitVersion !== opts.expectedOutfitVersion) return { ok: false, code: 'INVALID', error: '生成期间穿搭已改变，未覆盖当前图片。' }
    const error = wardrobeReferenceError(db, asset.roleId, asset.kind, payload)
    if (error) return { ok: false, code: 'INVALID', error }
    payload.imageOutfitVersion = opts.expectedOutfitVersion
  }
  db.run('UPDATE companion_assets SET payload_json = ? WHERE id = ? AND role_id = ?', [JSON.stringify(payload), assetId, opts.expectedRoleId])
  persist()
  return { ok: true, asset: { ...asset, payload } }
}

/**
 * 背景：空间和物件保存时可能引用别人的房间，或已删除的住所。
 * 设计意图：在同一数据库实例上同步检查引用后写入，避免异步读取与写入之间引用变化。
 * 关键约束：只按稳定 ID 和角色归属判断，不按名称匹配；存量失效引用允许纯正文修订，新增 / 更改引用必须有效。
 */
function homeReferenceError(db: Awaited<ReturnType<typeof getDatabase>>, roleId: string, kind: string, payload: Record<string, unknown>, previous?: Record<string, unknown>): string | null {
  const key = kind === 'home' && payload.recordType === 'space' ? 'residenceId' : kind === 'furniture' ? 'spaceId' : null
  if (!key || payload[key] == null) return null
  if (previous && previous[key] === payload[key] && (key !== 'residenceId' || previous.recordType === 'space')) return null
  const stmt = db.prepare('SELECT role_id, kind, payload_json FROM companion_assets WHERE id = ?')
  try {
    stmt.bind([String(payload[key])])
    if (!stmt.step()) return '关联的居住空间不存在，请重新选择。'
    const row = stmt.getAsObject()
    if (row.role_id !== roleId || row.kind !== 'home') return '只能关联当前人物的居住空间。'
    const target = JSON.parse(String(row.payload_json)) as Record<string, unknown>
    if (key === 'spaceId' ? target.recordType !== 'space' : target.recordType === 'space') return '关联的空间类型不正确，请重新选择。'
    return null
  } finally { stmt.free() }
}

function wardrobeReferenceError(db: Awaited<ReturnType<typeof getDatabase>>, roleId: string, kind: string, payload: Record<string, unknown>): string | null {
  if (kind !== ASSET_KIND_WARDROBE || !['outfit', 'wear-state'].includes(String(payload.recordType))) return null
  const slots = wardrobeSlotsSchema.safeParse(payload.slots)
  if (!slots.success) return '穿搭槽位无效，未保存。'
  for (const [slot, id] of Object.entries(slots.data)) {
    const stmt = db.prepare('SELECT role_id, kind, payload_json FROM companion_assets WHERE id = ?')
    try {
      stmt.bind([id])
      if (!stmt.step()) return '穿搭引用的衣物不存在，未保存。'
      const row = stmt.getAsObject()
      const garment = JSON.parse(String(row.payload_json)) as Record<string, unknown>
      if (row.role_id !== roleId || row.kind !== ASSET_KIND_WARDROBE || garment.category !== slot || garment.recordType && garment.recordType !== 'garment') return '穿搭只能引用当前人物分类匹配的衣物，未保存。'
    } finally { stmt.free() }
  }
  return null
}

export type AssetKind = typeof ASSET_KIND_WARDROBE | typeof ASSET_KIND_BOOKSHELF | typeof ASSET_KIND_CULTURE | typeof ASSET_KIND_HOME | typeof ASSET_KIND_FOOTPRINT | typeof ASSET_KIND_FURNITURE

export interface CompanionStarterAssetDefinition {
  key: string
  name: string
  kind: AssetKind
  payload: Record<string, unknown>
}

type StarterItem = Omit<CompanionStarterAssetDefinition, 'kind'>


/**
 * 返回角色的静态 starter 资产定义，供生产资产目录读取。
 *
 * 背景：衣柜 / 书架既会被播种到运行时数据库，也需要在 Debug 中追踪其生产来源。
 * 设计意图：复用同一份 starter 工厂，不从数据库反推目录，避免用户运行态改动污染生产资产。
 * 关键约束：只返回定义副本；调用方不得借此写入 companion_assets。
 */
export function getStarterAssetDefinitions(roleId: string): CompanionStarterAssetDefinition[] {
  const definitions: CompanionStarterAssetDefinition[] = [
    ...startersFor(ASSET_KIND_WARDROBE, roleId).map<CompanionStarterAssetDefinition>((item) => ({ ...item, kind: ASSET_KIND_WARDROBE })),
    ...startersFor(ASSET_KIND_BOOKSHELF, roleId).map<CompanionStarterAssetDefinition>((item) => ({ ...item, kind: ASSET_KIND_BOOKSHELF })),
    ...startersFor(ASSET_KIND_CULTURE, roleId).map<CompanionStarterAssetDefinition>((item) => ({ ...item, kind: ASSET_KIND_CULTURE })),
    ...startersFor(ASSET_KIND_HOME, roleId).map<CompanionStarterAssetDefinition>((item) => ({ ...item, kind: ASSET_KIND_HOME })),
    ...startersFor(ASSET_KIND_FOOTPRINT, roleId).map<CompanionStarterAssetDefinition>((item) => ({ ...item, kind: ASSET_KIND_FOOTPRINT })),
  ]
  return definitions.map((item) => ({ ...item, payload: structuredClone(item.payload) }))
}

function startersFor(kind: AssetKind, roleId: string): StarterItem[] {
  if (kind === ASSET_KIND_HOME) return worldHomeStarters(roleId)
  if (kind === ASSET_KIND_FOOTPRINT) return worldFootprintStarters(roleId)
  // 无已确认 Role Pack 来源时保持空态；衣物、作品与阅读经历不能由服务默认值编造。
  return []
}

/**
 * 某 kind 空柜时播种 starter（幂等稳定 id：`{kind}:{roleId}:{key}`）。
 */
export async function ensureStarterForKind(
  roleId: string,
  kind: AssetKind,
): Promise<{ created: number }> {
  if (kind === ASSET_KIND_HOME || kind === ASSET_KIND_FOOTPRINT) return ensureWorldDetailStarter(roleId, kind)
  await ensureTables()
  const existing = await listAssets(roleId, { kind })
  if (existing.length > 0) return { created: 0 }

  const starter = startersFor(kind, roleId)
  let created = 0
  const base = Date.now()
  for (let i = 0; i < starter.length; i++) {
    const item = starter[i]
    const id = `${kind}:${roleId}:${item.key}`
    const db = await getDatabase()
    const check = db.prepare('SELECT 1 AS x FROM companion_assets WHERE id = ?')
    check.bind([id])
    const exists = check.step()
    check.free()
    if (exists) continue
    await addAsset({
      id,
      roleId,
      kind,
      name: item.name,
      payload: item.payload,
      acquiredAt: base + i,
      sourceEventId: null,
    })
    created += 1
  }
  return { created }
}

export async function ensureStarterWardrobe(roleId: string): Promise<{ created: number }> {
  return ensureStarterForKind(roleId, ASSET_KIND_WARDROBE)
}

export async function ensureStarterBookshelf(roleId: string): Promise<{ created: number }> {
  return ensureStarterForKind(roleId, ASSET_KIND_BOOKSHELF)
}

function worldHomeStarters(roleId: string): StarterItem[] {
  const world = loadRoleWorldDefaults(roleId)
  if (!world || !world.home.shortName.trim() || world.home.shortName === '未设定') return []
  return [{ key: 'residence', name: world.home.shortName, payload: { ...world.home, seededFrom: 'world.default' } }]
}

function worldFootprintStarters(roleId: string): StarterItem[] {
  const world = loadRoleWorldDefaults(roleId)
  if (!world) return []
  return world.favoritePlaces.map((place) => ({
    key: place.id,
    name: place.name,
    payload: { placeKind: place.kind, description: place.description, travelMinutes: place.travelMinutes, city: world.city.name, seededFrom: 'world.default' },
  }))
}

export async function ensureStarterCulture(roleId: string): Promise<{ created: number }> {
  return ensureStarterForKind(roleId, ASSET_KIND_CULTURE)
}

/**
 * 背景：住所和常去地点可被用户编辑或删空，空列表不能被当成首次启动；多面板也可能并发读取。
 * 设计意图：同库保留按角色、种类隔离的播种标记，资产和标记在同步事务内一次写入，不复用空柜补种。
 * 关键约束：事务内不得 await 或落盘；失败回滚，未设定的世界不写标记，已有运行态资产优先。
 */
async function ensureWorldDetailStarter(roleId: string, kind: typeof ASSET_KIND_HOME | typeof ASSET_KIND_FOOTPRINT): Promise<{ created: number }> {
  const starter = startersFor(kind, roleId)
  if (!starter.length) return { created: 0 }
  await ensureTables()
  const db = await getDatabase()
  db.run(`CREATE TABLE IF NOT EXISTS companion_asset_seeds (
    role_id TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY (role_id, kind)
  )`)
  let created = 0
  db.run('BEGIN TRANSACTION')
  try {
    const seeded = db.exec('SELECT 1 FROM companion_asset_seeds WHERE role_id = ? AND kind = ?', [roleId, kind])
    if (!seeded.length) {
      const existing = db.exec('SELECT 1 FROM companion_assets WHERE role_id = ? AND kind = ? LIMIT 1', [roleId, kind])
      if (!existing.length) {
        const now = Date.now()
        for (const [index, item] of starter.entries()) {
          db.run(`INSERT INTO companion_assets (id, role_id, kind, name, payload_json, acquired_at, source_event_id)
            VALUES (?, ?, ?, ?, ?, ?, NULL)`, [`${kind}:${roleId}:${item.key}`, roleId, kind, item.name, JSON.stringify(item.payload), now + index])
          created++
        }
      }
      db.run('INSERT INTO companion_asset_seeds (role_id, kind) VALUES (?, ?)', [roleId, kind])
    }
    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
  persist()
  return { created }
}

export async function ensureStarterHome(roleId: string): Promise<{ created: number }> {
  return ensureWorldDetailStarter(roleId, ASSET_KIND_HOME)
}

export async function ensureStarterFootprints(roleId: string): Promise<{ created: number }> {
  return ensureWorldDetailStarter(roleId, ASSET_KIND_FOOTPRINT)
}

/**
 * 背景：默认物件、住所和地点共用 world.default 来源，但不是同一批种子。
 * 设计意图：只按物件稳定 ID 识别已经初始化的物件，避免住所先播种时挡住整个物件组。
 * 关键约束：不覆盖已有物件，维持原有整组初始化语义；不把其他资产当作物件标记。
 */
export async function ensureWorldDefaultPossessions(roleId: string): Promise<{ created: number }> {
  const defaults = loadRoleWorldDefaults(roleId)
  if (!defaults?.possessions.length) return { created: 0 }
  await ensureTables()
  const existing = await listAssets(roleId)
  if (existing.some((asset) => asset.id.startsWith(`world:${roleId}:`) && asset.payload.seededFrom === 'world.default')) {
    return { created: 0 }
  }
  const db = await getDatabase()
  let created = 0
  const base = Date.now()
  for (let index = 0; index < defaults.possessions.length; index++) {
    const item = defaults.possessions[index]
    const id = `world:${roleId}:${item.id}`
    const stmt = db.prepare('SELECT 1 AS x FROM companion_assets WHERE id = ?')
    stmt.bind([id])
    const exists = stmt.step()
    stmt.free()
    if (exists) continue
    await addAsset({
      id,
      roleId,
      kind: item.kind,
      name: item.name,
      payload: {
        description: item.description,
        condition: item.condition,
        seededFrom: 'world.default',
      },
      acquiredAt: base + index,
      sourceEventId: null,
    })
    created += 1
  }
  return { created }
}

/** 活跃主角打开生活面时初始化已有种子；住所与地点没有设定时不生成记录。 */
export async function ensureStarterAssets(roleId: string): Promise<{ created: number }> {
  const w = await ensureStarterWardrobe(roleId)
  const b = await ensureStarterBookshelf(roleId)
  const c = await ensureStarterCulture(roleId)
  const h = await ensureStarterHome(roleId)
  const f = await ensureStarterFootprints(roleId)
  const p = await ensureWorldDefaultPossessions(roleId)
  return { created: w.created + b.created + c.created + h.created + f.created + p.created }
}

/** 为事件挑选一件衣柜（确定性：按 scheduledAt 取模） */
export async function pickWardrobeAssetId(
  roleId: string,
  seed: number,
): Promise<string | null> {
  await ensureStarterWardrobe(roleId)
  const items = await listAssets(roleId, { kind: ASSET_KIND_WARDROBE })
  if (!items.length) return null
  return items[Math.abs(seed) % items.length].id
}

/** 为事件挑选一本书架书（确定性：按 scheduledAt 取模） */
export async function pickBookshelfAssetId(
  roleId: string,
  seed: number,
): Promise<string | null> {
  await ensureStarterBookshelf(roleId)
  const items = await listAssets(roleId, { kind: ASSET_KIND_BOOKSHELF })
  if (!items.length) return null
  return items[Math.abs(seed) % items.length].id
}

/**
 * 是否给该 moment 槽挂书架引用（稀薄：读/书相关，或家中且 seed%4===0）。
 */
export function shouldAttachBookshelfRef(input: {
  activity?: string
  location?: string
  seed: number
}): boolean {
  const act = (input.activity || '').toLowerCase()
  const loc = input.location || ''
  if (/读|书|笔记|翻页|夜读|睡前/.test(act)) return true
  if ((loc.includes('家') || loc.includes('公寓')) && Math.abs(input.seed) % 4 === 0) {
    return true
  }
  return false
}

export const BOOKSHELF_PROMPT_LIMIT = 3

/**
 * 背景：文化角允许保存完整笔记，书架上下文仍是有限的生活摘要而非文档注入。
 * 设计意图：将原短笔记的 24 字预算放在 Prompt 展示边界，正文留在资产中供界面完整读取。
 * 关键约束：最多 N 本；不改写源资产，不因存储上限放宽而自动扩张模型输入。
 */
export function formatBookshelfSliceForPrompt(
  items: CompanionAsset[],
  limit = BOOKSHELF_PROMPT_LIMIT,
): string {
  const lines: string[] = []
  for (const a of items.slice(0, limit)) {
    const name = a.name.trim()
    if (!name) continue
    const author = typeof a.payload.author === 'string' ? a.payload.author.trim() : ''
    const note = typeof a.payload.note === 'string' ? a.payload.note.trim().slice(0, 24) : ''
    const extra = [author, note].filter(Boolean).join(' · ')
    lines.push(extra ? `- 《${name}》${extra}` : `- 《${name}》`)
  }
  if (lines.length === 0) return ''
  return [
    '书架上现有（已入库，勿宣称未列出的书）：',
    ...lines,
    '提及阅读时优先引用上列；没有就不硬编书名。',
  ].join('\n')
}

export async function collectBookshelfSlice(
  roleId: string,
  opts?: { limit?: number },
): Promise<{ slice: string; items: CompanionAsset[] }> {
  await ensureStarterBookshelf(roleId)
  const items = await listAssets(roleId, { kind: ASSET_KIND_BOOKSHELF })
  const limit = opts?.limit ?? BOOKSHELF_PROMPT_LIMIT
  return {
    slice: formatBookshelfSliceForPrompt(items, limit),
    items: items.slice(0, limit),
  }
}

/**
 * 背景：衣柜短标签与文化 / 家居 / 足迹正文共用更新入口，统一截为 24 字会造成静默数据丢失。
 * 设计意图：名称与 payload 走同一套规范化 helper，超限或类型错误拒绝整次更新，短标签保持兼容。
 * 关键约束：先检查角色归属，再校验全部字段，最后一次参数化 SQL 更新；不得部分保存或记录正文日志。
 */
export async function updateAsset(
  assetId: string,
  patch: { name?: string; payload?: Record<string, unknown> },
  opts?: { expectedRoleId?: string },
): Promise<AssetMutationResult> {
  await ensureTables()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT * FROM companion_assets WHERE id = ?')
  let existing: CompanionAsset | null = null
  try { stmt.bind([assetId]); if (stmt.step()) existing = rowToAsset(stmt.getAsObject()) } finally { stmt.free() }
  if (!existing) {
    return { ok: false, code: 'NOT_FOUND', error: '资产不存在' }
  }
  if (opts?.expectedRoleId && existing.roleId !== opts.expectedRoleId) {
    return { ok: false, code: 'ROLE_MISMATCH', error: '只能改当前活跃主角的资产' }
  }

  if (existing.kind === ASSET_KIND_WARDROBE && (existing.payload.recordType === 'wear-state' || patch.payload?.recordType === 'wear-state')) return { ok: false, code: 'INVALID', error: '当前穿搭请通过换上操作更新。' }
  if (existing.kind === ASSET_KIND_WARDROBE && existing.payload.recordType === 'outfit' && patch.payload && ['image', 'imageOutfitVersion', 'outfitVersion'].some(key => Object.hasOwn(patch.payload!, key))) return { ok: false, code: 'INVALID', error: '穿搭图片与版本请通过生成图片操作更新。' }

  const name = patch.name !== undefined ? normalizeAssetName(patch.name) : { ok: true as const, value: existing.name }
  if (!name.ok) return { ok: false, code: 'INVALID', error: name.error }

  const payloadResult = applyAssetPayloadPatch(existing.kind, existing.payload, patch.payload)
  if (!payloadResult.ok) return { ok: false, code: 'INVALID', error: payloadResult.error }
  const payload = payloadResult.payload

  const referenceError = homeReferenceError(db, existing.roleId, existing.kind, payload, existing.payload)
  if (referenceError) return { ok: false, code: 'INVALID', error: referenceError }
  if (existing.kind === ASSET_KIND_WARDROBE && ['outfit', 'wear-state'].includes(String(payload.recordType))) {
    const changedSlots = JSON.stringify(Object.entries(payload.slots as Record<string, unknown>).sort()) !== JSON.stringify(Object.entries(existing.payload.slots as Record<string, unknown> ?? {}).sort())
    if (changedSlots || existing.payload.recordType !== payload.recordType) {
      const wardrobeError = wardrobeReferenceError(db, existing.roleId, existing.kind, payload)
      if (wardrobeError) return { ok: false, code: 'INVALID', error: wardrobeError }
      payload.outfitVersion = Number.isSafeInteger(existing.payload.outfitVersion) ? Number(existing.payload.outfitVersion) + 1 : 1
      delete payload.image
      delete payload.imageOutfitVersion
    }
  }
  db.run(
    `UPDATE companion_assets SET name = ?, payload_json = ? WHERE id = ?`,
    [name.value, JSON.stringify(payload), assetId],
  )
  persist()
  const asset: CompanionAsset = { ...existing, name: name.value, payload }
  log.info('Asset updated', { assetId, roleId: existing.roleId, name: name.value })
  return { ok: true, asset }
}

/**
 * 删除资产。expectedRoleId 用于防改他人资产。
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
    return { ok: false, code: 'ROLE_MISMATCH', error: '只能删当前活跃主角的资产' }
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
  if (existing) return existing.roleId === input.roleId ? existing : null

  try {
    return await addAsset({
      id,
      roleId: input.roleId,
      kind: grant.kind,
      name: grant.name,
      payload: grant.payload,
      sourceEventId: input.eventId,
    })
  } catch (error) {
    if (!(error instanceof InvalidInternalAssetError)) throw error
    log.warn('Invalid event asset skipped', { roleId: input.roleId, eventId: input.eventId, kind: grant.kind })
    return null
  }
}

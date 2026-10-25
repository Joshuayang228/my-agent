import type { Database, SqlValue } from 'sql.js'
import { z } from 'zod'
import { getInitializedDatabase } from '../storage/database'
import { listAvailableRoleIds, loadRolePack, loadRelations, isKnownProtagonist } from '../companion/identity/loader'
import { parseWorldJson } from '../companion/life/world-codec'
import { DEBUG_EVIDENCE_VIEWS, type DebugEvidenceQuery, type DebugEvidenceRecord, type DebugEvidenceResult, type DebugEvidenceScope } from '../../../src/shared/debug-evidence'
import { detectSensitiveKinds } from '../../../src/shared/sensitive-memory'

const querySchema = z.object({ view: z.enum(DEBUG_EVIDENCE_VIEWS), roleId: z.string().min(1).max(80), date: z.iso.date().optional(), limit: z.number().int().min(1).max(100).default(50), cursor: z.string().max(1024).optional(), recordId: z.string().min(1).max(200).optional() }).strict().refine(query => !(query.recordId && query.cursor))
type Row = Record<string, unknown>
type Source = { table: string; time: string; id: string; where?: string; values?: SqlValue[] }
const SOURCES: Partial<Record<DebugEvidenceQuery['view'], Source>> = {
  recent: { table: 'companion_events', time: 'scheduled_at', id: 'id' },
  activity: { table: 'companion_events', time: 'scheduled_at', id: 'id' },
  moments: { table: 'companion_moments', time: 'published_at', id: 'id' },
  residence: { table: 'companion_assets', time: 'acquired_at', id: 'id', where: "kind IN ('home','furniture')" },
  wardrobe: { table: 'companion_assets', time: 'acquired_at', id: 'id', where: "kind = 'wardrobe'" },
  items: { table: 'companion_assets', time: 'acquired_at', id: 'id', where: "kind IN ('culture','bookshelf')" },
  footprints: { table: 'companion_assets', time: 'acquired_at', id: 'id', where: "kind = 'footprint'" },
  links: { table: 'companion_event_links', time: 'created_at', id: 'id' },
  memories: { table: 'memories', time: 'updatedAt', id: 'id', where: "(role_id = ? OR role_id = '')" },
  profile: { table: 'memories', time: 'updatedAt', id: 'id', where: "(category != 'feedback' OR role_id = ?)" },
  growth: { table: 'companion_mutable_versions', time: 'created_at', id: 'id' },
}

function rows(db: Database, sql: string, values: SqlValue[] = []): Row[] {
  const stmt = db.prepare(sql)
  try { stmt.bind(values); const out: Row[] = []; while (stmt.step()) out.push(stmt.getAsObject()); return out } finally { stmt.free() }
}
function hasTable(db: Database, name: string): boolean { return rows(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [name]).length > 0 }
function setting(db: Database | null, name: string, fallback: string): string {
  if (!db || !hasTable(db, 'settings')) return fallback
  const value = rows(db, 'SELECT value FROM settings WHERE key = ?', [name])[0]?.value
  if (typeof value !== 'string') return fallback
  try { const decoded: unknown = JSON.parse(value); return typeof decoded === 'string' ? decoded : fallback } catch { return value }
}
export function getDebugEvidenceScope(): DebugEvidenceScope {
  const db = getInitializedDatabase()
  const universeId = setting(db, 'universeId', 'default')
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(universeId)) throw new Error('宇宙登记标识无效')
  const roles = listAvailableRoleIds(universeId).map(id => { try { return { id, name: loadRolePack(id, universeId).name } } catch { return { id, name: `${id}（资料读取失败）` } } })
  const configured = setting(db, 'activeRoleId', '')
  return { roles, universeId, activeRoleId: roles.some(role => role.id === configured) && isKnownProtagonist(configured, universeId) ? configured : null, ready: Boolean(db) }
}

/** 背景：诊断正文可能含用户粘贴的凭据、超长数组或坏 JSON。
 * 意图：逐记录隔离解析与有限深度投影，凭据不进入 Renderer；不依赖页面再隐藏。
 * 约束：先检测完整字符串再截断；所有文本、对象深度和数组长度有界，局部失败不丢其他记录。
 */
function safeValue(value: unknown, state: { truncated: boolean }, depth = 0): unknown {
  if (typeof value === 'string') {
    if (detectSensitiveKinds(value).includes('credentials')) return '含凭据内容已隐藏'
    if (value.length > 8000) { state.truncated = true; return value.slice(0, 8000) + '…' }
    return value
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
  if (depth >= 5) { state.truncated = true; return '嵌套内容已截断' }
  if (Array.isArray(value)) { if (value.length > 100) state.truncated = true; return value.slice(0, 100).map(item => safeValue(item, state, depth + 1)) }
  if (value && typeof value === 'object') { const entries = Object.entries(value); if (entries.length > 100) state.truncated = true; return Object.fromEntries(entries.slice(0, 100).map(([key, item]) => [key, /api.?key|password|secret|token|credential/i.test(key) ? '凭据字段已隐藏' : safeValue(item, state, depth + 1)])) }
  return null
}
function json(value: unknown): unknown {
  if (typeof value !== 'string' || value.length > 128_000) throw new Error('记录格式或长度不可读取')
  return JSON.parse(value)
}
function record(row: Row, source: string, owner: string): DebugEvidenceRecord {
  const state = { truncated: false }
  const raw = { ...row }
  if ('world_json' in raw) {
    try { raw.storedWorld = json(raw.world_json) } catch { raw.storedWorld = '存储世界 JSON 不可解析，运行时使用 codec 默认规则' }
    raw.world = parseWorldJson(typeof raw.world_json === 'string' ? raw.world_json : '', owner)
    delete raw.world_json
  }
  for (const key of ['payload_json', 'meta_json', 'metadata_json', 'runs_json']) if (key in raw) { raw[key.replace('_json', '')] = json(raw[key]); delete raw[key] }
  const data = safeValue(raw, state) as Row
  const payload = data.payload && typeof data.payload === 'object' ? data.payload as Row : {}
  const text = (value: unknown) => typeof value === 'string' ? value : ''
  const id = text(row.id) || text(row.role_id)
  const result: DebugEvidenceRecord = {
    id, roleId: typeof row.role_id === 'string' ? row.role_id : owner, kind: text(row.kind) || text(row.type) || text(row.category) || source,
    title: text(data.name) || text(payload.title) || text(payload.activity) || text(row.category) || id,
    time: [row.scheduled_at, row.published_at, row.updated_at, row.updatedAt, row.created_at, row.acquired_at].find(value => typeof value === 'number') as number | undefined ?? null,
    status: text(row.status), body: text(data.text) || text(data.content) || text(data.body) || text(payload.story) || text(payload.description),
    data, source, truncated: state.truncated, links: [],
  }
  const eventId = text(row.source_event_id) || text(row.event_id)
  if (eventId) result.links.push({ view: 'recent', id: eventId, label: '来源生活事件' })
  return result
}

function calendarNumber(ms: number, timezone: string): number {
  const p = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ms)
  return Number(['year', 'month', 'day'].map(type => p.find(part => part.type === type)!.value).join(''))
}
// 背景：时序诊断按角色日历日筛选；意图：用 IANA 日历找日界，避免把宿主时区当角色时区。
// 约束：二分边界覆盖 DST 的 23/25 小时日，不以固定 24 小时相加确定日末。
function dateRange(date: string, timezone: string): [number, number] {
  const day = Date.parse(date + 'T12:00:00Z')
  const target = Number(date.replaceAll('-', ''))
  const boundary = (after: boolean) => {
    let left = day - 48 * 3600000; let right = day + 48 * 3600000
    while (left < right) { const middle = Math.floor((left + right) / 2); const current = calendarNumber(middle, timezone); if (after ? current <= target : current < target) left = middle + 1; else right = middle }
    return left
  }
  return [boundary(false), boundary(true)]
}

/** 背景：生活 getter 会建表/播种，直接复用会让 Debug 浏览改变生产状态。
 * 意图：白名单源上的纯 SELECT 投影，允许测试注入已打开实例；缺表和坏记录分别报告。
 * 约束：不初始化数据库、不修复 activeRoleId；所有参数绑定，分页游标绑定角色/视图/日期。
 */
export function queryCompanionEvidence(input: unknown, db: Database | null = getInitializedDatabase(), scope: DebugEvidenceScope = getDebugEvidenceScope()): DebugEvidenceResult {
  const query = querySchema.parse(input)
  if (!scope.roles.some(role => role.id === query.roleId)) throw new Error('请选择已登记的人物')
  let cursor: { time: number; id: string } | undefined
  if (query.cursor) {
    if (!SOURCES[query.view]) throw new Error('此视图不使用历史分页')
    let decoded: unknown
    try { decoded = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')) } catch { throw new Error('分页标识无效') }
    const parsed = z.object({ view: z.literal(query.view), roleId: z.literal(query.roleId), date: z.literal(query.date ?? ''), time: z.number().finite(), id: z.string().min(1).max(200) }).strict().safeParse(decoded)
    if (!parsed.success) throw new Error('分页标识与查询范围不一致')
    cursor = parsed.data
  }
  const pack = loadRolePack(query.roleId, scope.universeId)
  const timezone = pack.worldDefaults?.timezone || 'Asia/Shanghai'
  const result: DebugEvidenceResult = { state: 'ready', roleId: query.roleId, view: query.view, date: query.date, timezone, records: [], source: '', generatedAt: Date.now(), hasMore: false, total: null, issues: [], boundary: '只读有界范围；注册定义、当前状态与历史执行分别解释，未保存的执行结果不补造。' }
  if (!db) return { ...result, state: 'unavailable', issues: ['数据库尚未由应用启动流程打开'] }
  if (query.view === 'proactive' || query.view === 'context') return { ...result, state: 'unsupported', boundary: query.view === 'proactive' ? '当前没有独立主动消息投递证据索引；普通消息不作为主动发送证明。' : '请通过实际 LLM 调用查看该次保存的上下文；当前人物资料不是历史实发输入。' }
  const append = (raw: Row[], source: string) => { for (const row of raw) { try {
    if (source === 'memories' && typeof row.content === 'string' && detectSensitiveKinds(row.content).includes('credentials')) { result.issues.push('含凭据的记忆未展示'); continue }
    result.records.push(record(row, source, query.roleId))
  } catch { result.issues.push(`记录 ${String(row.id ?? row.role_id ?? '未知').slice(0, 80)} 格式损坏或超限`) } } }
  if (['character', 'relations'].includes(query.view)) {
    result.source = 'Role Pack / Universe relations'
    if (query.view === 'character') append([{ id: pack.id, role_id: pack.id, name: pack.name, text: pack.summary, profile: pack.profile ?? null, worldDefaults: pack.worldDefaults ?? null }], result.source)
    else {
      const edges = loadRelations(scope.universeId).edges.filter(edge => edge.from === query.roleId || edge.to === query.roleId)
      const people = new Map<string, Row>()
      for (const edge of edges) {
        const personId = edge.from === query.roleId ? edge.to : edge.from
        if (!people.has(personId)) people.set(personId, { id: personId, role_id: query.roleId, name: scope.roles.find(role => role.id === personId)?.name ?? personId, text: edge.note ?? '', type: edge.type, relations: [] })
        ;(people.get(personId)!.relations as unknown[]).push(edge)
      }
      const selected = [...people.values()].filter(person => !query.recordId || person.id === query.recordId).slice(0, query.limit)
      if (hasTable(db, 'companion_events') && hasTable(db, 'companion_event_links')) {
        const experiences = rows(db, "SELECT e.*, l.target_id AS person_id FROM companion_events e JOIN companion_event_links l ON e.id = l.event_id AND e.role_id = l.role_id WHERE e.role_id = ? AND e.status = 'published' AND ((l.target_type = 'cast' AND l.relation = 'coframe') OR (l.target_type = 'person' AND l.relation = 'participant')) ORDER BY e.scheduled_at DESC, e.id DESC LIMIT ?", [query.roleId, query.limit])
        for (const person of selected) person.experiences = experiences.filter(event => event.person_id === person.id).flatMap(event => { try { return [safeValue({ id: event.id, time: event.scheduled_at, payload: json(event.payload_json) }, { truncated: false })] } catch { result.issues.push('一条共同经历格式损坏'); return [] } })
        result.boundary += ' 共同经历仅含显式共同在场关联与当前有界范围，不包含召唤聊天。忙闲未单独记录。'
      }
      append(selected, result.source)
    }
    return result
  }
  if (query.view === 'schedule') {
    result.source = 'companion_day_scripts'
    if (!hasTable(db, result.source)) return result
    if (!query.date && !query.recordId) throw new Error('日程查询需要有效日期')
    append(rows(db, `SELECT * FROM companion_day_scripts WHERE role_id = ? AND ${query.recordId ? 'id' : 'date'} = ? LIMIT 1`, [query.roleId, query.recordId ?? query.date!]), result.source)
    return result
  }
  if (query.view === 'now' || query.view === 'location') {
    result.source = 'companion_role_state'
    // 背景：当前快照的稳定标识就是 role_id，显式缺失引用曾被忽略并返回另一条状态。
    // 意图：在读取前核对人物和记录身份；约束：不跨人物补取，未指定 ID 的当前快照查询保持原行为。
    if (query.recordId && query.recordId !== query.roleId) return result
    if (hasTable(db, result.source)) append(rows(db, 'SELECT * FROM companion_role_state WHERE role_id = ? LIMIT 1', [query.roleId]), result.source)
    return result
  }
  const source = SOURCES[query.view]!
  result.source = source.table
  if (query.view === 'growth' && !query.cursor && !query.recordId) {
    const current = hasTable(db, 'companion_mutable') ? rows(db, 'SELECT role_id AS id, * FROM companion_mutable WHERE role_id = ? LIMIT 1', [query.roleId]) : []
    if (current.length) append(current, 'companion_mutable')
    else append([{ id: `${query.roleId}:pack-default`, role_id: query.roleId, name: '成长默认定义', body: pack.mutableDefault }], 'Role Pack mutable.default')
    if (hasTable(db, 'companion_reflection_state')) append(rows(db, 'SELECT role_id AS id, * FROM companion_reflection_state WHERE role_id = ? LIMIT 1', [query.roleId]), 'companion_reflection_state')
  }
  if (!hasTable(db, source.table)) return result
  const clauses = [source.where ?? 'role_id = ?']
  const values: SqlValue[] = [query.roleId]
  if (source.where && !['memories', 'profile'].includes(query.view)) { clauses.unshift('role_id = ?') }
  if (query.recordId) { clauses.push(`${source.id} = ?`); values.push(query.recordId) }
  if (query.date) { const [start, end] = dateRange(query.date, timezone); clauses.push(`${source.time} >= ? AND ${source.time} < ?`); values.push(start, end) }
  if (cursor) {
    clauses.push(`(${source.time} < ? OR (${source.time} = ? AND ${source.id} < ?))`); values.push(cursor.time, cursor.time, cursor.id)
  }
  values.push(query.limit + 1)
  const raw = rows(db, `SELECT * FROM ${source.table} WHERE ${clauses.join(' AND ')} ORDER BY ${source.time} DESC, ${source.id} DESC LIMIT ?`, values)
  result.hasMore = raw.length > query.limit
  const page = raw.slice(0, query.limit)
  append(page, source.table)
  if (result.hasMore) { const last = page.at(-1)!; result.nextCursor = Buffer.from(JSON.stringify({ view: query.view, roleId: query.roleId, date: query.date ?? '', time: last[source.time], id: last[source.id] })).toString('base64url') }
  if (query.view === 'profile') result.boundary = '有界画像来源：身份 / 事实、协作、表达记忆沿用全局范围，反馈限定所选人物；当前页不是全量画像，也不证明实际注入。'
  if (query.view === 'moments' && hasTable(db, 'companion_moment_user_interactions')) for (const entry of result.records) {
    const comments = rows(db, 'SELECT actor_id, kind, text, created_at FROM companion_moment_user_interactions WHERE role_id = ? AND moment_id = ? ORDER BY created_at DESC, id DESC LIMIT 51', [query.roleId, entry.id])
    entry.data.userInteractions = safeValue(comments.slice(0, 50), { truncated: false })
    if (comments.length > 50) entry.truncated = true
  }
  for (const entry of result.records) {
    entry.links = entry.links.filter(link => link.view !== 'recent' || hasTable(db, 'companion_events') && rows(db, 'SELECT id FROM companion_events WHERE role_id = ? AND id = ? LIMIT 1', [query.roleId, link.id]).length > 0)
    if (entry.data.target_type !== 'asset' || typeof entry.data.target_id !== 'string' || !hasTable(db, 'companion_assets')) continue
    const target = rows(db, 'SELECT id, kind FROM companion_assets WHERE role_id = ? AND id = ? LIMIT 1', [query.roleId, entry.data.target_id])[0]
    const views: Record<string, DebugEvidenceQuery['view']> = { home: 'residence', furniture: 'residence', wardrobe: 'wardrobe', culture: 'items', bookshelf: 'items', footprint: 'footprints' }
    if (target && views[String(target.kind)]) entry.links.push({ view: views[String(target.kind)], id: String(target.id), label: '查看明确关联的资产' })
  }
  return result
}

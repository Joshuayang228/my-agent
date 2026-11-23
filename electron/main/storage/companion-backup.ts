/**
 * Companion 核心与生活状态备份（B01）
 *
 * 背景：人物世界核心引擎迁移后，可变人格、运行态、关系、情绪、日记、信物、收到礼物、脆弱心境、
 * 生活心愿、航程推进、自主穿搭及自动朋友圈配图分别保存在独立表中，旧备份仅导出会话、记忆、资产和动态。
 * 设计意图：以独立模块统一负责 Companion 扩展表的数据采集、外部导入预检、事务内幂等合并和回滚补偿，
 * 既保持旧版 v1 备份文件（无 companionSnapshot 字段）100% 向前兼容，又消除换机恢复后的人格与生活记忆断层。
 * 关键约束：所有导入均走参数化 SQL 与现有 ID 幂等跳过（不覆盖当前已有记录）；失败时必须随外层事务或 undo 整笔撤销。
 */
import type { Database } from 'sql.js'
import type { GeneratedImageReference } from '../../../src/shared/types'
import { isBackupImageReference, toBackupImageReference, type BackupImageReference, type ImageReferenceCollection } from './generated-image-backup'

const MAX_ROWS = 10_000
const MAX_TEXT = 200_000

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const isText = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const isOptionalText = (v: unknown, max = 200): v is string | null | undefined =>
  v === null || v === undefined || (typeof v === 'string' && v.length <= max)
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export interface BackupMutableRecord {
  roleId: string
  body: string
  version: number
  updatedAt: number
}

export interface BackupMutableVersionRecord {
  id: string
  roleId: string
  version: number
  body: string
  createdAt: number
  summary: string
}

export interface BackupReflectionStateRecord {
  roleId: string
  lastRunAt: number
  runsJson: string
  updatedAt: number
}

export interface BackupFirstContactRecord {
  roleId: string
  shownAt: number
}

export interface BackupRuntimeStateRecord {
  roleId: string
  universeId: string
  mood: number
  energy: number
  socialNeed: number
  hunger: number
  sleepiness: number
  home: string
  timezone: string
  currentActivity: string
  currentLocation: string
  locationDetail: string
  statusTagsJson: string
  situation: string
  pausedAt: number | null
  catchupSummary: string
  lastTickAt: number
  version: number
  updatedAt: number
  lastEventId: string | null
}

export interface BackupRelationshipStateRecord {
  roleId: string
  subjectId: string
  phase: string
  signal: number
  note: string
  updatedAt: number
}

export interface BackupRelationshipEventRecord {
  id: string
  roleId: string
  subjectId: string
  phase: string
  delta: number
  note: string
  sourceEventId: string | null
  createdAt: number
}

export interface BackupEmotionEventRecord {
  id: string
  roleId: string
  eventId: string | null
  label: string
  intensity: number
  note: string
  createdAt: number
}

export interface BackupInnerThoughtRecord {
  id: string
  roleId: string
  title: string
  content: string
  mood: string | null
  weather: string | null
  location: string | null
  activity: string | null
  isFavorite: number
  createdAt: number
  thoughtType: string
  epiphany: string | null
  sourceType: string
  sourceId: string | null
  traceId: string | null
}

export interface BackupKeepsakeRecord {
  id: string
  roleId: string
  name: string
  description: string
  lore: string
  giftMessage: string
  giftReason: string
  iconName: string
  imageUrl: string | null
  acquiredAt: number
}

export interface BackupReceivedGiftRecord {
  id: string
  roleId: string
  giftKey: string
  giftName: string
  category: string
  giverName?: string | null
  userNote: string | null
  companionReaction: string
  vitalsBuffJson: string | null
  imageUrl?: string | null
  createdAt: number
}

export interface BackupVulnerabilityRecord {
  id: string
  roleId: string
  title: string
  moodState: string
  triggerContext: string
  vulnerabilityText: string
  comfortPromptHint: string | null
  status: string
  comfortText: string | null
  companionReaction: string | null
  createdAt: number
  comfortedAt: number | null
}

export interface BackupLifeResonanceRecord {
  id: string
  roleId: string
  sessionId: string
  kind: string
  title: string
  targetName: string
  userQuote: string
  reason: string
  cultureType: string | null
  status: string
  createdAt: number
  absorbedAt: number | null
  completedAt: number | null
  feedbackText: string | null
  feedbackDeliveredAt: number | null
  assetId: string | null
}

export interface BackupTravelProgressionRecord {
  id: string
  roleId: string
  tripId: string
  stopId: string
  stopName: string
  stopDate: string
  story: string
  triggerReason: string
  createdAt: number
}

export interface BackupAutonomousDressingRecord {
  id: string
  roleId: string
  assetId: string
  outfitName: string
  triggerReason: string
  outfitVersion: number
  createdAt: number
}

export interface BackupMomentMediaRecord {
  id: string
  roleId: string
  eventId: string
  momentId: string
  image: BackupImageReference
  createdAt: number
}

export interface CompanionBackupSnapshot {
  mutables?: BackupMutableRecord[]
  mutableVersions?: BackupMutableVersionRecord[]
  reflectionStates?: BackupReflectionStateRecord[]
  firstContacts?: BackupFirstContactRecord[]
  runtimeStates?: BackupRuntimeStateRecord[]
  relationshipStates?: BackupRelationshipStateRecord[]
  relationshipEvents?: BackupRelationshipEventRecord[]
  emotionEvents?: BackupEmotionEventRecord[]
  innerThoughts?: BackupInnerThoughtRecord[]
  keepsakes?: BackupKeepsakeRecord[]
  receivedGifts?: BackupReceivedGiftRecord[]
  vulnerabilities?: BackupVulnerabilityRecord[]
  lifeResonances?: BackupLifeResonanceRecord[]
  travelProgressions?: BackupTravelProgressionRecord[]
  autonomousDressings?: BackupAutonomousDressingRecord[]
  momentMedia?: BackupMomentMediaRecord[]
}

function tableExists(db: Database, name: string): boolean {
  const stmt = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
  try {
    stmt.bind([name])
    return stmt.step()
  } finally {
    stmt.free()
  }
}

function queryRows(db: Database, sql: string, bindings: Array<string | number> = []): Record<string, unknown>[] {
  const stmt = db.prepare(sql)
  const out: Record<string, unknown>[] = []
  try {
    stmt.bind(bindings)
    while (stmt.step()) {
      if (out.length >= MAX_ROWS) break
      out.push(stmt.getAsObject())
    }
    return out
  } finally {
    stmt.free()
  }
}

function validateArray<T>(arr: unknown, itemValidator: (item: unknown) => item is T): arr is T[] {
  if (arr === undefined) return true
  if (!Array.isArray(arr) || arr.length > MAX_ROWS) return false
  return arr.every(itemValidator)
}

export function isValidCompanionBackupSnapshot(value: unknown): value is CompanionBackupSnapshot {
  if (value === undefined) return true
  if (!isObject(value)) return false

  if (!validateArray(value.mutables, (r): r is BackupMutableRecord =>
    isObject(r) && isText(r.roleId) && typeof r.body === 'string' && r.body.length <= MAX_TEXT && isNumber(r.version) && isNumber(r.updatedAt))) return false
  if (!validateArray(value.mutableVersions, (r): r is BackupMutableVersionRecord =>
    isObject(r) && isText(r.id) && isText(r.roleId) && isNumber(r.version) && typeof r.body === 'string' && r.body.length <= MAX_TEXT && isNumber(r.createdAt) && typeof r.summary === 'string' && r.summary.length <= 2000)) return false
  if (!validateArray(value.reflectionStates, (r): r is BackupReflectionStateRecord =>
    isObject(r) && isText(r.roleId) && isNumber(r.lastRunAt) && typeof r.runsJson === 'string' && r.runsJson.length <= MAX_TEXT && isNumber(r.updatedAt))) return false
  if (!validateArray(value.firstContacts, (r): r is BackupFirstContactRecord =>
    isObject(r) && isText(r.roleId) && isNumber(r.shownAt))) return false
  if (!validateArray(value.runtimeStates, (r): r is BackupRuntimeStateRecord =>
    isObject(r) && isText(r.roleId) && isText(r.universeId) && isNumber(r.mood) && isNumber(r.energy) && isNumber(r.socialNeed)
    && isNumber(r.hunger) && isNumber(r.sleepiness) && typeof r.home === 'string' && r.home.length <= 500 && typeof r.timezone === 'string' && r.timezone.length <= 100
    && typeof r.currentActivity === 'string' && r.currentActivity.length <= 1000 && typeof r.currentLocation === 'string' && r.currentLocation.length <= 1000
    && typeof r.locationDetail === 'string' && r.locationDetail.length <= 1000 && typeof r.statusTagsJson === 'string' && r.statusTagsJson.length <= 10_000
    && typeof r.situation === 'string' && r.situation.length <= 4000 && (r.pausedAt === null || isNumber(r.pausedAt))
    && typeof r.catchupSummary === 'string' && r.catchupSummary.length <= 10_000 && isNumber(r.lastTickAt) && isNumber(r.version) && isNumber(r.updatedAt)
    && isOptionalText(r.lastEventId))) return false
  if (!validateArray(value.relationshipStates, (r): r is BackupRelationshipStateRecord =>
    isObject(r) && isText(r.roleId) && isText(r.subjectId) && isText(r.phase, 80) && isNumber(r.signal) && typeof r.note === 'string' && r.note.length <= 4000 && isNumber(r.updatedAt))) return false
  if (!validateArray(value.relationshipEvents, (r): r is BackupRelationshipEventRecord =>
    isObject(r) && isText(r.id) && isText(r.roleId) && isText(r.subjectId) && isText(r.phase, 80) && isNumber(r.delta) && typeof r.note === 'string' && r.note.length <= 4000 && isOptionalText(r.sourceEventId) && isNumber(r.createdAt))) return false
  if (!validateArray(value.emotionEvents, (r): r is BackupEmotionEventRecord =>
    isObject(r) && isText(r.id) && isText(r.roleId) && isOptionalText(r.eventId) && isText(r.label, 120) && isNumber(r.intensity) && typeof r.note === 'string' && r.note.length <= 4000 && isNumber(r.createdAt))) return false
  if (!validateArray(value.innerThoughts, (r): r is BackupInnerThoughtRecord =>
    isObject(r) && isText(r.id) && isText(r.roleId) && isText(r.title, 500) && isText(r.content, MAX_TEXT)
    && isOptionalText(r.mood, 200) && isOptionalText(r.weather, 200) && isOptionalText(r.location, 500) && isOptionalText(r.activity, 500)
    && isNumber(r.isFavorite) && isNumber(r.createdAt) && isText(r.thoughtType, 80) && isOptionalText(r.epiphany, 4000)
    && isText(r.sourceType, 120) && isOptionalText(r.sourceId) && isOptionalText(r.traceId))) return false
  if (!validateArray(value.keepsakes, (r): r is BackupKeepsakeRecord =>
    isObject(r) && isText(r.id) && isText(r.roleId) && isText(r.name, 200) && isText(r.description, 4000) && isText(r.lore, 10_000)
    && isText(r.giftMessage, 10_000) && isText(r.giftReason, 2000) && isText(r.iconName, 120) && isOptionalText(r.imageUrl, 2000) && isNumber(r.acquiredAt))) return false
  if (!validateArray(value.receivedGifts, (r): r is BackupReceivedGiftRecord =>
    isObject(r) && isText(r.id) && isText(r.roleId) && isText(r.giftKey, 120) && isText(r.giftName, 200) && isText(r.category, 80)
    && isOptionalText(r.userNote, 2000) && isText(r.companionReaction, 10_000) && isOptionalText(r.vitalsBuffJson, 2000) && isNumber(r.createdAt))) return false
  if (!validateArray(value.vulnerabilities, (r): r is BackupVulnerabilityRecord =>
    isObject(r) && isText(r.id) && isText(r.roleId) && isText(r.title, 500) && isText(r.moodState, 80) && isText(r.triggerContext, 1000)
    && isText(r.vulnerabilityText, MAX_TEXT) && isOptionalText(r.comfortPromptHint, 2000) && isText(r.status, 40)
    && isOptionalText(r.comfortText, 4000) && isOptionalText(r.companionReaction, 10_000) && isNumber(r.createdAt) && (r.comfortedAt === null || isNumber(r.comfortedAt)))) return false
  if (!validateArray(value.lifeResonances, (r): r is BackupLifeResonanceRecord =>
    isObject(r) && isText(r.id) && isText(r.roleId) && isText(r.sessionId) && isText(r.kind, 80) && isText(r.title, 500) && isText(r.targetName, 500)
    && typeof r.userQuote === 'string' && r.userQuote.length <= 4000 && typeof r.reason === 'string' && r.reason.length <= 4000
    && isOptionalText(r.cultureType, 80) && isText(r.status, 80) && isNumber(r.createdAt) && (r.absorbedAt === null || isNumber(r.absorbedAt))
    && (r.completedAt === null || isNumber(r.completedAt)) && isOptionalText(r.feedbackText, 10_000)
    && (r.feedbackDeliveredAt === null || isNumber(r.feedbackDeliveredAt)) && isOptionalText(r.assetId))) return false
  if (!validateArray(value.travelProgressions, (r): r is BackupTravelProgressionRecord =>
    isObject(r) && isText(r.id) && isText(r.roleId) && isText(r.tripId) && isText(r.stopId) && isText(r.stopName, 200)
    && isText(r.stopDate, 80) && isText(r.story, MAX_TEXT) && isText(r.triggerReason, 120) && isNumber(r.createdAt))) return false
  if (!validateArray(value.autonomousDressings, (r): r is BackupAutonomousDressingRecord =>
    isObject(r) && isText(r.id) && isText(r.roleId) && isText(r.assetId) && isText(r.outfitName, 200) && isText(r.triggerReason, 120) && isNumber(r.outfitVersion) && isNumber(r.createdAt))) return false
  if (!validateArray(value.momentMedia, (r): r is BackupMomentMediaRecord =>
    isObject(r) && isText(r.id) && isText(r.roleId) && isText(r.eventId) && isText(r.momentId) && isBackupImageReference(r.image) && r.image.id === r.id && isNumber(r.createdAt))) return false

  return true
}

export function collectCompanionBackupSnapshot(db: Database): {
  snapshot: CompanionBackupSnapshot
  momentMediaSources: ImageReferenceCollection[]
} {
  const mutables: BackupMutableRecord[] = tableExists(db, 'companion_mutable')
    ? queryRows(db, 'SELECT role_id, body, version, updated_at FROM companion_mutable ORDER BY role_id ASC').map(r => ({
        roleId: String(r.role_id),
        body: String(r.body),
        version: Number(r.version) || 1,
        updatedAt: Number(r.updated_at) || 0,
      }))
    : []

  const mutableVersions: BackupMutableVersionRecord[] = tableExists(db, 'companion_mutable_versions')
    ? queryRows(db, 'SELECT id, role_id, version, body, created_at, summary FROM companion_mutable_versions ORDER BY role_id ASC, version ASC').map(r => ({
        id: String(r.id),
        roleId: String(r.role_id),
        version: Number(r.version) || 1,
        body: String(r.body),
        createdAt: Number(r.created_at) || 0,
        summary: String(r.summary ?? ''),
      }))
    : []

  const reflectionStates: BackupReflectionStateRecord[] = tableExists(db, 'companion_reflection_state')
    ? queryRows(db, 'SELECT role_id, last_run_at, runs_json, updated_at FROM companion_reflection_state ORDER BY role_id ASC').map(r => ({
        roleId: String(r.role_id),
        lastRunAt: Number(r.last_run_at) || 0,
        runsJson: String(r.runs_json ?? '[]'),
        updatedAt: Number(r.updated_at) || 0,
      }))
    : []

  const firstContacts: BackupFirstContactRecord[] = tableExists(db, 'companion_first_contact')
    ? queryRows(db, 'SELECT role_id, shown_at FROM companion_first_contact ORDER BY role_id ASC').map(r => ({
        roleId: String(r.role_id),
        shownAt: Number(r.shown_at) || 0,
      }))
    : []

  const runtimeStates: BackupRuntimeStateRecord[] = tableExists(db, 'companion_runtime_state')
    ? queryRows(db, 'SELECT * FROM companion_runtime_state ORDER BY role_id ASC').map(r => ({
        roleId: String(r.role_id),
        universeId: String(r.universe_id ?? 'default'),
        mood: Number(r.mood) || 0,
        energy: Number(r.energy) || 0,
        socialNeed: Number(r.social_need) || 0,
        hunger: Number(r.hunger) || 0,
        sleepiness: Number(r.sleepiness) || 0,
        home: String(r.home ?? ''),
        timezone: String(r.timezone ?? 'Asia/Shanghai'),
        currentActivity: String(r.current_activity ?? ''),
        currentLocation: String(r.current_location ?? ''),
        locationDetail: String(r.location_detail ?? ''),
        statusTagsJson: String(r.status_tags_json ?? '[]'),
        situation: String(r.situation ?? ''),
        pausedAt: r.paused_at == null ? null : Number(r.paused_at),
        catchupSummary: String(r.catchup_summary ?? ''),
        lastTickAt: Number(r.last_tick_at) || 0,
        version: Number(r.version) || 0,
        updatedAt: Number(r.updated_at) || 0,
        lastEventId: r.last_event_id == null ? null : String(r.last_event_id),
      }))
    : []

  const relationshipStates: BackupRelationshipStateRecord[] = tableExists(db, 'companion_relationship_state')
    ? queryRows(db, 'SELECT role_id, subject_id, phase, signal, note, updated_at FROM companion_relationship_state ORDER BY role_id ASC, subject_id ASC').map(r => ({
        roleId: String(r.role_id),
        subjectId: String(r.subject_id),
        phase: String(r.phase),
        signal: Number(r.signal) || 0,
        note: String(r.note ?? ''),
        updatedAt: Number(r.updated_at) || 0,
      }))
    : []

  const relationshipEvents: BackupRelationshipEventRecord[] = tableExists(db, 'companion_relationship_events')
    ? queryRows(db, 'SELECT id, role_id, subject_id, phase, delta, note, source_event_id, created_at FROM companion_relationship_events ORDER BY created_at ASC, id ASC').map(r => ({
        id: String(r.id),
        roleId: String(r.role_id),
        subjectId: String(r.subject_id),
        phase: String(r.phase),
        delta: Number(r.delta) || 0,
        note: String(r.note ?? ''),
        sourceEventId: r.source_event_id == null ? null : String(r.source_event_id),
        createdAt: Number(r.created_at) || 0,
      }))
    : []

  const emotionEvents: BackupEmotionEventRecord[] = tableExists(db, 'companion_emotion_events')
    ? queryRows(db, 'SELECT id, role_id, event_id, label, intensity, note, created_at FROM companion_emotion_events ORDER BY created_at ASC, id ASC').map(r => ({
        id: String(r.id),
        roleId: String(r.role_id),
        eventId: r.event_id == null ? null : String(r.event_id),
        label: String(r.label),
        intensity: Number(r.intensity) || 0,
        note: String(r.note ?? ''),
        createdAt: Number(r.created_at) || 0,
      }))
    : []

  const innerThoughts: BackupInnerThoughtRecord[] = tableExists(db, 'companion_inner_thoughts')
    ? queryRows(db, 'SELECT * FROM companion_inner_thoughts ORDER BY created_at ASC, id ASC').map(r => ({
        id: String(r.id),
        roleId: String(r.role_id),
        title: String(r.title),
        content: String(r.content),
        mood: r.mood == null ? null : String(r.mood),
        weather: r.weather == null ? null : String(r.weather),
        location: r.location == null ? null : String(r.location),
        activity: r.activity == null ? null : String(r.activity),
        isFavorite: Number(r.is_favorite) ? 1 : 0,
        createdAt: Number(r.created_at) || 0,
        thoughtType: String(r.thought_type ?? 'general'),
        epiphany: r.epiphany == null ? null : String(r.epiphany),
        sourceType: String(r.source_type ?? 'legacy-inner-thought'),
        sourceId: r.source_id == null ? null : String(r.source_id),
        traceId: r.trace_id == null ? null : String(r.trace_id),
      }))
    : []

  const keepsakes: BackupKeepsakeRecord[] = tableExists(db, 'companion_keepsakes')
    ? queryRows(db, 'SELECT * FROM companion_keepsakes ORDER BY acquired_at ASC, id ASC').map(r => ({
        id: String(r.id),
        roleId: String(r.role_id),
        name: String(r.name),
        description: String(r.description),
        lore: String(r.lore),
        giftMessage: String(r.gift_message),
        giftReason: String(r.gift_reason),
        iconName: String(r.icon_name),
        imageUrl: r.image_url == null ? null : String(r.image_url),
        acquiredAt: Number(r.acquired_at) || 0,
      }))
    : []

  const receivedGifts: BackupReceivedGiftRecord[] = tableExists(db, 'companion_received_gifts')
    ? queryRows(db, 'SELECT * FROM companion_received_gifts ORDER BY created_at ASC, id ASC').map(r => ({
        id: String(r.id),
        roleId: String(r.role_id),
        giftKey: String(r.gift_key),
        giftName: String(r.gift_name),
        category: String(r.category),
        giverName: r.giver_name == null ? null : String(r.giver_name),
        userNote: r.user_note == null ? null : String(r.user_note),
        companionReaction: String(r.companion_reaction),
        vitalsBuffJson: r.vitals_buff_json == null ? null : String(r.vitals_buff_json),
        imageUrl: r.image_url == null ? null : String(r.image_url),
        createdAt: Number(r.created_at) || 0,
      }))
    : []

  const vulnerabilities: BackupVulnerabilityRecord[] = tableExists(db, 'companion_vulnerability_moments')
    ? queryRows(db, 'SELECT * FROM companion_vulnerability_moments ORDER BY created_at ASC, id ASC').map(r => ({
        id: String(r.id),
        roleId: String(r.role_id),
        title: String(r.title),
        moodState: String(r.mood_state),
        triggerContext: String(r.trigger_context),
        vulnerabilityText: String(r.vulnerability_text),
        comfortPromptHint: r.comfort_prompt_hint == null ? null : String(r.comfort_prompt_hint),
        status: String(r.status),
        comfortText: r.comfort_text == null ? null : String(r.comfort_text),
        companionReaction: r.companion_reaction == null ? null : String(r.companion_reaction),
        createdAt: Number(r.created_at) || 0,
        comfortedAt: r.comforted_at == null ? null : Number(r.comforted_at),
      }))
    : []

  const lifeResonances: BackupLifeResonanceRecord[] = tableExists(db, 'companion_life_resonances')
    ? queryRows(db, 'SELECT * FROM companion_life_resonances ORDER BY created_at ASC, id ASC').map(r => ({
        id: String(r.id),
        roleId: String(r.role_id),
        sessionId: String(r.session_id),
        kind: String(r.kind),
        title: String(r.title),
        targetName: String(r.target_name),
        userQuote: String(r.user_quote ?? ''),
        reason: String(r.reason ?? ''),
        cultureType: r.culture_type == null ? null : String(r.culture_type),
        status: String(r.status),
        createdAt: Number(r.created_at) || 0,
        absorbedAt: r.absorbed_at == null ? null : Number(r.absorbed_at),
        completedAt: r.completed_at == null ? null : Number(r.completed_at),
        feedbackText: r.feedback_text == null ? null : String(r.feedback_text),
        feedbackDeliveredAt: r.feedback_delivered_at == null ? null : Number(r.feedback_delivered_at),
        assetId: r.asset_id == null ? null : String(r.asset_id),
      }))
    : []

  const travelProgressions: BackupTravelProgressionRecord[] = tableExists(db, 'companion_travel_progressions')
    ? queryRows(db, 'SELECT * FROM companion_travel_progressions ORDER BY created_at ASC, id ASC').map(r => ({
        id: String(r.id),
        roleId: String(r.role_id),
        tripId: String(r.trip_id),
        stopId: String(r.stop_id),
        stopName: String(r.stop_name),
        stopDate: String(r.stop_date),
        story: String(r.story),
        triggerReason: String(r.trigger_reason),
        createdAt: Number(r.created_at) || 0,
      }))
    : []

  const autonomousDressings: BackupAutonomousDressingRecord[] = tableExists(db, 'companion_autonomous_dressings')
    ? queryRows(db, 'SELECT * FROM companion_autonomous_dressings ORDER BY created_at ASC, id ASC').map(r => ({
        id: String(r.id),
        roleId: String(r.role_id),
        assetId: String(r.asset_id),
        outfitName: String(r.outfit_name),
        triggerReason: String(r.trigger_reason),
        outfitVersion: Number(r.outfit_version) || 1,
        createdAt: Number(r.created_at) || 0,
      }))
    : []

  const momentMedia: BackupMomentMediaRecord[] = []
  const momentMediaSources: ImageReferenceCollection[] = []
  if (tableExists(db, 'companion_moment_media')) {
    for (const r of queryRows(db, 'SELECT * FROM companion_moment_media ORDER BY created_at ASC, id ASC')) {
      const ref: GeneratedImageReference = {
        id: String(r.id),
        path: String(r.path),
        mimeType: 'image/png',
        width: Number(r.width) || 0,
        height: Number(r.height) || 0,
        byteLength: Number(r.byte_length) || 0,
      }
      momentMedia.push({
        id: ref.id,
        roleId: String(r.role_id),
        eventId: String(r.event_id),
        momentId: String(r.moment_id),
        image: toBackupImageReference(ref),
        createdAt: Number(r.created_at) || 0,
      })
      momentMediaSources.push({ scope: `moment-media:${ref.id}`, references: [ref] })
    }
  }

  const snapshot: CompanionBackupSnapshot = {
    ...(mutables.length ? { mutables } : {}),
    ...(mutableVersions.length ? { mutableVersions } : {}),
    ...(reflectionStates.length ? { reflectionStates } : {}),
    ...(firstContacts.length ? { firstContacts } : {}),
    ...(runtimeStates.length ? { runtimeStates } : {}),
    ...(relationshipStates.length ? { relationshipStates } : {}),
    ...(relationshipEvents.length ? { relationshipEvents } : {}),
    ...(emotionEvents.length ? { emotionEvents } : {}),
    ...(innerThoughts.length ? { innerThoughts } : {}),
    ...(keepsakes.length ? { keepsakes } : {}),
    ...(receivedGifts.length ? { receivedGifts } : {}),
    ...(vulnerabilities.length ? { vulnerabilities } : {}),
    ...(lifeResonances.length ? { lifeResonances } : {}),
    ...(travelProgressions.length ? { travelProgressions } : {}),
    ...(autonomousDressings.length ? { autonomousDressings } : {}),
    ...(momentMedia.length ? { momentMedia } : {}),
  }

  return { snapshot, momentMediaSources }
}

export function companionMomentMediaImageCollections(snapshot?: CompanionBackupSnapshot): ImageReferenceCollection[] {
  if (!snapshot?.momentMedia?.length) return []
  return snapshot.momentMedia.map(item => ({
    scope: `moment-media:${item.id}`,
    references: [item.image],
  }))
}

function ensureCompanionBackupTables(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_runtime_state (
      role_id TEXT PRIMARY KEY,
      universe_id TEXT NOT NULL,
      mood INTEGER NOT NULL,
      energy INTEGER NOT NULL,
      social_need INTEGER NOT NULL,
      hunger INTEGER NOT NULL,
      sleepiness INTEGER NOT NULL,
      home TEXT NOT NULL DEFAULT '',
      timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
      current_activity TEXT NOT NULL DEFAULT '',
      current_location TEXT NOT NULL DEFAULT '',
      location_detail TEXT NOT NULL DEFAULT '',
      status_tags_json TEXT NOT NULL DEFAULT '[]',
      situation TEXT NOT NULL DEFAULT '',
      paused_at INTEGER,
      catchup_summary TEXT NOT NULL DEFAULT '',
      last_tick_at INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      last_event_id TEXT
    );
    CREATE TABLE IF NOT EXISTS companion_first_contact (
      role_id TEXT PRIMARY KEY,
      shown_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companion_relationship_state (
      role_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'familiar',
      signal INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (role_id, subject_id)
    );
    CREATE TABLE IF NOT EXISTS companion_relationship_events (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      delta INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      source_event_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companion_emotion_events (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      event_id TEXT,
      label TEXT NOT NULL,
      intensity INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companion_moment_media (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      moment_id TEXT NOT NULL,
      path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      byte_length INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(event_id, id)
    );
    CREATE TABLE IF NOT EXISTS companion_mutable (
      role_id    TEXT PRIMARY KEY,
      body       TEXT NOT NULL,
      version    INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companion_mutable_versions (
      id         TEXT PRIMARY KEY,
      role_id    TEXT NOT NULL,
      version    INTEGER NOT NULL,
      body       TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      summary    TEXT NOT NULL DEFAULT '',
      UNIQUE(role_id, version)
    );
    CREATE TABLE IF NOT EXISTS companion_reflection_state (
      role_id     TEXT PRIMARY KEY,
      last_run_at INTEGER NOT NULL DEFAULT 0,
      runs_json   TEXT NOT NULL DEFAULT '[]',
      updated_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companion_inner_thoughts (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      title        TEXT NOT NULL,
      content      TEXT NOT NULL,
      mood         TEXT,
      weather      TEXT,
      location     TEXT,
      activity     TEXT,
      is_favorite  INTEGER DEFAULT 0,
      created_at   INTEGER NOT NULL,
      thought_type TEXT NOT NULL DEFAULT 'general',
      epiphany     TEXT,
      source_type  TEXT NOT NULL DEFAULT 'legacy-inner-thought',
      source_id    TEXT,
      trace_id     TEXT
    );
    CREATE TABLE IF NOT EXISTS companion_keepsakes (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      name         TEXT NOT NULL,
      description  TEXT NOT NULL,
      lore         TEXT NOT NULL,
      gift_message TEXT NOT NULL,
      gift_reason  TEXT NOT NULL,
      icon_name    TEXT NOT NULL,
      image_url    TEXT,
      acquired_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companion_received_gifts (
      id                  TEXT PRIMARY KEY,
      role_id             TEXT NOT NULL,
      gift_key            TEXT NOT NULL,
      gift_name           TEXT NOT NULL,
      category            TEXT NOT NULL,
      giver_name          TEXT,
      user_note           TEXT,
      companion_reaction  TEXT NOT NULL,
      vitals_buff_json    TEXT,
      image_url           TEXT,
      created_at          INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companion_vulnerability_moments (
      id                  TEXT PRIMARY KEY,
      role_id             TEXT NOT NULL,
      title               TEXT NOT NULL,
      mood_state          TEXT NOT NULL,
      trigger_context     TEXT NOT NULL,
      vulnerability_text  TEXT NOT NULL,
      comfort_prompt_hint TEXT,
      status              TEXT NOT NULL DEFAULT 'active',
      comfort_text        TEXT,
      companion_reaction  TEXT,
      created_at          INTEGER NOT NULL,
      comforted_at        INTEGER
    );
    CREATE TABLE IF NOT EXISTS companion_life_resonances (
      id                    TEXT PRIMARY KEY,
      role_id               TEXT NOT NULL,
      session_id            TEXT NOT NULL,
      kind                  TEXT NOT NULL,
      title                 TEXT NOT NULL,
      target_name           TEXT NOT NULL,
      user_quote            TEXT NOT NULL,
      reason                TEXT NOT NULL,
      culture_type          TEXT,
      status                TEXT NOT NULL DEFAULT 'active',
      created_at            INTEGER NOT NULL,
      absorbed_at           INTEGER,
      completed_at          INTEGER,
      feedback_text         TEXT,
      feedback_delivered_at INTEGER,
      asset_id              TEXT
    );
    CREATE TABLE IF NOT EXISTS companion_travel_progressions (
      id             TEXT PRIMARY KEY,
      role_id        TEXT NOT NULL,
      trip_id        TEXT NOT NULL,
      stop_id        TEXT NOT NULL,
      stop_name      TEXT NOT NULL,
      stop_date      TEXT NOT NULL,
      story          TEXT NOT NULL,
      trigger_reason TEXT NOT NULL,
      created_at     INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companion_autonomous_dressings (
      id             TEXT PRIMARY KEY,
      role_id        TEXT NOT NULL,
      asset_id       TEXT NOT NULL,
      outfit_name    TEXT NOT NULL,
      trigger_reason TEXT NOT NULL,
      outfit_version INTEGER NOT NULL,
      created_at     INTEGER NOT NULL
    );
  `)
}

export function importCompanionBackupSnapshot(
  db: Database,
  snapshot: CompanionBackupSnapshot | undefined,
  undo: Array<() => void>,
  imageReferences?: ReadonlyMap<string, GeneratedImageReference>,
): void {
  if (!snapshot) return
  ensureCompanionBackupTables(db)

  const exists = (sql: string, params: Array<string | number>) => {
    const stmt = db.prepare(sql)
    try {
      stmt.bind(params)
      return stmt.step()
    } finally {
      stmt.free()
    }
  }

  for (const row of snapshot.mutables ?? []) {
    if (exists('SELECT 1 FROM companion_mutable WHERE role_id = ?', [row.roleId])) continue
    db.run('INSERT INTO companion_mutable (role_id, body, version, updated_at) VALUES (?, ?, ?, ?)', [row.roleId, row.body, row.version, row.updatedAt])
    undo.push(() => { db.run('DELETE FROM companion_mutable WHERE role_id = ?', [row.roleId]) })
  }

  for (const row of snapshot.mutableVersions ?? []) {
    if (exists('SELECT 1 FROM companion_mutable_versions WHERE id = ? OR (role_id = ? AND version = ?)', [row.id, row.roleId, row.version])) continue
    db.run('INSERT INTO companion_mutable_versions (id, role_id, version, body, created_at, summary) VALUES (?, ?, ?, ?, ?, ?)',
      [row.id, row.roleId, row.version, row.body, row.createdAt, row.summary])
    undo.push(() => { db.run('DELETE FROM companion_mutable_versions WHERE id = ?', [row.id]) })
  }

  for (const row of snapshot.reflectionStates ?? []) {
    if (exists('SELECT 1 FROM companion_reflection_state WHERE role_id = ?', [row.roleId])) continue
    db.run('INSERT INTO companion_reflection_state (role_id, last_run_at, runs_json, updated_at) VALUES (?, ?, ?, ?)',
      [row.roleId, row.lastRunAt, row.runsJson, row.updatedAt])
    undo.push(() => { db.run('DELETE FROM companion_reflection_state WHERE role_id = ?', [row.roleId]) })
  }

  for (const row of snapshot.firstContacts ?? []) {
    if (exists('SELECT 1 FROM companion_first_contact WHERE role_id = ?', [row.roleId])) continue
    db.run('INSERT INTO companion_first_contact (role_id, shown_at) VALUES (?, ?)', [row.roleId, row.shownAt])
    undo.push(() => { db.run('DELETE FROM companion_first_contact WHERE role_id = ?', [row.roleId]) })
  }

  for (const row of snapshot.runtimeStates ?? []) {
    if (exists('SELECT 1 FROM companion_runtime_state WHERE role_id = ?', [row.roleId])) continue
    db.run(
      `INSERT INTO companion_runtime_state
         (role_id, universe_id, mood, energy, social_need, hunger, sleepiness, home, timezone, current_activity, current_location, location_detail, status_tags_json, situation, paused_at, catchup_summary, last_tick_at, version, updated_at, last_event_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.roleId, row.universeId, row.mood, row.energy, row.socialNeed, row.hunger, row.sleepiness, row.home, row.timezone, row.currentActivity, row.currentLocation, row.locationDetail, row.statusTagsJson, row.situation, row.pausedAt, row.catchupSummary, row.lastTickAt, row.version, row.updatedAt, row.lastEventId],
    )
    undo.push(() => { db.run('DELETE FROM companion_runtime_state WHERE role_id = ?', [row.roleId]) })
  }

  for (const row of snapshot.relationshipStates ?? []) {
    if (exists('SELECT 1 FROM companion_relationship_state WHERE role_id = ? AND subject_id = ?', [row.roleId, row.subjectId])) continue
    db.run('INSERT INTO companion_relationship_state (role_id, subject_id, phase, signal, note, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [row.roleId, row.subjectId, row.phase, row.signal, row.note, row.updatedAt])
    undo.push(() => { db.run('DELETE FROM companion_relationship_state WHERE role_id = ? AND subject_id = ?', [row.roleId, row.subjectId]) })
  }

  for (const row of snapshot.relationshipEvents ?? []) {
    if (exists('SELECT 1 FROM companion_relationship_events WHERE id = ?', [row.id])) continue
    if (row.sourceEventId && exists('SELECT 1 FROM companion_relationship_events WHERE role_id = ? AND source_event_id = ?', [row.roleId, row.sourceEventId])) continue
    db.run('INSERT INTO companion_relationship_events (id, role_id, subject_id, phase, delta, note, source_event_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [row.id, row.roleId, row.subjectId, row.phase, row.delta, row.note, row.sourceEventId, row.createdAt])
    undo.push(() => { db.run('DELETE FROM companion_relationship_events WHERE id = ?', [row.id]) })
  }

  for (const row of snapshot.emotionEvents ?? []) {
    if (exists('SELECT 1 FROM companion_emotion_events WHERE id = ?', [row.id])) continue
    db.run('INSERT INTO companion_emotion_events (id, role_id, event_id, label, intensity, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [row.id, row.roleId, row.eventId, row.label, row.intensity, row.note, row.createdAt])
    undo.push(() => { db.run('DELETE FROM companion_emotion_events WHERE id = ?', [row.id]) })
  }

  for (const row of snapshot.innerThoughts ?? []) {
    if (exists('SELECT 1 FROM companion_inner_thoughts WHERE id = ?', [row.id])) continue
    db.run(
      `INSERT INTO companion_inner_thoughts
         (id, role_id, title, content, mood, weather, location, activity, is_favorite, created_at, thought_type, epiphany, source_type, source_id, trace_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.roleId, row.title, row.content, row.mood, row.weather, row.location, row.activity, row.isFavorite, row.createdAt, row.thoughtType, row.epiphany, row.sourceType, row.sourceId, row.traceId],
    )
    undo.push(() => { db.run('DELETE FROM companion_inner_thoughts WHERE id = ?', [row.id]) })
  }

  for (const row of snapshot.keepsakes ?? []) {
    if (exists('SELECT 1 FROM companion_keepsakes WHERE id = ?', [row.id])) continue
    db.run(
      `INSERT INTO companion_keepsakes
         (id, role_id, name, description, lore, gift_message, gift_reason, icon_name, image_url, acquired_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.roleId, row.name, row.description, row.lore, row.giftMessage, row.giftReason, row.iconName, row.imageUrl, row.acquiredAt],
    )
    undo.push(() => { db.run('DELETE FROM companion_keepsakes WHERE id = ?', [row.id]) })
  }

  for (const row of snapshot.receivedGifts ?? []) {
    if (exists('SELECT 1 FROM companion_received_gifts WHERE id = ?', [row.id])) continue
    db.run(
      `INSERT INTO companion_received_gifts
         (id, role_id, gift_key, gift_name, category, giver_name, user_note, companion_reaction, vitals_buff_json, image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.roleId, row.giftKey, row.giftName, row.category, row.giverName ?? null, row.userNote, row.companionReaction, row.vitalsBuffJson, row.imageUrl ?? null, row.createdAt],
    )
    undo.push(() => { db.run('DELETE FROM companion_received_gifts WHERE id = ?', [row.id]) })
  }

  for (const row of snapshot.vulnerabilities ?? []) {
    if (exists('SELECT 1 FROM companion_vulnerability_moments WHERE id = ?', [row.id])) continue
    db.run(
      `INSERT INTO companion_vulnerability_moments
         (id, role_id, title, mood_state, trigger_context, vulnerability_text, comfort_prompt_hint, status, comfort_text, companion_reaction, created_at, comforted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.roleId, row.title, row.moodState, row.triggerContext, row.vulnerabilityText, row.comfortPromptHint, row.status, row.comfortText, row.companionReaction, row.createdAt, row.comfortedAt],
    )
    undo.push(() => { db.run('DELETE FROM companion_vulnerability_moments WHERE id = ?', [row.id]) })
  }

  for (const row of snapshot.lifeResonances ?? []) {
    if (exists('SELECT 1 FROM companion_life_resonances WHERE id = ?', [row.id])) continue
    db.run(
      `INSERT INTO companion_life_resonances
         (id, role_id, session_id, kind, title, target_name, user_quote, reason, culture_type, status, created_at, absorbed_at, completed_at, feedback_text, feedback_delivered_at, asset_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.roleId, row.sessionId, row.kind, row.title, row.targetName, row.userQuote, row.reason, row.cultureType, row.status, row.createdAt, row.absorbedAt, row.completedAt, row.feedbackText, row.feedbackDeliveredAt, row.assetId],
    )
    undo.push(() => { db.run('DELETE FROM companion_life_resonances WHERE id = ?', [row.id]) })
  }

  for (const row of snapshot.travelProgressions ?? []) {
    if (exists('SELECT 1 FROM companion_travel_progressions WHERE id = ?', [row.id])) continue
    db.run(
      `INSERT INTO companion_travel_progressions
         (id, role_id, trip_id, stop_id, stop_name, stop_date, story, trigger_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.roleId, row.tripId, row.stopId, row.stopName, row.stopDate, row.story, row.triggerReason, row.createdAt],
    )
    undo.push(() => { db.run('DELETE FROM companion_travel_progressions WHERE id = ?', [row.id]) })
  }

  for (const row of snapshot.autonomousDressings ?? []) {
    if (exists('SELECT 1 FROM companion_autonomous_dressings WHERE id = ?', [row.id])) continue
    db.run(
      `INSERT INTO companion_autonomous_dressings
         (id, role_id, asset_id, outfit_name, trigger_reason, outfit_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.roleId, row.assetId, row.outfitName, row.triggerReason, row.outfitVersion, row.createdAt],
    )
    undo.push(() => { db.run('DELETE FROM companion_autonomous_dressings WHERE id = ?', [row.id]) })
  }

  for (const row of snapshot.momentMedia ?? []) {
    const restored = imageReferences?.get(row.id)
    const targetId = restored?.id ?? row.id
    if (exists('SELECT 1 FROM companion_moment_media WHERE id = ?', [targetId])) continue
    if (!restored) continue
    db.run(
      `INSERT INTO companion_moment_media
         (id, role_id, event_id, moment_id, path, mime_type, width, height, byte_length, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [restored.id, row.roleId, row.eventId, row.momentId, restored.path, restored.mimeType, restored.width, restored.height, restored.byteLength, row.createdAt],
    )
    undo.push(() => { db.run('DELETE FROM companion_moment_media WHERE id = ?', [restored.id]) })
  }
}

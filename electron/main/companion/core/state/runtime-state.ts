import { getDatabase, persist } from '../../../storage/database'
import * as lifeStore from '../../life/store'
import { defaultWorldState } from '../../life/world-codec'
import { ensureCompanionCoreSchema } from '../schema'
import type { CompanionRuntimeState } from '../types'
import type { CompanionWorldState } from '../../types'

export { resetCompanionCoreSchemaForTesting } from '../schema'

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function rowToState(row: Record<string, unknown>): CompanionRuntimeState {
  return {
    roleId: String(row.role_id),
    universeId: String(row.universe_id),
    mood: clamp(Number(row.mood) || 0),
    energy: clamp(Number(row.energy) || 0),
    socialNeed: clamp(Number(row.social_need) || 0),
    hunger: clamp(Number(row.hunger) || 0),
    sleepiness: clamp(Number(row.sleepiness) || 0),
    home: String(row.home ?? ''),
    timezone: String(row.timezone ?? 'Asia/Shanghai'),
    currentActivity: String(row.current_activity ?? ''),
    currentLocation: String(row.current_location ?? ''),
    locationDetail: String(row.location_detail ?? ''),
    statusTags: JSON.parse(String(row.status_tags_json ?? '[]')) as string[],
    situation: String(row.situation ?? ''),
    pausedAt: row.paused_at == null ? null : Number(row.paused_at),
    catchupSummary: String(row.catchup_summary ?? ''),
    version: Number(row.version) || 0,
    updatedAt: Number(row.updated_at) || 0,
    lastEventId: row.last_event_id == null ? null : String(row.last_event_id),
  }
}

/**
 * 读取统一人物运行态，并为旧生活状态建立一次快照。
 *
 * 背景：现有角色状态仍保存在 life store 的 world_json 中，核心层需要逐步接管读取而不能丢失存量状态。
 * 设计意图：首次读取时从既有 role_state 回填核心快照，后续核心写入使用独立版本号和 lastEventId。
 * 关键约束：回填只发生一次，数值统一限制在 0–100，当前状态不能用默认值覆盖已有 world_json。
 */
export async function getCompanionRuntimeState(roleId: string, universeId = 'default'): Promise<CompanionRuntimeState> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const existing = db.exec('SELECT * FROM companion_runtime_state WHERE role_id = ?', [roleId])[0]?.values[0]
  if (existing) {
    const columns = ['role_id', 'universe_id', 'mood', 'energy', 'social_need', 'hunger', 'sleepiness', 'home', 'timezone', 'current_activity', 'current_location', 'location_detail', 'status_tags_json', 'situation', 'paused_at', 'catchup_summary', 'version', 'updated_at', 'last_event_id']
    return rowToState(Object.fromEntries(columns.map((key, index) => [key, existing[index]])))
  }

  const roleState = await lifeStore.getRoleState(roleId)
  const world = roleState?.world ?? defaultWorldState(roleId)
  const now = Date.now()
  const legacyWorld = world as CompanionWorldState & Partial<Pick<CompanionRuntimeState, 'hunger' | 'sleepiness'>>
  const state: CompanionRuntimeState = {
    roleId,
    universeId,
    mood: clamp(world.mood),
    energy: clamp(world.energy),
    socialNeed: clamp(world.socialNeed),
    hunger: clamp(Number(legacyWorld.hunger) || 0),
    sleepiness: clamp(Number(legacyWorld.sleepiness) || 0),
    home: world.home,
    timezone: world.timezone,
    currentActivity: world.currentActivity || '',
    currentLocation: world.currentLocation || '',
    locationDetail: world.locationDetail || '',
    statusTags: world.statusTags,
    situation: world.situation || '',
    pausedAt: roleState?.pausedAt ?? null,
    catchupSummary: roleState?.catchupSummary ?? '',
    version: 0,
    updatedAt: world.updatedAt || now,
    lastEventId: null,
  }
  await replaceCompanionRuntimeState(state)
  return state
}

export async function replaceCompanionRuntimeState(state: CompanionRuntimeState): Promise<CompanionRuntimeState> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const next = {
    ...state,
    pausedAt: state.pausedAt ?? null,
    catchupSummary: state.catchupSummary ?? '',
    mood: clamp(state.mood),
    energy: clamp(state.energy),
    socialNeed: clamp(state.socialNeed),
    hunger: clamp(state.hunger),
    sleepiness: clamp(state.sleepiness),
  }
  db.run(`
    INSERT INTO companion_runtime_state
      (role_id, universe_id, mood, energy, social_need, hunger, sleepiness, home, timezone, current_activity, current_location, location_detail, status_tags_json, situation, paused_at, catchup_summary, version, updated_at, last_event_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(role_id) DO UPDATE SET
      universe_id = excluded.universe_id,
      mood = excluded.mood,
      energy = excluded.energy,
      social_need = excluded.social_need,
      hunger = excluded.hunger,
      sleepiness = excluded.sleepiness,
      home = excluded.home,
      timezone = excluded.timezone,
      current_activity = excluded.current_activity,
      current_location = excluded.current_location,
      location_detail = excluded.location_detail,
      status_tags_json = excluded.status_tags_json,
      situation = excluded.situation,
      paused_at = excluded.paused_at,
      catchup_summary = excluded.catchup_summary,
      version = excluded.version,
      updated_at = excluded.updated_at,
      last_event_id = excluded.last_event_id
  `, [next.roleId, next.universeId, next.mood, next.energy, next.socialNeed, next.hunger, next.sleepiness, next.home, next.timezone, next.currentActivity, next.currentLocation, next.locationDetail, JSON.stringify(next.statusTags), next.situation, next.pausedAt, next.catchupSummary, next.version, next.updatedAt, next.lastEventId])
  persist()
  const legacy = await lifeStore.getRoleState(next.roleId)
  const legacyWorld = legacy?.world ?? defaultWorldState(next.roleId)
  if (typeof lifeStore.setWorldState === 'function') {
    await lifeStore.setWorldState(next.roleId, {
      ...legacyWorld,
      home: next.home,
      timezone: next.timezone,
      mood: next.mood,
      energy: next.energy,
      socialNeed: next.socialNeed,
      currentActivity: next.currentActivity,
      currentLocation: next.currentLocation,
      locationDetail: next.locationDetail,
      situation: next.situation,
      statusTags: next.statusTags,
      updatedAt: next.updatedAt,
    })
  }
  return next
}

export async function applyCompanionRuntimeDelta(input: {
  roleId: string
  universeId?: string
  eventId?: string | null
  delta?: Partial<Pick<CompanionRuntimeState, 'mood' | 'energy' | 'socialNeed' | 'hunger' | 'sleepiness'>>
  patch?: Partial<Pick<CompanionRuntimeState, 'currentActivity' | 'currentLocation' | 'situation'>>
  expectedVersion?: number
  updatedAt?: number
}): Promise<CompanionRuntimeState> {
  const current = await getCompanionRuntimeState(input.roleId, input.universeId)
  if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
    throw new Error(`人物运行态版本冲突，当前版本为 ${current.version}。`)
  }
  const delta = input.delta ?? {}
  return replaceCompanionRuntimeState({
    ...current,
    ...input.patch,
    mood: current.mood + (delta.mood ?? 0),
    energy: current.energy + (delta.energy ?? 0),
    socialNeed: current.socialNeed + (delta.socialNeed ?? 0),
    hunger: current.hunger + (delta.hunger ?? 0),
    sleepiness: current.sleepiness + (delta.sleepiness ?? 0),
    version: current.version + 1,
    updatedAt: input.updatedAt ?? Date.now(),
    lastEventId: input.eventId ?? current.lastEventId,
  })
}

export async function updateCompanionRuntimeLifecycle(input: {
  roleId: string
  pausedAt?: number | null
  catchupSummary?: string
  updatedAt?: number
}): Promise<CompanionRuntimeState> {
  const current = await getCompanionRuntimeState(input.roleId)
  return replaceCompanionRuntimeState({
    ...current,
    pausedAt: input.pausedAt === undefined ? current.pausedAt : input.pausedAt,
    catchupSummary: input.catchupSummary === undefined ? current.catchupSummary : input.catchupSummary,
    updatedAt: input.updatedAt ?? Date.now(),
  })
}

import { getDatabase, persist } from '../../../storage/database'
import { defaultWorldState } from '../../life/world-codec'
import { ensureCompanionCoreSchema } from '../schema'
import type { CompanionRuntimeState } from '../types'
import { resolveRoleUniverseId } from '../../identity/loader'
import { withCompanionUnitOfWork } from '../transaction/unit-of-work'

export { resetCompanionCoreSchemaForTesting } from '../schema'

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function decodeCompanionRuntimeState(row: Record<string, unknown>): CompanionRuntimeState {
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
    lastTickAt: Number(row.last_tick_at) || 0,
    version: Number(row.version) || 0,
    updatedAt: Number(row.updated_at) || 0,
    lastEventId: row.last_event_id == null ? null : String(row.last_event_id),
  }
}

/**
 * 读取 Core 唯一人物运行态。
 *
 * 背景：运行态双写会让页面与生活调度读取不同事实。
 * 设计意图：缺失快照直接从 Role Pack 初始化，所有后续更新只写 Core。
 * 关键约束：数值统一限制在 0–100，已有 Core 快照不被默认值覆盖。
 */
export async function getCompanionRuntimeState(roleId: string, universeId = resolveRoleUniverseId(roleId)): Promise<CompanionRuntimeState> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const existing = db.exec('SELECT * FROM companion_runtime_state WHERE role_id = ?', [roleId])[0]?.values[0]
  if (existing) {
    const columns = ['role_id', 'universe_id', 'mood', 'energy', 'social_need', 'hunger', 'sleepiness', 'home', 'timezone', 'current_activity', 'current_location', 'location_detail', 'status_tags_json', 'situation', 'paused_at', 'catchup_summary', 'last_tick_at', 'version', 'updated_at', 'last_event_id']
    return decodeCompanionRuntimeState(Object.fromEntries(columns.map((key, index) => [key, existing[index]])))
  }

  return withCompanionUnitOfWork(async () => {
    // 首次并发读取可能同时发现缺失，领取事务后复核，避免默认值覆盖刚提交的运行态。
    if (db.exec('SELECT 1 FROM companion_runtime_state WHERE role_id = ?', [roleId])[0]?.values.length) {
      return getCompanionRuntimeState(roleId, universeId)
    }
    const world = defaultWorldState(roleId, universeId)
    const now = Date.now()
    const state: CompanionRuntimeState = {
      roleId,
      universeId,
      mood: clamp(world.mood),
      energy: clamp(world.energy),
      socialNeed: clamp(world.socialNeed),
      hunger: 0,
      sleepiness: 0,
      home: world.home,
      timezone: world.timezone,
      currentActivity: world.currentActivity || '',
      currentLocation: world.currentLocation || '',
      locationDetail: world.locationDetail || '',
      statusTags: world.statusTags,
      situation: world.situation || '',
      pausedAt: null,
      catchupSummary: '',
      lastTickAt: 0,
      version: 0,
      updatedAt: world.updatedAt || now,
      lastEventId: null,
    }
    await replaceCompanionRuntimeState(state)
    return state
  })
}

export async function replaceCompanionRuntimeState(state: CompanionRuntimeState): Promise<CompanionRuntimeState> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const next = {
    ...state,
    pausedAt: state.pausedAt ?? null,
    catchupSummary: state.catchupSummary ?? '',
    lastTickAt: state.lastTickAt ?? 0,
    mood: clamp(state.mood),
    energy: clamp(state.energy),
    socialNeed: clamp(state.socialNeed),
    hunger: clamp(state.hunger),
    sleepiness: clamp(state.sleepiness),
  }
  db.run(`
    INSERT INTO companion_runtime_state
      (role_id, universe_id, mood, energy, social_need, hunger, sleepiness, home, timezone, current_activity, current_location, location_detail, status_tags_json, situation, paused_at, catchup_summary, last_tick_at, version, updated_at, last_event_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      last_tick_at = excluded.last_tick_at,
      version = excluded.version,
      updated_at = excluded.updated_at,
      last_event_id = excluded.last_event_id
  `, [next.roleId, next.universeId, next.mood, next.energy, next.socialNeed, next.hunger, next.sleepiness, next.home, next.timezone, next.currentActivity, next.currentLocation, next.locationDetail, JSON.stringify(next.statusTags), next.situation, next.pausedAt, next.catchupSummary, next.lastTickAt, next.version, next.updatedAt, next.lastEventId])
  persist()
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
  return withCompanionUnitOfWork(async () => {
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
  })
}

export async function updateCompanionRuntimeLifecycle(input: {
  roleId: string
  pausedAt?: number | null
  catchupSummary?: string
  lastTickAt?: number
  updatedAt?: number
}): Promise<CompanionRuntimeState> {
  return withCompanionUnitOfWork(async () => {
    const current = await getCompanionRuntimeState(input.roleId)
    return replaceCompanionRuntimeState({
      ...current,
      pausedAt: input.pausedAt === undefined ? current.pausedAt : input.pausedAt,
      catchupSummary: input.catchupSummary === undefined ? current.catchupSummary : input.catchupSummary,
      lastTickAt: input.lastTickAt === undefined ? current.lastTickAt : input.lastTickAt,
      updatedAt: input.updatedAt ?? Date.now(),
    })
  })
}

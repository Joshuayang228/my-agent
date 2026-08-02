/**
 * 反思门闸（对照 Alice shouldReflectNow）
 *
 * - 冷启动 72h：从该 role 的成长时钟起算（M22-G1 按 role 分桶）
 * - 冷却 24h：该 role 上次 lastRunAt 起算
 * - 信号：近 7 日该角色用户消息 ≥ minUserMessages
 */

import * as settings from '../../storage/settings-store'
import { countUserMessagesForRoleSince } from '../../storage/session-store'
import { getReflectionState } from './reflection-log'

export const COLD_START_MS = 72 * 60 * 60 * 1000
export const COOLDOWN_MS = 24 * 60 * 60 * 1000
export const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
export const MIN_USER_MESSAGES = 5

/** settings 键：JSON Record<roleId, ms> */
export const GROWTH_STARTED_BY_ROLE_KEY = 'companionGrowthStartedAtByRole' as const
/** 旧全局时钟（仅迁移用） */
const LEGACY_GROWTH_KEY = 'companionGrowthStartedAt' as const

export type ReflectDenyReason =
  | 'cold-start-72h'
  | 'cooldown'
  | 'insufficient-messages'
  | 'ok'

export interface ReflectGateResult {
  allowed: boolean
  reason: ReflectDenyReason
  detail?: string
  growthStartedAt: number
  lastRunAt: number
  recentUserMessages: number
}

function parseGrowthMap(raw: string): Record<string, number> {
  const map: Record<string, number> = {}
  if (!raw?.trim()) return map
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return map
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = Number(v)
      if (k && Number.isFinite(n) && n > 0) map[k] = n
    }
  } catch {
    /* ignore */
  }
  return map
}

async function loadGrowthMap(): Promise<Record<string, number>> {
  const raw = await settings.getSetting(GROWTH_STARTED_BY_ROLE_KEY)
  let map = parseGrowthMap(raw)

  // 一次性迁移：旧全局时钟只落到当前活跃主角，其他角色首次对话再各自打点
  if (Object.keys(map).length === 0) {
    const legacy = Number(await settings.getSetting(LEGACY_GROWTH_KEY))
    if (Number.isFinite(legacy) && legacy > 0) {
      const active = (await settings.getSetting('activeRoleId')) || 'lin'
      map = { [active]: legacy }
      await settings.setSetting(GROWTH_STARTED_BY_ROLE_KEY, JSON.stringify(map))
    }
  }
  return map
}

async function saveGrowthMap(map: Record<string, number>): Promise<void> {
  await settings.setSetting(GROWTH_STARTED_BY_ROLE_KEY, JSON.stringify(map))
}

/** 读取某角色成长时钟；0 = 尚未开始 */
export async function getGrowthStartedAt(roleId: string): Promise<number> {
  if (!roleId.trim()) return 0
  const map = await loadGrowthMap()
  return map[roleId] ?? 0
}

/**
 * 确保该角色成长时钟已打点（首次与该角色有效对话后调用）。
 * 已存在则不改。
 */
export async function ensureGrowthStartedAt(
  roleId: string,
  now = Date.now(),
): Promise<number> {
  const id = roleId.trim()
  if (!id) return 0
  const map = await loadGrowthMap()
  const existing = map[id]
  if (Number.isFinite(existing) && existing > 0) return existing
  map[id] = now
  await saveGrowthMap(map)
  return now
}

export async function shouldReflectNow(
  roleId: string,
  opts?: { now?: number; minUserMessages?: number; force?: boolean },
): Promise<ReflectGateResult> {
  const now = opts?.now ?? Date.now()
  const minMsgs = opts?.minUserMessages ?? MIN_USER_MESSAGES
  const growthStartedAt = await getGrowthStartedAt(roleId)
  const state = await getReflectionState(roleId)
  const since = now - LOOKBACK_MS
  const recentUserMessages = await countUserMessagesForRoleSince(roleId, since)

  if (opts?.force) {
    return {
      allowed: true,
      reason: 'ok',
      growthStartedAt,
      lastRunAt: state.lastRunAt,
      recentUserMessages,
      detail: 'force',
    }
  }

  if (!growthStartedAt || now - growthStartedAt < COLD_START_MS) {
    const leftH = growthStartedAt
      ? Math.ceil((COLD_START_MS - (now - growthStartedAt)) / 3600000)
      : 72
    return {
      allowed: false,
      reason: 'cold-start-72h',
      detail: `还需约 ${leftH}h`,
      growthStartedAt,
      lastRunAt: state.lastRunAt,
      recentUserMessages,
    }
  }

  if (state.lastRunAt && now - state.lastRunAt < COOLDOWN_MS) {
    const leftH = Math.ceil((COOLDOWN_MS - (now - state.lastRunAt)) / 3600000)
    return {
      allowed: false,
      reason: 'cooldown',
      detail: `冷却中，约 ${leftH}h 后可再反思`,
      growthStartedAt,
      lastRunAt: state.lastRunAt,
      recentUserMessages,
    }
  }

  if (recentUserMessages < minMsgs) {
    return {
      allowed: false,
      reason: 'insufficient-messages',
      detail: `近7日用户消息 ${recentUserMessages}/${minMsgs}`,
      growthStartedAt,
      lastRunAt: state.lastRunAt,
      recentUserMessages,
    }
  }

  return {
    allowed: true,
    reason: 'ok',
    growthStartedAt,
    lastRunAt: state.lastRunAt,
    recentUserMessages,
  }
}

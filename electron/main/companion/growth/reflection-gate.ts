/**
 * 反思门闸（对照 Alice shouldReflectNow）
 *
 * - 冷启动 72h：从 companionGrowthStartedAt 起算
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

/** 确保成长时钟已打点（首次对话后调用） */
export async function ensureGrowthStartedAt(now = Date.now()): Promise<number> {
  const raw = await settings.getSetting('companionGrowthStartedAt')
  const existing = Number(raw)
  if (Number.isFinite(existing) && existing > 0) return existing
  await settings.setSetting('companionGrowthStartedAt', String(now))
  return now
}

export async function getGrowthStartedAt(): Promise<number> {
  const raw = await settings.getSetting('companionGrowthStartedAt')
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export async function shouldReflectNow(
  roleId: string,
  opts?: { now?: number; minUserMessages?: number; force?: boolean },
): Promise<ReflectGateResult> {
  const now = opts?.now ?? Date.now()
  const minMsgs = opts?.minUserMessages ?? MIN_USER_MESSAGES
  const growthStartedAt = await getGrowthStartedAt()
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

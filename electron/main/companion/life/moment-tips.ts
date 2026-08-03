/**
 * 新 Moment 应用内轻提示（M31-G1 / M31-G2）
 *
 * 背景：L0 静默推进用户无感；需要可选 L2「有新动态」气泡，且必须可静音。
 * 意图：tick 新发布后广播一句 toast；受静音、勿扰时段、日预算与最短间隔约束。
 * 约束：不发系统桌面通知；不编造假动态；内容必须来自已投影 Moment；失败静默。
 */

import { BrowserWindow } from 'electron'
import * as settings from '../../storage/settings-store'
import * as identity from '../identity/loader'
import { toLocalDateString } from './dates'
import { listMomentsForRole } from './moments'

export const MOMENT_TIPS_MUTED_KEY = 'companionMomentTipsMuted' as const
export const MOMENT_TIPS_LAST_AT_KEY = 'companionMomentTipsLastAt' as const
export const MOMENT_TIPS_QUIET_START_KEY = 'companionMomentTipsQuietStart' as const
export const MOMENT_TIPS_QUIET_END_KEY = 'companionMomentTipsQuietEnd' as const
export const MOMENT_TIPS_MAX_PER_DAY_KEY = 'companionMomentTipsMaxPerDay' as const
export const MOMENT_TIPS_DAY_STATS_KEY = 'companionMomentTipsDayStats' as const

/** 最短提示间隔，防通知风暴 */
export const MOMENT_TIP_MIN_INTERVAL_MS = 15 * 60 * 1000
/** 默认勿扰：本地 22:00–08:00（可跨午夜） */
export const DEFAULT_QUIET_START_HOUR = 22
export const DEFAULT_QUIET_END_HOUR = 8
/** 默认每日最多 3 条生活轻提示（0 = 不限） */
export const DEFAULT_MAX_TIPS_PER_DAY = 3

export type MomentTipDenyReason =
  | 'muted'
  | 'no-publish'
  | 'cooldown'
  | 'no-moment'
  | 'quiet-hours'
  | 'daily-budget'

export interface MomentTipDecision {
  allow: boolean
  reason: 'ok' | MomentTipDenyReason
}

export interface DayTipStats {
  day: string
  count: number
}

/**
 * 本地小时是否落在勿扰窗内。
 * start===end → 关闭勿扰；start<end → 同日窗 [start,end)；start>end → 跨午夜。
 */
export function isInQuietHours(
  localHour: number,
  quietStartHour: number,
  quietEndHour: number,
): boolean {
  const h = ((localHour % 24) + 24) % 24
  const start = clampHour(quietStartHour)
  const end = clampHour(quietEndHour)
  if (start === end) return false
  if (start < end) return h >= start && h < end
  return h >= start || h < end
}

export function clampHour(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(23, Math.max(0, Math.floor(n)))
}

export function parseHourSetting(raw: string, fallback: number): number {
  const t = raw.trim()
  if (!t) return clampHour(fallback)
  const n = Number(t)
  if (!Number.isFinite(n)) return clampHour(fallback)
  return clampHour(n)
}

export function parseMaxPerDay(raw: string, fallback = DEFAULT_MAX_TIPS_PER_DAY): number {
  const t = raw.trim()
  if (!t) return fallback
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

export function parseDayTipStats(raw: string): DayTipStats | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const day = String((parsed as { day?: unknown }).day || '')
    const count = Number((parsed as { count?: unknown }).count)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(count) || count < 0) return null
    return { day, count: Math.floor(count) }
  } catch {
    return null
  }
}

export function tipsSentToday(stats: DayTipStats | null, today: string): number {
  if (!stats || stats.day !== today) return 0
  return stats.count
}

/**
 * 纯函数：是否应发轻提示（含勿扰 / 日预算）。
 */
export function decideMomentTip(input: {
  muted: boolean
  published: number
  lastAt: number
  now: number
  hasMoment: boolean
  minIntervalMs?: number
  localHour?: number
  quietStartHour?: number
  quietEndHour?: number
  tipsSentToday?: number
  maxPerDay?: number
}): MomentTipDecision {
  if (input.muted) return { allow: false, reason: 'muted' }
  if (input.published <= 0) return { allow: false, reason: 'no-publish' }
  if (!input.hasMoment) return { allow: false, reason: 'no-moment' }

  const hour = input.localHour ?? new Date(input.now).getHours()
  const qStart = input.quietStartHour ?? DEFAULT_QUIET_START_HOUR
  const qEnd = input.quietEndHour ?? DEFAULT_QUIET_END_HOUR
  if (isInQuietHours(hour, qStart, qEnd)) {
    return { allow: false, reason: 'quiet-hours' }
  }

  const maxPerDay = input.maxPerDay ?? DEFAULT_MAX_TIPS_PER_DAY
  const sent = input.tipsSentToday ?? 0
  if (maxPerDay > 0 && sent >= maxPerDay) {
    return { allow: false, reason: 'daily-budget' }
  }

  const gap = input.minIntervalMs ?? MOMENT_TIP_MIN_INTERVAL_MS
  if (input.lastAt > 0 && input.now - input.lastAt < gap) {
    return { allow: false, reason: 'cooldown' }
  }
  return { allow: true, reason: 'ok' }
}

export function formatMomentTipToast(input: {
  roleName: string
  preview: string
  published: number
}): string {
  const name = input.roleName.trim() || '伙伴'
  const preview = input.preview.replace(/\s+/g, ' ').trim().slice(0, 40)
  if (input.published === 1 && preview) {
    return `${name}有新动态：${preview}`
  }
  if (preview) {
    return `${name}有 ${input.published} 条新动态，最近：${preview}`
  }
  return `${name}有新动态，可打开朋友圈看看`
}

function broadcast(payload: {
  roleId: string
  toast: string
  published: number
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('companion:moment-tip', payload)
  }
}

async function loadQuietAndBudget(now: number): Promise<{
  quietStart: number
  quietEnd: number
  maxPerDay: number
  sentToday: number
  today: string
}> {
  const today = toLocalDateString(now)
  const quietStart = parseHourSetting(
    await settings.getSetting(MOMENT_TIPS_QUIET_START_KEY),
    DEFAULT_QUIET_START_HOUR,
  )
  const quietEnd = parseHourSetting(
    await settings.getSetting(MOMENT_TIPS_QUIET_END_KEY),
    DEFAULT_QUIET_END_HOUR,
  )
  const maxPerDay = parseMaxPerDay(await settings.getSetting(MOMENT_TIPS_MAX_PER_DAY_KEY))
  const stats = parseDayTipStats(await settings.getSetting(MOMENT_TIPS_DAY_STATS_KEY))
  return {
    quietStart,
    quietEnd,
    maxPerDay,
    sentToday: tipsSentToday(stats, today),
    today,
  }
}

async function recordTipSent(today: string, previousSent: number): Promise<void> {
  const next: DayTipStats = { day: today, count: previousSent + 1 }
  await settings.setSetting(MOMENT_TIPS_DAY_STATS_KEY, JSON.stringify(next))
}

/**
 * tick 发布后调用：条件满足则广播应用内轻提示。
 * 返回是否已广播。
 */
export async function maybeNotifyNewMoments(
  roleId: string,
  published: number,
  now = Date.now(),
): Promise<{ notified: boolean; reason: MomentTipDecision['reason'] }> {
  const id = roleId.trim()
  if (!id || published <= 0) {
    return { notified: false, reason: 'no-publish' }
  }

  const mutedRaw = (await settings.getSetting(MOMENT_TIPS_MUTED_KEY)).trim().toLowerCase()
  const muted = mutedRaw === '1' || mutedRaw === 'true' || mutedRaw === 'yes'
  const lastAt = Number(await settings.getSetting(MOMENT_TIPS_LAST_AT_KEY)) || 0
  const budget = await loadQuietAndBudget(now)

  const moments = await listMomentsForRole(id, { limit: 1 })
  const latest = moments[0]
  const decision = decideMomentTip({
    muted,
    published,
    lastAt,
    now,
    hasMoment: Boolean(latest?.text?.trim()),
    localHour: new Date(now).getHours(),
    quietStartHour: budget.quietStart,
    quietEndHour: budget.quietEnd,
    tipsSentToday: budget.sentToday,
    maxPerDay: budget.maxPerDay,
  })
  if (!decision.allow) {
    return { notified: false, reason: decision.reason }
  }

  let roleName = id
  try {
    const universeId = (await settings.getSetting('universeId')) || 'default'
    roleName = identity.loadRolePack(id, universeId).name
  } catch {
    /* id 即可 */
  }

  const toast = formatMomentTipToast({
    roleName,
    preview: latest!.text,
    published,
  })
  await settings.setSetting(MOMENT_TIPS_LAST_AT_KEY, String(now))
  await recordTipSent(budget.today, budget.sentToday)
  broadcast({ roleId: id, toast, published })
  return { notified: true, reason: 'ok' }
}

export async function isMomentTipsMuted(): Promise<boolean> {
  const raw = (await settings.getSetting(MOMENT_TIPS_MUTED_KEY)).trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export async function setMomentTipsMuted(muted: boolean): Promise<void> {
  await settings.setSetting(MOMENT_TIPS_MUTED_KEY, muted ? 'true' : 'false')
}

export const __test = {
  decideMomentTip,
  formatMomentTipToast,
  isInQuietHours,
  parseHourSetting,
  parseMaxPerDay,
  parseDayTipStats,
  tipsSentToday,
}

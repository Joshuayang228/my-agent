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

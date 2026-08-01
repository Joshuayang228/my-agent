/**
 * 本地日历日工具（LifeEngine）
 *
 * 背景：Catch-up / ensure 按「本地日历日」切边界；单测需注入固定 now。
 * 意图：YYYY-MM-DD 解析、区间枚举、本地日零点时间戳。
 * 约束：不使用 UTC 日切；minute 级用本地时区。
 */

/** 将 Date/ms 格式化为本地 YYYY-MM-DD */
export function toLocalDateString(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 本地日 00:00:00.000 的 epoch ms；非法 date 抛错 */
export function localMidnightMs(dateStr: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) throw new Error(`Invalid date: ${dateStr}`)
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const day = Number(m[3])
  const d = new Date(y, mo, day, 0, 0, 0, 0)
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) {
    throw new Error(`Invalid calendar date: ${dateStr}`)
  }
  return d.getTime()
}

/** 本地日某时某分的 epoch ms */
export function localDateTimeMs(dateStr: string, hour: number, minute = 0): number {
  const base = localMidnightMs(dateStr)
  return base + hour * 3_600_000 + minute * 60_000
}

/**
 * 闭区间 [fromDate, toDate] 的本地日历日列表（含两端）。
 * from > to 时返回空数组。
 */
export function eachLocalDateInclusive(fromDate: string, toDate: string): string[] {
  let cur = localMidnightMs(fromDate)
  const end = localMidnightMs(toDate)
  if (cur > end) return []
  const out: string[] = []
  while (cur <= end) {
    out.push(toLocalDateString(cur))
    // 推进约 26h 再取本地日，避免 DST 边界漏日/重日；用日期部件 +1 更稳
    const d = new Date(cur)
    d.setDate(d.getDate() + 1)
    cur = d.getTime()
  }
  return out
}

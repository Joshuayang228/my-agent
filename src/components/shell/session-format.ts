/**
 * 会话时间戳：对齐 Alice「06/20(六) 15:51」风格（大气侧栏用）。
 */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

export function formatSessionStamp(ts: number, now = Date.now()): string {
  if (!Number.isFinite(ts) || ts <= 0) return ''
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const week = WEEKDAYS[d.getDay()]
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startMs = startOfToday.getTime()
  if (ts >= startMs) return `今天 ${time}`
  if (ts >= startMs - 86400000) return `昨天 ${time}`
  return `${mm}/${dd}(${week}) ${time}`
}

/** 消息摘要一行：去换行、截断 */
export function formatSessionPreview(text: string, max = 36): string {
  const one = text.replace(/\s+/g, ' ').trim()
  if (!one) return ''
  return one.length > max ? `${one.slice(0, max)}…` : one
}

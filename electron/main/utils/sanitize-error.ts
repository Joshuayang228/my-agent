/**
 * 错误信息脱敏 — 移除 API Key、URL 等敏感信息后再传给渲染进程
 */

const API_KEY_PATTERN = /\b(sk-|Bearer\s+)[A-Za-z0-9_-]{8,}/g
const URL_PATTERN = /https?:\/\/[^\s"']+/g

export function sanitizeError(message: string): string {
  return message
    .replace(API_KEY_PATTERN, (_match, prefix) => `${prefix}***`)
    .replace(URL_PATTERN, (url) => {
      try {
        const u = new URL(url)
        return `${u.protocol}//${u.hostname}/***`
      } catch {
        return '***'
      }
    })
}

export function sanitizeErrorFromCatch(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return sanitizeError(raw)
}

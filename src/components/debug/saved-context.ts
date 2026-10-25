export interface SavedMessage { role?: unknown; content?: unknown; contentLength?: unknown; [key: string]: unknown }
export function savedMessages(value: unknown): SavedMessage[] | null {
  if (!Array.isArray(value)) return null
  return value.map(entry => entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as SavedMessage : { role: 'unknown', raw: entry })
}

export function messageScope(message: SavedMessage): string {
  if (message.content === '（正文未持久化）') return typeof message.contentLength === 'number' && Number.isSafeInteger(message.contentLength) && message.contentLength >= 0
    ? `正文未持久化 · 保存长度 ${message.contentLength} 字符` : '正文未持久化 · 长度未记录'
  return message.content === undefined ? '未返回正文字段' : '包含已保存内容；仅代表当前读取范围'
}

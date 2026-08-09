export interface DebugRequestMessage {
  role: string
  content: string
  id?: string
  toolName?: string
}

export function formatDebugValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/**
 * 将持久化请求中的 provider-neutral message 规范为 Debug UI 可读形状。
 *
 * 背景：LLM Debug 正文按 unknown 存储，以兼容 OpenAI / Anthropic / Gemini 的内容形态。
 * 设计意图：只做展示层归一化，不修改或重新解释生产请求；复杂 content 保留完整 JSON。
 * 关键约束：异常或非数组输入返回空列表，不能让坏日志拖垮整个 Debug 页面。
 */
export function normalizeDebugMessages(value: unknown): DebugRequestMessage[] {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      return { role: 'unknown', content: formatDebugValue(item), id: String(index) }
    }
    const raw = item as Record<string, unknown>
    return {
      role: typeof raw.role === 'string' ? raw.role : 'unknown',
      content: formatDebugValue(raw.content),
      ...(typeof raw.id === 'string' ? { id: raw.id } : { id: String(index) }),
      ...(typeof raw.toolName === 'string' ? { toolName: raw.toolName } : {}),
    }
  })
}

export function formatDebugBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

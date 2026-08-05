/**
 * 对话内 debugMode 纯函数（M32-G7）。
 *
 * 背景：全页 Debug/Playground 与聊天叠加是两码事；叠加层开关与展示计算需可单测。
 * 调用方：App 聊天底栏、ConversationDebugOverlay、settings 读写。
 */

export function parseConversationDebugMode(value: string | undefined | null): boolean {
  return value === 'true' || value === '1'
}

/** 上下文占用比；maxTokens≤0 时返回 0（无预算则不画危险色）。 */
export function tokenUsageRatio(
  promptTokens: number,
  completionTokens: number,
  maxTokens: number,
): number {
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) return 0
  const used = Math.max(0, promptTokens) + Math.max(0, completionTokens)
  return Math.min(1, used / maxTokens)
}

export function formatTokenK(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n < 1000) return String(Math.round(n))
  return `${(n / 1000).toFixed(1)}k`
}

/** 事件条优先展示的类型（其余仍进完整 log，默认折叠时只秀这些）。 */
export const DEBUG_EVENT_PRIORITY = new Set([
  'tool_start',
  'tool_end',
  'usage',
  'compact',
  'error',
  'execution_mode_changed',
  'memory_citations',
])

export function filterDebugEvents<T extends { type: string }>(
  events: T[],
  limit = 40,
): T[] {
  const prioritized = events.filter((e) => DEBUG_EVENT_PRIORITY.has(e.type))
  const source = prioritized.length > 0 ? prioritized : events
  return source.slice(-limit)
}

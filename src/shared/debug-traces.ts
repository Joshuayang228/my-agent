/** 真实 tracer 有界快照的传输形状；links 为因果关联，不代表父子耗时。 */
export interface DebugTraceSpan {
  id: string; name: string; type: string; caller: string; parentId?: string; links?: string[]
  startTime?: number; endTime?: number; duration?: number; status: string; attributes: Record<string, unknown>; error?: string
}
export interface DebugTracesSnapshot {
  spans: DebugTraceSpan[]
  callerStats: Record<string, { count: number; totalMs: number; avgMs: number; totalInputTokens: number; totalOutputTokens: number }>
  tokenLanes?: { foreground: { inputTokens: number; outputTokens: number }; background: { inputTokens: number; outputTokens: number } }
  dailyTokenUsage?: number
}

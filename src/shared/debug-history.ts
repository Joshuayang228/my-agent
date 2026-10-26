/** 诊断历史只保存结构化元数据；当前快照、历史范围与正文分别解释。 */
export const DIAGNOSTIC_HISTORY_LIMITS = {
  retentionMs: 7 * 24 * 60 * 60 * 1000,
  maxRecords: 20_000,
  maxRecordBytes: 4096,
  maxQueued: 512,
  batchSize: 64,
  pageSize: 50,
  maxPageSize: 100,
} as const

export type DiagnosticHistoryKind = 'span' | 'event'
export type DiagnosticHistoryStatus = 'running' | 'ok' | 'error' | 'interrupted'
export type DiagnosticHistoryPhase = 'started' | 'updated' | 'ended'
export type DiagnosticSpanType = 'interaction' | 'llm_request' | 'tool' | 'tool_blocked' | 'tool_execution' | 'compress' | 'subagent'
export type DiagnosticCaller = 'main' | 'compact' | 'memory' | 'title' | 'subagent' | 'tool' | 'profile' | 'system'

export interface DiagnosticHistoryRecord {
  id: string
  processRunId: string
  kind: DiagnosticHistoryKind
  occurredAt: number
  updatedAt: number
  status: DiagnosticHistoryStatus
  phase: DiagnosticHistoryPhase
  spanType: DiagnosticSpanType
  caller: DiagnosticCaller
  spanId: string
  roleId?: string
  sessionId?: string
  operation?: 'life_tick' | 'life_projection'
  sourceEventId?: string
  momentId?: string
  parentId?: string
  links?: string[]
  durationMs?: number
  inputTokens?: number
  outputTokens?: number
  omittedFields: number
}

export interface DiagnosticHistoryQuery {
  kind?: DiagnosticHistoryKind
  roleId?: string
  sessionId?: string
  processRunId?: string
  spanId?: string
  recordId?: string
  from?: number
  to?: number
  limit?: number
  cursor?: string
}

export interface DiagnosticHistoryResult {
  state: 'ready' | 'unavailable'
  records: DiagnosticHistoryRecord[]
  hasMore: boolean
  nextCursor?: string
  generatedAt: number
  coverage: {
    recordingSince: number | null
    retainedFrom: number
    processRunId: string | null
    pending: number
    dropped: number
    pruned: number
    writeFailures: number
    invalidStored: number
    diskPending: boolean
  }
  boundary: string
}

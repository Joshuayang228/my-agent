/** 生产问候约束的单一常量源，目录从此投影，不复制策略数值。 */
export const PROACTIVE_DELIVERY_POLICY = {
  enabledSettingKey: 'companionProactiveGreetingEnabled',
  momentMaxAgeMs: 24 * 60 * 60 * 1000,
  receiptTimeoutMs: 30_000,
  maxPending: 512,
  maxRecipients: 16,
} as const

export type ProactiveEvidenceStatus = 'skipped' | 'reserved' | 'dispatched' | 'presented' | 'failed' | 'unconfirmed'
export type ProactiveEvidenceReason = 'ok' | 'disabled' | 'muted' | 'quiet-hours' | 'already-today' | 'no-fresh-moment' | 'no-window' | 'send-failed' | 'receipt-timeout' | 'process-restarted' | 'role-inactive' | 'reservation-save-failed'
export interface ProactiveGreetingPayload {
  attemptId: string
  receiptToken: string
  roleId: string
  toast: string
  momentId: string
}
export interface ProactiveGreetingReceipt { attemptId: string; receiptToken: string }
export interface ProactiveEvidenceRecord {
  id: string; processRunId: string; roleId: string; localDay: string
  status: ProactiveEvidenceStatus; reason: ProactiveEvidenceReason
  occurredAt: number; updatedAt: number; checks: number; momentId?: string
  recipientCount: number; sentCount: number; failedCount: number
}
export interface ProactiveEvidenceQuery { roleId: string; date?: string; limit?: number; cursor?: string; recordId?: string }
export interface ProactiveEvidenceResult {
  state: 'ready' | 'unavailable'; records: ProactiveEvidenceRecord[]; hasMore: boolean; nextCursor?: string
  boundary: string
}

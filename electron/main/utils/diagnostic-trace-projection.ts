import type { DiagnosticHistoryPhase, DiagnosticHistoryRecord } from '../../../src/shared/debug-history'
import type { TraceSpan } from './tracer'
import { DIAGNOSTIC_PROCESS_RUN_ID, publishDiagnosticHistory } from './diagnostic-history'

function identifier(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,240}$/.test(value) && !/(?:sk-|gh[pousr]_|github_pat_|xox[baprs]-)/i.test(value) ? value : undefined
}
function metric(value: unknown): number | undefined { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined }

/** 背景：Tracer attributes / name / error 可含正文，历史只允许元数据白名单。
 * 意图：从真实生命周期投影，同一 Span 沿用 ID，start/end 另存阶段事件。
 * 约束：未知身份不补当前人物；名字、错误正文和任意 attributes 永不复制入历史。
 */
export function publishTraceHistory(span: TraceSpan, phase: DiagnosticHistoryPhase): void {
  const base: DiagnosticHistoryRecord = {
    id: `${DIAGNOSTIC_PROCESS_RUN_ID}:span:${span.id}`, processRunId: DIAGNOSTIC_PROCESS_RUN_ID,
    kind: 'span', occurredAt: span.startTime, updatedAt: span.endTime ?? Date.now(), status: span.status,
    phase, spanType: span.type, caller: span.caller, spanId: span.id,
    omittedFields: Object.keys(span.attributes).filter(key => !['roleId', 'sessionId', 'sourceEventId', 'momentId', 'operation', 'inputTokens', 'outputTokens'].includes(key)).length + 1 + (span.error ? 1 : 0),
  }
  for (const field of ['roleId', 'sessionId', 'sourceEventId', 'momentId'] as const) {
    const value = identifier(span.attributes[field])
    if (value) base[field] = value
    else if (span.attributes[field] !== undefined) base.omittedFields += 1
  }
  if (span.attributes.operation === 'life_tick' || span.attributes.operation === 'life_projection') base.operation = span.attributes.operation
  else if (span.attributes.operation !== undefined) base.omittedFields += 1
  const parent = identifier(span.parentId)
  if (parent) base.parentId = parent
  else if (span.parentId !== undefined) base.omittedFields += 1
  if (span.links?.length) {
    if (span.links.length <= 16 && span.links.every(link => identifier(link))) base.links = [...span.links]
    else base.omittedFields += 1
  }
  for (const [field, raw] of [['durationMs', span.duration], ['inputTokens', span.attributes.inputTokens], ['outputTokens', span.attributes.outputTokens]] as const) {
    const value = metric(raw)
    if (value !== undefined) base[field] = value
    else if (raw !== undefined) base.omittedFields += 1
  }
  publishDiagnosticHistory(base)
  if (phase !== 'updated') publishDiagnosticHistory({ ...base, kind: 'event', id: `${DIAGNOSTIC_PROCESS_RUN_ID}:event:${span.id}:${phase}`, occurredAt: base.updatedAt })
}

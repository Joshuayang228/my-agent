import { randomUUID } from 'node:crypto'
import type { DiagnosticHistoryRecord } from '../../../src/shared/debug-history'
import { createLogger } from './logger'

export const DIAGNOSTIC_PROCESS_RUN_ID = randomUUID()
const log = createLogger('DiagnosticHistory')
export type DiagnosticHistorySink = (record: DiagnosticHistoryRecord) => void
let sink: DiagnosticHistorySink | undefined
let sinkFailures = 0

export function setDiagnosticHistorySink(next?: DiagnosticHistorySink): void { sink = next }
export function getDiagnosticSinkFailures(): number { return sinkFailures }

/** 背景：生产追踪不能反向依赖数据库，也不能因诊断失败中断模型 / 工具。
 * 意图：启动装配同步 sink；有界排队由存储负责，不创建悬空 Promise。
 * 约束：只接收白名单投影；sink 故障计数并记录，不携带原始异常正文。
 */
export function publishDiagnosticHistory(record: DiagnosticHistoryRecord): void {
  if (!sink) return
  try { sink(record) } catch {
    sinkFailures += 1
    log.warn('Diagnostic history sink failed', { count: sinkFailures })
  }
}

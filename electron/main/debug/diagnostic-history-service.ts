import type { Database } from 'sql.js'
import type { DiagnosticHistoryResult } from '../../../src/shared/debug-history'
import { DIAGNOSTIC_HISTORY_LIMITS } from '../../../src/shared/debug-history'
import { DiagnosticHistoryStore, validateDiagnosticHistoryQuery } from '../storage/diagnostic-history-store'
import { DIAGNOSTIC_PROCESS_RUN_ID, setDiagnosticHistorySink } from '../utils/diagnostic-history'
import { createLogger } from '../utils/logger'

const log = createLogger('DiagnosticHistoryService')
let store: DiagnosticHistoryStore | undefined

/** 背景：观察节点先于界面存在，存储必须由启动装配，不能由 Debug 读取创建。
 * 意图：复用正式 DB 和 persist；故障保留 unavailable，不阻断 Agent 启动。
 * 约束：只在数据库迁移完成后调用；停止先摘 sink，再排空队列。
 */
export function startDiagnosticHistory(db: Database, persist: () => void): void {
  if (store) return
  try {
    const next = new DiagnosticHistoryStore(db, DIAGNOSTIC_PROCESS_RUN_ID, persist)
    next.recover()
    store = next
    setDiagnosticHistorySink(record => next.record(record))
  } catch { log.warn('Diagnostic history startup unavailable') }
}

export function stopDiagnosticHistory(): void {
  setDiagnosticHistorySink()
  store?.close()
  store = undefined
}

export function queryDiagnosticHistory(input?: unknown): DiagnosticHistoryResult {
  validateDiagnosticHistoryQuery(input)
  if (store) return store.query(input)
  return {
    state: 'unavailable', records: [], hasMore: false, generatedAt: Date.now(),
    coverage: { recordingSince: null, retainedFrom: Date.now() - DIAGNOSTIC_HISTORY_LIMITS.retentionMs, processRunId: null, pending: 0, dropped: 0, pruned: 0, writeFailures: 0, invalidStored: 0, diskPending: false },
    boundary: '历史记录服务尚未由应用启动流程打开；读取不会建表、初始化或修复数据。',
  }
}

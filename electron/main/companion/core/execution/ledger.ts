import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../../storage/database'
import { ensureCompanionCoreSchema } from '../schema'
import type { CompanionExecutionRun, CompanionExecutionStatus } from '../types'

const STALE_EXECUTION_AFTER_MS = 10 * 60 * 1000

/**
 * 把进程崩溃遗留的运行中账本恢复为可重试状态。
 *
 * 背景：命令 handler 可能已经提交领域事实，但进程在完成账本前崩溃，遗留的 running 记录会阻塞同一幂等命令永久重试。
 * 设计意图：只回收超过租约窗口的 running 记录，并把中断原因写入账本，保留最近运行避免误伤仍在等待外部模型的命令。
 * 关键约束：恢复必须在读取幂等记录前完成，状态只能转为 retryable，不能伪造 completed；调用方仍需依靠幂等键避免领域副作用重复提交。
 */
export async function recoverStaleCompanionExecutions(input?: { now?: number; staleAfterMs?: number }): Promise<number> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const now = input?.now ?? Date.now()
  const staleAfterMs = input?.staleAfterMs ?? STALE_EXECUTION_AFTER_MS
  const cutoff = now - Math.max(1, staleAfterMs)
  const rows = db.exec('SELECT id FROM companion_execution_runs WHERE status = ? AND started_at < ?', ['running', cutoff])[0]?.values ?? []
  for (const row of rows) {
    db.run(`UPDATE companion_execution_runs
      SET status = ?, error_code = ?, error_message = ?, completed_at = ?
      WHERE id = ? AND status = ?`, ['retryable', 'EXECUTION_INTERRUPTED', '进程中断，允许重新执行。', now, String(row[0]), 'running'])
  }
  if (rows.length > 0) persist()
  return rows.length
}

export async function startCompanionExecution(input: {
  roleId: string
  commandId?: string | null
  idempotencyKey?: string | null
  eventId?: string | null
  actionType: string
  attempt?: number
}): Promise<CompanionExecutionRun> {
  await ensureCompanionCoreSchema()
  await recoverStaleCompanionExecutions()
  const db = await getDatabase()
  const existing = input.idempotencyKey
    ? db.exec(`SELECT id, role_id, command_id, idempotency_key, event_id, action_type, status, attempt, error_code, error_message, result_json, started_at, completed_at
      FROM companion_execution_runs WHERE role_id = ? AND action_type = ? AND idempotency_key = ? LIMIT 1`, [input.roleId, input.actionType, input.idempotencyKey])[0]?.values[0]
    : undefined
  if (existing) {
    const run = rowToExecution(existing)
    if (run.status !== 'retryable') return run
    // 失败重试必须先同步切回 running 并更换 commandId，后续同键请求才能看到当前所有者。
    const restarted = { ...run, commandId: input.commandId ?? null, status: 'running' as const, attempt: run.attempt + 1, startedAt: Date.now(), completedAt: null, errorCode: null, errorMessage: null, result: undefined }
    db.run(`UPDATE companion_execution_runs SET command_id = ?, status = 'running', attempt = ?, started_at = ?, completed_at = NULL, error_code = NULL, error_message = NULL, result_json = NULL WHERE id = ? AND status = 'retryable'`, [restarted.commandId, restarted.attempt, restarted.startedAt, run.id])
    persist()
    return restarted
  }
  const run: CompanionExecutionRun = {
    id: randomUUID(),
    roleId: input.roleId,
    commandId: input.commandId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    eventId: input.eventId ?? null,
    actionType: input.actionType,
    status: 'running',
    attempt: input.attempt ?? 1,
    errorCode: null,
    errorMessage: null,
    result: undefined,
    startedAt: Date.now(),
    completedAt: null,
  }
  db.run(`INSERT INTO companion_execution_runs
    (id, role_id, command_id, idempotency_key, event_id, action_type, status, attempt, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [run.id, run.roleId, run.commandId, run.idempotencyKey, run.eventId, run.actionType, run.status, run.attempt, run.startedAt])
  persist()
  return run
}

export async function finishCompanionExecution(input: {
  executionId: string
  commandId?: string
  status: Extract<CompanionExecutionStatus, 'completed' | 'failed' | 'retryable' | 'cancelled'>
  errorCode?: string | null
  errorMessage?: string | null
  result?: unknown
}): Promise<void> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  db.run(`UPDATE companion_execution_runs
    SET status = ?, error_code = ?, error_message = ?, result_json = ?, completed_at = ?
    WHERE id = ?${input.commandId ? ' AND command_id = ? AND status = \'running\'' : ''}`, [input.status, input.errorCode ?? null, input.errorMessage?.slice(0, 500) ?? null, input.result === undefined ? null : JSON.stringify(input.result), Date.now(), input.executionId, ...(input.commandId ? [input.commandId] : [])])
  persist()
}

function rowToExecution(row: unknown[]): CompanionExecutionRun {
  return {
    id: String(row[0]),
    roleId: String(row[1]),
    commandId: row[2] == null ? null : String(row[2]),
    idempotencyKey: row[3] == null ? null : String(row[3]),
    eventId: row[4] == null ? null : String(row[4]),
    actionType: String(row[5]),
    status: String(row[6]) as CompanionExecutionStatus,
    attempt: Number(row[7]) || 1,
    errorCode: row[8] == null ? null : String(row[8]),
    errorMessage: row[9] == null ? null : String(row[9]),
    result: row[10] == null ? undefined : JSON.parse(String(row[10])),
    startedAt: Number(row[11]) || 0,
    completedAt: row[12] == null ? null : Number(row[12]),
  }
}

export async function linkCompanionExecutionEvent(input: { executionId: string; eventId: string }): Promise<void> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  db.run('UPDATE companion_execution_runs SET event_id = ? WHERE id = ?', [input.eventId, input.executionId])
  persist()
}

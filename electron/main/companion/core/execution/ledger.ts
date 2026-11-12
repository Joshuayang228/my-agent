import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../../storage/database'
import { ensureCompanionCoreSchema } from '../schema'
import type { CompanionExecutionRun, CompanionExecutionStatus } from '../types'

export async function startCompanionExecution(input: {
  roleId: string
  commandId?: string | null
  idempotencyKey?: string | null
  eventId?: string | null
  actionType: string
  attempt?: number
}): Promise<CompanionExecutionRun> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const existing = input.idempotencyKey
    ? db.exec(`SELECT id, role_id, command_id, idempotency_key, event_id, action_type, status, attempt, error_code, error_message, result_json, started_at, completed_at
      FROM companion_execution_runs WHERE role_id = ? AND action_type = ? AND idempotency_key = ? LIMIT 1`, [input.roleId, input.actionType, input.idempotencyKey])[0]?.values[0]
    : undefined
  if (existing) return rowToExecution(existing)
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
  status: Extract<CompanionExecutionStatus, 'completed' | 'failed' | 'retryable' | 'cancelled'>
  errorCode?: string | null
  errorMessage?: string | null
  result?: unknown
}): Promise<void> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  db.run(`UPDATE companion_execution_runs
    SET status = ?, error_code = ?, error_message = ?, result_json = ?, completed_at = ?
    WHERE id = ?`, [input.status, input.errorCode ?? null, input.errorMessage?.slice(0, 500) ?? null, input.result === undefined ? null : JSON.stringify(input.result), Date.now(), input.executionId])
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

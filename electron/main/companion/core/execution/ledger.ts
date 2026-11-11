import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../../storage/database'
import { ensureCompanionCoreSchema } from '../schema'
import type { CompanionExecutionRun, CompanionExecutionStatus } from '../types'

export async function startCompanionExecution(input: {
  roleId: string
  commandId?: string | null
  eventId?: string | null
  actionType: string
  attempt?: number
}): Promise<CompanionExecutionRun> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const run: CompanionExecutionRun = {
    id: randomUUID(),
    roleId: input.roleId,
    commandId: input.commandId ?? null,
    eventId: input.eventId ?? null,
    actionType: input.actionType,
    status: 'running',
    attempt: input.attempt ?? 1,
    errorCode: null,
    errorMessage: null,
    startedAt: Date.now(),
    completedAt: null,
  }
  db.run(`INSERT INTO companion_execution_runs
    (id, role_id, command_id, event_id, action_type, status, attempt, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [run.id, run.roleId, run.commandId, run.eventId, run.actionType, run.status, run.attempt, run.startedAt])
  persist()
  return run
}

export async function finishCompanionExecution(input: {
  executionId: string
  status: Extract<CompanionExecutionStatus, 'completed' | 'failed' | 'retryable' | 'cancelled'>
  errorCode?: string | null
  errorMessage?: string | null
}): Promise<void> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  db.run(`UPDATE companion_execution_runs
    SET status = ?, error_code = ?, error_message = ?, completed_at = ?
    WHERE id = ?`, [input.status, input.errorCode ?? null, input.errorMessage?.slice(0, 500) ?? null, Date.now(), input.executionId])
  persist()
}

export async function linkCompanionExecutionEvent(input: { executionId: string; eventId: string }): Promise<void> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  db.run('UPDATE companion_execution_runs SET event_id = ? WHERE id = ?', [input.eventId, input.executionId])
  persist()
}

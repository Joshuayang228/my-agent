import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../../storage/database'
import { ensureCompanionCoreSchema } from '../schema'
import type { CompanionDomainEvent } from '../types'
import { contentIntegrityError } from '../../../../../src/shared/content-integrity'
import { commandExecutionScope } from '../commands/execution-scope'
import { assertCompanionExecutionOwner } from '../execution/ledger'

const EVENT_COLUMNS = 'id, role_id, universe_id, type, source_type, source_id, causation_id, correlation_id, idempotency_key, occurred_at, payload_json, schema_version, execution_id'

export async function appendCompanionDomainEvent(input: Omit<CompanionDomainEvent, 'id' | 'executionId'>): Promise<CompanionDomainEvent> {
  const integrityError = contentIntegrityError(input)
  if (integrityError) throw new Error(integrityError)
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const command = commandExecutionScope.getStore()
  if (command) {
    if (command.roleId !== input.roleId) throw new Error('人物世界事件不属于当前命令。')
    await assertCompanionExecutionOwner(command.executionId, command.commandId)
  }
  const existing = db.exec(`SELECT ${EVENT_COLUMNS} FROM companion_domain_events WHERE role_id = ? AND idempotency_key = ?`, [input.roleId, input.idempotencyKey])[0]?.values[0]
  if (existing) return rowToEvent(existing)
  const event: CompanionDomainEvent = {
    ...input,
    id: randomUUID(),
    executionId: command?.executionId ?? null,
    ...(command && { correlationId: command.correlationId, causationId: command.commandId }),
  }
  db.run(`
    INSERT INTO companion_domain_events
      (${EVENT_COLUMNS})
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [event.id, event.roleId, event.universeId, event.type, event.sourceType, event.sourceId, event.causationId, event.correlationId, event.idempotencyKey, event.occurredAt, JSON.stringify(event.payload), event.schemaVersion, event.executionId ?? null])
  if (command) {
    db.run('UPDATE companion_execution_runs SET event_id = COALESCE(event_id, ?) WHERE id = ? AND command_id = ?', [event.id, command.executionId, command.commandId])
  }
  persist()
  return event
}

export async function getCompanionDomainEventById(id: string): Promise<CompanionDomainEvent | null> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const row = db.exec(`SELECT ${EVENT_COLUMNS} FROM companion_domain_events WHERE id = ?`, [id])[0]?.values[0]
  return row ? rowToEvent(row) : null
}

export async function listRecentCompanionDomainEvents(input: { roleId: string; universeId: string; type: string; since: number; until: number }): Promise<CompanionDomainEvent[]> {
  const db = await getDatabase()
  if (!db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'companion_domain_events'").length) return []
  const rows = db.exec(`SELECT ${EVENT_COLUMNS}
    FROM companion_domain_events WHERE role_id = ? AND universe_id = ? AND type = ? AND occurred_at >= ? AND occurred_at <= ?
    ORDER BY occurred_at DESC LIMIT 256`, [input.roleId, input.universeId, input.type, input.since, input.until])
  return (rows[0]?.values ?? []).map(rowToEvent)
}

function rowToEvent(row: unknown[]): CompanionDomainEvent {
  return {
    id: String(row[0]),
    roleId: String(row[1]),
    universeId: String(row[2]),
    type: String(row[3]),
    sourceType: String(row[4]),
    sourceId: row[5] == null ? null : String(row[5]),
    causationId: row[6] == null ? null : String(row[6]),
    correlationId: String(row[7]),
    idempotencyKey: String(row[8]),
    occurredAt: Number(row[9]) || 0,
    payload: JSON.parse(String(row[10])) as Record<string, unknown>,
    schemaVersion: Number(row[11]) || 1,
    executionId: row[12] == null ? null : String(row[12]),
  }
}

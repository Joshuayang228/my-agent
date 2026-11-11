import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../../storage/database'
import { ensureCompanionCoreSchema } from '../schema'
import type { CompanionDomainEvent } from '../types'

export async function appendCompanionDomainEvent(input: Omit<CompanionDomainEvent, 'id'>): Promise<CompanionDomainEvent> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const existing = db.exec('SELECT id, role_id, universe_id, type, source_type, source_id, causation_id, correlation_id, idempotency_key, occurred_at, payload_json, schema_version FROM companion_domain_events WHERE role_id = ? AND idempotency_key = ?', [input.roleId, input.idempotencyKey])[0]?.values[0]
  if (existing) return rowToEvent(existing)
  const event: CompanionDomainEvent = { ...input, id: randomUUID() }
  db.run(`
    INSERT INTO companion_domain_events
      (id, role_id, universe_id, type, source_type, source_id, causation_id, correlation_id, idempotency_key, occurred_at, payload_json, schema_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [event.id, event.roleId, event.universeId, event.type, event.sourceType, event.sourceId, event.causationId, event.correlationId, event.idempotencyKey, event.occurredAt, JSON.stringify(event.payload), event.schemaVersion])
  persist()
  return event
}

export async function getCompanionDomainEventById(id: string): Promise<CompanionDomainEvent | null> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const row = db.exec('SELECT id, role_id, universe_id, type, source_type, source_id, causation_id, correlation_id, idempotency_key, occurred_at, payload_json, schema_version FROM companion_domain_events WHERE id = ?', [id])[0]?.values[0]
  return row ? rowToEvent(row) : null
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
  }
}

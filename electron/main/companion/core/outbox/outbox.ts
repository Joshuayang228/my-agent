import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../../storage/database'
import { ensureCompanionCoreSchema } from '../schema'
import type { CompanionOutboxMessage } from '../types'

export async function enqueueCompanionOutbox(input: {
  roleId: string
  eventId?: string | null
  kind: string
  dedupeKey: string
  payload: Record<string, unknown>
}): Promise<CompanionOutboxMessage> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const existing = db.exec('SELECT id, role_id, event_id, kind, dedupe_key, payload_json, status, attempt, last_error, created_at, delivered_at FROM companion_outbox WHERE role_id = ? AND dedupe_key = ?', [input.roleId, input.dedupeKey])[0]?.values[0]
  if (existing) return rowToOutbox(existing)
  const message: CompanionOutboxMessage = {
    id: randomUUID(),
    roleId: input.roleId,
    eventId: input.eventId ?? null,
    kind: input.kind,
    dedupeKey: input.dedupeKey,
    payload: input.payload,
    status: 'pending',
    attempt: 0,
    lastError: null,
    createdAt: Date.now(),
    deliveredAt: null,
  }
  db.run(`INSERT INTO companion_outbox
    (id, role_id, event_id, kind, dedupe_key, payload_json, status, attempt, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [message.id, message.roleId, message.eventId, message.kind, message.dedupeKey, JSON.stringify(message.payload), message.status, message.attempt, message.createdAt])
  persist()
  return message
}

function rowToOutbox(row: unknown[]): CompanionOutboxMessage {
  return {
    id: String(row[0]),
    roleId: String(row[1]),
    eventId: row[2] == null ? null : String(row[2]),
    kind: String(row[3]),
    dedupeKey: String(row[4]),
    payload: JSON.parse(String(row[5])) as Record<string, unknown>,
    status: String(row[6]) as CompanionOutboxMessage['status'],
    attempt: Number(row[7]) || 0,
    lastError: row[8] == null ? null : String(row[8]),
    createdAt: Number(row[9]) || 0,
    deliveredAt: row[10] == null ? null : Number(row[10]),
  }
}

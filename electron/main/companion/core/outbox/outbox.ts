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
  const existing = db.exec('SELECT id, role_id, event_id, kind, dedupe_key, payload_json, status, attempt, last_error, claimed_at, lease_until, next_attempt_at, max_attempts, created_at, delivered_at FROM companion_outbox WHERE role_id = ? AND dedupe_key = ?', [input.roleId, input.dedupeKey])[0]?.values[0]
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
    claimedAt: null,
    leaseUntil: null,
    nextAttemptAt: null,
    maxAttempts: 8,
    createdAt: Date.now(),
    deliveredAt: null,
  }
  db.run(`INSERT INTO companion_outbox
    (id, role_id, event_id, kind, dedupe_key, payload_json, status, attempt, last_error, claimed_at, lease_until, next_attempt_at, max_attempts, created_at, delivered_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [message.id, message.roleId, message.eventId, message.kind, message.dedupeKey, JSON.stringify(message.payload), message.status, message.attempt, message.lastError, message.claimedAt, message.leaseUntil, message.nextAttemptAt, message.maxAttempts, message.createdAt, message.deliveredAt])
  persist()
  return message
}

export async function dispatchCompanionOutbox(input: {
  limit?: number
  kinds?: readonly string[]
  excludeKinds?: readonly string[]
  deliver: (message: CompanionOutboxMessage) => Promise<void>
}): Promise<number> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100))
  const kindFilter = input.kinds && input.kinds.length > 0
    ? ` AND kind IN (${input.kinds.map(() => '?').join(', ')})`
    : ''
  const excludeFilter = input.excludeKinds && input.excludeKinds.length > 0
    ? ` AND kind NOT IN (${input.excludeKinds.map(() => '?').join(', ')})`
    : ''
  const now = Date.now()
  /**
   * 回收达到重试上限的过期租约。
   *
   * 背景：投递进程可能在 processing 阶段崩溃，租约恢复本来会再次领取消息，但达到上限的消息不应继续占用恢复队列。
   * 设计意图：先把这类记录落为 failed 终态，再用同一查询领取仍有额度的消息，放弃让过期记录永久停留在 processing 的做法。
   * 关键约束：只有租约已过期且 attempt >= max_attempts 才能终止，正常失败仍由 next_attempt_at 控制退避；状态变化必须持久化。
   */
  db.run(`UPDATE companion_outbox
    SET status = 'failed', last_error = ?, claimed_at = NULL, lease_until = NULL, next_attempt_at = NULL
    WHERE status = 'processing' AND lease_until IS NOT NULL AND lease_until <= ? AND attempt >= max_attempts`, ['达到最大投递次数，停止自动重试。', now])
  const terminalizedCount = db.getRowsModified()
  const rows = db.exec(`SELECT id, role_id, event_id, kind, dedupe_key, payload_json, status, attempt, last_error, claimed_at, lease_until, next_attempt_at, max_attempts, created_at, delivered_at
    FROM companion_outbox WHERE ((status = 'pending' AND attempt < max_attempts) OR (status = 'failed' AND attempt < max_attempts AND (next_attempt_at IS NULL OR next_attempt_at <= ?)) OR (status = 'processing' AND attempt < max_attempts AND lease_until IS NOT NULL AND lease_until <= ?))${kindFilter}${excludeFilter} ORDER BY created_at ASC LIMIT ?`, [now, now, ...(input.kinds ?? []), ...(input.excludeKinds ?? []), limit])[0]?.values ?? []
  let delivered = 0
  for (const row of rows) {
    const message = rowToOutbox(row)
    const leaseUntil = now + 30_000
    db.run(`UPDATE companion_outbox SET status = 'processing', attempt = attempt + 1, claimed_at = ?, lease_until = ?, last_error = NULL WHERE id = ? AND ((status = 'pending') OR (status = 'failed' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)) OR (status = 'processing' AND lease_until IS NOT NULL AND lease_until <= ?))`, [now, leaseUntil, message.id, now, now])
    if (db.getRowsModified() !== 1) continue
    persist()
    try {
      await input.deliver({ ...message, status: 'processing', attempt: message.attempt + 1, lastError: null })
      db.run(`UPDATE companion_outbox SET status = 'delivered', delivered_at = ?, claimed_at = NULL, lease_until = NULL, next_attempt_at = NULL WHERE id = ?`, [Date.now(), message.id])
      delivered += 1
    } catch (error) {
      const nextAttemptAt = Date.now() + Math.min(15 * 60_000, 1_000 * (2 ** Math.min(message.attempt, 8)))
      db.run(`UPDATE companion_outbox SET status = 'failed', last_error = ?, claimed_at = NULL, lease_until = NULL, next_attempt_at = ? WHERE id = ?`, [error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500), nextAttemptAt, message.id])
    }
    persist()
  }
  if (terminalizedCount > 0 || rows.length > 0) persist()
  return delivered
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
    claimedAt: row[9] == null ? null : Number(row[9]),
    leaseUntil: row[10] == null ? null : Number(row[10]),
    nextAttemptAt: row[11] == null ? null : Number(row[11]),
    maxAttempts: Number(row[12]) || 8,
    createdAt: Number(row[13]) || 0,
    deliveredAt: row[14] == null ? null : Number(row[14]),
  }
}

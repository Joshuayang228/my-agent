import type { Database, SqlValue } from 'sql.js'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { PROACTIVE_DELIVERY_POLICY } from '../../../src/shared/proactive-evidence'
import type { ProactiveEvidenceReason, ProactiveEvidenceRecord, ProactiveEvidenceResult, ProactiveEvidenceStatus } from '../../../src/shared/proactive-evidence'
import { DIAGNOSTIC_HISTORY_LIMITS as LIMITS } from '../../../src/shared/debug-history'

const id = z.string().regex(/^[A-Za-z0-9_.:-]{1,240}$/).refine(value => !/(?:sk-|gh[pousr]_|github_pat_|xox[baprs]-)/i.test(value))
const timestamp = z.number().int().nonnegative().safe()
const reasons = z.enum(['ok', 'disabled', 'muted', 'quiet-hours', 'already-today', 'no-fresh-moment', 'no-window', 'send-failed', 'receipt-timeout', 'process-restarted', 'role-inactive', 'reservation-save-failed'])
const rowSchema = z.object({
  id, roleId: id, processRunId: id, localDay: z.iso.date(),
  status: z.enum(['skipped', 'reserved', 'dispatched', 'presented', 'failed', 'unconfirmed']), reason: reasons,
  occurredAt: timestamp, updatedAt: timestamp, checks: z.number().int().min(1).safe(), momentId: id.optional(),
  recipientCount: z.number().int().min(0).max(PROACTIVE_DELIVERY_POLICY.maxRecipients), sentCount: z.number().int().min(0).max(PROACTIVE_DELIVERY_POLICY.maxRecipients), failedCount: z.number().int().min(0).max(PROACTIVE_DELIVERY_POLICY.maxRecipients),
}).strict()
const querySchema = z.object({ roleId: id, date: z.iso.date().optional(), limit: z.number().int().min(1).max(100).default(50), cursor: z.string().max(2048).optional(), recordId: id.optional() }).strict().refine(q => !(q.cursor && q.recordId))
function rows(db: Database, sql: string, values: SqlValue[] = []): Record<string, unknown>[] {
  const stmt = db.prepare(sql)
  try { stmt.bind(values); const result = []; while (stmt.step()) result.push(stmt.getAsObject()); return result } finally { stmt.free() }
}
export function validateProactiveEvidenceQuery(input: unknown) { return querySchema.parse(input) }

/** 背景：发送名额必须在广播前可靠保存，而记录本身可按保留策略裁剪。
 * 意图：同步原子事务预留人物每日名额，保存失败则不发送；未提醒原因按日合并。
 * 约束：构造和查询不建表；存储只接受固定状态 / 原因与来源 ID，不保存 toast / token。
 */
export class ProactiveEvidenceStore {
  constructor(private db: Database, readonly processRunId: string, private persist: () => void) { id.parse(processRunId) }

  hasReservation(roleId: string, localDay: string): boolean {
    id.parse(roleId); z.iso.date().parse(localDay)
    return rows(this.db, 'SELECT 1 FROM companion_greeting_days WHERE role_id=? AND local_day=?', [roleId, localDay]).length > 0
  }

  recordSkipped(roleId: string, localDay: string, reason: ProactiveEvidenceReason, now: number, momentId?: string): void {
    id.parse(roleId); z.iso.date().parse(localDay); reasons.parse(reason); timestamp.parse(now)
    if (momentId !== undefined) id.parse(momentId)
    const key = `greeting-skip-${createHash('sha256').update(JSON.stringify([roleId, localDay, reason])).digest('hex').slice(0, 32)}`
    this.db.run(`INSERT INTO companion_greeting_evidence(id,role_id,local_day,process_run_id,status,reason,occurred_at,updated_at,moment_id)
      VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,checks=MIN(checks+1,9007199254740991)`,
    [key, roleId, localDay, this.processRunId, 'skipped', reason, now, now, momentId ?? null])
    this.prune(now)
    this.persist()
  }

  /** 背景：并发 tick 可能都读到未发送，单纯先查再 await 会重复打扰。
   * 意图：无 await 的事务 CAS 同步预留，提交并落盘成功才返回可发送 attempt。
   * 约束：后续发送 / 回执失败都不释放名额；失败落盘不得继续广播。
   */
  reserve(roleId: string, localDay: string, momentId: string, recipientCount: number, now: number): string | null {
    id.parse(roleId); id.parse(momentId); z.iso.date().parse(localDay); timestamp.parse(now)
    z.number().int().min(1).max(PROACTIVE_DELIVERY_POLICY.maxRecipients).parse(recipientCount)
    const attemptId = `greeting-${randomUUID()}`
    let began = false
    try {
      this.db.run('BEGIN TRANSACTION'); began = true
      if (this.hasReservation(roleId, localDay)) { this.db.run('ROLLBACK'); return null }
      this.db.run(`INSERT INTO companion_greeting_days(role_id,local_day,attempt_id,reserved_at) VALUES (?,?,?,?)
        ON CONFLICT(role_id) DO UPDATE SET local_day=excluded.local_day,attempt_id=excluded.attempt_id,reserved_at=excluded.reserved_at`, [roleId, localDay, attemptId, now])
      this.db.run(`INSERT INTO companion_greeting_evidence(id,role_id,local_day,process_run_id,status,reason,occurred_at,updated_at,moment_id,recipient_count)
        VALUES (?,?,?,?,?,?,?,?,?,?)`, [attemptId, roleId, localDay, this.processRunId, 'reserved', 'ok', now, now, momentId, recipientCount])
      this.prune(now)
      this.db.run('COMMIT'); began = false
      this.persist()
      return attemptId
    } catch (error) {
      if (began) this.db.run('ROLLBACK')
      else this.db.run("UPDATE companion_greeting_evidence SET status='failed',reason='reservation-save-failed' WHERE id=? AND status='reserved'", [attemptId])
      throw error
    }
  }

  markDispatch(attemptId: string, sent: number, failed: number, now: number): void {
    for (const count of [sent, failed]) z.number().int().min(0).max(PROACTIVE_DELIVERY_POLICY.maxRecipients).parse(count)
    this.update(attemptId, sent ? 'dispatched' : 'failed', sent ? 'ok' : 'send-failed', now, sent, failed)
  }
  markPresented(attemptId: string, now: number): boolean { return this.update(attemptId, 'presented', 'ok', now) }
  markUnconfirmed(attemptId: string, now: number): void { this.update(attemptId, 'unconfirmed', 'receipt-timeout', now) }

  private update(attemptId: string, status: ProactiveEvidenceStatus, reason: ProactiveEvidenceReason, now: number, sent?: number, failed?: number): boolean {
    id.parse(attemptId); timestamp.parse(now)
    const counters = sent === undefined ? '' : ',sent_count=?,failed_count=?'
    this.db.run(`UPDATE companion_greeting_evidence SET status=?,reason=?,updated_at=?${counters}
      WHERE id=? AND process_run_id=? AND status IN ('reserved','dispatched') AND updated_at <= ?`,
    [status, reason, now, ...(sent === undefined ? [] : [sent, failed!]), attemptId, this.processRunId, now])
    if (!this.db.getRowsModified()) return false
    this.persist()
    return true
  }

  recover(now: number): void {
    this.db.run("UPDATE companion_greeting_evidence SET status='unconfirmed',reason='process-restarted' WHERE status IN ('reserved','dispatched') AND process_run_id != ?", [this.processRunId])
    this.prune(now)
    this.persist()
  }

  private prune(now: number): void {
    this.db.run('DELETE FROM companion_greeting_evidence WHERE occurred_at < ?', [now - LIMITS.retentionMs])
    this.db.run('DELETE FROM companion_greeting_evidence WHERE id IN (SELECT id FROM companion_greeting_evidence ORDER BY occurred_at DESC,id DESC LIMIT -1 OFFSET ?)', [LIMITS.maxRecords])
  }

  /** 背景：查询范围必须独立于活跃人物；缺目标与已发送不能混成空成功。
   * 意图：参数化、有界游标与固定字段投影，不触发发送 / 建表 / 设置读取。
   * 约束：坏行由整个读取报错，不回填近邻；回执未确认不表示提醒未发送。
   */
  query(input: unknown, now: number): ProactiveEvidenceResult {
    const q = validateProactiveEvidenceQuery(input)
    const scope = JSON.stringify([q.roleId, q.date ?? '', q.recordId ?? ''])
    const conditions = ['role_id=?', 'occurred_at>=?']; const values: SqlValue[] = [q.roleId, now - LIMITS.retentionMs]
    if (q.date) { conditions.push('local_day=?'); values.push(q.date) }
    if (q.recordId) { conditions.push('id=?'); values.push(q.recordId) }
    if (q.cursor) {
      const cursor = z.object({ scope: z.string(), at: timestamp, id }).strict().parse(JSON.parse(Buffer.from(q.cursor, 'base64url').toString()))
      if (cursor.scope !== scope) throw new Error('问候游标范围不一致')
      conditions.push('(occurred_at<? OR (occurred_at=? AND id<?))'); values.push(cursor.at, cursor.at, cursor.id)
    }
    const raw = rows(this.db, `SELECT * FROM companion_greeting_evidence WHERE ${conditions.join(' AND ')} ORDER BY occurred_at DESC,id DESC LIMIT ?`, [...values, q.limit + 1])
    const page = raw.slice(0, q.limit)
    const records: ProactiveEvidenceRecord[] = page.map(row => rowSchema.parse({
      id: row.id, roleId: row.role_id, processRunId: row.process_run_id, localDay: row.local_day, status: row.status, reason: row.reason,
      occurredAt: row.occurred_at, updatedAt: row.updated_at, checks: row.checks,
      ...(row.moment_id === null ? {} : { momentId: row.moment_id }), recipientCount: row.recipient_count, sentCount: row.sent_count, failedCount: row.failed_count,
    }))
    const last = page.at(-1)
    return { state: 'ready', records, hasMore: raw.length > q.limit,
      ...(raw.length > q.limit && last ? { nextCursor: Buffer.from(JSON.stringify({ scope, at: last.occurred_at, id: last.id })).toString('base64url') } : {}),
      boundary: '仅有最近 7 天、最多 20000 条问候元数据；界面呈现只证明组件报告已呈现，不代表用户看见或已读。无回执不自动重发，完整正文与回执 token 不保存。',
    }
  }
}

import type { Database, SqlValue } from 'sql.js'
import { z } from 'zod'
import { DIAGNOSTIC_HISTORY_LIMITS as LIMITS, type DiagnosticHistoryRecord, type DiagnosticHistoryResult } from '../../../src/shared/debug-history'
import { createLogger } from '../utils/logger'

const log = createLogger('DiagnosticHistoryStore')
const identity = z.string().regex(/^[A-Za-z0-9_.:-]{1,240}$/).refine(value => !/(?:sk-|gh[pousr]_|github_pat_|xox[baprs]-)/i.test(value))
const time = z.number().int().nonnegative().safe()
const count = z.number().int().nonnegative().safe()
const recordSchema = z.object({
  id: identity, processRunId: identity, kind: z.enum(['span', 'event']), occurredAt: time, updatedAt: time,
  status: z.enum(['running', 'ok', 'error', 'interrupted']), phase: z.enum(['started', 'updated', 'ended']),
  spanType: z.enum(['interaction', 'llm_request', 'tool', 'tool_blocked', 'tool_execution', 'compress', 'subagent']),
  caller: z.enum(['main', 'compact', 'memory', 'title', 'subagent', 'tool', 'profile', 'system']), spanId: identity,
  roleId: identity.optional(), sessionId: identity.optional(), parentId: identity.optional(), links: z.array(identity).max(16).optional(),
  operation: z.enum(['life_tick', 'life_projection']).optional(), sourceEventId: identity.optional(), momentId: identity.optional(),
  durationMs: count.optional(), inputTokens: count.optional(), outputTokens: count.optional(), omittedFields: count,
}).strict().refine(row => row.updatedAt >= row.occurredAt)
const querySchema = z.object({
  kind: z.enum(['span', 'event']).optional(), roleId: identity.optional(), sessionId: identity.optional(),
  processRunId: identity.optional(), spanId: identity.optional(), recordId: identity.optional(),
  from: time.optional(), to: time.optional(), limit: z.number().int().min(1).max(LIMITS.maxPageSize).default(LIMITS.pageSize),
  cursor: z.string().max(4096).optional(),
}).strict().refine(q => !(q.recordId && q.cursor) && !(q.from !== undefined && q.to !== undefined && q.from > q.to))

function rows(db: Database, sql: string, values: SqlValue[] = []): Record<string, unknown>[] {
  const stmt = db.prepare(sql)
  try { stmt.bind(values); const result = []; while (stmt.step()) result.push(stmt.getAsObject()); return result } finally { stmt.free() }
}

export function validateDiagnosticHistoryQuery(input: unknown) { return querySchema.parse(input ?? {}) }

/** 背景：历史元数据需跨重启查询，不能每个 token 全库落盘或积累无限 Promise。
 * 意图：有界 Map 合并 Span 更新，定时小批写入；与数据库同进程、同步事务。
 * 约束：构造不建表；查询不 flush / persist；调用方负责正式迁移与退出 flush。
 */
export class DiagnosticHistoryStore {
  private queue = new Map<string, DiagnosticHistoryRecord>()
  private timer?: ReturnType<typeof setTimeout>
  private dropped = 0
  private pruned = 0
  private writeFailures = 0
  private invalidStored = 0
  private diskPending = false
  private recordingSince: number

  constructor(private db: Database, readonly processRunId: string, private persist: () => void, private now = Date.now) {
    identity.parse(processRunId)
    const metadata = Object.fromEntries(rows(db, 'SELECT key,value FROM diagnostic_history_meta').map(row => [row.key, row.value]))
    const stored = metadata.recordingSince
    this.recordingSince = typeof stored === 'number' ? stored : now()
    this.dropped = typeof metadata.dropped === 'number' ? metadata.dropped : 0
    this.pruned = typeof metadata.pruned === 'number' ? metadata.pruned : 0
    this.writeFailures = typeof metadata.writeFailures === 'number' ? metadata.writeFailures : 0
  }

  /** 背景：重启前 running 不能被当成成功或用户取消。
   * 意图：只转换旧进程尚未结束的 Span 投影；事件仍保留当时发生的阶段。
   * 约束：仅由启动调用，查询不触发恢复；不填造结束时间或耗时。
   */
  recover(): void {
    this.db.run(`UPDATE diagnostic_history SET status = 'interrupted' WHERE kind = 'span' AND status = 'running' AND process_run_id != ?`, [this.processRunId])
    this.flush()
  }

  record(input: unknown): void {
    const parsed = recordSchema.safeParse(input)
    if (!parsed.success || parsed.data.processRunId !== this.processRunId || Buffer.byteLength(JSON.stringify(parsed.data)) > LIMITS.maxRecordBytes) { this.dropped += 1; return }
    const row = parsed.data
    const expectedId = `${this.processRunId}:${row.kind}:${row.spanId}${row.kind === 'event' ? `:${row.phase}` : ''}`
    if (row.id !== expectedId || row.kind === 'event' && row.phase === 'updated') { this.dropped += 1; return }
    if (row.occurredAt < this.now() - LIMITS.retentionMs || row.updatedAt > this.now() + 60_000) { this.dropped += 1; return }
    const previous = this.queue.get(row.id)
    if (previous && (previous.occurredAt !== row.occurredAt || previous.roleId !== undefined && previous.roleId !== row.roleId || previous.sessionId !== undefined && previous.sessionId !== row.sessionId)) { this.dropped += 1; return }
    if (previous && (previous.updatedAt > row.updatedAt || previous.status !== 'running' && row.status !== previous.status)) return
    if (!previous && this.queue.size >= LIMITS.maxQueued) { this.dropped += 1; return }
    this.queue.set(row.id, row)
    this.schedule()
  }

  private schedule(): void {
    if (this.timer) return
    this.timer = setTimeout(() => { this.timer = undefined; this.flush(LIMITS.batchSize); if (this.queue.size) this.schedule() }, 50)
    this.timer.unref?.()
  }

  /** 背景：DB 写入与磁盘 export 可能分别失败，主任务不能因此失败。
   * 意图：事务回滚失败批次，显式累计丢失；磁盘失败保留 dirty 供下一批或退出重试。
   * 约束：不无限重试 / 重排终态；退出用默认上限排空全部有界队列。
   */
  flush(limit: number = LIMITS.maxQueued): boolean {
    const batch = [...this.queue.values()].slice(0, limit)
    let began = false
    try {
      this.db.run('BEGIN TRANSACTION')
      began = true
      for (const row of batch) this.db.run(`INSERT INTO diagnostic_history
        (id,process_run_id,kind,occurred_at,updated_at,status,role_id,session_id,span_id,record_json) VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,status=excluded.status,role_id=excluded.role_id,session_id=excluded.session_id,record_json=excluded.record_json
        WHERE diagnostic_history.updated_at <= excluded.updated_at AND
          diagnostic_history.process_run_id = excluded.process_run_id AND diagnostic_history.kind = excluded.kind AND
          (diagnostic_history.role_id IS NULL OR diagnostic_history.role_id IS excluded.role_id) AND
          (diagnostic_history.session_id IS NULL OR diagnostic_history.session_id IS excluded.session_id) AND
          diagnostic_history.span_id = excluded.span_id AND diagnostic_history.occurred_at = excluded.occurred_at AND
          (diagnostic_history.status = 'running' OR diagnostic_history.status = excluded.status)`,
      [row.id, row.processRunId, row.kind, row.occurredAt, row.updatedAt, row.status, row.roleId ?? null, row.sessionId ?? null, row.spanId, JSON.stringify(row)])
      const pruned = this.prune()
      for (const [key, value] of Object.entries({ recordingSince: this.recordingSince, dropped: this.dropped, pruned: this.pruned + pruned, writeFailures: this.writeFailures })) {
        this.db.run('INSERT INTO diagnostic_history_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value])
      }
      this.db.run('COMMIT')
      this.pruned += pruned
      for (const row of batch) this.queue.delete(row.id)
      this.diskPending = true
    } catch {
      if (began) { try { this.db.run('ROLLBACK') } catch { log.warn('Diagnostic history rollback unavailable') } }
      for (const row of batch) this.queue.delete(row.id)
      this.dropped += batch.length
      this.writeFailures += 1
      log.warn('Diagnostic history batch unavailable', { count: batch.length })
      return false
    }
    try { this.persist(); this.diskPending = false; return true } catch {
      this.writeFailures += 1
      log.warn('Diagnostic history disk save pending')
      return false
    }
  }

  private prune(): number {
    this.db.run('DELETE FROM diagnostic_history WHERE occurred_at < ?', [this.now() - LIMITS.retentionMs])
    const expired = this.db.getRowsModified()
    this.db.run('DELETE FROM diagnostic_history WHERE id IN (SELECT id FROM diagnostic_history ORDER BY occurred_at DESC,id DESC LIMIT -1 OFFSET ?)', [LIMITS.maxRecords])
    return expired + this.db.getRowsModified()
  }

  /** 背景：分页及指定来源必须限定同一查询范围，未知历史不能用相邻项替代。
   * 意图：游标绑定筛选与 retention 下界，SQL 参数化并按时间 / ID 稳定排序。
   * 约束：只读、不建表、不 flush；坏记录局部跳过且保留计数，不返回未校验 JSON。
   */
  query(input?: unknown): DiagnosticHistoryResult {
    const q = validateDiagnosticHistoryQuery(input)
    const scope = JSON.stringify({ ...q, cursor: undefined, limit: undefined })
    const conditions = ['occurred_at >= ?']; const values: SqlValue[] = [this.now() - LIMITS.retentionMs]
    for (const [field, value] of Object.entries({ kind: q.kind, role_id: q.roleId, session_id: q.sessionId, process_run_id: q.processRunId, span_id: q.spanId, id: q.recordId })) {
      if (value !== undefined) { conditions.push(`${field} = ?`); values.push(value) }
    }
    if (q.from !== undefined) { conditions.push('occurred_at >= ?'); values.push(q.from) }
    if (q.to !== undefined) { conditions.push('occurred_at <= ?'); values.push(q.to) }
    if (q.cursor) {
      const cursor = z.object({ scope: z.string(), at: time, id: identity }).strict().parse(JSON.parse(Buffer.from(q.cursor, 'base64url').toString()))
      if (cursor.scope !== scope) throw new Error('历史游标与当前范围不一致')
      conditions.push('(occurred_at < ? OR (occurred_at = ? AND id < ?))'); values.push(cursor.at, cursor.at, cursor.id)
    }
    const raw = rows(this.db, `SELECT * FROM diagnostic_history WHERE ${conditions.join(' AND ')} ORDER BY occurred_at DESC,id DESC LIMIT ?`, [...values, q.limit + 1])
    const page = raw.slice(0, q.limit); const records: DiagnosticHistoryRecord[] = []
    let invalid = 0
    for (const row of page) {
      try {
        if (typeof row.record_json !== 'string' || Buffer.byteLength(row.record_json) > LIMITS.maxRecordBytes) throw new Error('历史记录超限')
        const record = recordSchema.parse(JSON.parse(row.record_json))
        if (record.id !== row.id || record.occurredAt !== row.occurred_at || record.kind !== row.kind || record.processRunId !== row.process_run_id || record.spanId !== row.span_id || (record.roleId ?? null) !== row.role_id || (record.sessionId ?? null) !== row.session_id) throw new Error('历史标识不一致')
        if (row.status !== record.status && !(row.status === 'interrupted' && record.status === 'running' && record.kind === 'span')) throw new Error('历史状态不一致')
        records.push({ ...record, status: row.status === 'interrupted' ? 'interrupted' : record.status })
      } catch { invalid += 1 }
    }
    this.invalidStored = invalid
    const last = page.at(-1)
    return {
      state: 'ready', records, hasMore: raw.length > q.limit,
      ...(raw.length > q.limit && last ? { nextCursor: Buffer.from(JSON.stringify({ scope, at: last.occurred_at, id: last.id })).toString('base64url') } : {}),
      generatedAt: this.now(), coverage: { recordingSince: this.recordingSince, retainedFrom: this.now() - LIMITS.retentionMs, processRunId: this.processRunId, pending: this.queue.size, dropped: this.dropped, pruned: this.pruned, writeFailures: this.writeFailures, invalidStored: this.invalidStored, diskPending: this.diskPending },
      boundary: '仅记录启用后的已采样关键生命周期元数据；最近 7 天且最多 20000 条，不含模型正文、工具参数或完整实时文字流。中断表示旧进程未确认结束，不能据此判断实际取消。',
    }
  }

  close(): void { if (this.timer) clearTimeout(this.timer); this.timer = undefined; this.flush() }
}

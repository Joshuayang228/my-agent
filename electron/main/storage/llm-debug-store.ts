/**
 * LLM Debug 持久化 —— 现有 tracer 的持久化 sink。
 *
 * 背景：普通 logger 适合运行诊断，TraceSpan 适合调用链摘要；两者都不应承载
 *       完整 Prompt / Response。Alice 的 Debug 模式需要在进程重启后继续查询。
 * 意图：复用现有 my-agent.db、sql.js、persist 和 safeStorage，只新增专用表与查询
 *       API；记录 ID 直接使用 tracer Span ID，避免第二套调用生命周期。
 * 约束：所有写入串行化；写盘失败只记录 warning，不阻断 LLM；renderer 只收到
 *       summary，正文通过单条详情 IPC 懒加载。
 */

import { safeStorage } from 'electron'
import { getDatabase, persist } from './database'
import { createLogger, sanitizeLogData } from '../utils/logger'
import type {
  LLMTraceRequest,
  LLMTraceResponse,
  LLMTraceSink,
} from '../utils/tracer'
import type {
  LLMCallDetail,
  LLMCallEvent,
  LLMCallQuery,
  LLMCallQueryResult,
  LLMCallSummary,
  LLMSubagentSession,
} from '../../../src/shared/types'

const log = createLogger('LLMDebugStore')

const MAX_DEBUG_LOGS = 3000
/** 主库采用 sql.js 全量 export，Debug 载荷不能无限膨胀；按正文列大小再加一道上限。 */
const MAX_DEBUG_BYTES = 256 * 1024 * 1024
const MAX_QUERY_LIMIT = 300

type LLMCallListener = (event: LLMCallEvent) => void

function safeJson(value: unknown, fallback: string): string {
  try {
    const safe = sanitizeLogData(value)
    const encoded = JSON.stringify(safe)
    return encoded === undefined ? fallback : encoded
  } catch {
    return fallback
  }
}

function protect(value: unknown, fallback: string): string {
  const json = safeJson(value, fallback)
  try {
    if (json && safeStorage.isEncryptionAvailable()) {
      return `enc:${safeStorage.encryptString(json).toString('base64')}`
    }
  } catch (error) {
    log.warn('Failed to encrypt Debug payload; keeping sanitized plaintext', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  return json
}

function protectText(value: string | null | undefined): string | null {
  if (value == null) return null
  return protect(value, '""')
}

function unprotect(value: unknown): string {
  if (typeof value !== 'string') return ''
  if (!value.startsWith('enc:')) return value
  try {
    return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64'))
  } catch {
    // 设备换机或 safeStorage 不可用时，返回原值让 JSON fallback 继续工作。
    return value
  }
}

function parseJson(value: unknown, fallback: unknown): unknown {
  const raw = unprotect(value)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return fallback
  }
}

function parseText(value: unknown): string | undefined {
  const raw = unprotect(value)
  if (!raw) return undefined
  const parsed = parseJson(value, raw)
  return typeof parsed === 'string' ? parsed : raw
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function rowToSummary(row: Record<string, unknown>): LLMCallSummary {
  const status = row.status === 'success' || row.status === 'error' ? row.status : 'pending'
  return {
    id: String(row.id ?? ''),
    ...(asOptionalString(row.session_id) ? { sessionId: String(row.session_id) } : {}),
    ...(asOptionalString(row.parent_span_id) ? { parentSpanId: String(row.parent_span_id) } : {}),
    startedAt: asNumber(row.started_at),
    ...(asNumber(row.ended_at) > 0 ? { endedAt: asNumber(row.ended_at) } : {}),
    provider: String(row.provider ?? ''),
    model: String(row.model ?? ''),
    caller: String(row.caller ?? 'system'),
    status,
    promptTokens: asNumber(row.prompt_tokens),
    completionTokens: asNumber(row.completion_tokens),
    totalTokens: asNumber(row.total_tokens),
    toolCallCount: asNumber(row.tool_call_count),
    cacheReadTokens: asNumber(row.cache_read_tokens),
    cacheCreationTokens: asNumber(row.cache_creation_tokens),
    durationMs: asNumber(row.duration_ms),
    ...(asOptionalString(row.error) ? { error: parseText(row.error) } : {}),
  }
}

function rowToDetail(row: Record<string, unknown>): LLMCallDetail {
  const summary = rowToSummary(row)
  const requestExtra = parseJson(row.request_extra, {}) as Record<string, unknown>
  return {
    ...summary,
    requestMessages: parseJson(row.request_messages, []),
    requestTools: parseJson(row.request_tools, []),
    requestExtra: requestExtra && typeof requestExtra === 'object' && !Array.isArray(requestExtra)
      ? requestExtra
      : {},
    ...(row.response_content != null ? { responseContent: parseText(row.response_content) ?? null } : {}),
    ...(row.response_reasoning != null ? { responseReasoning: parseText(row.response_reasoning) } : {}),
    responseToolCalls: parseJson(row.response_tool_calls, []),
  }
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 100
  return Math.max(1, Math.min(MAX_QUERY_LIMIT, Math.floor(limit as number)))
}

function normalizeSessionId(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

/**
 * 构造 LLM Debug 列表与导出的公共过滤条件。
 *
 * 背景：全页 Debug 需要按会话、caller、模型与状态定位真实请求，查询和导出必须保持同一语义。
 * 设计意图：只搜索未加密元数据，避免为了关键字搜索解密最多 256 MB 的请求正文；正文继续单条懒加载。
 * 关键约束：所有外部值只通过 SQL 参数绑定；排序方向由调用方单独白名单化。
 */
function buildQueryFilter(
  sessionIds: string[] | undefined,
  options: LLMCallQuery,
): { whereSql: string; params: Array<string | number> } {
  const where: string[] = []
  const params: Array<string | number> = []
  if (sessionIds) {
    where.push(`session_id IN (${sessionIds.map(() => '?').join(', ')})`)
    params.push(...sessionIds)
  }

  const caller = options.caller?.trim()
  if (caller) {
    where.push('caller = ?')
    params.push(caller)
  }
  const model = options.model?.trim()
  if (model) {
    where.push('model = ?')
    params.push(model)
  }
  if (options.status === 'pending' || options.status === 'success' || options.status === 'error') {
    where.push('status = ?')
    params.push(options.status)
  }

  const search = options.search?.trim()
  if (search) {
    where.push('(provider LIKE ? OR model LIKE ? OR caller LIKE ? OR session_id LIKE ? OR status LIKE ?)')
    const pattern = `%${search}%`
    params.push(pattern, pattern, pattern, pattern, pattern)
  }
  return {
    whereSql: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    params,
  }
}

class LLMDebugStore implements LLMTraceSink {
  private operationTail: Promise<void> = Promise.resolve()
  private readonly listeners = new Set<LLMCallListener>()

  private enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.operationTail.then(task, task)
    this.operationTail = next.catch((error: unknown) => {
      log.warn('LLM Debug persistence operation failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    })
    return next
  }

  private emit(event: LLMCallEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        log.warn('LLM Debug listener failed', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  subscribe(listener: LLMCallListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onLLMStart(request: LLMTraceRequest): Promise<void> {
    return this.enqueue(async () => {
      const db = await getDatabase()
      db.run(
        `INSERT INTO llm_debug_logs (
           id, session_id, parent_span_id, started_at, provider, model, caller, status,
           request_messages, request_tools, request_extra
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           session_id = excluded.session_id,
           parent_span_id = excluded.parent_span_id,
           provider = excluded.provider,
           model = excluded.model,
           caller = excluded.caller,
           request_messages = excluded.request_messages,
           request_tools = excluded.request_tools,
           request_extra = excluded.request_extra`,
        [
          request.spanId,
          request.sessionId ?? null,
          request.parentSpanId ?? null,
          Date.now(),
          request.provider,
          request.model,
          request.caller,
          protect(request.messages, '[]'),
          protect(request.tools, '[]'),
          protect(request.extra, '{}'),
        ],
      )
      persist()
      await this.evictIfNeeded(db)
      const record = await this.getRecordById(request.spanId, false)
      if (record) this.emit({ type: 'started', record })
    })
  }

  onLLMRequestUpdate(request: LLMTraceRequest): Promise<void> {
    return this.enqueue(async () => {
      const db = await getDatabase()
      db.run(
        `UPDATE llm_debug_logs
         SET session_id = ?, parent_span_id = ?, provider = ?, model = ?, caller = ?,
             request_messages = ?, request_tools = ?, request_extra = ?
         WHERE id = ?`,
        [
          request.sessionId ?? null,
          request.parentSpanId ?? null,
          request.provider,
          request.model,
          request.caller,
          protect(request.messages, '[]'),
          protect(request.tools, '[]'),
          protect(request.extra, '{}'),
          request.spanId,
        ],
      )
      persist()
      const record = await this.getRecordById(request.spanId, false)
      if (record) this.emit({ type: 'updated', record })
    })
  }

  onLLMEnd(spanId: string, response: LLMTraceResponse): Promise<void> {
    return this.enqueue(async () => {
      const db = await getDatabase()
      const endedAt = Date.now()
      const usage = response.usage
      db.run(
        `UPDATE llm_debug_logs
         SET ended_at = ?, status = ?, response_content = ?, response_reasoning = ?,
             response_tool_calls = ?, error = ?, prompt_tokens = ?, completion_tokens = ?, total_tokens = ?,
             tool_call_count = ?,
             cache_read_tokens = ?, cache_creation_tokens = ?, duration_ms = ?
         WHERE id = ?`,
        [
          endedAt,
          response.status,
          protectText(response.content),
          protectText(response.reasoning),
          protect(response.toolCalls ?? [], '[]'),
          response.error ? protect(response.error, '""') : null,
          usage?.promptTokens ?? 0,
          usage?.completionTokens ?? 0,
          usage?.totalTokens ?? (usage ? usage.promptTokens + usage.completionTokens : 0),
          Array.isArray(response.toolCalls) ? response.toolCalls.length : 0,
          usage?.cacheReadTokens ?? 0,
          usage?.cacheCreationTokens ?? 0,
          response.durationMs ?? 0,
          spanId,
        ],
      )
      persist()
      const record = await this.getRecordById(spanId, false)
      if (record) this.emit({ type: 'ended', record })
    })
  }

  async query(options: LLMCallQuery = {}): Promise<LLMCallQueryResult> {
    await this.operationTail
    const db = await getDatabase()
    const sessionIds = await this.resolveSessionIds(db, options)
    const { whereSql, params } = buildQueryFilter(sessionIds, options)
    const countStmt = db.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(
                COALESCE(LENGTH(request_messages), 0) +
                COALESCE(LENGTH(request_tools), 0) +
                COALESCE(LENGTH(request_extra), 0) +
                COALESCE(LENGTH(response_content), 0) +
                COALESCE(LENGTH(response_reasoning), 0) +
                COALESCE(LENGTH(response_tool_calls), 0) +
                COALESCE(LENGTH(error), 0)
              ), 0) AS storage_bytes
       FROM llm_debug_logs ${whereSql}`,
    )
    countStmt.bind(params)
    countStmt.step()
    const countRow = countStmt.getAsObject() as Record<string, unknown>
    countStmt.free()

    const limit = clampLimit(options.limit)
    const offset = Math.max(0, Math.floor(options.offset ?? 0))
    const order = options.order === 'desc' ? 'DESC' : 'ASC'
    const stmt = db.prepare(
      `SELECT * FROM llm_debug_logs ${whereSql}
       ORDER BY started_at ${order}, id ${order} LIMIT ? OFFSET ?`,
    )
    stmt.bind([...params, limit, offset])
    const records: LLMCallSummary[] = []
    while (stmt.step()) records.push(rowToSummary(stmt.getAsObject() as Record<string, unknown>))
    stmt.free()
    return {
      records,
      total: asNumber(countRow.total),
      storageBytes: asNumber(countRow.storage_bytes),
    }
  }

  async getById(id: string): Promise<LLMCallDetail | null> {
    await this.operationTail
    return this.getRecordById(id.trim(), true)
  }

  async clear(sessionId?: string): Promise<void> {
    await this.operationTail
    const db = await getDatabase()
    const normalized = normalizeSessionId(sessionId)
    if (!normalized) {
      db.run('DELETE FROM llm_debug_logs')
      db.run('DELETE FROM llm_debug_subagent_sessions')
    } else {
      const childIds = await this.getSubagentIds(db, normalized)
      const ids = [normalized, ...childIds]
      const placeholders = ids.map(() => '?').join(', ')
      db.run(`DELETE FROM llm_debug_logs WHERE session_id IN (${placeholders})`, ids)
      db.run(
        `DELETE FROM llm_debug_subagent_sessions
         WHERE main_session_id = ? OR debug_session_id IN (${placeholders})`,
        [normalized, ...ids],
      )
    }
    persist()
    this.emit({ type: 'cleared', ...(normalized ? { sessionId: normalized } : {}) })
  }

  async registerSubagentSession(
    debugSessionId: string,
    mainSessionId: string | undefined,
    role: string,
    parentSpanId?: string,
  ): Promise<void> {
    const child = normalizeSessionId(debugSessionId)
    const parent = normalizeSessionId(mainSessionId)
    if (!child || !parent) return
    await this.enqueue(async () => {
      const db = await getDatabase()
      db.run(
        `INSERT INTO llm_debug_subagent_sessions
           (debug_session_id, main_session_id, role, parent_span_id, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(debug_session_id) DO UPDATE SET
           main_session_id = excluded.main_session_id,
           role = excluded.role,
           parent_span_id = excluded.parent_span_id`,
        [child, parent, role, parentSpanId ?? null, Date.now()],
      )
      persist()
    })
  }

  async listSubagentSessions(mainSessionId: string): Promise<LLMSubagentSession[]> {
    await this.operationTail
    const db = await getDatabase()
    const stmt = db.prepare(
      `SELECT debug_session_id, main_session_id, role, parent_span_id, created_at
       FROM llm_debug_subagent_sessions
       WHERE main_session_id = ? ORDER BY created_at ASC`,
    )
    stmt.bind([mainSessionId])
    const result: LLMSubagentSession[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      result.push({
        debugSessionId: String(row.debug_session_id ?? ''),
        mainSessionId: String(row.main_session_id ?? ''),
        role: String(row.role ?? ''),
        ...(asOptionalString(row.parent_span_id) ? { parentSpanId: String(row.parent_span_id) } : {}),
        createdAt: asNumber(row.created_at),
      })
    }
    stmt.free()
    return result
  }

  async exportJsonl(options: LLMCallQuery = {}): Promise<string> {
    await this.operationTail
    const db = await getDatabase()
    const sessionIds = await this.resolveSessionIds(db, options)
    const { whereSql, params } = buildQueryFilter(sessionIds, options)
    const order = options.order === 'desc' ? 'DESC' : 'ASC'
    const stmt = db.prepare(
      `SELECT * FROM llm_debug_logs ${whereSql} ORDER BY started_at ${order}, id ${order}`,
    )
    stmt.bind(params)
    const lines: string[] = []
    while (stmt.step()) {
      lines.push(JSON.stringify(rowToDetail(stmt.getAsObject() as Record<string, unknown>)))
    }
    stmt.free()
    return lines.length > 0 ? `${lines.join('\n')}\n` : ''
  }

  private async getRecordById(id: string, detail: boolean): Promise<LLMCallSummary | LLMCallDetail | null> {
    if (!id) return null
    const db = await getDatabase()
    const stmt = db.prepare('SELECT * FROM llm_debug_logs WHERE id = ? LIMIT 1')
    stmt.bind([id])
    if (!stmt.step()) {
      stmt.free()
      return null
    }
    const row = stmt.getAsObject() as Record<string, unknown>
    stmt.free()
    return detail ? rowToDetail(row) : rowToSummary(row)
  }

  private async resolveSessionIds(
    db: Awaited<ReturnType<typeof getDatabase>>,
    options: LLMCallQuery,
  ): Promise<string[] | undefined> {
    const sessionId = normalizeSessionId(options.sessionId)
    if (!sessionId) return undefined
    if (!options.includeSubagents) return [sessionId]
    return [sessionId, ...(await this.getSubagentIds(db, sessionId))]
  }

  private async getSubagentIds(
    db: Awaited<ReturnType<typeof getDatabase>>,
    mainSessionId: string,
  ): Promise<string[]> {
    const stmt = db.prepare(
      'SELECT debug_session_id FROM llm_debug_subagent_sessions WHERE main_session_id = ?',
    )
    stmt.bind([mainSessionId])
    const result: string[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      if (typeof row.debug_session_id === 'string') result.push(row.debug_session_id)
    }
    stmt.free()
    return result
  }

  private async evictIfNeeded(db: Awaited<ReturnType<typeof getDatabase>>): Promise<void> {
    const stmt = db.prepare(
      `SELECT id,
         COALESCE(length(request_messages), 0)
         + COALESCE(length(request_tools), 0)
         + COALESCE(length(request_extra), 0)
         + COALESCE(length(response_content), 0)
         + COALESCE(length(response_reasoning), 0)
         + COALESCE(length(response_tool_calls), 0) AS payload_bytes
       FROM llm_debug_logs ORDER BY started_at ASC, id ASC`,
    )
    const rows: Array<{ id: string; bytes: number }> = []
    let totalBytes = 0
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      const bytes = asNumber(row.payload_bytes)
      rows.push({ id: String(row.id ?? ''), bytes })
      totalBytes += bytes
    }
    stmt.free()
    if (rows.length <= MAX_DEBUG_LOGS && totalBytes <= MAX_DEBUG_BYTES) return
    const victims: string[] = []
    let remainingBytes = totalBytes
    while (
      rows.length - victims.length > MAX_DEBUG_LOGS ||
      remainingBytes > MAX_DEBUG_BYTES
    ) {
      const victim = rows[victims.length]
      if (!victim) break
      victims.push(victim.id)
      remainingBytes -= victim.bytes
    }
    db.run(
      `DELETE FROM llm_debug_logs
       WHERE id IN (${victims.map(() => '?').join(', ')})`,
      victims,
    )
    persist()
  }
}

export const llmDebugStore = new LLMDebugStore()

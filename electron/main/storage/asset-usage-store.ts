/**
 * 生产资产使用关联索引。
 *
 * 背景：运行正文已有 LLM Debug / Trace / Eval 各自事实源，反向查询只缺稳定 key 关联。
 * 设计意图：只持久化脱敏关联和小型元数据，不复制 Prompt、工具参数、命令或记忆正文。
 * 关键约束：SQL 全部参数化；写入串行并有界裁剪；safeStorage 不可用时只保存已脱敏 JSON。
 */

import { safeStorage } from 'electron'
import type {
  AgentAssetUsageEvidence,
  AgentAssetUsageQuery,
  AgentAssetUsageQueryResult,
  AgentAssetUsageStatus,
} from '../../../src/shared/types'
import type { AssetUsageSink } from '../utils/asset-usage'
import { createLogger, sanitizeLogData } from '../utils/logger'
import { getDatabase, persist } from './database'

const log = createLogger('AssetUsageStore')
const MAX_ROWS = 20_000
const MAX_BYTES = 32 * 1024 * 1024
const MAX_LIMIT = 100

function protect(value: unknown): string {
  const json = JSON.stringify(sanitizeLogData(value)) || '{}'
  try {
    if (safeStorage.isEncryptionAvailable()) return `enc:${safeStorage.encryptString(json).toString('base64')}`
  } catch (error) {
    log.warn('Failed to encrypt asset usage metadata', { error: error instanceof Error ? error.message : String(error) })
  }
  return json
}

function unprotect(value: unknown): string {
  if (typeof value !== 'string') return '{}'
  if (!value.startsWith('enc:')) return value
  try { return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64')) } catch { return '{}' }
}

function parseMetadata(value: unknown): AgentAssetUsageEvidence['metadata'] {
  try {
    const parsed = JSON.parse(unprotect(value)) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as AgentAssetUsageEvidence['metadata']
      : {}
  } catch { return {} }
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function rowToEvidence(row: Record<string, unknown>): AgentAssetUsageEvidence {
  const status: AgentAssetUsageStatus = ['running', 'success', 'error', 'blocked', 'denied'].includes(String(row.status))
    ? String(row.status) as AgentAssetUsageStatus
    : 'success'
  return {
    id: String(row.id ?? ''),
    assetKey: String(row.asset_key ?? ''),
    assetName: String(row.asset_name ?? ''),
    assetType: String(row.asset_type ?? 'prompt') as AgentAssetUsageEvidence['assetType'],
    assetVersion: String(row.asset_version ?? ''),
    assetFingerprint: String(row.asset_fingerprint ?? ''),
    relation: String(row.relation ?? 'used') as AgentAssetUsageEvidence['relation'],
    usageKind: String(row.usage_kind ?? 'llm-input') as AgentAssetUsageEvidence['usageKind'],
    ...(typeof row.session_id === 'string' && row.session_id ? { sessionId: row.session_id } : {}),
    ...(typeof row.interaction_span_id === 'string' && row.interaction_span_id ? { interactionSpanId: row.interaction_span_id } : {}),
    spanId: String(row.span_id ?? ''),
    ...(typeof row.parent_span_id === 'string' && row.parent_span_id ? { parentSpanId: row.parent_span_id } : {}),
    occurredAt: numberValue(row.occurred_at),
    status,
    metadata: parseMetadata(row.metadata),
  }
}

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return 20
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(value as number)))
}

function tableExists(db: Awaited<ReturnType<typeof getDatabase>>): boolean {
  try {
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'agent_asset_usage'")
    const exists = stmt.step()
    stmt.free()
    return exists
  } catch {
    return false
  }
}

class AssetUsageStore implements AssetUsageSink {
  private operationTail: Promise<void> = Promise.resolve()

  private enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.operationTail.then(task, task)
    this.operationTail = next.catch(() => undefined)
    return next
  }

  async record(evidence: AgentAssetUsageEvidence): Promise<void> {
    await this.recordMany([evidence])
  }

  async recordMany(items: AgentAssetUsageEvidence[]): Promise<void> {
    if (items.length === 0) return
    await this.enqueue(async () => {
      const db = await getDatabase()
      if (!tableExists(db)) return
      const sql = `INSERT OR REPLACE INTO agent_asset_usage
        (id, asset_key, asset_name, asset_type, relation, usage_kind, session_id,
         interaction_span_id, span_id, parent_span_id, occurred_at, status,
         asset_version, asset_fingerprint, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      for (const evidence of items) {
        db.run(sql, [
          evidence.id, evidence.assetKey, evidence.assetName, evidence.assetType,
          evidence.relation, evidence.usageKind, evidence.sessionId ?? null,
          evidence.interactionSpanId ?? null, evidence.spanId, evidence.parentSpanId ?? null,
          evidence.occurredAt, evidence.status, evidence.assetVersion,
          evidence.assetFingerprint, protect(evidence.metadata),
        ])
      }
      this.prune(db)
      persist()
    })
  }

  /** 按稳定白名单字段构造查询，所有值继续走参数绑定。 */
  async query(input: AgentAssetUsageQuery = {}): Promise<AgentAssetUsageQueryResult> {
    await this.operationTail
    const db = await getDatabase()
    if (!tableExists(db)) return { records: [], total: 0 }
    const clauses: string[] = []
    const params: Array<string | number> = []
    for (const [column, value] of [
      ['asset_key', input.assetKey], ['span_id', input.spanId], ['session_id', input.sessionId],
      ['interaction_span_id', input.interactionSpanId], ['usage_kind', input.usageKind],
    ] as const) {
      const normalized = typeof value === 'string' ? value.trim() : ''
      if (normalized) { clauses.push(`${column} = ?`); params.push(normalized) }
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    const count = db.prepare(`SELECT COUNT(*) AS total FROM agent_asset_usage ${where}`)
    count.bind(params)
    count.step()
    const total = numberValue((count.getAsObject() as Record<string, unknown>).total)
    count.free()
    const stmt = db.prepare(
      `SELECT * FROM agent_asset_usage ${where}
       ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    stmt.bind([...params, clampLimit(input.limit), Math.max(0, Math.floor(input.offset ?? 0))])
    const records: AgentAssetUsageEvidence[] = []
    while (stmt.step()) records.push(rowToEvidence(stmt.getAsObject() as Record<string, unknown>))
    stmt.free()
    return { records, total }
  }

  /**
   * 批量读取多个运行节点的证据，供 Debug 导出使用。
   * 背景：JSONL 最多导出数千条 LLM 记录，逐条 query 会形成明显 N+1。
   * 关键约束：只按已存在的 spanId 查询，分片控制 SQLite 绑定参数数量。
   */
  async queryForSpanIds(spanIds: string[]): Promise<Map<string, AgentAssetUsageEvidence[]>> {
    await this.operationTail
    const db = await getDatabase()
    const grouped = new Map<string, AgentAssetUsageEvidence[]>()
    if (!tableExists(db)) return grouped
    const unique = [...new Set(spanIds.map((id) => id.trim()).filter(Boolean))]
    const chunkSize = 200
    for (let offset = 0; offset < unique.length; offset += chunkSize) {
      const chunk = unique.slice(offset, offset + chunkSize)
      const placeholders = chunk.map(() => '?').join(', ')
      const stmt = db.prepare(
        `SELECT * FROM agent_asset_usage WHERE span_id IN (${placeholders})
         ORDER BY occurred_at ASC, id ASC`,
      )
      stmt.bind(chunk)
      while (stmt.step()) {
        const evidence = rowToEvidence(stmt.getAsObject() as Record<string, unknown>)
        const records = grouped.get(evidence.spanId) ?? []
        records.push(evidence)
        grouped.set(evidence.spanId, records)
      }
      stmt.free()
    }
    return grouped
  }

  async clear(sessionId?: string): Promise<void> {
    await this.enqueue(async () => {
      const db = await getDatabase()
      if (!tableExists(db)) return
      const normalized = sessionId?.trim()
      if (normalized) db.run('DELETE FROM agent_asset_usage WHERE session_id = ?', [normalized])
      else db.run('DELETE FROM agent_asset_usage')
      persist()
    })
  }

  private prune(db: Awaited<ReturnType<typeof getDatabase>>): void {
    db.run(
      `DELETE FROM agent_asset_usage WHERE id IN (
         SELECT id FROM agent_asset_usage ORDER BY occurred_at DESC, id DESC LIMIT -1 OFFSET ?
       )`,
      [MAX_ROWS],
    )

    // 关键约束：单次写入可能带来多条证据，不能只删一批后就声称索引已受上限保护。
    // 统计所有文本列而不只统计 metadata，避免资产名称或 fingerprint 把数据库推过界。
    const measureBytes = (): number => {
      const stmt = db.prepare(`
        SELECT COALESCE(SUM(
          LENGTH(id) + LENGTH(asset_key) + LENGTH(asset_name) + LENGTH(asset_type) +
          LENGTH(relation) + LENGTH(usage_kind) + COALESCE(LENGTH(session_id), 0) +
          COALESCE(LENGTH(interaction_span_id), 0) + LENGTH(span_id) +
          COALESCE(LENGTH(parent_span_id), 0) + LENGTH(asset_version) +
          LENGTH(asset_fingerprint) + LENGTH(metadata)
        ), 0) AS bytes
        FROM agent_asset_usage
      `)
      stmt.step()
      const bytes = numberValue((stmt.getAsObject() as Record<string, unknown>).bytes)
      stmt.free()
      return bytes
    }

    let bytes = measureBytes()
    while (bytes > MAX_BYTES) {
      const beforeStmt = db.prepare('SELECT COUNT(*) AS total FROM agent_asset_usage')
      beforeStmt.step()
      const before = numberValue((beforeStmt.getAsObject() as Record<string, unknown>).total)
      beforeStmt.free()
      if (before <= 0) break

      db.run(
        `DELETE FROM agent_asset_usage WHERE id IN (
           SELECT id FROM agent_asset_usage ORDER BY occurred_at ASC, id ASC LIMIT 1000
         )`,
      )
      bytes = measureBytes()
    }
  }
}

export const assetUsageStore = new AssetUsageStore()

import { getDatabase } from '../../storage/database'

/**
 * 初始化人物世界核心层的事实、执行和出站表。
 *
 * 背景：生活模块此前各自维护事实表、执行状态和窗口广播，失败后无法统一追踪。
 * 设计意图：先建立一组与旧生活表并行的核心账本，允许垂直迁移逐步接入，避免一次改动重写所有页面。
 * 关键约束：所有列都使用参数化写入，唯一键用于幂等恢复，初始化只创建结构不改变既有生活数据。
 */
export async function ensureCompanionCoreSchema(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_runtime_state (
      role_id TEXT PRIMARY KEY,
      universe_id TEXT NOT NULL,
      mood INTEGER NOT NULL,
      energy INTEGER NOT NULL,
      social_need INTEGER NOT NULL,
      hunger INTEGER NOT NULL,
      sleepiness INTEGER NOT NULL,
      home TEXT NOT NULL DEFAULT '',
      timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
      current_activity TEXT NOT NULL DEFAULT '',
      current_location TEXT NOT NULL DEFAULT '',
      location_detail TEXT NOT NULL DEFAULT '',
      status_tags_json TEXT NOT NULL DEFAULT '[]',
      situation TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      last_event_id TEXT
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_domain_events (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      universe_id TEXT NOT NULL,
      type TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT,
      causation_id TEXT,
      correlation_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT 1,
      UNIQUE(role_id, idempotency_key)
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_domain_events_role_time ON companion_domain_events(role_id, occurred_at DESC)')
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_domain_events_correlation ON companion_domain_events(correlation_id, occurred_at)')
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_execution_runs (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      command_id TEXT,
      idempotency_key TEXT,
      event_id TEXT,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 1,
      error_code TEXT,
      error_message TEXT,
      result_json TEXT,
      started_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `)
  try { db.run('ALTER TABLE companion_execution_runs ADD COLUMN idempotency_key TEXT') } catch { /* 已存在 */ }
  try { db.run('ALTER TABLE companion_execution_runs ADD COLUMN result_json TEXT') } catch { /* 已存在 */ }
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_execution_idempotency ON companion_execution_runs(role_id, action_type, idempotency_key) WHERE idempotency_key IS NOT NULL')
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_execution_role_time ON companion_execution_runs(role_id, started_at DESC)')
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_outbox (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      event_id TEXT,
      kind TEXT NOT NULL,
      dedupe_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      delivered_at INTEGER,
      UNIQUE(role_id, dedupe_key)
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_outbox_pending ON companion_outbox(status, created_at)')
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_projection_receipts (
      projection_name TEXT NOT NULL,
      event_id TEXT NOT NULL,
      applied_at INTEGER NOT NULL,
      PRIMARY KEY (projection_name, event_id)
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_projection_receipts_event ON companion_projection_receipts(event_id)')
}

export function resetCompanionCoreSchemaForTesting(): void {
  // 核心表使用 IF NOT EXISTS，每次调用都会针对当前数据库确认结构。
}

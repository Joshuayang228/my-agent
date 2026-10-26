import type { Database } from 'sql.js'

/** 背景：历史由正式数据库初始化创建，Debug 查询不能借读取迁移数据库。
 * 意图：schema 独立于存储实例，避免 database 与历史服务互相 import。
 * 约束：幂等执行；不修改会话、人物或模型正文表。
 */
export function createDiagnosticHistorySchema(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS diagnostic_history (
    id TEXT PRIMARY KEY, process_run_id TEXT NOT NULL, kind TEXT NOT NULL,
    occurred_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, status TEXT NOT NULL,
    role_id TEXT, session_id TEXT, span_id TEXT NOT NULL, record_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_diagnostic_history_time ON diagnostic_history(occurred_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_diagnostic_history_role ON diagnostic_history(role_id, occurred_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_diagnostic_history_session ON diagnostic_history(session_id, occurred_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_diagnostic_history_span ON diagnostic_history(span_id);
  CREATE TABLE IF NOT EXISTS diagnostic_history_meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);`)
}

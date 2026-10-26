import type { Database } from 'sql.js'

/** 背景：问候每日限次是行为约束，不能依赖可裁剪的诊断清单。
 * 意图：角色单行名额与有界证据分开；无窗口不占名额，正式启动建表。
 * 约束：不存提示正文或回执 token；保留角色日期，不使用旧全局日标记。
 */
export function createProactiveEvidenceSchema(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS companion_greeting_days (
    role_id TEXT PRIMARY KEY, local_day TEXT NOT NULL, attempt_id TEXT NOT NULL, reserved_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS companion_greeting_evidence (
    id TEXT PRIMARY KEY, role_id TEXT NOT NULL, local_day TEXT NOT NULL, process_run_id TEXT NOT NULL,
    status TEXT NOT NULL, reason TEXT NOT NULL, occurred_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    moment_id TEXT, checks INTEGER NOT NULL DEFAULT 1, recipient_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_companion_greeting_scope ON companion_greeting_evidence(role_id,occurred_at DESC,id DESC);`)
}

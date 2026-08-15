/**
 * SQLite 数据库（sql.js WASM）— M16 并发与数据架构
 *
 * 背景：桌面端需要本地持久化，但不想引入 better-sqlite3 原生编译链。
 *       sql.js 全量在内存，每次 persist 把整库 export 写盘——无 WAL、无多写者。
 *
 * 意图：
 * - 提供单例 DB + 有序 schema migration
 * - persist 用「脏标记 coalesce + 原子写盘」，避免崩溃半截文件与冗余全量写
 *
 * 约束：
 * - 主进程单线程：同步 persist 本身不会真正并行；coalesce 防的是「连打 persist」浪费 I/O
 * - 原子写：先写 .tmp，再 rename/replace，降低写到一半崩溃导致库损坏的概率
 * - 不跨进程共享同一 db 文件
 *
 * 调用方：session-store / memory-store / settings-store / task-queue / approval-store
 */

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { createLogger, hashForLog } from '../utils/logger'

const log = createLogger('Database')

// sql.js 需要通过 createRequire 加载，避免 ESM 环境下 __dirname 问题
const require = createRequire(import.meta.url)
const initSqlJs = require('sql.js') as typeof import('sql.js').default

// 定位 WASM 文件：require.resolve('sql.js') → node_modules/sql.js/dist/sql-wasm.js
const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm')

type SqlJsDatabase = import('sql.js').Database
let db: SqlJsDatabase | null = null
let dbPath = ''

/** 当前 schema 版本；每次破坏性/加列迁移 +1 */
export const SCHEMA_VERSION = 14

/** persist 是否正在写盘（同步重入 / 连打时走 dirty coalesce） */
let persisting = false
/** 写盘期间又有人调了 persist → 结束后再写一次最新快照 */
let persistDirty = false

export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) return db

  dbPath = path.join(app.getPath('userData'), 'my-agent.db')
  log.info('Opening database', { pathHash: hashForLog(dbPath) })

  // sql.js 从 require 导入后是一个函数（default export）
  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  })

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
    log.info('Loaded existing database')
  } else {
    db = new SQL.Database()
    log.info('Created new database')
  }

  db.run('PRAGMA foreign_keys = ON')
  initSchema(db)
  persist()

  log.info('Database initialized', { schemaVersion: SCHEMA_VERSION })
  return db
}

function initSchema(database: SqlJsDatabase): void {
  // meta：schema 版本账本（G3）
  database.run(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id                       TEXT PRIMARY KEY,
      title                    TEXT NOT NULL DEFAULT '新对话',
      created_at               INTEGER NOT NULL,
      updated_at               INTEGER NOT NULL,
      total_prompt_tokens      INTEGER NOT NULL DEFAULT 0,
      total_completion_tokens  INTEGER NOT NULL DEFAULT 0,
      role_id                  TEXT NOT NULL DEFAULT ''
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id            TEXT PRIMARY KEY,
      session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role          TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
      content       TEXT NOT NULL,
      tool_calls    TEXT,
      tool_call_id  TEXT,
      created_at    INTEGER NOT NULL,
      sort_order    INTEGER NOT NULL
    )
  `)

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_messages_session
      ON messages(session_id, sort_order)
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS rag_documents (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      file_path   TEXT NOT NULL,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      prompt      TEXT NOT NULL,
      cron        TEXT,
      interval_ms INTEGER,
      enabled     INTEGER NOT NULL DEFAULT 1,
      last_run_at INTEGER,
      next_run_at INTEGER,
      created_at  INTEGER NOT NULL
    )
  `)

  // 持久审批记录（scope='persistent'），跨会话保留用户对命令的允许/拒绝决策
  database.run(`
    CREATE TABLE IF NOT EXISTS persistent_approvals (
      command_pattern TEXT PRIMARY KEY,
      approved        INTEGER NOT NULL,
      created_at      INTEGER NOT NULL
    )
  `)

  // M11 后台任务生命周期：任务状态持久化，进程崩溃后可恢复 pending/running 任务
  database.run(`
    CREATE TABLE IF NOT EXISTS background_tasks (
      id          TEXT PRIMARY KEY,
      session_id  TEXT NOT NULL,
      type        TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      notified    INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      error       TEXT,
      checkpoint  TEXT
    )
  `)
  database.run(`CREATE INDEX IF NOT EXISTS idx_btasks_status ON background_tasks(status)`)
  database.run(`CREATE INDEX IF NOT EXISTS idx_btasks_session ON background_tasks(session_id)`)

  runMigrations(database)
}

/**
 * 有序 schema 迁移。
 *
 * 背景：旧库用 try/catch ALTER 加列，无版本号，难追踪演进。
 * 意图：meta.schema_version 单调递增；每个 migration 必须幂等。
 * 约束：migrations[i] 负责 version i → i+1；失败应抛错阻止启动（避免半迁移）。
 */
export function runMigrations(database: SqlJsDatabase): void {
  let version = getSchemaVersion(database)

  const migrations: Array<(d: SqlJsDatabase) => void> = [
    // v0 → v1：sessions token 累计列（旧库可能已有，addColumnIfMissing 幂等）
    (d) => {
      addColumnIfMissing(d, 'sessions', 'total_prompt_tokens', 'INTEGER NOT NULL DEFAULT 0')
      addColumnIfMissing(d, 'sessions', 'total_completion_tokens', 'INTEGER NOT NULL DEFAULT 0')
    },
    // v1 → v2：后台任务 checkpoint 列（M09 断点续接）
    (d) => {
      addColumnIfMissing(d, 'background_tasks', 'checkpoint', 'TEXT')
    },
    // v2 → v3：会话绑定主角；开发期破坏性清空旧会话（无 role_id 兼容路径）
    (d) => {
      addColumnIfMissing(d, 'sessions', 'role_id', "TEXT NOT NULL DEFAULT ''")
      // 测试夹具可能缺表；生产库两条表都在
      if (tableExists(d, 'messages')) d.run('DELETE FROM messages')
      if (tableExists(d, 'sessions')) d.run('DELETE FROM sessions')
      if (tableExists(d, 'settings')) d.run(`DELETE FROM settings WHERE key = 'personaId'`)
    },
    // v3 → v4：Companion MUTABLE 覆盖与版本（W1 Growth）
    (d) => {
      d.run(`
        CREATE TABLE IF NOT EXISTS companion_mutable (
          role_id    TEXT PRIMARY KEY,
          body       TEXT NOT NULL,
          version    INTEGER NOT NULL DEFAULT 1,
          updated_at INTEGER NOT NULL
        )
      `)
      d.run(`
        CREATE TABLE IF NOT EXISTS companion_mutable_versions (
          id         TEXT PRIMARY KEY,
          role_id    TEXT NOT NULL,
          version    INTEGER NOT NULL,
          body       TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          summary    TEXT NOT NULL DEFAULT '',
          UNIQUE(role_id, version)
        )
      `)
    },
    // v4 → v5：LifeEngine 运行态 / 日剧本 / 事件（W2）
    (d) => {
      d.run(`
        CREATE TABLE IF NOT EXISTS companion_role_state (
          role_id         TEXT PRIMARY KEY,
          paused_at       INTEGER,
          last_tick_at    INTEGER NOT NULL DEFAULT 0,
          catchup_summary TEXT NOT NULL DEFAULT '',
          updated_at      INTEGER NOT NULL
        )
      `)
      d.run(`
        CREATE TABLE IF NOT EXISTS companion_day_scripts (
          id           TEXT PRIMARY KEY,
          role_id      TEXT NOT NULL,
          date         TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at   INTEGER NOT NULL,
          UNIQUE(role_id, date)
        )
      `)
      d.run(`
        CREATE INDEX IF NOT EXISTS idx_companion_day_scripts_role_date
          ON companion_day_scripts(role_id, date)
      `)
      d.run(`
        CREATE TABLE IF NOT EXISTS companion_events (
          id            TEXT PRIMARY KEY,
          role_id       TEXT NOT NULL,
          scheduled_at  INTEGER NOT NULL,
          status        TEXT NOT NULL,
          type          TEXT NOT NULL,
          payload_json  TEXT NOT NULL,
          day_script_id TEXT
        )
      `)
      d.run(`
        CREATE INDEX IF NOT EXISTS idx_companion_events_role_sched
          ON companion_events(role_id, scheduled_at)
      `)
    },
    // v5 → v6：朋友圈 Moments 截面（W3）
    (d) => {
      d.run(`
        CREATE TABLE IF NOT EXISTS companion_moments (
          id           TEXT PRIMARY KEY,
          role_id      TEXT NOT NULL,
          event_id     TEXT NOT NULL,
          published_at INTEGER NOT NULL,
          text         TEXT NOT NULL,
          meta_json    TEXT NOT NULL DEFAULT '{}'
        )
      `)
      d.run(`
        CREATE INDEX IF NOT EXISTS idx_companion_moments_role_pub
          ON companion_moments(role_id, published_at DESC)
      `)
      d.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_moments_event
          ON companion_moments(event_id)
      `)
    },
    // v6 → v7：Assets 衣柜等（W4）
    (d) => {
      d.run(`
        CREATE TABLE IF NOT EXISTS companion_assets (
          id               TEXT PRIMARY KEY,
          role_id          TEXT NOT NULL,
          kind             TEXT NOT NULL,
          name             TEXT NOT NULL,
          payload_json     TEXT NOT NULL DEFAULT '{}',
          acquired_at      INTEGER NOT NULL,
          source_event_id  TEXT
        )
      `)
      d.run(`
        CREATE INDEX IF NOT EXISTS idx_companion_assets_role_kind
          ON companion_assets(role_id, kind)
      `)
    },
    // v7 → v8：召唤子会话标记（不改 active、不启对方生活）
    (d) => {
      addColumnIfMissing(d, 'sessions', 'session_kind', "TEXT NOT NULL DEFAULT 'main'")
    },
    // v8 → v9：记忆可选归属主角（feedback 反思分桶，M22-G2）
    (d) => {
      if (tableExists(d, 'memories')) {
        addColumnIfMissing(d, 'memories', 'role_id', "TEXT NOT NULL DEFAULT ''")
        d.run(`
          CREATE INDEX IF NOT EXISTS idx_memories_category_role
            ON memories(category, role_id)
        `)
      }
    },
    // v9 → v10：角色世界状态薄片（居所/时区/短期情境，M23-G2）
    (d) => {
      if (tableExists(d, 'companion_role_state')) {
        addColumnIfMissing(d, 'companion_role_state', 'world_json', "TEXT NOT NULL DEFAULT '{}'")
      }
    },
    // v10 → v11：LLM Debug 请求/响应快照（复用现有 database，不另建日志库）
    (d) => {
      d.run(`
        CREATE TABLE IF NOT EXISTS llm_debug_logs (
          id                    TEXT PRIMARY KEY,
          session_id            TEXT,
          parent_span_id        TEXT,
          started_at            INTEGER NOT NULL,
          ended_at              INTEGER,
          provider              TEXT NOT NULL DEFAULT '',
          model                 TEXT NOT NULL DEFAULT '',
          caller                TEXT NOT NULL DEFAULT 'system',
          status                TEXT NOT NULL DEFAULT 'pending'
                                CHECK(status IN ('pending', 'success', 'error')),
          request_messages      TEXT NOT NULL DEFAULT '',
          request_tools         TEXT NOT NULL DEFAULT '',
          request_extra         TEXT NOT NULL DEFAULT '{}',
          response_content      TEXT,
          response_reasoning    TEXT,
          response_tool_calls   TEXT,
          error                 TEXT,
          prompt_tokens         INTEGER NOT NULL DEFAULT 0,
          completion_tokens     INTEGER NOT NULL DEFAULT 0,
          total_tokens          INTEGER NOT NULL DEFAULT 0,
          tool_call_count       INTEGER NOT NULL DEFAULT 0,
          cache_read_tokens     INTEGER NOT NULL DEFAULT 0,
          cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
          duration_ms           INTEGER NOT NULL DEFAULT 0
        )
      `)
      addColumnIfMissing(d, 'llm_debug_logs', 'total_tokens', 'INTEGER NOT NULL DEFAULT 0')
      addColumnIfMissing(d, 'llm_debug_logs', 'tool_call_count', 'INTEGER NOT NULL DEFAULT 0')
      d.run(`
        CREATE INDEX IF NOT EXISTS idx_llm_debug_logs_session_started
          ON llm_debug_logs(session_id, started_at DESC)
      `)
      d.run(`
        CREATE INDEX IF NOT EXISTS idx_llm_debug_logs_parent_span
          ON llm_debug_logs(parent_span_id)
      `)
      d.run(`
        CREATE TABLE IF NOT EXISTS llm_debug_subagent_sessions (
          debug_session_id TEXT PRIMARY KEY,
          main_session_id  TEXT NOT NULL,
          role             TEXT NOT NULL DEFAULT '',
          parent_span_id   TEXT,
          created_at       INTEGER NOT NULL
        )
      `)
      d.run(`
        CREATE INDEX IF NOT EXISTS idx_llm_debug_subagent_main
          ON llm_debug_subagent_sessions(main_session_id, created_at DESC)
      `)
    },
    // v11 → v12：Persona Eval 独立人工审阅记录，不改原始报告或自动判定
    (d) => {
      d.run(`
        CREATE TABLE IF NOT EXISTS persona_eval_human_reviews (
          report_file_name        TEXT NOT NULL,
          scenario_id             TEXT NOT NULL,
          trial_id                TEXT NOT NULL,
          naturalness             INTEGER,
          role_consistency        INTEGER,
          emotional_attunement   INTEGER,
          forced_optimism         TEXT,
          plan_pushing            TEXT,
          psychological_diagnosis TEXT,
          templatedness           TEXT,
          verdict                 TEXT,
          notes                   TEXT NOT NULL DEFAULT '',
          updated_at              INTEGER NOT NULL,
          PRIMARY KEY (report_file_name, scenario_id, trial_id)
        )
      `)
      d.run(`
        CREATE INDEX IF NOT EXISTS idx_persona_eval_reviews_report
          ON persona_eval_human_reviews(report_file_name, updated_at DESC)
      `)
    },
    // v12 → v13：生产资产与真实运行 Span 的脱敏关联索引
    (d) => {
      d.run(`
        CREATE TABLE IF NOT EXISTS agent_asset_usage (
          id                  TEXT PRIMARY KEY,
          asset_key           TEXT NOT NULL,
          asset_name          TEXT NOT NULL,
          asset_type          TEXT NOT NULL,
          relation            TEXT NOT NULL,
          usage_kind          TEXT NOT NULL,
          session_id          TEXT,
          interaction_span_id TEXT,
          span_id             TEXT NOT NULL,
          parent_span_id      TEXT,
          occurred_at         INTEGER NOT NULL,
          status              TEXT NOT NULL,
          asset_version       TEXT NOT NULL,
          asset_fingerprint   TEXT NOT NULL,
          metadata            TEXT NOT NULL DEFAULT '{}'
        )
      `)
      d.run('CREATE INDEX IF NOT EXISTS idx_asset_usage_key_time ON agent_asset_usage(asset_key, occurred_at DESC)')
      d.run('CREATE INDEX IF NOT EXISTS idx_asset_usage_span ON agent_asset_usage(span_id)')
      d.run('CREATE INDEX IF NOT EXISTS idx_asset_usage_session_time ON agent_asset_usage(session_id, occurred_at DESC)')
      d.run('CREATE INDEX IF NOT EXISTS idx_asset_usage_interaction ON agent_asset_usage(interaction_span_id)')
    },
    // v13 → v14：清理历史 LLM Debug 正文，今后只保留结构元数据与资产证据。
    (d) => {
      if (!tableExists(d, 'llm_debug_logs')) return
      d.run(`
        UPDATE llm_debug_logs
        SET request_messages = '[]',
            request_tools = '[]',
            request_extra = '{}',
            response_content = NULL,
            response_reasoning = NULL,
            response_tool_calls = '[]'
      `)
    },
  ]

  while (version < SCHEMA_VERSION) {
    const migrate = migrations[version]
    if (!migrate) {
      throw new Error(`Missing migration for schema version ${version} → ${version + 1}`)
    }
    migrate(database)
    version += 1
    setSchemaVersion(database, version)
    log.info('Applied schema migration', { to: version })
  }
}

export function getSchemaVersion(database: SqlJsDatabase): number {
  try {
    const stmt = database.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`)
    if (stmt.step()) {
      const row = stmt.getAsObject() as { value: string }
      stmt.free()
      const n = Number(row.value)
      return Number.isFinite(n) ? n : 0
    }
    stmt.free()
  } catch {
    // meta 表不存在或查询失败 → 视为 v0
  }
  return 0
}

function setSchemaVersion(database: SqlJsDatabase, version: number): void {
  database.run(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(version)],
  )
}

/**
 * 幂等加列：列已存在则跳过。
 * sql.js 对重复 ADD COLUMN 会抛错，catch 后视为已迁移。
 */
export function addColumnIfMissing(
  database: SqlJsDatabase,
  table: string,
  column: string,
  typeDecl: string,
): void {
  if (hasColumn(database, table, column)) return
  try {
    database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDecl}`)
  } catch {
    // 并发/重复迁移：忽略
  }
}

export function hasColumn(database: SqlJsDatabase, table: string, column: string): boolean {
  const stmt = database.prepare(`PRAGMA table_info(${table})`)
  try {
    while (stmt.step()) {
      const row = stmt.getAsObject() as { name: string }
      if (row.name === column) return true
    }
    return false
  } finally {
    stmt.free()
  }
}

function tableExists(database: SqlJsDatabase, table: string): boolean {
  const stmt = database.prepare(
    `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
  )
  try {
    stmt.bind([table])
    return stmt.step()
  } finally {
    stmt.free()
  }
}

/**
 * 原子写盘（G9）。
 *
 * 背景：直写 db 文件时若进程崩溃，可能留下半截文件，下次启动 sql.js 打不开。
 * 意图：先写唯一临时文件，再替换目标；Windows 上 rename 不能覆盖已存在文件，走 copy+unlink。
 * 约束：仍非跨进程安全；仅降低单进程崩溃损坏概率。
 */
export function atomicWriteFileSync(filePath: string, data: Uint8Array): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const tmpPath = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmpPath, Buffer.from(data))

  try {
    fs.renameSync(tmpPath, filePath)
  } catch {
    // Windows：目标已存在时 rename 失败 → 覆盖复制后删临时文件
    fs.copyFileSync(tmpPath, filePath)
    try {
      fs.unlinkSync(tmpPath)
    } catch {
      // 临时文件残留不致命
    }
  }
}

/**
 * 将内存 DB 快照落盘（G1 coalesce + G9 原子写）。
 *
 * 连打 persist 时：写盘中的调用只打脏标记，当前写完后用最新 export 再写一次，
 * 避免 N 次全量写盘，也避免「先 export 的旧快照后写覆盖新数据」（若将来改异步 I/O）。
 */
export function persist(): void {
  if (!db || !dbPath) return

  if (persisting) {
    persistDirty = true
    return
  }

  persisting = true
  try {
    do {
      persistDirty = false
      const data = db.export()
      atomicWriteFileSync(dbPath, data)
    } while (persistDirty)
  } finally {
    persisting = false
  }
}

export function closeDatabase(): void {
  if (db) {
    persist()
    db.close()
    db = null
    log.info('Database closed')
  }
}

/** 测试用：重置模块级单例状态 */
export function _resetDatabaseForTests(): void {
  if (db) {
    try {
      db.close()
    } catch { /* ignore */ }
  }
  db = null
  dbPath = ''
  persisting = false
  persistDirty = false
}

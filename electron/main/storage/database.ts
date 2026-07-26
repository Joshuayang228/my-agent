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
import { createLogger } from '../utils/logger'

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
export const SCHEMA_VERSION = 1

/** persist 是否正在写盘（同步重入 / 连打时走 dirty coalesce） */
let persisting = false
/** 写盘期间又有人调了 persist → 结束后再写一次最新快照 */
let persistDirty = false

export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) return db

  dbPath = path.join(app.getPath('userData'), 'my-agent.db')
  log.info('Opening database', { path: dbPath })

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
      total_completion_tokens  INTEGER NOT NULL DEFAULT 0
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
      error       TEXT
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

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

  log.info('Database initialized')
  return db
}

function initSchema(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT '新对话',
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    )
  `)

  db.run(`
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

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_messages_session
      ON messages(session_id, sort_order)
  `)

  // Migration: add token tracking columns if missing
  try {
    db.run('ALTER TABLE sessions ADD COLUMN total_prompt_tokens INTEGER NOT NULL DEFAULT 0')
  } catch { /* column already exists */ }
  try {
    db.run('ALTER TABLE sessions ADD COLUMN total_completion_tokens INTEGER NOT NULL DEFAULT 0')
  } catch { /* column already exists */ }
}

export function persist(): void {
  if (!db) return
  const data = db.export()
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(dbPath, Buffer.from(data))
}

export function closeDatabase(): void {
  if (db) {
    persist()
    db.close()
    db = null
    log.info('Database closed')
  }
}

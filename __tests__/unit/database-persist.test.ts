/**
 * M16：database persist / schema migration 单元测试
 *
 * 覆盖：原子写盘、幂等加列、schema_version 迁移。
 * 不启动 Electron（不测 getDatabase 单例路径）。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import initSqlJs from 'sql.js'

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

const {
  SCHEMA_VERSION,
  addColumnIfMissing,
  atomicWriteFileSync,
  getSchemaVersion,
  hasColumn,
  runMigrations,
} = await import('../../electron/main/storage/database')

describe('atomicWriteFileSync', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-agent-db-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('写入新文件成功', () => {
    const filePath = path.join(tmpDir, 'test.db')
    atomicWriteFileSync(filePath, Buffer.from('hello'))
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello')
  })

  it('覆盖已存在文件，不留下半截内容', () => {
    const filePath = path.join(tmpDir, 'test.db')
    fs.writeFileSync(filePath, 'old-content-that-is-longer')
    atomicWriteFileSync(filePath, Buffer.from('new'))
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('new')
  })

  it('写完后不残留 .tmp 文件', () => {
    const filePath = path.join(tmpDir, 'test.db')
    atomicWriteFileSync(filePath, Buffer.from('data'))
    const leftovers = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })
})

describe('schema migration', () => {
  let db: import('sql.js').Database

  beforeEach(async () => {
    const SQL = await initSqlJs()
    db = new SQL.Database()
    db.run(`
      CREATE TABLE meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
    // 模拟旧库：sessions 无 token 列
    db.run(`
      CREATE TABLE sessions (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL DEFAULT '新对话',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      )
    `)
  })

  it('旧库 v0 迁移后到达 SCHEMA_VERSION，并补上 token 列', () => {
    expect(getSchemaVersion(db)).toBe(0)
    expect(hasColumn(db, 'sessions', 'total_prompt_tokens')).toBe(false)

    runMigrations(db)

    expect(getSchemaVersion(db)).toBe(SCHEMA_VERSION)
    expect(hasColumn(db, 'sessions', 'total_prompt_tokens')).toBe(true)
    expect(hasColumn(db, 'sessions', 'total_completion_tokens')).toBe(true)
    const tables = db.exec(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name IN ('agent_asset_usage', 'llm_debug_logs', 'llm_debug_subagent_sessions', 'persona_eval_human_reviews')
       ORDER BY name`,
    )[0]?.values.map((row) => row[0])
    expect(tables).toEqual(['agent_asset_usage', 'llm_debug_logs', 'llm_debug_subagent_sessions', 'persona_eval_human_reviews'])
  })

  it('重复跑 migration 幂等', () => {
    runMigrations(db)
    runMigrations(db)
    expect(getSchemaVersion(db)).toBe(SCHEMA_VERSION)
  })

  it('addColumnIfMissing 对已存在列不报错', () => {
    addColumnIfMissing(db, 'sessions', 'total_prompt_tokens', 'INTEGER NOT NULL DEFAULT 0')
    addColumnIfMissing(db, 'sessions', 'total_prompt_tokens', 'INTEGER NOT NULL DEFAULT 0')
    expect(hasColumn(db, 'sessions', 'total_prompt_tokens')).toBe(true)
  })
})

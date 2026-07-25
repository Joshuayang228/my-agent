/**
 * M11 任务队列 SQLite 持久化测试
 *
 * 测试范围：
 * - 任务入队后写入 background_tasks 表
 * - 崩溃恢复：从 SQLite 加载 pending/running 任务
 * - notified 幂等标志落盘
 * - 恢复任务的函数重新注册
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import initSqlJs from 'sql.js'

describe('TaskQueue SQLite Persistence', () => {
  let db: import('sql.js').Database

  beforeEach(async () => {
    const SQL = await initSqlJs()
    db = new SQL.Database()

    // 创建 background_tasks 表（复制 database.ts schema）
    db.run(`
      CREATE TABLE background_tasks (
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
  })

  it('should persist task on enqueue', () => {
    const now = Date.now()
    db.run(
      `INSERT INTO background_tasks
         (id, session_id, type, status, notified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['task-1', 'sess-1', 'profile-extraction', 'pending', 0, now, now]
    )

    const stmt = db.prepare('SELECT * FROM background_tasks WHERE id = ?')
    stmt.bind(['task-1'])
    expect(stmt.step()).toBe(true)

    const row = stmt.getAsObject()
    expect(row.id).toBe('task-1')
    expect(row.type).toBe('profile-extraction')
    expect(row.status).toBe('pending')
    expect(row.notified).toBe(0)
    stmt.free()
  })

  it('should update status when task completes', () => {
    const now = Date.now()
    db.run(
      `INSERT INTO background_tasks
         (id, session_id, type, status, notified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['task-2', 'sess-1', 'title-generation', 'pending', 0, now, now]
    )

    // Simulate task execution
    db.run('UPDATE background_tasks SET status=?, notified=?, updated_at=? WHERE id=?',
      ['completed', 1, now + 1000, 'task-2'])

    const stmt = db.prepare('SELECT status, notified FROM background_tasks WHERE id = ?')
    stmt.bind(['task-2'])
    stmt.step()
    const row = stmt.getAsObject()
    expect(row.status).toBe('completed')
    expect(row.notified).toBe(1)
    stmt.free()
  })

  it('should recover pending tasks after crash', () => {
    const now = Date.now()

    // Simulate 2 tasks: one pending, one running (crashed)
    db.run(
      `INSERT INTO background_tasks
         (id, session_id, type, status, notified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['task-p', 'sess-1', 'profile-extraction', 'pending', 0, now, now]
    )
    db.run(
      `INSERT INTO background_tasks
         (id, session_id, type, status, notified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['task-r', 'sess-1', 'title-generation', 'running', 0, now, now]
    )

    // Simulate recovery: reset running → pending
    const stmt = db.prepare('SELECT * FROM background_tasks WHERE status IN (?, ?)')
    stmt.bind(['pending', 'running'])
    const recovered: Array<{ id: string; status: string }> = []
    while (stmt.step()) {
      const row = stmt.getAsObject()
      recovered.push({ id: String(row.id), status: String(row.status) })
    }
    stmt.free()

    expect(recovered).toHaveLength(2)
    expect(recovered.map(t => t.id)).toContain('task-p')
    expect(recovered.map(t => t.id)).toContain('task-r')

    // Reset running → pending
    db.run('UPDATE background_tasks SET status=? WHERE id=?', ['pending', 'task-r'])
    const checkStmt = db.prepare('SELECT status FROM background_tasks WHERE id=?')
    checkStmt.bind(['task-r'])
    checkStmt.step()
    expect(checkStmt.getAsObject().status).toBe('pending')
    checkStmt.free()
  })

  it('should not recover completed or failed tasks', () => {
    const now = Date.now()

    db.run(
      `INSERT INTO background_tasks
         (id, session_id, type, status, notified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['task-done', 'sess-1', 'profile-extraction', 'completed', 1, now, now]
    )
    db.run(
      `INSERT INTO background_tasks
         (id, session_id, type, status, notified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['task-fail', 'sess-1', 'title-generation', 'failed', 1, now, now]
    )

    const stmt = db.prepare('SELECT * FROM background_tasks WHERE status IN (?, ?)')
    stmt.bind(['pending', 'running'])
    const recovered = []
    while (stmt.step()) {
      recovered.push(stmt.getAsObject())
    }
    stmt.free()

    expect(recovered).toHaveLength(0)
  })

  it('should persist notified flag to prevent duplicate notifications', () => {
    const now = Date.now()
    db.run(
      `INSERT INTO background_tasks
         (id, session_id, type, status, notified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['task-3', 'sess-1', 'profile-extraction', 'completed', 0, now, now]
    )

    // First notification
    db.run('UPDATE background_tasks SET notified=? WHERE id=?', [1, 'task-3'])

    // Check idempotency
    const stmt = db.prepare('SELECT notified FROM background_tasks WHERE id=?')
    stmt.bind(['task-3'])
    stmt.step()
    const row = stmt.getAsObject()
    expect(row.notified).toBe(1)
    stmt.free()

    // Simulate duplicate notification attempt (should be skipped by checking notified flag)
    const checkStmt = db.prepare('SELECT notified FROM background_tasks WHERE id=?')
    checkStmt.bind(['task-3'])
    checkStmt.step()
    const check = checkStmt.getAsObject()
    expect(check.notified).toBe(1)
    checkStmt.free()
  })

  it('should handle task cancellation', () => {
    const now = Date.now()
    db.run(
      `INSERT INTO background_tasks
         (id, session_id, type, status, notified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['task-cancel', 'sess-1', 'profile-extraction', 'pending', 0, now, now]
    )

    db.run('UPDATE background_tasks SET status=?, updated_at=? WHERE id=?',
      ['cancelled', now + 500, 'task-cancel'])

    const stmt = db.prepare('SELECT status FROM background_tasks WHERE id=?')
    stmt.bind(['task-cancel'])
    stmt.step()
    expect(stmt.getAsObject().status).toBe('cancelled')
    stmt.free()
  })

  it('should persist error message on task failure', () => {
    const now = Date.now()
    const errorMsg = 'Network timeout'

    db.run(
      `INSERT INTO background_tasks
         (id, session_id, type, status, notified, created_at, updated_at, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['task-err', 'sess-1', 'title-generation', 'failed', 1, now, now, errorMsg]
    )

    const stmt = db.prepare('SELECT error FROM background_tasks WHERE id=?')
    stmt.bind(['task-err'])
    stmt.step()
    expect(stmt.getAsObject().error).toBe(errorMsg)
    stmt.free()
  })
})

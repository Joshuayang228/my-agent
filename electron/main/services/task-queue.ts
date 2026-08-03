/**
 * 后台任务队列服务 — M11 任务生命周期 v2（SQLite 持久化）
 *
 * 第一性原理（m11-task-lifecycle.md）：
 * 伙伴的可信赖感来自可见性。用户不需要盯着它，但它必须告诉你它在做什么。
 *
 * v2 新增（对照方法论幂等性章节）：
 * - SQLite 持久化：任务状态写库，进程崩溃后可从 background_tasks 表恢复 pending 任务
 * - 启动恢复：app ready 后调用 recoverPendingTasks()，把中断的任务重新入队
 * - notified 幂等标志落盘：通知发出后写库，重启后不重发
 *
 * v3 新增（M11 方向一：可靠性）：
 * - 指数退避重试：任务失败后最多重试 MAX_RETRIES=3 次（1s/2s/4s），耗尽后通知用户
 *
 * 内存 vs SQLite 的职责划分：
 * - 内存：执行函数（fn）、运行时状态的来源
 * - SQLite：崩溃后的恢复依据、通知幂等的持久记录
 *
 * M16 G2：running / completed / failed / notified 转移 await 落盘；enqueue 仍可非阻塞。
 *
 * M09：checkpoint 断点续接 + task:sync 断线对齐。
 */

import { BrowserWindow } from 'electron'
import { createLogger } from '../utils/logger'
import { getDatabase, persist } from '../storage/database'
import type {
  BackgroundTaskInfo,
  TaskCheckpoint,
  TaskLifecycleEvent,
  TaskType,
} from '../../../src/shared/types'

const log = createLogger('TaskQueue')

/** 最多重试次数（指数退避：1s → 2s → 4s），对照 feiche retrier.go 策略 */
const MAX_RETRIES = 3

// ── 内部任务定义（含执行函数，不对外暴露） ──

interface InternalTask extends BackgroundTaskInfo {
  fn?: () => Promise<void>  // 恢复的任务没有 fn，等外部重新注册
}

// ── SQLite helpers ──

/**
 * 把任务写入/更新 background_tasks 表。
 *
 * 背景（M16 G2）：原先 fire-and-forget，关键状态转移（running/completed/failed/notified）
 * 可能在崩溃窗口丢写。现改为 await 可等待；入队仍可 void 调用。
 *
 * 失败只记日志，不抛给调用方（队列执行不应因落盘失败而中断）。
 */
async function dbUpsertTask(task: BackgroundTaskInfo): Promise<void> {
  try {
    const database = await getDatabase()
    database.run(
      `INSERT OR REPLACE INTO background_tasks
         (id, session_id, type, status, notified, created_at, updated_at, error, checkpoint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.sessionId,
        task.name,
        task.status,
        task.notified ? 1 : 0,
        task.createdAt,
        task.updatedAt,
        task.error ?? null,
        task.checkpoint ? JSON.stringify(task.checkpoint) : null,
      ],
    )
    persist()
  } catch (err) {
    log.warn('Failed to persist task to SQLite', { taskId: task.id, error: String(err) })
  }
}

function parseCheckpoint(raw: unknown): TaskCheckpoint | undefined {
  if (raw == null || raw === '') return undefined
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (obj && typeof obj === 'object') return obj as TaskCheckpoint
  } catch { /* ignore */ }
  return undefined
}

// ── TaskQueueManager ──

class TaskQueueManager {
  private tasks = new Map<string, InternalTask>()
  private queue: string[] = []
  private running = false

  // ── 入队 ──

  enqueue(sessionId: string, name: TaskType, fn: () => Promise<void>): string {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const now = Date.now()

    const task: InternalTask = {
      id, name, sessionId, fn,
      status: 'pending',
      notified: false,
      createdAt: now,
      updatedAt: now,
    }

    this.tasks.set(id, task)
    this.queue.push(id)
    // 入队：非阻塞落盘（内存已有真相；崩溃最多丢这个 pending，可接受）
    void dbUpsertTask(this.toInfo(task))
    log.info(`Task enqueued: ${name}`, { taskId: id, sessionId, queueLength: this.queue.length })

    void this.processNext()
    return id
  }

  // ── 启动恢复：从 SQLite 加载上次中断的 pending 任务 ──

  /**
   * 进程启动后调用一次，把 status='pending' 或 'running'（上次崩溃中断）的任务
   * 重置为 pending 并加回内存队列，等外部重新注册执行函数。
   *
   * 注意：恢复的任务没有 fn，调用 reRegisterRecoveredTask() 注入函数后才会真正执行。
   * 对于没有被重新注册的任务，它们会停留在 pending 状态直到 app 生命周期结束。
   */
  async recoverPendingTasks(): Promise<BackgroundTaskInfo[]> {
    try {
      const db = await getDatabase()
      const stmt = db.prepare(
        `SELECT id, session_id, type, status, notified, created_at, updated_at, error, checkpoint
         FROM background_tasks
         WHERE status IN ('pending', 'running')
         ORDER BY created_at ASC`
      )
      const recovered: BackgroundTaskInfo[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>
        const info: BackgroundTaskInfo = {
          id: String(row.id),
          sessionId: String(row.session_id),
          name: String(row.type) as TaskType,
          status: 'pending',  // 重置 running → pending（上次崩溃）
          notified: row.notified === 1 || row.notified === '1',
          createdAt: Number(row.created_at),
          updatedAt: Date.now(),
          error: row.error ? String(row.error) : undefined,
          checkpoint: parseCheckpoint(row.checkpoint),
        }
        // 更新状态为 pending（覆盖 running）
        if (row.status === 'running') {
          db.run('UPDATE background_tasks SET status=?, updated_at=? WHERE id=?',
            ['pending', info.updatedAt, info.id])
          persist()
        }
        this.tasks.set(info.id, info)
        this.queue.push(info.id)
        recovered.push(info)
      }
      stmt.free()
      if (recovered.length > 0) {
        log.info('Recovered interrupted tasks from SQLite', { count: recovered.length })
      }
      return recovered
    } catch (err) {
      log.warn('Failed to recover tasks from SQLite', { error: String(err) })
      return []
    }
  }

  /**
   * 为恢复的任务注入执行函数。注入后任务会在下一个 processNext 轮次被执行。
   * 如果 taskId 不存在或任务已不是 pending，返回 false。
   */
  reRegisterRecoveredTask(taskId: string, fn: () => Promise<void>): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'pending') return false
    task.fn = fn
    void this.processNext()
    return true
  }

  // ── 查询 ──

  getActiveTasks(sessionId?: string): BackgroundTaskInfo[] {
    const result: BackgroundTaskInfo[] = []
    for (const task of this.tasks.values()) {
      if (task.status !== 'pending' && task.status !== 'running') continue
      if (sessionId && task.sessionId !== sessionId) continue
      result.push(this.toInfo(task))
    }
    return result
  }

  getTask(taskId: string): BackgroundTaskInfo | undefined {
    const task = this.tasks.get(taskId)
    if (!task) return undefined
    return this.toInfo(task)
  }

  /**
   * 断线重连同步：活跃任务 + 尚未 notified 的终态任务（供 UI 补 Toast / 对齐 pill）。
   */
  syncForRenderer(sessionId?: string): {
    active: BackgroundTaskInfo[]
    pendingNotify: BackgroundTaskInfo[]
  } {
    const active = this.getActiveTasks(sessionId)
    const pendingNotify: BackgroundTaskInfo[] = []
    for (const task of this.tasks.values()) {
      if (sessionId && task.sessionId !== sessionId) continue
      if (
        (task.status === 'completed' || task.status === 'failed') &&
        !task.notified
      ) {
        pendingNotify.push(this.toInfo(task))
      }
    }
    return { active, pendingNotify }
  }

  /** 写入/更新断点（长任务续接） */
  async updateCheckpoint(taskId: string, checkpoint: Omit<TaskCheckpoint, 'updatedAt'> & { updatedAt?: number }): Promise<boolean> {
    const task = this.tasks.get(taskId)
    if (!task) return false
    task.checkpoint = {
      ...checkpoint,
      updatedAt: checkpoint.updatedAt ?? Date.now(),
    }
    task.updatedAt = Date.now()
    await dbUpsertTask(this.toInfo(task))
    return true
  }

  getCheckpoint(taskId: string): TaskCheckpoint | undefined {
    return this.tasks.get(taskId)?.checkpoint
  }

  // ── 取消 ──

  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'pending') return false
    task.status = 'cancelled'
    task.updatedAt = Date.now()
    void dbUpsertTask(this.toInfo(task))
    log.info(`Task cancelled: ${task.name}`, { taskId })
    return true
  }

  // ── 优雅关闭 ──

  async shutdown(): Promise<void> {
    if (!this.running) return
    log.info('TaskQueue: waiting for running task to finish...')
    while (this.running) {
      await new Promise<void>(r => setTimeout(r, 100))
    }
  }

  // ── 内部：串行执行器 ──

  private async processNext(): Promise<void> {
    if (this.running) return
    this.running = true

    try {
      while (this.queue.length > 0) {
        const id = this.queue[0]
        const task = this.tasks.get(id)

        if (!task || task.status === 'cancelled') {
          this.queue.shift()
          continue
        }

        // 恢复的任务还没有 fn，跳过等待注入
        if (!task.fn) {
          this.queue.shift()
          continue
        }

        this.queue.shift()

        // pending → running（关键转移：await 落盘，缩小崩溃丢写窗口）
        task.status = 'running'
        task.updatedAt = Date.now()
        await dbUpsertTask(this.toInfo(task))
        this.emit({ type: 'task:started', task: this.toInfo(task) })
        log.info(`Task started: ${task.name}`, { taskId: id, sessionId: task.sessionId })

        try {
          const { runWithTraceContext, DEFAULT_TRACE_USER_ID } = await import('../utils/trace-context')
          await runWithTraceContext(
            { sessionId: task.sessionId, userId: DEFAULT_TRACE_USER_ID },
            () => task.fn!(),
          )
          task.status = 'completed'
          task.updatedAt = Date.now()
          log.info(`Task completed: ${task.name}`, { taskId: id })
          await this.notify(task, { type: 'task:completed', task: this.toInfo(task) })
        } catch (err) {
          const retryCount = (task.retryCount ?? 0) + 1
          task.retryCount = retryCount

          if (retryCount <= MAX_RETRIES) {
            // 指数退避重试：1s / 2s / 4s，非阻塞（不卡主循环）
            const backoffMs = 1000 * Math.pow(2, retryCount - 1)
            log.warn(`Task failed, retry ${retryCount}/${MAX_RETRIES} in ${backoffMs}ms`, {
              taskId: id, error: err instanceof Error ? err.message : String(err),
            })
            task.status = 'pending'
            task.updatedAt = Date.now()
            await dbUpsertTask(this.toInfo(task))

            setTimeout(() => {
              this.queue.push(id)
              void this.processNext()
            }, backoffMs)
          } else {
            // 重试耗尽 → 永久失败，通知用户
            task.status = 'failed'
            task.error = err instanceof Error ? err.message : String(err)
            task.updatedAt = Date.now()
            log.warn(`Task failed permanently after ${retryCount} attempts: ${task.name}`, {
              taskId: id, error: task.error,
            })
            await this.notify(task, { type: 'task:failed', task: this.toInfo(task) })
          }
        }
      }
    } finally {
      this.running = false
    }
  }

  // ── 内部：事件发送 ──

  private emit(event: TaskLifecycleEvent): void {
    BrowserWindow.getAllWindows()[0]?.webContents.send('task:event', event)
  }

  private async notify(task: InternalTask, event: TaskLifecycleEvent): Promise<void> {
    if (task.notified) {
      log.warn(`Task notification already sent (skipping): ${task.name}`, { taskId: task.id })
      return
    }
    task.notified = true
    // notified 幂等标志必须落盘后再发事件，避免重启后重复 Toast
    await dbUpsertTask(this.toInfo(task))
    BrowserWindow.getAllWindows()[0]?.webContents.send('task:event', event)
  }

  private toInfo(task: InternalTask): BackgroundTaskInfo {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fn: _fn, ...info } = task
    return info
  }
}

export const taskQueue = new TaskQueueManager()


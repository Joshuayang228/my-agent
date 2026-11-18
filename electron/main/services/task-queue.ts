/**
 * 后台任务队列服务 — M09 任务生命周期（SQLite 持久化）
 *
 * 第一性原理（m09-task-lifecycle.md）：
 * 伙伴的可信赖感来自可见性。用户不需要盯着它，但它必须告诉你它在做什么。
 *
 * v2 新增（对照方法论幂等性章节）：
 * - SQLite 持久化：任务状态写库，进程崩溃后可从 background_tasks 表恢复 pending 任务
 * - 启动恢复：app ready 后调用 recoverPendingTasks()，把可重建的中断任务重新入队
 * - 不可恢复任务：没有注册恢复处理器或缺少上下文时，明确落为 failed 并发送一次幂等通知
 * - notified 由 Renderer 接收确认后落盘，未确认终态在启动恢复和同步时重投。
 *
 * v3 新增（M11 方向一：可靠性）：
 * - 指数退避重试：任务失败后最多重试 MAX_RETRIES=3 次（1s/2s/4s），耗尽后通知用户
 *
 * 内存 vs SQLite 的职责划分：
 * - 内存：执行函数（fn）、运行时状态的来源
 * - SQLite：崩溃后的恢复依据、通知幂等的持久记录
 *
 * 入队与关键状态转移均等待事务保存。没有窗口或发送失败时保留终态待确认。
 *
 * M09：checkpoint 断点续接 + task:sync 断线对齐。
 */

import { BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { createLogger } from '../utils/logger'
import { getDatabase, withDatabaseTransaction } from '../storage/database'
import {
  DEFAULT_TRACE_USER_ID,
  getTraceContext,
  runWithTraceContext,
} from '../utils/trace-context'
import { startLinkedAsyncSpan, type SpanCaller } from '../utils/tracer'
import type {
  BackgroundTaskInfo,
  TaskCheckpoint,
  TaskLifecycleEvent,
  TaskType,
} from '../../../src/shared/types'

function callerForTask(name: TaskType): SpanCaller {
  switch (name) {
    case 'smart-title':
      return 'title'
    case 'profile-extract':
    case 'persona-reflection':
      return 'profile'
    case 'vector-index-user':
      return 'memory'
    default:
      return 'system'
  }
}

const log = createLogger('TaskQueue')

/** 最多重试次数（指数退避：1s → 2s → 4s），对照 feiche retrier.go 策略 */
const MAX_RETRIES = 3

// ── 内部任务定义（含执行函数，不对外暴露） ──

interface InternalTask extends BackgroundTaskInfo {
  fn?: () => Promise<void>
  /** 入队时捕获的主对话 span，供 linked async span 追溯 */
  linkSpanId?: string
}

type RecoveryHandler = (task: BackgroundTaskInfo) => Promise<(() => Promise<void>) | null>

// ── SQLite helpers ──

/** 任务接受、执行和终态必须先持久化，再发布内存状态或通知。
 * 写盘失败向调用方传播，避免任务执行成功后被存储异常当成业务失败重跑。
 */
async function dbUpsertTask(task: BackgroundTaskInfo): Promise<void> {
  await withDatabaseTransaction(async database => {
    database.run(`INSERT OR REPLACE INTO background_tasks
      (id, session_id, type, status, notified, created_at, updated_at, error, checkpoint, retry_count, next_retry_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      task.id, task.sessionId, task.name, task.status, task.notified ? 1 : 0,
      task.createdAt, task.updatedAt, task.error ?? null,
      task.checkpoint ? JSON.stringify(task.checkpoint) : null, task.retryCount ?? 0, task.nextRetryAt ?? null,
    ])
  })
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

export class TaskQueueManager {
  private tasks = new Map<string, InternalTask>()
  private queue: string[] = []
  private running = false
  private stopped = false
  private persistenceFailure: Error | null = null
  private mutationTail: Promise<void> = Promise.resolve()
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private recoveryHandlers = new Map<TaskType, RecoveryHandler>()

  registerRecoveryHandler(name: TaskType, handler: RecoveryHandler): void {
    this.recoveryHandlers.set(name, handler)
  }

  async enqueue(sessionId: string, name: TaskType, fn: () => Promise<void>, checkpoint?: TaskCheckpoint): Promise<string> {
    if (this.stopped) throw new Error('后台任务队列已停止。')
    if (this.persistenceFailure) throw this.persistenceFailure
    const now = Date.now()
    const task: InternalTask = {
      id: `task-${randomUUID()}`, name, sessionId, fn, checkpoint,
      status: 'pending', notified: false, createdAt: now, updatedAt: now,
      linkSpanId: getTraceContext().interactionSpanId,
    }
    await dbUpsertTask(this.toInfo(task))
    this.tasks.set(task.id, task)
    this.queue.push(task.id)
    this.kick()
    return task.id
  }

  async recoverPendingTasks(): Promise<BackgroundTaskInfo[]> {
    const db = await getDatabase()
    // 先释放读取游标再等待模型或写盘。sql.js 导出会关闭旧游标，恢复不能跨 export 保留 statement。
    const result = db.exec(`SELECT id, session_id, type, status, notified, created_at, updated_at,
      error, checkpoint, retry_count, next_retry_at FROM background_tasks
      WHERE status IN ('pending', 'running') OR (status IN ('completed', 'failed') AND notified = 0)
      ORDER BY created_at ASC`)[0]
    const recovered: BackgroundTaskInfo[] = []
    for (const values of result?.values ?? []) {
      const row = Object.fromEntries(result.columns.map((key, index) => [key, values[index]]))
      const id = String(row.id)
      if (this.tasks.has(id)) continue
      const task: InternalTask = {
        id, sessionId: String(row.session_id), name: String(row.type) as TaskType,
        status: row.status as BackgroundTaskInfo['status'], notified: Number(row.notified) === 1,
        createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
        error: row.error ? String(row.error) : undefined, checkpoint: parseCheckpoint(row.checkpoint),
        retryCount: Number(row.retry_count) || 0, nextRetryAt: row.next_retry_at == null ? undefined : Number(row.next_retry_at),
      }
      if (task.status === 'completed' || task.status === 'failed') {
        this.tasks.set(id, task)
        this.notify(task)
        recovered.push(this.toInfo(task))
        continue
      }
      const handler = this.recoveryHandlers.get(task.name)
      try {
        task.fn = handler ? await handler(this.toInfo(task)) ?? undefined : undefined
      } catch (error) {
        log.warn('Task recovery handler failed', { taskId: id, errorType: error instanceof Error ? error.name : 'unknown' })
      }
      if (task.fn) {
        await this.transition(task, { status: 'pending' })
        this.tasks.set(id, task)
        this.schedule(task)
      } else {
        await this.transition(task, { status: 'failed', error: '应用重启后无法恢复该后台任务，已停止等待。' })
        this.tasks.set(id, task)
        this.notify(task)
      }
      recovered.push(this.toInfo(task))
    }
    this.kick()
    return recovered
  }

  reRegisterRecoveredTask(taskId: string, fn: () => Promise<void>): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'pending') return false
    task.fn = fn
    this.schedule(task)
    this.kick()
    return true
  }

  getActiveTasks(sessionId?: string): BackgroundTaskInfo[] {
    return [...this.tasks.values()]
      .filter(task => (task.status === 'pending' || task.status === 'running') && (!sessionId || task.sessionId === sessionId))
      .map(task => this.toInfo(task))
  }

  getTask(taskId: string): BackgroundTaskInfo | undefined {
    const task = this.tasks.get(taskId)
    return task ? this.toInfo(task) : undefined
  }

  syncForRenderer(sessionId?: string): { active: BackgroundTaskInfo[]; pendingNotify: BackgroundTaskInfo[] } {
    return {
      active: this.getActiveTasks(sessionId),
      pendingNotify: [...this.tasks.values()]
        .filter(task => (task.status === 'completed' || task.status === 'failed') && !task.notified && (!sessionId || task.sessionId === sessionId))
        .map(task => this.toInfo(task)),
    }
  }

  async acknowledgeNotification(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId)
    if (!task || (task.status !== 'completed' && task.status !== 'failed')) return false
    if (!task.notified) await this.transition(task, { notified: true })
    return true
  }

  async updateCheckpoint(taskId: string, checkpoint: Omit<TaskCheckpoint, 'updatedAt'> & { updatedAt?: number }): Promise<boolean> {
    const task = this.tasks.get(taskId)
    if (!task) return false
    await this.transition(task, { checkpoint: { ...checkpoint, updatedAt: checkpoint.updatedAt ?? Date.now() } })
    return true
  }

  getCheckpoint(taskId: string): TaskCheckpoint | undefined {
    return this.tasks.get(taskId)?.checkpoint
  }

  async cancel(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId)
    if (!task) return false
    const cancelled = await this.transition(task, { status: 'cancelled' }, 'pending')
    if (cancelled) {
      clearTimeout(this.retryTimers.get(taskId))
      this.retryTimers.delete(taskId)
      this.emit({ type: 'task:cancelled', task: this.toInfo(task) })
    }
    return cancelled
  }

  async shutdown(): Promise<void> {
    this.stopped = true
    for (const timer of this.retryTimers.values()) clearTimeout(timer)
    this.retryTimers.clear()
    while (this.running) await new Promise<void>(resolve => setTimeout(resolve, 20))
    await this.mutationTail
  }

  private transition(task: InternalTask, patch: Partial<BackgroundTaskInfo>, expected?: BackgroundTaskInfo['status']): Promise<boolean> {
    const result = this.mutationTail.then(async () => {
      if (expected && task.status !== expected) return false
      const next = { ...this.toInfo(task), ...patch, updatedAt: Date.now() }
      await dbUpsertTask(next)
      Object.assign(task, next)
      return true
    })
    this.mutationTail = result.then(() => undefined, () => undefined)
    return result
  }

  private schedule(task: InternalTask): void {
    if (this.stopped || this.retryTimers.has(task.id) || this.queue.includes(task.id)) return
    const delay = Math.max(0, (task.nextRetryAt ?? 0) - Date.now())
    if (!delay) {
      this.queue.push(task.id)
      return
    }
    const timer = setTimeout(() => {
      this.retryTimers.delete(task.id)
      if (!this.stopped && task.status === 'pending') {
        this.queue.push(task.id)
        this.kick()
      }
    }, delay)
    this.retryTimers.set(task.id, timer)
  }

  private kick(): void {
    if (this.running || this.stopped || this.persistenceFailure) return
    void this.processNext().catch(error => {
      this.persistenceFailure = new Error('后台任务保存失败，请检查磁盘后重启应用。')
      log.error('Task queue suspended after persistence failure', { errorType: error instanceof Error ? error.name : 'unknown' })
    })
  }

  private async processNext(): Promise<void> {
    this.running = true
    try {
      while (!this.stopped && this.queue.length) {
        const id = this.queue.shift()!
        const task = this.tasks.get(id)
        if (!task?.fn || task.status !== 'pending') continue
        if (!await this.transition(task, { status: 'running', nextRetryAt: undefined }, 'pending')) continue
        this.emit({ type: 'task:started', task: this.toInfo(task) })
        let executionError: unknown
        let failed = false
        try {
          await runWithTraceContext({ sessionId: task.sessionId, userId: DEFAULT_TRACE_USER_ID, interactionSpanId: task.linkSpanId }, async () => {
            const span = startLinkedAsyncSpan(`bg:${task.name}`, callerForTask(task.name), {
              linkToSpanId: task.linkSpanId, attributes: { taskId: id, taskName: task.name },
            })
            try {
              await task.fn!()
              span.end('ok')
            } catch (error) {
              span.end('error', error instanceof Error ? error.name : 'unknown')
              throw error
            }
          })
        } catch (error) {
          failed = true
          executionError = error
        }
        // 完成保存失败不能进入业务重试，否则已经成功的副作用会重复执行。
        if (!failed) {
          await this.transition(task, { status: 'completed' })
          this.notify(task)
          continue
        }
        const retryCount = (task.retryCount ?? 0) + 1
        if (retryCount <= MAX_RETRIES) {
          await this.transition(task, { status: 'pending', retryCount, nextRetryAt: Date.now() + 1000 * 2 ** (retryCount - 1) })
          this.schedule(task)
        } else {
          log.warn('Background task exhausted retries', { taskId: id, errorType: executionError instanceof Error ? executionError.name : 'unknown' })
          await this.transition(task, { status: 'failed', retryCount, error: '后台任务执行失败，请检查配置或稍后重试。' })
          this.notify(task)
        }
      }
    } finally { this.running = false }
  }

  private emit(event: TaskLifecycleEvent): void {
    try {
      BrowserWindow.getAllWindows()[0]?.webContents.send('task:event', event)
    } catch (error) {
      log.warn('Task notification unavailable; retained for renderer sync', { taskId: event.task.id, errorType: error instanceof Error ? error.name : 'unknown' })
    }
  }

  private notify(task: InternalTask): void {
    if (task.notified) return
    const type = task.status === 'failed' ? 'task:failed' : 'task:completed'
    this.emit({ type, task: this.toInfo(task) })
  }

  private toInfo(task: InternalTask): BackgroundTaskInfo {
    const { fn: _fn, linkSpanId: _linkSpanId, ...info } = task
    return info
  }
}

export const taskQueue = new TaskQueueManager()

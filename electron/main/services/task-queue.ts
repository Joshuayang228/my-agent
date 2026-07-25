/**
 * 后台任务队列服务 — M11 任务生命周期
 *
 * 第一性原理（m11-task-lifecycle.md）：
 * 伙伴的可信赖感来自可见性。用户不需要盯着它，但它必须告诉你它在做什么。
 *
 * 本模块提供的核心能力：
 * - 唯一 ID：幂等保证，同一任务不会重复入队
 * - 五态状态机：pending → running → completed | failed | cancelled
 * - 事件推送：任务完成/失败时通知渲染进程，触发 Toast 等可见性组件
 * - 串行执行：避免并发写冲突（画像提取 + 向量索引不并发）
 *
 * v1 局限性（按方法论暂缓清单）：
 * - 纯内存存储，进程崩溃后任务丢失（SQLite 持久化待实现）
 * - 无重试机制（指数退避 + 最多 3 次，待实现）
 * - 无断点恢复（长任务，待实现）
 */

import { BrowserWindow } from 'electron'
import { createLogger } from '../utils/logger'
import type { BackgroundTaskInfo, TaskLifecycleEvent, TaskType } from '../../../src/shared/types'

const log = createLogger('TaskQueue')

// ── 内部任务定义（含执行函数，不对外暴露） ──

interface InternalTask extends BackgroundTaskInfo {
  fn: () => Promise<void>
}

// ── TaskQueueManager ──

class TaskQueueManager {
  private tasks = new Map<string, InternalTask>()
  private queue: string[] = []
  private running = false

  // ── 入队 ──

  /**
   * 将一个后台任务加入队列。
   *
   * - 返回唯一 taskId，调用方可用于查询状态
   * - 调用后立即触发 processNext（如果当前没有任务在跑）
   * - 注意：同一 sessionId + type 组合可以多次入队（每次对话结束都需要重新提取画像）
   */
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
    log.info(`Task enqueued: ${name}`, { taskId: id, sessionId, queueLength: this.queue.length })

    // 非阻塞启动，不 await
    void this.processNext()
    return id
  }

  // ── 查询 ──

  /** 返回当前 pending 或 running 的任务摘要（不含 fn） */
  getActiveTasks(sessionId?: string): BackgroundTaskInfo[] {
    const result: BackgroundTaskInfo[] = []
    for (const task of this.tasks.values()) {
      if (task.status !== 'pending' && task.status !== 'running') continue
      if (sessionId && task.sessionId !== sessionId) continue
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { fn: _fn, ...info } = task
      result.push(info)
    }
    return result
  }

  /** 返回指定任务信息（不含 fn） */
  getTask(taskId: string): BackgroundTaskInfo | undefined {
    const task = this.tasks.get(taskId)
    if (!task) return undefined
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fn: _fn, ...info } = task
    return info
  }

  // ── 取消 ──

  /** 取消一个 pending 任务（running 任务无法取消）*/
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'pending') return false
    task.status = 'cancelled'
    task.updatedAt = Date.now()
    log.info(`Task cancelled: ${task.name}`, { taskId })
    return true
  }

  // ── 优雅关闭 ──

  /** 等待正在运行的任务完成（用于 app shutdown） */
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
        const id = this.queue.shift()!
        const task = this.tasks.get(id)
        if (!task || task.status === 'cancelled') continue

        // pending → running
        task.status = 'running'
        task.updatedAt = Date.now()
        this.emit({ type: 'task:started', task: this.toInfo(task) })
        log.info(`Task started: ${task.name}`, { taskId: id, sessionId: task.sessionId })

        try {
          await task.fn()

          // running → completed
          task.status = 'completed'
          task.updatedAt = Date.now()
          log.info(`Task completed: ${task.name}`, { taskId: id })
          this.notify(task, { type: 'task:completed', task: this.toInfo(task) })
        } catch (err) {
          // running → failed
          task.status = 'failed'
          task.error = err instanceof Error ? err.message : String(err)
          task.updatedAt = Date.now()
          log.warn(`Task failed: ${task.name}`, { taskId: id, error: task.error })
          this.notify(task, { type: 'task:failed', task: this.toInfo(task) })
        }
      }
    } finally {
      this.running = false
    }
  }

  // ── 内部：事件发送 ──

  /** 向渲染进程推送任务事件（不设 notified，仅用于 started 等中间状态） */
  private emit(event: TaskLifecycleEvent): void {
    const win = BrowserWindow.getAllWindows()[0]
    win?.webContents.send('task:event', event)
  }

  /** 向渲染进程推送终态事件（completed/failed），设置 notified 幂等标志 */
  private notify(task: InternalTask, event: TaskLifecycleEvent): void {
    if (task.notified) {
      log.warn(`Task notification already sent (skipping): ${task.name}`, { taskId: task.id })
      return
    }
    task.notified = true
    const win = BrowserWindow.getAllWindows()[0]
    win?.webContents.send('task:event', event)
  }

  /** 返回不含 fn 的任务信息 */
  private toInfo(task: InternalTask): BackgroundTaskInfo {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fn: _fn, ...info } = task
    return info
  }
}

// 单例，与 runtime.ts 共享生命周期
export const taskQueue = new TaskQueueManager()

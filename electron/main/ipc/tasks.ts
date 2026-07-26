/**
 * 任务 IPC 模块 — M11 任务生命周期
 *
 * 提供 `task:list` 查询接口（渲染进程拉取当前活跃任务）。
 * 任务完成/失败事件通过 task-queue.ts 的 notify() 主动推送，
 * 渲染进程监听 `task:event` 通道接收。
 */

import { ipcMain } from 'electron'
import { taskQueue } from '../services/task-queue'
import { createLogger } from '../utils/logger'

const log = createLogger('TasksIPC')

export function registerTasksIPC(): void {
  // 查询当前活跃任务（pending | running）
  ipcMain.handle('task:list', (_event, sessionId?: string) => {
    const tasks = taskQueue.getActiveTasks(sessionId)
    log.debug('task:list', { sessionId, count: tasks.length })
    return tasks
  })

  // M09：渲染进程重挂后主动对齐（活跃 + 未通知终态）
  ipcMain.handle('task:sync', (_event, sessionId?: string) => {
    const snapshot = taskQueue.syncForRenderer(sessionId)
    log.debug('task:sync', {
      sessionId,
      active: snapshot.active.length,
      pendingNotify: snapshot.pendingNotify.length,
    })
    return snapshot
  })

  // 取消 pending 任务
  ipcMain.handle('task:cancel', (_event, taskId: string) => {
    return taskQueue.cancel(taskId)
  })
}

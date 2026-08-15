import { ipcMain } from 'electron'
import * as scheduler from '../scheduler/index'

const MAX_ID_LENGTH = 200

export function registerSchedulerIPC(): void {
  ipcMain.handle('scheduler:list', async () => scheduler.listTasks())

  ipcMain.handle('scheduler:create', async (_event, opts: { name: string; prompt: string; cron?: string; intervalMs?: number }) => {
    if (!opts || typeof opts !== 'object') return { ok: false, error: '任务参数无效' }
    const validationError = scheduler.validateScheduledTaskInput(opts)
    if (validationError) return { ok: false, error: validationError }
    try { return { ok: true, task: await scheduler.createTask(opts) } }
    catch { return { ok: false, error: '创建定时任务失败' } }
  })

  ipcMain.handle('scheduler:update', async (_event, id: string, updates: Record<string, unknown>) => {
    if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_LENGTH || !updates || typeof updates !== 'object') {
      return { ok: false, error: '任务参数无效' }
    }
    const allowed = new Set(['name', 'prompt', 'cron', 'intervalMs', 'enabled'])
    if (Object.keys(updates).some(key => !allowed.has(key))) return { ok: false, error: '任务更新字段无效' }
    const validationError = scheduler.validateScheduledTaskInput(updates)
    if (validationError) return { ok: false, error: validationError }
    if (updates.enabled !== undefined && typeof updates.enabled !== 'boolean') return { ok: false, error: '任务开关无效' }
    try { await scheduler.updateTask(id, updates as Parameters<typeof scheduler.updateTask>[1]); return { ok: true } }
    catch { return { ok: false, error: '更新定时任务失败' } }
  })

  ipcMain.handle('scheduler:delete', async (_event, id: string) => {
    if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_LENGTH) return { ok: false, error: '任务 ID 无效' }
    try { await scheduler.deleteTask(id); return { ok: true } }
    catch { return { ok: false, error: '删除定时任务失败' } }
  })
}

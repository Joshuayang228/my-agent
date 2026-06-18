import { ipcMain } from 'electron'
import * as scheduler from '../scheduler/index'

export function registerSchedulerIPC(): void {
  ipcMain.handle('scheduler:list', async () => scheduler.listTasks())

  ipcMain.handle('scheduler:create', async (_event, opts: { name: string; prompt: string; cron?: string; intervalMs?: number }) =>
    scheduler.createTask(opts))

  ipcMain.handle('scheduler:update', async (_event, id: string, updates: Record<string, unknown>) =>
    scheduler.updateTask(id, updates))

  ipcMain.handle('scheduler:delete', async (_event, id: string) =>
    scheduler.deleteTask(id))
}

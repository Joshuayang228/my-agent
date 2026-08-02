import { ipcMain } from 'electron'
import * as memory from '../storage/memory-store'
import type { MemoryCategory } from '../storage/memory-store'

export function registerMemoryIPC(): void {
  ipcMain.handle('memory:list', async (_event, category?: string) =>
    memory.listMemories(category as MemoryCategory | undefined))

  ipcMain.handle(
    'memory:add',
    async (_event, category: string, content: string, roleId?: string) =>
      memory.addMemory(category as MemoryCategory, content, {
        roleId: typeof roleId === 'string' ? roleId : undefined,
      }),
  )

  ipcMain.handle('memory:delete', async (_event, id: string) =>
    memory.deleteMemory(id))

  ipcMain.handle('memory:update', async (_event, id: string, content: string) =>
    memory.updateMemory(id, content))
}

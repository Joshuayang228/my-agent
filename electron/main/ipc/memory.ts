import { ipcMain } from 'electron'
import { correctCitedMemory } from '../memory/citation-correct'
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

  /** M29-G2：对话内对本轮引用一键纠错（忘/改） */
  ipcMain.handle(
    'memory:correct-citation',
    async (_event, id: string, replacement?: string) =>
      correctCitedMemory(id, {
        replacement: typeof replacement === 'string' ? replacement : undefined,
      }),
  )
}

import { ipcMain } from 'electron'
import { correctCitedMemory } from '../memory/citation-correct'
import * as memory from '../storage/memory-store'
import type { MemoryCategory } from '../storage/memory-store'

const MEMORY_CATEGORIES = new Set<MemoryCategory>(['identity', 'preference', 'fact', 'workflow', 'voice', 'feedback'])
const MAX_MEMORY_CONTENT_LENGTH = 1_000_000
const MAX_MEMORY_ID_LENGTH = 200

function isMemoryCategory(value: unknown): value is MemoryCategory {
  return typeof value === 'string' && MEMORY_CATEGORIES.has(value as MemoryCategory)
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max
}

export function registerMemoryIPC(): void {
  ipcMain.handle('memory:list', async (_event, category?: string) =>
    category === undefined || isMemoryCategory(category)
      ? memory.listMemories(category as MemoryCategory | undefined)
      : [])

  ipcMain.handle(
    'memory:add',
    async (_event, category: string, content: string, roleId?: string) => {
      if (!isMemoryCategory(category) || !isBoundedString(content, MAX_MEMORY_CONTENT_LENGTH)) {
        throw new Error('记忆参数无效或内容过长')
      }
      return memory.addMemory(category, content, {
        roleId: typeof roleId === 'string' && roleId.length <= MAX_MEMORY_ID_LENGTH ? roleId : undefined,
      })
    },
  )

  ipcMain.handle('memory:delete', async (_event, id: string) => {
    if (!isBoundedString(id, MAX_MEMORY_ID_LENGTH)) throw new Error('记忆 ID 无效')
    return memory.deleteMemory(id)
  })

  ipcMain.handle('memory:update', async (_event, id: string, content: string) => {
    if (!isBoundedString(id, MAX_MEMORY_ID_LENGTH) || !isBoundedString(content, MAX_MEMORY_CONTENT_LENGTH)) {
      throw new Error('记忆参数无效或内容过长')
    }
    return memory.updateMemory(id, content)
  })

  /** M29-G2：对话内对本轮引用一键纠错（忘/改） */
  ipcMain.handle(
    'memory:correct-citation',
    async (_event, id: string, replacement?: string) => {
      if (!isBoundedString(id, MAX_MEMORY_ID_LENGTH)) throw new Error('记忆 ID 无效')
      if (replacement !== undefined && !isBoundedString(replacement, MAX_MEMORY_CONTENT_LENGTH)) {
        throw new Error('改正内容过长')
      }
      return correctCitedMemory(id, {
        replacement: typeof replacement === 'string' ? replacement : undefined,
      })
    },
  )
}

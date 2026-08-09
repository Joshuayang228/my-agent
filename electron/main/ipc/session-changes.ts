/**
 * 会话文件变更 IPC（右坞审阅）
 */

import { ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import {
  clearSessionFileChanges,
  getSessionFileChange,
  listSessionFileChanges,
} from '../agent/session-file-changes'
import { formatUnifiedDiff } from '../utils/simple-diff'
import { createLogger } from '../utils/logger'

const log = createLogger('SessionChangesIPC')

export function registerSessionChangesIPC(): void {
  ipcMain.handle('session:listFileChanges', (_e, sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') return []
    return listSessionFileChanges(sessionId).map((c) => ({
      path: c.path,
      toolName: c.toolName,
      updatedAt: c.updatedAt,
      hasBefore: c.before != null,
      beforeTruncated: !!c.beforeTruncated,
    }))
  })

  ipcMain.handle('session:clearFileChanges', (_e, sessionId: string) => {
    if (!sessionId || typeof sessionId !== 'string') return { ok: false }
    clearSessionFileChanges(sessionId)
    return { ok: true }
  })

  ipcMain.handle('session:getFileChangeDiff', async (_e, sessionId: string, filePath: string) => {
    if (!sessionId || !filePath) return { error: 'Invalid args' }
    const rec = getSessionFileChange(sessionId, filePath)
    if (!rec) return { error: 'No change record' }
    try {
      const after = await fs.readFile(filePath, 'utf-8')
      const diff = formatUnifiedDiff(filePath, rec.before, after)
      return {
        path: filePath,
        toolName: rec.toolName,
        updatedAt: rec.updatedAt,
        beforeTruncated: !!rec.beforeTruncated,
        diff,
        after,
        hasBefore: rec.before != null,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.warn('getFileChangeDiff failed', { filePath, message })
      return { error: message }
    }
  })

  log.info('Session file-changes IPC registered')
}

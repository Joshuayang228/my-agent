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
import { createLogger, hashForLog } from '../utils/logger'

const log = createLogger('SessionChangesIPC')
const MAX_ID_LENGTH = 200
const MAX_PATH_LENGTH = 4_096
const MAX_REVIEW_FILE_BYTES = 5 * 1024 * 1024
const MAX_REVIEW_TEXT_CHARS = 500_000

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}

export function registerSessionChangesIPC(): void {
  ipcMain.handle('session:listFileChanges', (_e, sessionId: string) => {
    if (!validId(sessionId)) return []
    return listSessionFileChanges(sessionId).map((c) => ({
      path: c.path,
      toolName: c.toolName,
      updatedAt: c.updatedAt,
      hasBefore: c.before != null,
      beforeTruncated: !!c.beforeTruncated,
    }))
  })

  ipcMain.handle('session:clearFileChanges', (_e, sessionId: string) => {
    if (!validId(sessionId)) return { ok: false }
    clearSessionFileChanges(sessionId)
    return { ok: true }
  })

  ipcMain.handle('session:getFileChangeDiff', async (_e, sessionId: string, filePath: string) => {
    if (!validId(sessionId) || typeof filePath !== 'string' || filePath.length === 0 || filePath.length > MAX_PATH_LENGTH) {
      return { error: '审阅参数无效' }
    }
    const rec = getSessionFileChange(sessionId, filePath)
    if (!rec) return { error: '没有找到对应的会话文件变更记录' }
    try {
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) return { error: '变更目标不是普通文件' }
      if (stat.size > MAX_REVIEW_FILE_BYTES) return { error: '文件超过 5MB，无法在审阅面板生成差异' }
      const rawAfter = await fs.readFile(filePath, 'utf-8')
      const afterTruncated = rawAfter.length > MAX_REVIEW_TEXT_CHARS
      const after = afterTruncated ? rawAfter.slice(0, MAX_REVIEW_TEXT_CHARS) : rawAfter
      const diff = formatUnifiedDiff(filePath, rec.before, after)
      return {
        path: filePath,
        toolName: rec.toolName,
        updatedAt: rec.updatedAt,
        beforeTruncated: !!rec.beforeTruncated,
        diff,
        after,
        hasBefore: rec.before != null,
        afterTruncated,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.warn('getFileChangeDiff failed', { filePathHash: hashForLog(filePath), errorType: err instanceof Error ? err.name : 'unknown', errorLength: message.length })
      return { error: '读取文件变更失败，请确认文件仍然存在且可访问' }
    }
  })

  log.info('Session file-changes IPC registered')
}

/**
 * 写文件工具成功后记入会话变更（供右坞审阅）
 */

import { promises as fs } from 'node:fs'
import type { ToolMiddleware } from './middleware'
import {
  isSessionWriteTool,
  recordSessionFileChange,
} from '../agent/session-file-changes'
import { resolveToolFilePath } from '../sandbox/file-path-guard'
import { getWorkspaceRoot } from '../agent/project-memory'
import { BrowserWindow } from 'electron'

export const sessionFileChangeMiddleware: ToolMiddleware = async (ctx, next) => {
  if (!isSessionWriteTool(ctx.call.name)) {
    return next(ctx)
  }

  const rawPath = typeof ctx.args.path === 'string' ? ctx.args.path : ''
  const sessionId = ctx.toolContext?.sessionId || ''
  const resolved = rawPath
    ? resolveToolFilePath(rawPath, getWorkspaceRoot())
    : ''

  let before: string | null = null
  if (resolved) {
    try {
      before = await fs.readFile(resolved, 'utf-8')
    } catch {
      before = null
    }
  }

  const result = await next(ctx)

  if (result.isError || !resolved || !sessionId) return result

  const record = recordSessionFileChange(sessionId, {
    path: resolved,
    toolName: ctx.call.name,
    before,
  })

  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('session:file-change', {
      sessionId,
      change: {
        path: record.path,
        toolName: record.toolName,
        updatedAt: record.updatedAt,
        hasBefore: record.before != null,
        beforeTruncated: !!record.beforeTruncated,
      },
    })
  }

  return result
}

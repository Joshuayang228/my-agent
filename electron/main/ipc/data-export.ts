/**
 * 数据导出/导入 IPC — 备份恢复用户数据
 *
 * 导出格式：JSON 文件，包含会话、消息、记忆、设置
 * 导入时合并（不覆盖现有数据），导入前备份
 */
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile, readFile, stat } from 'node:fs/promises'
import { createLogger, hashForLog } from '../utils/logger'
import * as sessionStore from '../storage/session-store'
import * as memoryStore from '../storage/memory-store'
import * as settingsStore from '../storage/settings-store'
import { getDatabase, persist } from '../storage/database'

const log = createLogger('DataExport')

const MAX_IMPORT_BYTES = 25 * 1024 * 1024
const MAX_IMPORTED_SESSIONS = 10_000
const MAX_IMPORTED_MESSAGES_PER_SESSION = 10_000
const MAX_IMPORTED_MEMORIES = 10_000
const MAX_IMPORTED_STRING_LENGTH = 1_000_000
const EXPORT_MESSAGE_ROLES = new Set(['user', 'assistant', 'system', 'tool'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function boundedString(value: unknown, max = MAX_IMPORTED_STRING_LENGTH): value is string {
  return typeof value === 'string' && value.length <= max
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * 校验外部备份文件后再进入数据库写入链路。
 *
 * 背景：导入文件完全由用户选择，不能把 TypeScript 类型断言当作运行时校验。
 * 设计意图：先限制结构、数量和字符串长度，再交给参数化存储层；拒绝损坏或恶意构造的超大数据。
 * 关键约束：校验失败不写入数据库，不把原始 JSON 或内部异常返回给渲染层。
 */
export function isValidExportData(value: unknown): value is ExportData {
  if (!isRecord(value) || value.version !== 1 || !isFiniteNumber(value.exportedAt)) return false
  if (!Array.isArray(value.sessions) || value.sessions.length > MAX_IMPORTED_SESSIONS) return false
  if (!Array.isArray(value.memories) || value.memories.length > MAX_IMPORTED_MEMORIES) return false
  if (!isRecord(value.settings)) return false

  for (const session of value.sessions) {
    if (!isRecord(session)
      || !boundedString(session.id, 200)
      || !boundedString(session.title, 20_000)
      || !isFiniteNumber(session.createdAt)
      || !isFiniteNumber(session.updatedAt)
      || !Array.isArray(session.messages)
      || session.messages.length > MAX_IMPORTED_MESSAGES_PER_SESSION) return false
    for (const message of session.messages) {
      if (!isRecord(message)
        || !boundedString(message.id, 200)
        || typeof message.role !== 'string'
        || !EXPORT_MESSAGE_ROLES.has(message.role)
        || !boundedString(message.content)
        || !isFiniteNumber(message.timestamp)) return false
    }
  }

  for (const memory of value.memories) {
    if (!isRecord(memory)
      || !boundedString(memory.id, 200)
      || !boundedString(memory.category, 64)
      || !boundedString(memory.content)
      || !isFiniteNumber(memory.createdAt)
      || !isFiniteNumber(memory.updatedAt)) return false
  }

  for (const [key, setting] of Object.entries(value.settings)) {
    if (!boundedString(key, 200) || !boundedString(setting)) return false
  }
  return true
}

interface ExportData {
  version: 1
  exportedAt: number
  sessions: Array<{
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messages: Array<{
      id: string
      role: string
      content: string
      timestamp: number
    }>
  }>
  memories: Array<{
    id: string
    category: string
    content: string
    createdAt: number
    updatedAt: number
  }>
  settings: Record<string, string>
}

async function getAllSessions() {
  const db = await getDatabase()
  const sessions: ExportData['sessions'] = []
  const stmt = db.prepare('SELECT id, title, createdAt, updatedAt FROM sessions ORDER BY updatedAt DESC')
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>
    const sessionId = row.id as string
    const session = await sessionStore.getSession(sessionId)
    sessions.push({
      id: sessionId,
      title: row.title as string || '',
      createdAt: row.createdAt as number,
      updatedAt: row.updatedAt as number,
      messages: (session?.messages || []).map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    })
  }
  stmt.free()
  return sessions
}

export function registerDataExportIPC(): void {
  ipcMain.handle('data:export', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) return { success: false, error: 'No window' }

      const result = await dialog.showSaveDialog(win, {
        title: '导出数据',
        defaultPath: `my-agent-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })

      if (result.canceled || !result.filePath) return { success: false, error: 'cancelled' }

      const sessions = await getAllSessions()
      const memories = await memoryStore.listMemories()
      const settings = await settingsStore.getAllSettings()

      const sensitiveKeys = new Set(['llmApiKey'])
      const safeSettings: Record<string, string> = {}
      for (const [k, v] of Object.entries(settings)) {
        if (!sensitiveKeys.has(k)) safeSettings[k] = v
      }

      const data: ExportData = {
        version: 1,
        exportedAt: Date.now(),
        sessions,
        memories: memories.map(m => ({
          id: m.id,
          category: m.category,
          content: m.content,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
        settings: safeSettings,
      }

      await writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
      log.info('Data exported', {
        pathHash: hashForLog(result.filePath),
        sessions: sessions.length,
        memories: memories.length,
      })

      return { success: true, path: result.filePath, stats: { sessions: sessions.length, memories: memories.length } }
    } catch (err) {
      log.error('Export failed', { error: err instanceof Error ? err.message : 'unknown' })
      return { success: false, error: '导出失败，请重试' }
    }
  })

  ipcMain.handle('data:import', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) return { success: false, error: 'No window' }

      const result = await dialog.showOpenDialog(win, {
        title: '导入数据',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      })

      if (result.canceled || !result.filePaths[0]) return { success: false, error: 'cancelled' }

      const importPath = result.filePaths[0]
      const fileStat = await stat(importPath)
      if (fileStat.size > MAX_IMPORT_BYTES) {
        return { success: false, error: '备份文件过大，无法导入' }
      }
      const raw = await readFile(importPath, 'utf-8')
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return { success: false, error: '备份文件不是有效的 JSON' }
      }
      if (!isValidExportData(parsed)) {
        return { success: false, error: '备份文件格式无效或包含超限数据' }
      }
      const data = parsed

      let importedSessions = 0
      let importedMemories = 0
      let importedSettings = 0

      const db = await getDatabase()

      for (const session of data.sessions) {
        const existsStmt = db.prepare('SELECT id FROM sessions WHERE id = ?')
        existsStmt.bind([session.id])
        const exists = existsStmt.step()
        existsStmt.free()
        if (exists) continue

        db.run(
          'INSERT OR IGNORE INTO sessions (id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
          [session.id, session.title, session.createdAt, session.updatedAt],
        )
        for (const msg of session.messages) {
          db.run(
            'INSERT OR IGNORE INTO messages (id, sessionId, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
            [msg.id, session.id, msg.role, msg.content, msg.timestamp],
          )
        }
        importedSessions++
      }

      for (const mem of data.memories) {
        const existing = await memoryStore.listMemories()
        const isDup = existing.some(m => m.content.toLowerCase() === mem.content.toLowerCase())
        if (isDup) continue

        await memoryStore.addMemory(mem.category as memoryStore.MemoryCategory, mem.content)
        importedMemories++
      }

      const sensitiveKeys = new Set(['llmApiKey'])
      const allowedSettings = new Set(Object.keys(await settingsStore.getAllSettings()))
      for (const [key, value] of Object.entries(data.settings || {})) {
        if (sensitiveKeys.has(key) || !allowedSettings.has(key)) continue
        const current = await settingsStore.getSetting(key as keyof settingsStore.AppSettings)
        if (!current) {
          await settingsStore.setSetting(key as keyof settingsStore.AppSettings, value)
          importedSettings++
        }
      }

      persist()
      log.info('Data imported', { sessions: importedSessions, memories: importedMemories, settings: importedSettings })

      return {
        success: true,
        stats: { sessions: importedSessions, memories: importedMemories, settings: importedSettings },
      }
    } catch (err) {
      log.error('Import failed', { error: err instanceof Error ? err.message : 'unknown' })
      return { success: false, error: '导入失败，请检查备份文件后重试' }
    }
  })

  log.info('Data export/import IPC registered')
}

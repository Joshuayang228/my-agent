/**
 * 数据导出/导入 IPC — 备份恢复用户数据
 *
 * 导出格式：JSON 文件，包含会话、消息、记忆、设置
 * 导入时合并（不覆盖现有数据），导入前备份
 */
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile, readFile } from 'node:fs/promises'
import { createLogger } from '../utils/logger'
import * as sessionStore from '../storage/session-store'
import * as memoryStore from '../storage/memory-store'
import * as settingsStore from '../storage/settings-store'
import { getDatabase, persist } from '../storage/database'

const log = createLogger('DataExport')

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
        path: result.filePath,
        sessions: sessions.length,
        memories: memories.length,
      })

      return { success: true, path: result.filePath, stats: { sessions: sessions.length, memories: memories.length } }
    } catch (err) {
      log.error('Export failed', { error: String(err) })
      return { success: false, error: String(err) }
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

      const raw = await readFile(result.filePaths[0], 'utf-8')
      const data = JSON.parse(raw) as ExportData

      if (data.version !== 1) return { success: false, error: `Unsupported version: ${data.version}` }

      let importedSessions = 0
      let importedMemories = 0
      let importedSettings = 0

      const db = await getDatabase()

      for (const session of data.sessions) {
        const exists = db.exec(`SELECT id FROM sessions WHERE id = '${session.id}'`)
        if (exists.length > 0 && exists[0].values.length > 0) continue

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
      for (const [key, value] of Object.entries(data.settings || {})) {
        if (sensitiveKeys.has(key)) continue
        const current = await settingsStore.getSetting(key)
        if (!current) {
          await settingsStore.setSetting(key, value)
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
      log.error('Import failed', { error: String(err) })
      return { success: false, error: String(err) }
    }
  })

  log.info('Data export/import IPC registered')
}

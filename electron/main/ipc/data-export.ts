/**
 * 数据导出/导入 IPC — 备份恢复用户数据
 *
 * 导出格式：JSON 文件，包含会话、消息、记忆、设置
 * 导入时按 ID 合并（不覆盖现有数据）；导入文件在写库前做结构与规模校验。
 */
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile, readFile, stat } from 'node:fs/promises'
import { createLogger, hashForLog } from '../utils/logger'
import * as sessionStore from '../storage/session-store'
import * as memoryStore from '../storage/memory-store'
import * as settingsStore from '../storage/settings-store'
import { getDatabase, persist } from '../storage/database'
import type { ChatSession, MemoryCategory, SessionKind } from '../../../src/shared/types'
import type { Database } from 'sql.js'
import { detectSensitiveKinds } from '../../../src/shared/sensitive-memory'

const log = createLogger('DataExport')

const MAX_IMPORT_BYTES = 25 * 1024 * 1024
const MAX_IMPORTED_SESSIONS = 10_000
const MAX_IMPORTED_MESSAGES_PER_SESSION = 10_000
const MAX_IMPORTED_MEMORIES = 10_000
const MAX_IMPORTED_STRING_LENGTH = 1_000_000
const EXPORT_MESSAGE_ROLES = new Set(['user', 'assistant', 'system', 'tool'])
const EXPORT_MEMORY_CATEGORIES = new Set<MemoryCategory>(['identity', 'preference', 'fact', 'workflow', 'voice', 'feedback'])

/**
 * 备份只携带不会泄露凭据、不会改变执行权限、不会在下次启动执行外部命令的设置。
 *
 * 背景：`mcpServers` 可能含环境变量密钥和启用的 stdio command；`permissionRules`、
 * `executionMode` 会改变权限边界；项目路径会泄露本机目录。备份文件是可分享的普通 JSON，
 * 不能把这些控制面或本机秘密当作普通偏好一起导出 / 导入。
 */
const SAFE_BACKUP_SETTING_KEYS = new Set<keyof settingsStore.AppSettings>([
  'llmBaseUrl', 'llmModel', 'llmTemperature', 'llmTopP', 'llmMaxTokens',
  'systemPrompt', 'activeRoleId', 'universeId', 'userExpertiseLevel', 'auxModel',
  'sessionTokenBudget', 'dailyTokenBudget',
  'companionGrowthStartedAt', 'companionGrowthStartedAtByRole', 'companionMilestonesByRole',
  'companionMomentTipsMuted', 'companionMomentTipsLastAt', 'companionMomentTipsQuietStart',
  'companionMomentTipsQuietEnd', 'companionMomentTipsMaxPerDay', 'companionMomentTipsDayStats',
  'companionProactiveGreetingEnabled', 'companionProactiveGreetingLastDay',
  'conversationDebugMode', 'llmCapabilityCache',
])

export function isSafeBackupSettingKey(key: string): key is keyof settingsStore.AppSettings {
  return SAFE_BACKUP_SETTING_KEYS.has(key as keyof settingsStore.AppSettings)
}

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
      || (session.roleId !== undefined && !boundedString(session.roleId, 200))
      || (session.sessionKind !== undefined && session.sessionKind !== 'main' && session.sessionKind !== 'summon')
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
      || typeof memory.category !== 'string'
      || !EXPORT_MEMORY_CATEGORIES.has(memory.category as MemoryCategory)
      || (memory.roleId !== undefined && !boundedString(memory.roleId, 200))
      || !boundedString(memory.content)
      || detectSensitiveKinds(memory.content).includes('credentials')
      || !isFiniteNumber(memory.createdAt)
      || !isFiniteNumber(memory.updatedAt)) return false
  }

  for (const [key, setting] of Object.entries(value.settings)) {
    if (!boundedString(key, 200) || !boundedString(setting)) return false
  }
  return true
}

export interface ExportData {
  version: 1
  exportedAt: number
  sessions: Array<{
    id: string
    title: string
    createdAt: number
    updatedAt: number
    roleId?: string
    sessionKind?: SessionKind
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
    roleId?: string
  }>
  settings: Record<string, string>
}

/**
 * 按当前 SQLite schema 收集可导出的会话。
 *
 * 背景：备份代码曾继续使用早期 camelCase 列名，导致导出在真实数据库上必然失败。
 * 设计意图：查询显式使用数据库事实源的 snake_case 列，再映射为稳定的 JSON 字段。
 * 关键约束：消息正文仍通过 session-store 读取，避免在这里复制 tool_calls 解码规则。
 */
export async function collectExportSessions(
  db: Database,
  loadSession: (sessionId: string) => Promise<ChatSession | null> = sessionStore.getSession,
): Promise<ExportData['sessions']> {
  const sessions: ExportData['sessions'] = []
  const stmt = db.prepare('SELECT id, title, created_at, updated_at, role_id, session_kind FROM sessions ORDER BY updated_at DESC')
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>
    const sessionId = row.id as string
    const session = await loadSession(sessionId)
    sessions.push({
      id: sessionId,
      title: (row.title as string) || '',
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      roleId: (row.role_id as string) || '',
      sessionKind: row.session_kind === 'summon' ? 'summon' : 'main',
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

async function getAllSessions() {
  return collectExportSessions(await getDatabase())
}

/**
 * 将已校验的会话写入当前 schema，并返回新增会话数量。
 *
 * 背景：旧实现写入不存在的 createdAt/sessionId/timestamp 列，而且没有 sort_order，导入会
 * 整体失败。设计意图：集中维护 snake_case SQL 和消息顺序，供 IPC 与单测共用。
 * 关键约束：调用方必须先执行 isValidExportData；现有 ID 使用 INSERT OR IGNORE 合并。
 */
export function importSessionsIntoDatabase(db: Database, sessions: ExportData['sessions']): number {
  let imported = 0
  db.run('BEGIN')
  try {
    for (const session of sessions) {
      const existsStmt = db.prepare('SELECT id FROM sessions WHERE id = ?')
      existsStmt.bind([session.id])
      const exists = existsStmt.step()
      existsStmt.free()
      if (exists) continue

      db.run(
        `INSERT INTO sessions (id, title, created_at, updated_at, role_id, session_kind)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [session.id, session.title, session.createdAt, session.updatedAt, session.roleId || '', session.sessionKind === 'summon' ? 'summon' : 'main'],
      )
      session.messages.forEach((msg, sortOrder) => {
        db.run(
          `INSERT OR IGNORE INTO messages (id, session_id, role, content, tool_calls, tool_call_id, created_at, sort_order)
           VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`,
          [msg.id, session.id, msg.role, msg.content, msg.timestamp, sortOrder],
        )
      })
      imported++
    }
    db.run('COMMIT')
    return imported
  } catch (error) {
    try { db.run('ROLLBACK') } catch { /* 原错误优先 */ }
    throw error
  }
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

      const safeSettings: Record<string, string> = {}
      for (const [key, value] of Object.entries(settings)) {
        if (isSafeBackupSettingKey(key)) safeSettings[key] = value
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
          ...(m.roleId ? { roleId: m.roleId } : {}),
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
      log.error('Export failed', { errorType: err instanceof Error ? err.name : 'unknown' })
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

      importedSessions = importSessionsIntoDatabase(db, data.sessions)

      const existingMemories = await memoryStore.listMemories()
      const normalizedMemoryContents = new Set(existingMemories.map((memory) => memory.content.toLowerCase()))
      for (const mem of data.memories) {
        const normalized = mem.content.toLowerCase()
        if (normalizedMemoryContents.has(normalized)) continue

        await memoryStore.addMemory(mem.category as memoryStore.MemoryCategory, mem.content, {
          roleId: mem.roleId,
        })
        normalizedMemoryContents.add(normalized)
        importedMemories++
      }

      for (const [key, value] of Object.entries(data.settings || {})) {
        if (!isSafeBackupSettingKey(key)) continue
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
      log.error('Import failed', { errorType: err instanceof Error ? err.name : 'unknown' })
      return { success: false, error: '导入失败，请检查备份文件后重试' }
    }
  })

  log.info('Data export/import IPC registered')
}

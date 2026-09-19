/**
 * 数据导出/导入 IPC — 备份恢复用户数据
 *
 * 导出格式：JSON 文件，包含会话、消息、记忆、设置、生活资产和播种标记。
 * 导入时按 ID 合并（不覆盖现有数据）；导入文件在写库前做结构与规模校验。
 */
import { app, ipcMain, dialog } from 'electron'
import { createBackupOperationGuard } from './backup-operation'
import { writeFile, readFile, stat } from 'node:fs/promises'
import { createLogger, hashForLog } from '../utils/logger'
import * as sessionStore from '../storage/session-store'
import * as memoryStore from '../storage/memory-store'
import * as settingsStore from '../storage/settings-store'
import { getDatabase, persist } from '../storage/database'
import { BackupImageError, collectBackupImageMedia, isValidBackupImageBundle, prepareBackupImages, restoreBackupImages, toBackupImageReference, type BackupImageMedia, type BackupImageReference } from '../storage/generated-image-backup'
import type {
  BackupLivingAsset,
  BackupLivingAssetSeed,
  ChatSession,
  DataExportStats,
  DataImportStats,
  MemoryCategory,
  SessionKind,
  ToolCall,
  GeneratedImageReference,
} from '../../../src/shared/types'
import {
  BACKUP_LIVING_ASSET_KINDS,
  MAX_COMPANION_RESPONSE_NOTE_LENGTH,
} from '../../../src/shared/types'
import type { Database } from 'sql.js'
import { BACKUP_IMAGE_ERRORS } from '../../../src/shared/backup-errors'

const log = createLogger('DataExport')

const MAX_IMPORT_BYTES = 25 * 1024 * 1024
const MAX_IMPORTED_SESSIONS = 10_000
const MAX_IMPORTED_MESSAGES_PER_SESSION = 10_000
const MAX_IMPORTED_MEMORIES = 10_000
const MAX_IMPORTED_LIVING_ASSETS = 10_000
const MAX_IMPORTED_LIVING_ASSET_SEEDS = 1_000
const MAX_IMPORTED_STRING_LENGTH = 1_000_000
const MAX_IMPORTED_ASSET_NAME_LENGTH = 40
const MAX_IMPORTED_ASSET_PAYLOAD_CHARS = 20_000
const EXPORT_MESSAGE_ROLES = new Set(['user', 'assistant', 'system', 'tool'])
const EXPORT_MEMORY_CATEGORIES = new Set<MemoryCategory>(['identity', 'preference', 'fact', 'workflow', 'voice', 'feedback'])
const EXPORT_LIVING_ASSET_KINDS = new Set<string>(BACKUP_LIVING_ASSET_KINDS)

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
  'companionResponseNote',
  'sessionTokenBudget', 'dailyTokenBudget',
  'companionGrowthStartedAt', 'companionGrowthStartedAtByRole', 'companionMilestonesByRole',
  'companionMomentTipsMuted', 'companionMomentTipsLastAt', 'companionMomentTipsQuietStart',
  'companionMomentTipsQuietEnd', 'companionMomentTipsMaxPerDay', 'companionMomentTipsDayStats',
  'companionProactiveGreetingEnabled', 'companionProactiveGreetingLastDay',
  'conversationDebugMode', 'llmCapabilityCache', 'modelConnections', 'modelRoutes',
])

export function redactModelConnections(raw: string): string {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return '[]'
    return JSON.stringify(parsed.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item
      return { ...(item as Record<string, unknown>), apiKey: '' }
    }))
  } catch {
    return '[]'
  }
}

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

function isPlainPayload(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
}

function isBackupLivingAsset(value: unknown): value is BackupLivingAsset {
  if (!isRecord(value)
    || !boundedString(value.id, 200)
    || !boundedString(value.roleId, 200)
    || !boundedString(value.kind, 40)
    || !EXPORT_LIVING_ASSET_KINDS.has(value.kind)
    || !boundedString(value.name, MAX_IMPORTED_ASSET_NAME_LENGTH)
    || !value.name.trim()
    || !isPlainPayload(value.payload)
    || JSON.stringify(value.payload).length > MAX_IMPORTED_ASSET_PAYLOAD_CHARS
    || !isFiniteNumber(value.acquiredAt)
    || (value.sourceEventId !== null && !boundedString(value.sourceEventId, 200))) return false
  return true
}

function isBackupLivingAssetSeed(value: unknown): value is BackupLivingAssetSeed {
  return isRecord(value)
    && boundedString(value.roleId, 200)
    && boundedString(value.kind, 40)
    && EXPORT_LIVING_ASSET_KINDS.has(value.kind)
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
  const livingAssets = value.livingAssets === undefined ? [] : value.livingAssets
  const livingAssetSeeds = value.livingAssetSeeds === undefined ? [] : value.livingAssetSeeds
  if (!Array.isArray(livingAssets) || livingAssets.length > MAX_IMPORTED_LIVING_ASSETS) return false
  if (!Array.isArray(livingAssetSeeds) || livingAssetSeeds.length > MAX_IMPORTED_LIVING_ASSET_SEEDS) return false

  const sessionIds = new Set<string>()
  const messageIds = new Set<string>()
  for (const session of value.sessions) {
    if (!isRecord(session)
      || !boundedString(session.id, 200) || !session.id || sessionIds.has(session.id)
      || !boundedString(session.title, 20_000)
      || (session.roleId !== undefined && !boundedString(session.roleId, 200))
      || (session.sessionKind !== undefined && session.sessionKind !== 'main' && session.sessionKind !== 'summon' && session.sessionKind !== 'workspace')
      || !isFiniteNumber(session.createdAt)
      || !isFiniteNumber(session.updatedAt)
      || !Array.isArray(session.messages)
      || session.messages.length > MAX_IMPORTED_MESSAGES_PER_SESSION) return false
    sessionIds.add(session.id)
    for (const message of session.messages) {
      if (!isRecord(message)
        || !boundedString(message.id, 200) || !message.id || messageIds.has(message.id)
        || typeof message.role !== 'string'
        || !EXPORT_MESSAGE_ROLES.has(message.role)
        || !boundedString(message.content)
        || !isFiniteNumber(message.timestamp)) return false
      messageIds.add(message.id)
      if (message.toolCalls !== undefined && (message.role !== 'assistant' || !Array.isArray(message.toolCalls)
        || message.toolCalls.length > 256 || message.toolCalls.some(call => !isRecord(call)
          || !boundedString(call.id, 200) || !call.id || !boundedString(call.name, 200) || !call.name
          || !boundedString(call.arguments)))) return false
      if (message.toolCallId !== undefined && (message.role !== 'tool' || !boundedString(message.toolCallId, 200) || !message.toolCallId)) return false
    }
  }

  for (const memory of value.memories) {
    if (!isRecord(memory)
      || !boundedString(memory.id, 200)
      || typeof memory.category !== 'string'
      || !EXPORT_MEMORY_CATEGORIES.has(memory.category as MemoryCategory)
      || (memory.roleId !== undefined && !boundedString(memory.roleId, 200))
      || !isFiniteNumber(memory.createdAt)
      || !isFiniteNumber(memory.updatedAt)) return false
    // 导入会先写会话再写记忆，因此必须在整份预检复用存储约束；
    // 不另设宽松长度上限，任何正文不合法都应在首次写入前拒绝。
    try {
      memoryStore.assertMemoryContentAllowed(memory.content)
    } catch {
      return false
    }
  }

  for (const [key, setting] of Object.entries(value.settings)) {
    if (!boundedString(key, 200) || !boundedString(setting)) return false
    if (key === 'companionResponseNote' && setting.length > MAX_COMPANION_RESPONSE_NOTE_LENGTH) return false
  }

  const seenAssetIds = new Set<string>()
  for (const asset of livingAssets) {
    if (!isBackupLivingAsset(asset) || seenAssetIds.has(asset.id)) return false
    seenAssetIds.add(asset.id)
  }
  const seenSeeds = new Set<string>()
  for (const seed of livingAssetSeeds) {
    if (!isBackupLivingAssetSeed(seed)) return false
    const key = `${seed.roleId}:${seed.kind}`
    if (seenSeeds.has(key)) return false
    seenSeeds.add(key)
  }
  return isValidBackupImageBundle(value.sessions, value.generatedImageMedia)
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
      toolCalls?: ToolCall[]
      toolCallId?: string
      generatedImages?: BackupImageReference[]
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
  livingAssets?: BackupLivingAsset[]
  livingAssetSeeds?: BackupLivingAssetSeed[]
  generatedImageMedia?: BackupImageMedia[]
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
      sessionKind: row.session_kind === 'summon' ? 'summon' : row.session_kind === 'workspace' ? 'workspace' : 'main',
      messages: (session?.messages || []).map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        ...(m.role === 'assistant' && m.toolCalls?.length ? { toolCalls: m.toolCalls } : {}),
        ...(m.role === 'tool' && m.toolCallId ? { toolCallId: m.toolCallId } : {}),
        ...(m.role === 'tool' && m.generatedImages?.length ? { generatedImages: m.generatedImages.map(toBackupImageReference) } : {}),
      })),
    })
  }
  stmt.free()
  return sessions
}

function parseAssetPayload(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * 收集当前库里可备份的生活资产。
 *
 * 背景：人物世界的衣柜 / 文化 / 家居 / 足迹已经进入 companion_assets，旧备份只带走会话和记忆。
 * 设计意图：导出时按稳定 id 全量读取，不经过 Renderer 或 Playground 夹具。
 * 关键约束：只导出白名单 kind；损坏 JSON 降为空对象，不中断整份备份。
 */
export function collectExportLivingAssets(db: Database): BackupLivingAsset[] {
  if (!tableExists(db, 'companion_assets')) return []
  const stmt = db.prepare(
    `SELECT id, role_id, kind, name, payload_json, acquired_at, source_event_id
     FROM companion_assets
     ORDER BY role_id ASC, kind ASC, acquired_at ASC, id ASC`,
  )
  const assets: BackupLivingAsset[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>
    const kind = typeof row.kind === 'string' ? row.kind : ''
    if (!EXPORT_LIVING_ASSET_KINDS.has(kind)) continue
    const id = typeof row.id === 'string' ? row.id : ''
    const roleId = typeof row.role_id === 'string' ? row.role_id : ''
    const name = typeof row.name === 'string' ? row.name : ''
    if (!id || !roleId || !name) continue
    assets.push({
      id,
      roleId,
      kind,
      name,
      payload: parseAssetPayload(row.payload_json),
      acquiredAt: typeof row.acquired_at === 'number' ? row.acquired_at : 0,
      sourceEventId: typeof row.source_event_id === 'string' ? row.source_event_id : null,
    })
  }
  stmt.free()
  return assets
}

/**
 * 收集家居 / 足迹初始化标记，避免恢复后把已删空的列表当成首次启动再补种。
 */
export function collectExportLivingAssetSeeds(db: Database): BackupLivingAssetSeed[] {
  if (!tableExists(db, 'companion_asset_seeds')) return []
  const stmt = db.prepare('SELECT role_id, kind FROM companion_asset_seeds ORDER BY role_id ASC, kind ASC')
  const seeds: BackupLivingAssetSeed[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>
    const roleId = typeof row.role_id === 'string' ? row.role_id : ''
    const kind = typeof row.kind === 'string' ? row.kind : ''
    if (!roleId || !EXPORT_LIVING_ASSET_KINDS.has(kind)) continue
    seeds.push({ roleId, kind })
  }
  stmt.free()
  return seeds
}

function tableExists(db: Database, name: string): boolean {
  const stmt = db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?")
  stmt.bind([name])
  const exists = stmt.step()
  stmt.free()
  return exists
}

function ensureLivingAssetTables(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_assets (
      id               TEXT PRIMARY KEY,
      role_id          TEXT NOT NULL,
      kind             TEXT NOT NULL,
      name             TEXT NOT NULL,
      payload_json     TEXT NOT NULL DEFAULT '{}',
      acquired_at      INTEGER NOT NULL,
      source_event_id  TEXT
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_assets_role_kind
      ON companion_assets(role_id, kind)
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_asset_seeds (
      role_id TEXT NOT NULL,
      kind    TEXT NOT NULL,
      PRIMARY KEY (role_id, kind)
    )
  `)
}

/**
 * 将已校验的生活资产与播种标记写入当前 schema。
 *
 * 背景：导入必须按现有 ID 合并，失败时不能留下半份资产或半份标记。
 * 设计意图：与会话导入共用调用方事务；现有资产 / 标记跳过，不覆盖用户当前数据。
 * 关键约束：只写入白名单 kind；payload 先 JSON 序列化，source_event_id 允许为空。
 */
export function importLivingAssetsIntoDatabase(
  db: Database,
  assets: BackupLivingAsset[] = [],
  seeds: BackupLivingAssetSeed[] = [],
): { assets: number; seeds: number } {
  ensureLivingAssetTables(db)
  let importedAssets = 0
  let importedSeeds = 0
  for (const asset of assets) {
    const existsStmt = db.prepare('SELECT id FROM companion_assets WHERE id = ?')
    existsStmt.bind([asset.id])
    const exists = existsStmt.step()
    existsStmt.free()
    if (exists) continue
    db.run(
      `INSERT INTO companion_assets
         (id, role_id, kind, name, payload_json, acquired_at, source_event_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        asset.id,
        asset.roleId,
        asset.kind,
        asset.name,
        JSON.stringify(asset.payload ?? {}),
        asset.acquiredAt,
        asset.sourceEventId,
      ],
    )
    importedAssets++
  }
  for (const seed of seeds) {
    const existsStmt = db.prepare('SELECT 1 AS x FROM companion_asset_seeds WHERE role_id = ? AND kind = ?')
    existsStmt.bind([seed.roleId, seed.kind])
    const exists = existsStmt.step()
    existsStmt.free()
    if (exists) continue
    db.run('INSERT INTO companion_asset_seeds (role_id, kind) VALUES (?, ?)', [seed.roleId, seed.kind])
    importedSeeds++
  }
  return { assets: importedAssets, seeds: importedSeeds }
}

/**
 * 将已校验的会话写入当前 schema，并返回新增会话数量。
 *
 * 背景：旧实现写入不存在的 createdAt/sessionId/timestamp 列，而且没有 sort_order，导入会
 * 整体失败。设计意图：集中维护 snake_case SQL 和消息顺序，供 IPC 与单测共用。
 * 关键约束：调用方必须先执行 isValidExportData；现有会话跳过，新会话消息 ID 冲突则整笔失败，不能静默丢失工具配对。
 */
export function importSessionsIntoDatabase(
  db: Database,
  sessions: ExportData['sessions'],
  opts?: { transact?: boolean; imageReferences?: ReadonlyMap<string, GeneratedImageReference> },
): number {
  const transact = opts?.transact !== false
  let imported = 0
  if (transact) db.run('BEGIN')
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
        [session.id, session.title, session.createdAt, session.updatedAt, session.roleId || '', session.sessionKind === 'summon' ? 'summon' : session.sessionKind === 'workspace' ? 'workspace' : 'main'],
      )
      session.messages.forEach((msg, sortOrder) => {
        const images = msg.generatedImages?.map(image => {
          const restored = opts?.imageReferences?.get(image.id)
          if (!restored) throw new BackupImageError(BACKUP_IMAGE_ERRORS.incomplete)
          return restored
        })
        db.run(
          `INSERT INTO messages (id, session_id, role, content, tool_calls, tool_call_id, generated_images, created_at, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [msg.id, session.id, msg.role, msg.content, msg.toolCalls ? JSON.stringify(msg.toolCalls) : null, msg.toolCallId ?? null, images?.length ? JSON.stringify(images) : null, msg.timestamp, sortOrder],
        )
      })
      imported++
    }
    if (transact) db.run('COMMIT')
    return imported
  } catch (error) {
    if (transact) {
      try { db.run('ROLLBACK') } catch { /* 原错误优先 */ }
    }
    throw error
  }
}

/**
 * 把已校验的会话和生活资产写入当前库；失败时整笔回滚。
 *
 * 背景：生活资产与播种标记必须一起恢复，半份写入会让删空后的家居 / 足迹被再次补种。
 * 设计意图：所有表使用同一同步事务，记忆和设置调用共享写入原语，成功落盘后才发出副作用。
 * 关键约束：禁止 await；COMMIT 后 persist 失败须同步补偿内存，不替换全局数据库对象。
 */
export function importBackupPayload(
  db: Database,
  payload: {
    sessions: ExportData['sessions']
    livingAssets: BackupLivingAsset[]
    livingAssetSeeds: BackupLivingAssetSeed[]
    imageReferences?: ReadonlyMap<string, GeneratedImageReference>
    memories?: ExportData['memories']
    settings?: ReturnType<typeof settingsStore.prepareSettingWrite>[]
    persist?: () => void
  },
): DataImportStats {
  let importedSessions = 0
  let importedLiving = { assets: 0, seeds: 0 }
  const undo: Array<() => void> = []
  const afterCommit: Array<() => void> = []
  let importedMemories = 0
  let committed = false
  const exists = (sql: string, values: string[]) => {
    const statement = db.prepare(sql)
    try { statement.bind(values); return statement.step() } finally { statement.free() }
  }
  db.run('BEGIN')
  try {
    for (const session of payload.sessions) {
      if (!exists('SELECT id FROM sessions WHERE id = ?', [session.id])) {
        undo.push(() => {
          db.run('DELETE FROM messages WHERE session_id = ?', [session.id])
          db.run('DELETE FROM sessions WHERE id = ?', [session.id])
        })
      }
    }
    ensureLivingAssetTables(db)
    for (const asset of payload.livingAssets) {
      if (!exists('SELECT id FROM companion_assets WHERE id = ?', [asset.id])) undo.push(() => { db.run('DELETE FROM companion_assets WHERE id = ?', [asset.id]) })
    }
    for (const seed of payload.livingAssetSeeds) {
      if (!exists('SELECT 1 FROM companion_asset_seeds WHERE role_id = ? AND kind = ?', [seed.roleId, seed.kind])) {
        undo.push(() => { db.run('DELETE FROM companion_asset_seeds WHERE role_id = ? AND kind = ?', [seed.roleId, seed.kind]) })
      }
    }
    importedSessions = importSessionsIntoDatabase(db, payload.sessions, { transact: false, imageReferences: payload.imageReferences })
    importedLiving = importLivingAssetsIntoDatabase(db, payload.livingAssets, payload.livingAssetSeeds)
    for (const memory of payload.memories ?? []) {
      const result = memoryStore.writeMemoryToDatabase(db, memory.category as MemoryCategory, memory.content, { roleId: memory.roleId })
      if (result.inserted) {
        importedMemories++
        undo.push(() => { db.run('DELETE FROM memories WHERE id = ?', [result.entry.id]) })
      }
      afterCommit.push(result.afterCommit)
    }
    for (const setting of payload.settings ?? []) {
      const statement = db.prepare('SELECT value FROM settings WHERE key = ?')
      let previous: string | undefined
      try { statement.bind([setting.key]); if (statement.step()) previous = statement.getAsObject().value as string } finally { statement.free() }
      undo.push(() => {
        if (previous === undefined) db.run('DELETE FROM settings WHERE key = ?', [setting.key])
        else db.run('UPDATE settings SET value = ? WHERE key = ?', [previous, setting.key])
      })
      settingsStore.writePreparedSetting(db, setting)
    }
    db.run('COMMIT')
    committed = true
    payload.persist?.()
  } catch (error) {
    if (committed) {
      db.run('BEGIN')
      try {
        for (const revert of undo.reverse()) revert()
        db.run('COMMIT')
      } catch {
        log.error('Backup in-memory compensation failed')
        throw new Error('导入恢复失败，请重启应用后重试')
      }
    } else {
      try { db.run('ROLLBACK') } catch { log.error('Backup transaction rollback failed') }
    }
    throw error
  }
  for (const publish of afterCommit) {
    try { publish() } catch { log.warn('Committed backup background notification failed') }
  }
  return {
    sessions: importedSessions,
    memories: importedMemories,
    settings: payload.settings?.length ?? 0,
    livingAssets: importedLiving.assets,
    livingAssetSeeds: importedLiving.seeds,
  }
}

export function registerDataExportIPC(): void {
  const operations = createBackupOperationGuard()
  ipcMain.handle('data:export', async (event) => {
    const operation = operations.begin(event)
    if (!operation.ok) return { success: false, error: operation.error }
    try {
      const result = await dialog.showSaveDialog(operation.window, {
        title: '导出数据',
        defaultPath: `my-agent-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })

      if (!operation.isActive() || result.canceled || !result.filePath) return { success: false, error: 'cancelled' }

      const db = await getDatabase()
      const sessions = await collectExportSessions(db)
      const generatedImageMedia = await collectBackupImageMedia(sessions)
      const memories = await memoryStore.listMemories()
      const settings = await settingsStore.getAllSettings()
      const livingAssets = collectExportLivingAssets(db)
      const livingAssetSeeds = collectExportLivingAssetSeeds(db)

      const safeSettings: Record<string, string> = {}
      for (const [key, value] of Object.entries(settings)) {
        if (isSafeBackupSettingKey(key)) safeSettings[key] = key === 'modelConnections' ? redactModelConnections(value) : value
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
        livingAssets,
        livingAssetSeeds,
        ...(generatedImageMedia.length ? { generatedImageMedia } : {}),
      }

      if (!isValidExportData(data)) throw new BackupImageError(BACKUP_IMAGE_ERRORS.export)
      const serialized = JSON.stringify(data, null, 2)
      if (Buffer.byteLength(serialized, 'utf8') > MAX_IMPORT_BYTES) throw new BackupImageError(BACKUP_IMAGE_ERRORS.size)
      if (!operation.beginCommit()) return { success: false, error: 'cancelled' }
      await writeFile(result.filePath, serialized, 'utf-8')
      const stats: DataExportStats = {
        sessions: sessions.length,
        memories: memories.length,
        livingAssets: livingAssets.length,
      }
      log.info('Data exported', {
        pathHash: hashForLog(result.filePath),
        ...stats,
        livingAssetSeeds: livingAssetSeeds.length,
      })

      return { success: true, path: result.filePath, stats }
    } catch (err) {
      log.error('Export failed', { errorType: err instanceof Error ? err.name : 'unknown' })
      return { success: false, error: err instanceof BackupImageError ? err.message : '导出失败，请重试' }
    } finally {
      operation.finish()
    }
  })

  ipcMain.handle('data:import', async (event) => {
    const operation = operations.begin(event)
    if (!operation.ok) return { success: false, error: operation.error }
    try {
      const result = await dialog.showOpenDialog(operation.window, {
        title: '导入数据',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      })

      if (!operation.isActive() || result.canceled || !result.filePaths[0]) return { success: false, error: 'cancelled' }

      const importPath = result.filePaths[0]
      const fileStat = await stat(importPath)
      if (fileStat.size > MAX_IMPORT_BYTES) {
        return { success: false, error: '备份文件过大，无法导入' }
      }
      const raw = await readFile(importPath, 'utf-8')
      if (!operation.isActive()) return { success: false, error: 'cancelled' }
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
      const preparedImages = await prepareBackupImages(data.generatedImageMedia ?? [])
      if (!operation.isActive()) return { success: false, error: 'cancelled' }

      const db = await getDatabase()
      const existingMemories = await memoryStore.listMemories()
      const normalizedMemoryContents = new Set(existingMemories.map((memory) => memory.content.toLowerCase()))
      const pendingMemories = data.memories.filter((mem) => {
        const normalized = mem.content.toLowerCase()
        if (normalizedMemoryContents.has(normalized)) return false
        normalizedMemoryContents.add(normalized)
        return true
      })
      const pendingSettings: ReturnType<typeof settingsStore.prepareSettingWrite>[] = []
      const settingEntries = Object.entries(data.settings || {}).filter(([key]) => isSafeBackupSettingKey(key))
      if (settingEntries.length) await settingsStore.ensureTable()
      for (const [key, value] of settingEntries) {
        if (!isSafeBackupSettingKey(key)) continue
        const statement = db.prepare('SELECT value FROM settings WHERE key = ?')
        let current: unknown
        try { statement.bind([key]); if (statement.step()) current = statement.getAsObject().value } finally { statement.free() }
        // 默认值不是用户写入，不能让空库的 [] / false 阻断备份恢复；已有密文也不解密或覆盖。
        if (!current) pendingSettings.push(settingsStore.prepareSettingWrite(key, value))
      }

      if (!operation.beginCommit()) return { success: false, error: 'cancelled' }
      const newSessions = data.sessions.filter(session => {
        const statement = db.prepare('SELECT id FROM sessions WHERE id = ?')
        try { statement.bind([session.id]); return !statement.step() } finally { statement.free() }
      })
      const restored = restoreBackupImages(preparedImages, newSessions, preparedImages.length ? app.getPath('userData') : '')
      let importedCore: ReturnType<typeof importBackupPayload>
      try {
        importedCore = importBackupPayload(db, {
          sessions: newSessions,
          livingAssets: data.livingAssets ?? [],
          livingAssetSeeds: data.livingAssetSeeds ?? [],
          imageReferences: restored.references,
          memories: pendingMemories,
          settings: pendingSettings,
          persist,
        })
      } catch (error) { restored.rollback(); throw error }
      restored.finish()
      const stats: DataImportStats = importedCore
      log.info('Data imported', stats)
      return { success: true, stats }
    } catch (err) {
      log.error('Import failed', { errorType: err instanceof Error ? err.name : 'unknown' })
      return { success: false, error: err instanceof BackupImageError ? err.message : '导入失败，请检查备份文件后重试' }
    } finally {
      operation.finish()
    }
  })

  log.info('Data export/import IPC registered')
}

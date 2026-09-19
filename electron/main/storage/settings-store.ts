import { safeStorage } from 'electron'
import { getDatabase, persist } from './database'
import { createLogger } from '../utils/logger'
import { MAX_COMPANION_RESPONSE_NOTE_LENGTH } from '../../../src/shared/types'
import type { ModelConfigurationInput } from '../../../src/shared/types'
import type { Database } from 'sql.js'

const log = createLogger('SettingsStore')
const modelConfigurationListeners = new Set<() => void | Promise<void>>()

export function subscribeModelConfigurationCommitted(listener: () => void | Promise<void>): () => void {
  modelConfigurationListeners.add(listener)
  return () => { modelConfigurationListeners.delete(listener) }
}

/**
 * 背景：配置保存及备份导入成功后，派生索引需要读取新身份，不能继续等待记忆被编辑。
 * 意图：存储只发布无凭据的提交通知，由上层服务订阅，不反向 import 记忆或模型模块。
 * 约束：仅在整次持久化成功后调用；监听失败不反转已成功的保存，通知不等待网络。
 */
export function publishModelConfigurationCommitted(keys: readonly string[]): void {
  if (!keys.some(key => key === 'modelConnections' || key === 'modelRoutes')) return
  for (const listener of [...modelConfigurationListeners]) {
    try {
      void Promise.resolve(listener()).catch(() => log.warn('Model configuration observer failed'))
    } catch { log.warn('Model configuration observer failed') }
  }
}

const ENCRYPTED_KEYS = new Set<keyof AppSettings>(['llmApiKey', 'mcpServers', 'modelConnections'])
const ENCRYPTED_VALUE_PREFIX = 'enc:v1:'
export const MAX_SETTING_VALUE_LENGTH = 1_000_000

function encrypt(value: string): string {
  if (!value) return value
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('系统安全存储不可用，无法安全保存敏感设置')
  }
  return ENCRYPTED_VALUE_PREFIX + safeStorage.encryptString(value).toString('base64')
}

function decryptPayload(encoded: string): string | null {
  if (!encoded || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  } catch {
    return null
  }
}

/**
 * 解码敏感设置并迁移旧格式。
 *
 * 背景：旧版本既出现过明文 API Key / MCP JSON，也出现过没有格式前缀的 safeStorage
 * base64；若解密失败后直接返回原字符串，会把旧明文继续留在 SQLite，甚至把损坏密文
 * 当作 API Key 交给 Provider。
 * 设计意图：新密文统一使用 `enc:v1:` 包络；旧密文先尝试解密，失败则按旧明文迁移。
 * 关键约束：带新前缀的值解密失败必须 fail-closed，不能回退为原文。
 */
export function decodeStoredSetting(
  key: keyof AppSettings,
  stored: string,
): { value: string; migratedValue?: string } {
  if (!stored || !safeStorage.isEncryptionAvailable()) return { value: '' }

  if (stored.startsWith(ENCRYPTED_VALUE_PREFIX)) {
    return { value: decryptPayload(stored.slice(ENCRYPTED_VALUE_PREFIX.length)) ?? '' }
  }

  if (key === 'mcpServers' && stored.trimStart().startsWith('[')) {
    return { value: stored, migratedValue: encrypt(stored) }
  }

  const legacyCipher = decryptPayload(stored)
  if (legacyCipher !== null) {
    return { value: legacyCipher, migratedValue: encrypt(legacyCipher) }
  }

  return { value: stored, migratedValue: encrypt(stored) }
}

export const __test = { ENCRYPTED_VALUE_PREFIX }

export interface AppSettings {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  llmTemperature: string
  llmTopP: string
  llmMaxTokens: string
  systemPrompt: string
  /** 用户在伙伴设置中填写的回应偏好，不能替代 systemPrompt 或 Role Pack。 */
  companionResponseNote: string
  /** 当前活跃主角（Companion Role Pack id） */
  activeRoleId: string
  /** 当前宇宙 id，默认 default */
  universeId: string
  /** JSON string — McpServerConfig[] */
  mcpServers: string
  /** @deprecated 写入边界改由 executionMode → resolveEffectiveSandbox；保留键以免旧库报错 */
  sandboxMode: string
  /** 对话页审批模式：auto | confirm-all | plan-first | full-access（并推导有效沙箱） */
  executionMode: string
  /**
   * 用户专家度（M30-G3）：auto | novice | intermediate | expert | unknown
   * auto/空 = 启发式；显式值覆盖解释粒度。
   */
  userExpertiseLevel: string
  /** 辅助任务模型（标题/画像/压缩摘要，留空则沿用主模型） */
  auxModel: string
  /** 会话级 Token 预算（0 = 无限制） */
  sessionTokenBudget: string
  /** 日级 Token 预算（0 = 无限制） */
  dailyTokenBudget: string
  /** 当前项目目录路径 */
  currentProject: string
  /** 最近使用的项目目录列表（JSON 字符串） */
  recentProjects: string
  /** 自定义权限规则 JSON（PermissionRule[]），启动时 loadRules */
  permissionRules: string
  /**
   * @deprecated 旧全局成长时钟；仅作迁移源。新逻辑用 companionGrowthStartedAtByRole
   */
  companionGrowthStartedAt: string
  /** 成长核冷启动时钟（按 role 分桶）：JSON Record<roleId, ms>；空对象=尚未开始 */
  companionGrowthStartedAtByRole: string
  /** 关系里程碑（按 role）：JSON Record<roleId, MilestoneKind[]>（M30-G1） */
  companionMilestonesByRole: string
  /** 新 Moment 应用内轻提示是否静音（M31-G1）：true|false */
  companionMomentTipsMuted: string
  /** 上次 Moment 轻提示时间戳 ms（M31-G1 冷却） */
  companionMomentTipsLastAt: string
  /** 勿扰开始小时 0–23（M31-G2），默认 22；与 end 相等=关闭勿扰 */
  companionMomentTipsQuietStart: string
  /** 勿扰结束小时 0–23（M31-G2），默认 8；可跨午夜 */
  companionMomentTipsQuietEnd: string
  /** 每日最多生活轻提示条数（M31-G2），默认 3；0=不限 */
  companionMomentTipsMaxPerDay: string
  /** 当日计数 JSON：{ day: YYYY-MM-DD, count: number }（M31-G2） */
  companionMomentTipsDayStats: string
  /** 定时主动问候开关（M31-G3 / L4）：默认 false */
  companionProactiveGreetingEnabled: string
  /** 上次主动问候本地日 YYYY-MM-DD（M31-G3） */
  companionProactiveGreetingLastDay: string
  /**
   * 已废弃的 Chat 内 Debug 旧键（M32-G7）：true|false。
   * 为兼容既有设置导出而保留；当前 Debug 统一由全页 DevPanel 承载，不再读取此键。
   */
  conversationDebugMode: string
  /** 普通模式隐藏 Debug / Playground；仅由关于页显式开启。 */
  developerMode: string
  /**
   * 模型能力探测缓存（Playground「模型测试」写入）：
   * JSON Record<`${baseUrl}|${model}`, { thinkingDisable, probedAt?, note? }>
   */
  llmCapabilityCache: string
  /** JSON ModelConnectionProfile[]；为空时沿用旧单连接字段。 */
  modelConnections: string
  /** JSON ModelRouteProfile[]；为空时由旧主/辅助字段生成默认路由。 */
  modelRoutes: string
}

export function isAppSettingKey(key: string): key is keyof AppSettings {
  return Object.prototype.hasOwnProperty.call(getDefaults(), key)
}

function getDefaults(): AppSettings {
  return {
    llmApiKey: process.env.LLM_API_KEY || '',
    llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    llmModel: process.env.LLM_MODEL || 'gpt-4o',
    llmTemperature: '0.7',
    llmTopP: '1',
    llmMaxTokens: '4096',
    systemPrompt: '',
    companionResponseNote: '',
    activeRoleId: 'lin',
    universeId: 'default',
    mcpServers: '[]',
    sandboxMode: 'workspace-write',
    executionMode: 'auto',
    userExpertiseLevel: 'auto',
    auxModel: '',
    sessionTokenBudget: '0',
    dailyTokenBudget: '0',
    currentProject: '',
    recentProjects: '[]',
    permissionRules: '[]',
    companionGrowthStartedAt: '',
    companionGrowthStartedAtByRole: '{}',
    companionMilestonesByRole: '{}',
    companionMomentTipsMuted: 'false',
    companionMomentTipsLastAt: '',
    companionMomentTipsQuietStart: '22',
    companionMomentTipsQuietEnd: '8',
    companionMomentTipsMaxPerDay: '3',
    companionMomentTipsDayStats: '',
    companionProactiveGreetingEnabled: 'false',
    companionProactiveGreetingLastDay: '',
    conversationDebugMode: 'false',
    developerMode: 'false',
    llmCapabilityCache: '{}',
    modelConnections: '[]',
    modelRoutes: '[]',
  }
}

export async function ensureTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
  // 破坏性重置：旧 personaId 键直接删除，不做映射兼容
  db.run(`DELETE FROM settings WHERE key = 'personaId'`)
}

export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  await ensureTable()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
  stmt.bind([key])

  if (stmt.step()) {
    const row = stmt.getAsObject() as { value: string }
    stmt.free()
    let val = row.value
    if (val && ENCRYPTED_KEYS.has(key)) {
      const decoded = decodeStoredSetting(key, val)
      val = decoded.value
      if (decoded.migratedValue) {
        db.run('UPDATE settings SET value = ? WHERE key = ?', [decoded.migratedValue, key])
        persist()
      }
    }
    const defaults = getDefaults()
    return (val !== '' ? val : defaults[key]) as AppSettings[K]
  }

  stmt.free()
  return getDefaults()[key]
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  const prepared = prepareSettingWrite(key, value)
  await ensureTable()
  const db = await getDatabase()
  // 模型单键入口也会被配置工厂读取；持久化失败必须恢复内存，不能通知后端使用失败配置。
  const modelKey = key === 'modelConnections' || key === 'modelRoutes'
  const previous = modelKey ? db.exec('SELECT value FROM settings WHERE key = ?', [key])[0]?.values[0]?.[0] : undefined
  try {
    writePreparedSetting(db, prepared)
    persist()
  } catch (error) {
    if (!modelKey) throw error
    try {
      if (previous === undefined) db.run('DELETE FROM settings WHERE key = ?', [key])
      else db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, previous])
    } catch {
      log.error('Model setting rollback failed')
      throw new Error('模型配置恢复失败，请重启应用后重试')
    }
    throw new Error('模型配置保存失败，原配置已保留，请重试')
  }
  publishModelConfigurationCommitted([key])
  log.info(`Setting updated: ${key}`)
}

/**
 * 背景：备份不能在写入其他表后才发现密钥加密失败。
 * 意图：普通保存与批量导入共用准备逻辑，不复制校验或密文格式。
 * 约束：此函数不写库，prepared 值只供主进程同步提交，不向 Renderer 暴露。
 */
export function prepareSettingWrite<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  if (!isAppSettingKey(String(key))) throw new Error('无效的设置项')
  if (typeof value !== 'string' || value.length > MAX_SETTING_VALUE_LENGTH) {
    throw new Error('设置值无效或超出长度限制')
  }
  if (key === 'companionResponseNote' && value.length > MAX_COMPANION_RESPONSE_NOTE_LENGTH) {
    throw new Error('相处补充说明超出长度限制')
  }
  const stored = ENCRYPTED_KEYS.has(key) && value ? encrypt(String(value)) : String(value)
  return { key, stored }
}

export function writePreparedSetting(db: Database, { key, stored }: ReturnType<typeof prepareSettingWrite>): void {
  const existing = db.prepare('SELECT 1 FROM settings WHERE key = ?')
  existing.bind([key])
  const exists = existing.step()
  existing.free()

  if (exists) {
    db.run('UPDATE settings SET value = ? WHERE key = ?', [stored, key])
  } else {
    db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, stored])
  }
}

/**
 * 背景：模型连接与用途路由分开写盘会在失败时留下半套配置。
 * 设计意图：沿用 Skill 状态的同步写入及失败补偿，仅处理这两个设置键。
 * 关键约束：密文先准备；读旧值、两次 SQL、persist 与恢复之间不得 await；sql.js export 不能置于未提交事务内。
 */
export async function saveModelConfiguration(input: ModelConfigurationInput): Promise<void> {
  if ([input.connections, input.routes].some((value) => typeof value !== 'string' || value.length > MAX_SETTING_VALUE_LENGTH)) {
    throw new Error('模型配置无效或超出长度限制')
  }
  const values = [encrypt(input.connections), input.routes]
  await ensureTable()
  const db = await getDatabase()
  const keys = ['modelConnections', 'modelRoutes'] as const
  const previous = keys.map((key) => db.exec('SELECT value FROM settings WHERE key = ?', [key])[0]?.values[0]?.[0])
  const write = (key: string, value: string | number | Uint8Array | null) => db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value],
  )
  let written = 0
  try {
    keys.forEach((key, index) => { write(key, values[index]); written++ })
    persist()
  } catch {
    try {
      for (let index = written - 1; index >= 0; index--) {
        const value = previous[index]
        if (value === undefined) db.run('DELETE FROM settings WHERE key = ?', [keys[index]])
        else write(keys[index], value)
      }
    } catch {
      log.error('Model configuration rollback failed')
      throw new Error('模型配置恢复失败，请重启应用后重试')
    }
    throw new Error('模型配置保存失败，原配置已保留，请重试')
  }
  publishModelConfigurationCommitted(keys)
}

export async function getAllSettings(): Promise<AppSettings> {
  await ensureTable()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT key, value FROM settings')

  const result = { ...getDefaults() }
  const migrations: Array<{ key: keyof AppSettings; value: string }> = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as { key: string; value: string }
    if (row.key in result && row.value !== '') {
      const key = row.key as keyof AppSettings
      let val = row.value
      if (ENCRYPTED_KEYS.has(key)) {
        const decoded = decodeStoredSetting(key, val)
        val = decoded.value
        if (decoded.migratedValue) migrations.push({ key, value: decoded.migratedValue })
      }
      ;(result as Record<string, string>)[row.key] = val
    }
  }
  stmt.free()
  for (const migration of migrations) {
    db.run('UPDATE settings SET value = ? WHERE key = ?', [migration.value, migration.key])
  }
  if (migrations.length > 0) persist()
  return result
}

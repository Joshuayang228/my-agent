import { safeStorage } from 'electron'
import { getDatabase, persist } from './database'
import { createLogger } from '../utils/logger'

const log = createLogger('SettingsStore')

const ENCRYPTED_KEYS = new Set<keyof AppSettings>(['llmApiKey'])
export const MAX_SETTING_VALUE_LENGTH = 1_000_000

function encrypt(value: string): string {
  if (!value) return value
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('系统安全存储不可用，无法安全保存 API Key')
  }
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(encoded: string): string {
  if (!encoded) return encoded
  if (!safeStorage.isEncryptionAvailable()) return ''
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  } catch {
    return encoded
  }
}

export interface AppSettings {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  llmTemperature: string
  llmTopP: string
  llmMaxTokens: string
  systemPrompt: string
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
   * 对话内 debugMode 叠加（M32-G7）：true|false
   * 与全页 Debug/Playground 入口无关；只提高主聊天信息密度。
   */
  conversationDebugMode: string
  /**
   * 模型能力探测缓存（Playground「模型测试」写入）：
   * JSON Record<`${baseUrl}|${model}`, { thinkingDisable, probedAt?, note? }>
   */
  llmCapabilityCache: string
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
    llmCapabilityCache: '{}',
  }
}

async function ensureTable(): Promise<void> {
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
    if (val && ENCRYPTED_KEYS.has(key)) val = decrypt(val)
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
  if (!isAppSettingKey(String(key))) throw new Error('无效的设置项')
  if (typeof value !== 'string' || value.length > MAX_SETTING_VALUE_LENGTH) {
    throw new Error('设置值无效或超出长度限制')
  }
  await ensureTable()
  const db = await getDatabase()

  const existing = db.prepare('SELECT 1 FROM settings WHERE key = ?')
  existing.bind([key])
  const exists = existing.step()
  existing.free()

  let stored = String(value)
  if (ENCRYPTED_KEYS.has(key) && stored) stored = encrypt(stored)

  if (exists) {
    db.run('UPDATE settings SET value = ? WHERE key = ?', [stored, key])
  } else {
    db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, stored])
  }

  persist()
  log.info(`Setting updated: ${key}`)
}

export async function getAllSettings(): Promise<AppSettings> {
  await ensureTable()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT key, value FROM settings')

  const result = { ...getDefaults() }
  while (stmt.step()) {
    const row = stmt.getAsObject() as { key: string; value: string }
    if (row.key in result && row.value !== '') {
      let val = row.value
      if (ENCRYPTED_KEYS.has(row.key as keyof AppSettings)) val = decrypt(val)
      ;(result as Record<string, string>)[row.key] = val
    }
  }
  stmt.free()
  return result
}

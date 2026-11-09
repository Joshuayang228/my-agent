/**
 * 交流冲动与主动问候落会话单测
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import initSqlJs from 'sql.js'
import { formatConversationImpulseForPrompt } from '../../electron/main/companion/orchestrator'
import { buildLlmPrompt } from '../../electron/main/prompts/companion-behaviors'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: { getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

const {
  ensureMainSessionForRole,
  getLatestMainSessionForRole,
  saveMessage,
} = await import('../../electron/main/storage/session-store')

describe('formatConversationImpulseForPrompt', () => {
  it('无动态且体征常态时返回 undefined，不硬造心境', () => {
    const result = formatConversationImpulseForPrompt({
      socialNeed: 50,
      currentActivity: '',
      latestMomentText: undefined,
    })
    expect(result).toBeUndefined()
  })

  it('社交需求高时注入强表达欲提示与最近动态', () => {
    const result = formatConversationImpulseForPrompt({
      socialNeed: 75,
      currentActivity: '整理船头的航海图',
      latestMomentText: '今天海风超舒服！',
    })
    expect(result).toBeTruthy()
    expect(result).toContain('今天海风超舒服！')
    expect(result).toContain('你此刻很有倾诉欲和活力')
    expect(result).toContain('若这轮是闲聊开场或随口问候')
  })

  it('社交需求低时注入沉静倾听倾向', () => {
    const result = formatConversationImpulseForPrompt({
      socialNeed: 20,
      currentActivity: '在甲板看夕阳',
    })
    expect(result).toBeTruthy()
    expect(result).toContain('在甲板看夕阳')
    expect(result).toContain('倾向于简练回应、多听对方说')
  })
})

describe('buildLlmPrompt with lifeContext', () => {
  it('日剧本 Prompt 包含近期生活因果连续性线索', () => {
    const prompt = buildLlmPrompt({
      roleName: '路飞',
      roleId: 'luffy',
      date: '2026-11-08',
      voiceHint: '豪爽直接',
      characterHint: '千阳号船长',
      lifeContext: '昨日轨迹：在共享甲板看夕阳；用户昨晚提到想看海',
    })
    expect(prompt).toContain('近期生活与现实连续性线索')
    expect(prompt).toContain('昨日轨迹：在共享甲板看夕阳；用户昨晚提到想看海')
  })
})

describe('ensureMainSessionForRole & proactive greeting delivery', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    memDb.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        role_id TEXT,
        session_kind TEXT,
        parent_session_id TEXT,
        total_prompt_tokens INTEGER DEFAULT 0,
        total_completion_tokens INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        role TEXT,
        content TEXT,
        tool_calls TEXT,
        tool_call_id TEXT,
        created_at INTEGER,
        sort_order INTEGER,
        generated_images TEXT
      );
    `)
  })

  afterEach(() => {
    memDb.close()
  })

  it('角色无会话时 ensureMainSessionForRole 自动创建并可复用', async () => {
    const session = await ensureMainSessionForRole('luffy')
    expect(session.id).toBeTruthy()
    expect(session.roleId).toBe('luffy')
    expect(session.sessionKind).toBe('main')

    const same = await getLatestMainSessionForRole('luffy')
    expect(same?.id).toBe(session.id)
  })

  it('主动问候消息作为 assistant 角色真实持久化在会话中', async () => {
    const session = await ensureMainSessionForRole('luffy')
    await saveMessage(session.id, {
      id: 'msg-greeting-1',
      role: 'assistant',
      content: '今天海风超舒服！带你吹吹风！',
      timestamp: Date.now(),
    })

    const reloaded = await getLatestMainSessionForRole('luffy')
    expect(reloaded?.messages).toHaveLength(1)
    expect(reloaded?.messages[0].role).toBe('assistant')
    expect(reloaded?.messages[0].content).toBe('今天海风超舒服！带你吹吹风！')
  })
})

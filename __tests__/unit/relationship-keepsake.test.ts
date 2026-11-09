/**
 * 羁绊深度跃迁与专属信物馈赠（Relationship Progression & Keepsake Gifts）门禁测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import initSqlJs from 'sql.js'

const sendMock = vi.fn()
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: {
    getAllWindows: () => [{ isDestroyed: () => false, webContents: { send: sendMock } }],
  },
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

const settingsStore = new Map<string, string>()
vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (k: string) => settingsStore.get(k) || ''),
  setSetting: vi.fn(async (k: string, v: string) => { settingsStore.set(k, v) }),
  getAllSettings: vi.fn(async () => ({})),
  getAllSettingsReadOnly: vi.fn(() => ({})),
}))

const llmState = vi.hoisted(() => ({
  response: JSON.stringify({
    giftSpeech: '喂！这个送给你！不管以后遇到多大的风浪，只要顺着它就能找到我！',
    celebrationTitle: '路飞赠送了你专属信物',
  }),
}))

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete: vi.fn(async () => llmState.response),
}))

const {
  ensureKeepsakeTable,
  listKeepsakes,
  triggerGiftKeepsake,
  PRESET_KEEPSAKES_LUFFY,
} = await import('../../electron/main/companion/growth/relationship-keepsake')
const { getSession } = await import('../../electron/main/storage/session-store')
const { listMilestoneKinds } = await import('../../electron/main/companion/growth/milestones')

describe('羁绊深度跃迁与专属信物馈赠（Relationship Keepsake Gifts）', () => {
  beforeEach(async () => {
    memDb = new SQL.Database()
    memDb.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id                       TEXT PRIMARY KEY,
        title                    TEXT NOT NULL DEFAULT '新对话',
        created_at               INTEGER NOT NULL,
        updated_at               INTEGER NOT NULL,
        total_prompt_tokens      INTEGER NOT NULL DEFAULT 0,
        total_completion_tokens  INTEGER NOT NULL DEFAULT 0,
        role_id                  TEXT NOT NULL DEFAULT '',
        session_kind             TEXT NOT NULL DEFAULT 'main',
        parent_session_id        TEXT
      );
      CREATE TABLE IF NOT EXISTS messages (
        id               TEXT PRIMARY KEY,
        session_id       TEXT NOT NULL,
        role             TEXT NOT NULL,
        content          TEXT NOT NULL,
        timestamp        INTEGER NOT NULL,
        model            TEXT,
        tokens           INTEGER,
        reasoning_tokens INTEGER,
        metadata         TEXT,
        generated_images TEXT
      );
    `)
    settingsStore.clear()
    sendMock.mockClear()
  })

  it('表初始化为路飞自动播种首件羁绊信物（生命卡的一角）并记录里程碑', async () => {
    await ensureKeepsakeTable()
    const keepsakes = await listKeepsakes('luffy')
    expect(keepsakes.length).toBe(1)
    expect(keepsakes[0].id).toBe('luffy-vivre-card')
    expect(keepsakes[0].name).toBe('生命卡的一角')
    expect(keepsakes[0].giftReason).toContain('伙伴誓约')

    // 验证关系里程碑已记录
    const milestones = await listMilestoneKinds('luffy')
    expect(milestones).toContain('keepsake_gifted')
  })

  it('triggerGiftKeepsake 赠送下一件信物、将赠言写入主会话并广播桌面事件', async () => {
    await ensureKeepsakeTable()
    const now = Date.now()

    // 触发赠送第二件信物（梅利号小羊金色铃铛）
    const gifted = await triggerGiftKeepsake('luffy', 'luffy-merry-bell', '共同经历险阻的纪念', now, {
      llmConfig: { apiKey: 'sk-test', baseUrl: 'https://api.test', model: 'gpt-4o' } as any,
    })

    expect(gifted).not.toBeNull()
    expect(gifted?.id).toBe('luffy-merry-bell')
    expect(gifted?.name).toBe('梅利号的小羊金色铃铛')
    expect(gifted?.giftMessage).toContain('这个送给你')

    // 验证消息已写入角色专属主会话
    const keepsakes = await listKeepsakes('luffy')
    expect(keepsakes.length).toBe(2)

    // 验证桌面广播
    expect(sendMock).toHaveBeenCalledWith('companion:keepsake-gifted', expect.objectContaining({
      roleId: 'luffy',
      keepsake: expect.objectContaining({ id: 'luffy-merry-bell' }),
    }))
  })

  it('预设信物全部赠送后平滑生成定制专属信物，不阻塞流程', async () => {
    await ensureKeepsakeTable()
    const now = Date.now()

    // 赠送梅利号铃铛
    await triggerGiftKeepsake('luffy', 'luffy-merry-bell', '纪念', now)
    // 赠送风车村麦穗手绳
    await triggerGiftKeepsake('luffy', 'luffy-windmill-braid', '家乡信物', now + 1000)

    const list = await listKeepsakes('luffy')
    expect(list.length).toBe(3)

    // 再次触发，自动生成高阶纪念信物
    const extra = await triggerGiftKeepsake('luffy', undefined, '终极同伴之证', now + 2000)
    expect(extra).not.toBeNull()
    expect(extra?.name).toContain('随身符')

    const finalList = await listKeepsakes('luffy')
    expect(finalList.length).toBe(4)
  })
})

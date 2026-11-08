/**
 * 会话到生活的因果反哺（Chat to Life Resonance）门禁测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

const llmState = vi.hoisted(() => ({
  response: '{"hasResonance":false}',
}))

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete: vi.fn(async () => llmState.response),
}))

let mockSession: Record<string, unknown> | null = null
vi.mock('../../electron/main/storage/session-store', () => ({
  getSession: vi.fn(async () => mockSession),
  listRecentUserMessagesForRole: vi.fn(async () => []),
}))

const {
  settleChatResonance,
  listLifeResonances,
  markResonancesAbsorbed,
  ensureResonanceTable,
} = await import('../../electron/main/companion/life/chat-resonance')
const { listAssets } = await import('../../electron/main/companion/life/assets')
const { collectDayScriptLifeContext } = await import('../../electron/main/companion/life/script-generator')

describe('会话到生活的因果反哺（Chat to Life Resonance）', () => {
  beforeEach(async () => {
    memDb = new SQL.Database()
    await ensureResonanceTable()
    sendMock.mockClear()
    mockSession = {
      id: 'session-1',
      roleId: 'luffy',
      sessionKind: 'main',
      messages: [
        { role: 'user', content: '路飞，推荐你看《老人与海》，里面在大海上和大鱼搏斗的故事特别热血！' },
        { role: 'assistant', content: '哇！听起来好酷！我也想看看到底有多大的大鱼！' },
      ],
    }
  })

  afterEach(() => {
    memDb.close()
  })

  it('用户在对话中推荐书籍时，自动记录心愿并在文化角创建 planned 状态的阅读资产', async () => {
    llmState.response = JSON.stringify({
      hasResonance: true,
      kind: 'culture_wish',
      cultureType: 'reading',
      title: '想读《老人与海》',
      targetName: '老人与海',
      userQuote: '推荐你看《老人与海》，里面在大海上和大鱼搏斗的故事特别热血！',
      reason: '听说有很厉害的大海与大鱼搏斗，我也要见识一下！',
    })

    const result = await settleChatResonance('luffy', 'session-1', {
      apiKey: 'test',
      baseUrl: 'https://example.com',
      model: 'test-model',
    })

    expect(result.triggered).toBe(true)
    expect(result.resonance).toBeDefined()
    expect(result.resonance?.kind).toBe('culture_wish')
    expect(result.resonance?.targetName).toBe('老人与海')
    expect(result.resonance?.status).toBe('active')

    // 验证 companion_assets 中新增了对应的文化资产，且状态为 planned
    const cultureAssets = await listAssets('luffy', { kind: 'culture' })
    const book = cultureAssets.find(a => a.name === '老人与海')
    expect(book).toBeDefined()
    expect(book?.payload.type).toBe('reading')
    expect(book?.payload.readingStatus).toBe('planned')
    expect(book?.payload.note).toContain('老人与海')

    // 验证广播通知
    expect(sendMock).toHaveBeenCalledWith('companion:life-resonance-created', expect.objectContaining({
      roleId: 'luffy',
      message: expect.stringContaining('老人与海'),
    }))

    // 验证 listLifeResonances 能读取到
    const list = await listLifeResonances('luffy', { status: 'active' })
    expect(list).toHaveLength(1)
    expect(list[0].targetName).toBe('老人与海')
  })

  it('寻常无推荐对话，识别为 hasResonance: false 且不创建心愿或资产', async () => {
    llmState.response = JSON.stringify({ hasResonance: false })

    mockSession = {
      id: 'session-2',
      roleId: 'luffy',
      sessionKind: 'main',
      messages: [
        { role: 'user', content: '今天工作好累啊。' },
        { role: 'assistant', content: '辛苦啦！快吃点肉好好休息吧！' },
      ],
    }

    const result = await settleChatResonance('luffy', 'session-2', {
      apiKey: 'test',
      baseUrl: 'https://example.com',
      model: 'test-model',
    })

    expect(result.triggered).toBe(false)
    const list = await listLifeResonances('luffy')
    expect(list).toHaveLength(0)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('日剧本上下文生成会吸收活跃心愿，并更新其状态为 absorbed_in_script', async () => {
    // 预置一条美食意愿
    llmState.response = JSON.stringify({
      hasResonance: true,
      kind: 'cuisine_wish',
      cultureType: null,
      title: '尝试章鱼烧',
      targetName: '章鱼烧',
      userQuote: '今天吃了超好吃的章鱼烧',
      reason: '听起来很好吃，让山治也做做看！',
    })

    await settleChatResonance('luffy', 'session-1', {
      apiKey: 'test',
      baseUrl: 'https://example.com',
      model: 'test-model',
    })

    // 生成日剧本上下文
    const context = await collectDayScriptLifeContext('luffy')
    expect(context).toContain('章鱼烧')
    expect(context).toContain('愿望与行动意向')

    // 验证心愿状态已更新为 absorbed_in_script
    const activeList = await listLifeResonances('luffy', { status: 'active' })
    expect(activeList).toHaveLength(0)

    const absorbedList = await listLifeResonances('luffy', { status: 'absorbed_in_script' })
    expect(absorbedList).toHaveLength(1)
    expect(absorbedList[0].targetName).toBe('章鱼烧')
    expect(absorbedList[0].absorbedAt).toBeTypeOf('number')
  })
})

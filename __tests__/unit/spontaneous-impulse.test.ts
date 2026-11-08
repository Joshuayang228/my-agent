/**
 * 突发生活意图与主动找聊（Spontaneous Impulse & Proactive Conversation Outreach）门禁测试
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

const llmState = vi.hoisted(() => ({
  response: JSON.stringify({
    impulseText: '喂！甲板上的太阳太棒了，你今天过得怎么样啊！',
    contextHint: '甲板看海突发闲聊',
    toastTitle: '路飞找你聊天',
  }),
}))

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete: vi.fn(async () => llmState.response),
}))

const {
  ensureImpulseTable,
  decideSpontaneousImpulse,
  triggerSpontaneousImpulse,
  listSpontaneousImpulses,
  SPONTANEOUS_IMPULSE_COOLDOWN_MS,
  SPONTANEOUS_IMPULSE_DAILY_LIMIT,
} = await import('../../electron/main/companion/life/spontaneous-impulse')
const { getSession } = await import('../../electron/main/storage/session-store')

describe('突发生活意图与主动找聊（Spontaneous Impulse）', () => {
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
        session_kind             TEXT NOT NULL DEFAULT 'main'
      );
      CREATE TABLE IF NOT EXISTS messages (
        id               TEXT PRIMARY KEY,
        session_id       TEXT NOT NULL,
        role             TEXT NOT NULL,
        content          TEXT NOT NULL,
        tool_calls       TEXT,
        tool_call_id     TEXT,
        created_at       INTEGER NOT NULL,
        sort_order       INTEGER NOT NULL,
        generated_images TEXT
      );
    `)
    sendMock.mockClear()
    await ensureImpulseTable()
  })

  it('decideSpontaneousImpulse 严格遵守勿扰时段、冷却时间、每日限额与体征需求阈值', () => {
    const now = Date.now()
    // 1. 处于静音或勿扰时段拦截
    expect(decideSpontaneousImpulse({
      muted: true, localHour: 14, quietStartHour: 23, quietEndHour: 8,
      socialNeed: 80, energy: 90, lastImpulseAt: null, impulsesToday: 0, now,
    }).allow).toBe(false)

    expect(decideSpontaneousImpulse({
      muted: false, localHour: 2, quietStartHour: 23, quietEndHour: 8,
      socialNeed: 80, energy: 90, lastImpulseAt: null, impulsesToday: 0, now,
    }).allow).toBe(false)

    // 2. 达到每日限额拦截
    expect(decideSpontaneousImpulse({
      muted: false, localHour: 14, quietStartHour: 23, quietEndHour: 8,
      socialNeed: 80, energy: 90, lastImpulseAt: null, impulsesToday: SPONTANEOUS_IMPULSE_DAILY_LIMIT, now,
    }).allow).toBe(false)

    // 3. 冷却时间内拦截
    expect(decideSpontaneousImpulse({
      muted: false, localHour: 14, quietStartHour: 23, quietEndHour: 8,
      socialNeed: 80, energy: 90, lastImpulseAt: now - 3600 * 1000, impulsesToday: 0, now,
    }).allow).toBe(false)

    // 4. 社交欲望与精力均低时拦截（无表达意愿）
    expect(decideSpontaneousImpulse({
      muted: false, localHour: 14, quietStartHour: 23, quietEndHour: 8,
      socialNeed: 40, energy: 50, lastImpulseAt: null, impulsesToday: 0, now,
    }).allow).toBe(false)

    // 5. 条件满足：白天、未超额、社交欲望高涨（>= 70），放行
    expect(decideSpontaneousImpulse({
      muted: false, localHour: 14, quietStartHour: 23, quietEndHour: 8,
      socialNeed: 75, energy: 80, lastImpulseAt: null, impulsesToday: 0, now,
    }).allow).toBe(true)
  })

  it('triggerSpontaneousImpulse 主动向角色主会话写入搭话消息并广播桌面事件', async () => {
    const res = await triggerSpontaneousImpulse('luffy', Date.now(), {
      force: true,
      mockResponse: {
        impulseText: '喂！我刚在甲板钓到了一条金色的鱼！快来看！',
        contextHint: '钓到珍奇鱼类',
        toastTitle: '路飞向你炫耀战利品',
      },
    })

    expect(res.triggered).toBe(true)
    expect(res.event).toBeDefined()
    expect(res.event?.impulseText).toContain('金色的鱼')
    expect(res.event?.toastMessage).toContain('路飞')

    // 验证消息已真实写入该角色的主会话
    const session = await getSession(res.event!.sessionId)
    expect(session).not.toBeNull()
    const lastMsg = session?.messages.at(-1)
    expect(lastMsg?.role).toBe('assistant')
    expect(lastMsg?.content).toContain('金色的鱼')

    // 验证向窗口广播 companion:spontaneous-impulse
    expect(sendMock).toHaveBeenCalledWith('companion:spontaneous-impulse', expect.objectContaining({
      roleId: 'luffy',
      sessionId: res.event!.sessionId,
      impulseText: expect.stringContaining('金色的鱼'),
    }))

    // 验证历史记录表已落盘
    const history = await listSpontaneousImpulses('luffy')
    expect(history.length).toBe(1)
    expect(history[0].impulseText).toContain('金色的鱼')
  })
})

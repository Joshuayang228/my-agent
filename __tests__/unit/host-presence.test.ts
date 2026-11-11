/**
 * 宿主环境作息感知与虚实关怀锚点（Host Presence & Care Anchor）单元测试
 *
 * 背景：角色通过非侵入式方式（powerMonitor 空闲时间与会话活跃时长）感知用户的连续工作与作息状态；
 * 在连续高强度久坐超 2 小时或深夜 1-4 点仍未入眠时，主动发出第一人称同伴关切，并反哺次日生活日剧本。
 *
 * 设计意图：
 * 1. 验证 getHostPresenceStatus 正确计算连续专注工作时长与空闲状态；
 * 2. 验证连续专注 >= 120 分钟时触发 fatigue_break 久坐疲劳关怀；
 * 3. 验证深夜 01:30 触发 late_night_sleep 劝睡关怀，并标记熬夜状态；
 * 4. 验证防打扰冷却机制：已触发关怀在冷却期内不重复打扰；
 * 5. 验证会话留痕与多端广播：关切消息写入主角主会话（sessionKind: 'main'）并向全窗口广播；
 * 6. 验证次日生活吸收：getRecentHostCareContext 正确提取熬夜线索供日剧本规划。
 *
 * 关键约束：
 * - 纯内存测试，隔离外部电源管理与大模型调用；
 * - 遵循三要素注释规范。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>

let mockIdleTime = 10 // 默认空闲 10 秒
const sendMock = vi.fn()

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  powerMonitor: {
    getSystemIdleTime: vi.fn(() => mockIdleTime),
  },
  BrowserWindow: {
    getAllWindows: () => [{ isDestroyed: () => false, webContents: { send: sendMock } }],
  },
}))

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/companion/life/store', () => ({
  getRoleState: vi.fn(async (roleId: string) => ({
    roleId,
    world: { schemaVersion: 1, home: '', timezone: 'Asia/Shanghai', situation: '', mood: 65, energy: 70, socialNeed: 40, currentLocation: '', locationDetail: '', currentActivity: '', statusTags: [], updatedAt: 0 },
  })),
  setWorldState: vi.fn(async () => undefined),
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

const appendedMessages: Array<{ sessionId: string; content: string }> = []
vi.mock('../../electron/main/storage/session-store', () => ({
  ensureMainSessionForRole: vi.fn(async (roleId: string) => ({ id: `main-session-${roleId}` })),
  saveMessage: vi.fn(async (sessionId: string, message: { role: string; content: string }) => {
    appendedMessages.push({ sessionId, content: message.content })
  }),
}))

vi.mock('../../electron/main/companion/identity/loader', () => ({
  loadRolePack: vi.fn(async () => ({
    manifest: { name: '蒙奇·D·路飞' },
    profile: { brief: '热血温暖的航海同伴' },
  })),
}))

vi.mock('../../electron/main/llm/aux-config', () => ({
  loadAuxLLMConfig: vi.fn(async () => ({})),
}))

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete: vi.fn(async () => ''),
}))

import {
  recordUserActivity,
  getHostPresenceStatus,
  checkAndTriggerHostCare,
  getRecentHostCareContext,
  resetHostCareDayFlags,
  resetHostPresenceStateForTesting,
} from '../../electron/main/companion/life/host-presence'

describe('宿主作息与现实关怀触达（Host Presence & Care Anchor）', () => {
  const roleId = 'luffy'
  const baseTime = Date.UTC(2026, 10, 10, 10, 0, 0) // 10:00

  beforeEach(() => {
    memDb = new SQL.Database()
    vi.clearAllMocks()
    appendedMessages.length = 0
    mockIdleTime = 10
    resetHostPresenceStateForTesting(baseTime)
  })

  it('getHostPresenceStatus 正确反映系统空闲与连续专注时长', () => {
    recordUserActivity(baseTime)

    // 40 分钟后且空闲仅 15 秒
    mockIdleTime = 15
    const status1 = getHostPresenceStatus(baseTime + 40 * 60 * 1000)
    expect(status1.continuousActiveMinutes).toBe(40)
    expect(status1.idleSeconds).toBe(15)
    expect(status1.isFocusSession).toBe(false)

    // 70 分钟后，达成专注会话
    const status2 = getHostPresenceStatus(baseTime + 70 * 60 * 1000)
    expect(status2.continuousActiveMinutes).toBe(70)
    expect(status2.isFocusSession).toBe(true)

    // 若系统空闲超过 5 分钟 (301 秒)，连续专注时长归零
    mockIdleTime = 305
    const status3 = getHostPresenceStatus(baseTime + 80 * 60 * 1000)
    expect(status3.continuousActiveMinutes).toBe(0)
  })

  it('连续工作专注达 120 分钟时，自动触发 fatigue_break 久坐疲劳关怀', async () => {
    recordUserActivity(baseTime)
    mockIdleTime = 20

    // 持续工作 130 分钟
    const now = baseTime + 130 * 60 * 1000
    const care = await checkAndTriggerHostCare(roleId, now)

    expect(care).not.toBeNull()
    expect(care?.kind).toBe('fatigue_break')
    expect(care?.title).toBe('休息一下吧！')
    expect(care?.message).toContain('喂！')
    expect(care?.message).toContain('键盘都要敲出火星啦')
    expect(care?.suggestedAction).toBeDefined()

    // 写入主会话验证
    expect(appendedMessages).toHaveLength(1)
    expect(appendedMessages[0].sessionId).toBe(`main-session-${roleId}`)
    expect(appendedMessages[0].content).toBe(care?.message)

    // 广播验证
    expect(sendMock).toHaveBeenCalledWith('companion:host-care-triggered', expect.objectContaining({
      roleId,
      care: expect.objectContaining({ kind: 'fatigue_break' }),
    }))
  })

  it('疲劳关怀触发后具备 3 小时冷却保护，不重复打扰', async () => {
    recordUserActivity(baseTime)
    mockIdleTime = 20

    const t1 = baseTime + 130 * 60 * 1000
    const care1 = await checkAndTriggerHostCare(roleId, t1)
    expect(care1).not.toBeNull()

    // 1 小时后再次检查：处于 3 小时冷却期内，返回 null
    const t2 = t1 + 60 * 60 * 1000
    const care2 = await checkAndTriggerHostCare(roleId, t2)
    expect(care2).toBeNull()
    expect(appendedMessages).toHaveLength(1) // 未重复追加
  })

  it('深夜 01:30 仍在工作时，触发 late_night_sleep 劝睡关怀并记录熬夜线索', async () => {
    // 构造本地时间 01:30
    const lateNightDate = new Date()
    lateNightDate.setHours(1, 30, 0, 0)
    const lateNightTime = lateNightDate.getTime()

    resetHostPresenceStateForTesting(lateNightTime - 50 * 60 * 1000)
    recordUserActivity(lateNightTime - 50 * 60 * 1000)
    mockIdleTime = 10

    const care = await checkAndTriggerHostCare(roleId, lateNightTime)
    expect(care).not.toBeNull()
    expect(care?.kind).toBe('late_night_sleep')
    expect(care?.title).toBe('快去睡啦！')
    expect(care?.message).toContain('哈欠')
    expect(care?.message).toContain('钻进被窝')

    // 检查次日日剧本线索
    const context = await getRecentHostCareContext()
    expect(context).toContain('深夜熬夜工作')
    expect(context).toContain('温和关心')
  })

  it('支持手动/强制触发指定类型的关切（例如 welcome_back）', async () => {
    const care = await checkAndTriggerHostCare(roleId, baseTime, 'welcome_back')
    expect(care).not.toBeNull()
    expect(care?.kind).toBe('welcome_back')
    expect(care?.title).toBe('欢迎回来！')
    expect(care?.message).toContain('探险')
  })
})

import { runLocalTransaction } from '../helpers/local-transaction'
/**
 * 日内计划槽位自适应重排（Dynamic Re-planning）单元测试
 *
 * 背景：角色遭遇生理透支（精力枯竭）或心境突变时，需将当日未发布的计划槽位自适应重排为休养生息类活动；
 * 保持时间槽时间不变，调整活动与心情，注入 causedBy 因果溯源标签，保证前后因果自洽。
 *
 * 设计意图：
 * 1. 验证当日无待执行槽位时安全退出，返回 replannedCount: 0；
 * 2. 验证体力透支（vitals_exhaustion）触发时，后续计划槽位自适应替换为休养生息活动，且注入 causedBy；
 * 3. 验证广播事件 companion:slots-replanned 与 companion:timeline-updated 正常触发；
 * 4. 验证 checkAndReplanIfExhausted 在精力透支（energy <= 25）时自动触发，且同日不重复重排（幂等性）；
 * 5. 验证无可用模型时高质量规则保底生效。
 *
 * 关键约束：
 * - 纯内存测试，隔离外部 LLM 与 Electron 窗口；
 * - 遵循三要素注释规范。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>

const sendMock = vi.fn()
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: {
    getAllWindows: () => [{ isDestroyed: () => false, webContents: { send: sendMock } }],
  },
}))

vi.mock('../../electron/main/storage/database', () => ({
  withDatabaseTransaction: async (work: (db: typeof memDb) => Promise<unknown>) => runLocalTransaction(memDb, work),
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

let mockEvents: Array<{
  id: string
  roleId: string
  scheduledAt: number
  status: 'planned' | 'published'
  type: string
  payload: Record<string, unknown>
}> = []

vi.mock('../../electron/main/companion/core/persistence/life-repository', () => ({
  getRoleState: vi.fn(async (roleId: string) => ({
    roleId,
    world: { schemaVersion: 1, home: '', timezone: 'Asia/Shanghai', situation: '', mood: mockWorldState.mood, energy: mockWorldState.energy, socialNeed: mockWorldState.socialNeed, currentLocation: '', locationDetail: '', currentActivity: '', statusTags: [], updatedAt: 0 },
  })),
  setWorldState: vi.fn(async () => undefined),
  listEvents: vi.fn(async (roleId: string) => {
    return mockEvents.filter((e) => e.roleId === roleId)
  }),
  updateEventPayload: vi.fn(async (eventId: string, payload: Record<string, unknown>) => {
    const ev = mockEvents.find((e) => e.id === eventId)
    if (ev) {
      ev.payload = payload
    }
  }),
}))

let mockWorldState = {
  energy: 80,
  mood: 75,
  socialNeed: 40,
}

vi.mock('../../electron/main/companion/life/world-state', () => ({
  ensureWorldState: vi.fn(async () => ({ ...mockWorldState })),
}))

vi.mock('../../electron/main/companion/identity/loader', () => ({
  loadRoleWorldDefaults: () => null,
  resolveRoleUniverseId: () => 'default',
  loadRolePack: vi.fn(async () => ({
    manifest: { name: '蒙奇·D·路飞' },
    profile: { brief: '热血开朗的草帽船长' },
  })),
}))

vi.mock('../../electron/main/llm/aux-config', () => ({
  loadAuxLLMConfig: vi.fn(async () => ({})),
}))

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete: vi.fn(async () => ''),
}))

import {
  adaptNextUpcomingSlotForResonance,
  replanRemainingSlots,
  checkAndReplanIfExhausted,
} from '../../electron/main/companion/life/replan'

describe('日内计划槽位自适应重排（Dynamic Re-planning）', () => {
  const roleId = 'luffy'
  const now = Date.UTC(2026, 10, 10, 14, 0, 0) // 14:00

  beforeEach(() => {
    memDb = new SQL.Database()
    vi.clearAllMocks()
    mockEvents = []
    mockWorldState = { energy: 80, mood: 75, socialNeed: 40 }
  })

  it('当日无待执行 planned 槽位时安全退出，返回 replannedCount 为 0', async () => {
    const result = await replanRemainingSlots(roleId, {
      trigger: 'vitals_exhaustion',
      reason: '体力枯竭',
      now,
    })

    expect(result.ok).toBe(true)
    expect(result.replannedCount).toBe(0)
    expect(result.adjustedSlots).toHaveLength(0)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('体力透支时，自适应重排今日后续槽位并注入 causedBy 因果标签', async () => {
    mockEvents = [
      {
        id: 'evt-past',
        roleId,
        scheduledAt: now - 3600 * 1000, // 13:00 (过去)
        status: 'published',
        type: 'activity',
        payload: { date: '2026-11-10', activity: '遭遇巨大海怪并搏斗', mood: '激战' },
      },
      {
        id: 'evt-future-1',
        roleId,
        scheduledAt: now + 3600 * 1000, // 15:00 (未来)
        status: 'planned',
        type: 'activity',
        payload: { date: '2026-11-10', activity: '甲板高强度体能特训', mood: '热血' },
      },
      {
        id: 'evt-future-2',
        roleId,
        scheduledAt: now + 7200 * 1000, // 16:00 (未来)
        status: 'planned',
        type: 'moment',
        payload: { date: '2026-11-10', activity: '攀爬最高桅杆观望', mood: '兴奋' },
      },
    ]

    const result = await replanRemainingSlots(roleId, {
      trigger: 'vitals_exhaustion',
      reason: '海怪激战后体力透支',
      now,
    })

    expect(result.ok).toBe(true)
    expect(result.replannedCount).toBe(2)
    expect(result.adjustedSlots).toHaveLength(2)

    // 过去已发布的事件未被修改
    expect(mockEvents[0].payload.activity).toBe('遭遇巨大海怪并搏斗')
    expect(mockEvents[0].payload.causedBy).toBeUndefined()

    // 未来计划事件已调整为休养生息
    expect(mockEvents[1].payload.activity).toContain('睡')
    expect(mockEvents[1].payload.mood).toBe('疲惫恢复中')
    expect(mockEvents[1].payload.causedBy).toEqual({
      trigger: 'vitals_exhaustion',
      reason: '海怪激战后体力透支',
      previousActivity: '甲板高强度体能特训',
      at: now,
    })

    // 第二个未来计划事件调整为喝热汤
    expect(mockEvents[2].payload.activity).toContain('汤')
    expect(mockEvents[2].payload.causedBy).toBeDefined()

    // 广播检查
    expect(sendMock).toHaveBeenCalledWith('companion:slots-replanned', expect.objectContaining({
      roleId,
      replannedCount: 2,
    }))
    expect(sendMock).toHaveBeenCalledWith('companion:timeline-updated', { roleId, now })
  })

  it('脆弱心境时，自适应重排为沉静看海与独处释怀活动', async () => {
    mockEvents = [
      {
        id: 'evt-v-1',
        roleId,
        scheduledAt: now + 3600 * 1000,
        status: 'planned',
        type: 'moment',
        payload: { date: '2026-11-10', activity: '举办热闹烤肉宴会', mood: '喧闹' },
      },
    ]

    const result = await replanRemainingSlots(roleId, {
      trigger: 'vulnerability',
      reason: '深夜思念故人陷入低落',
      now,
    })

    expect(result.ok).toBe(true)
    expect(result.replannedCount).toBe(1)
    expect(mockEvents[0].payload.activity).toContain('船首静静看海浪')
    expect(mockEvents[0].payload.mood).toBe('沉静释怀')
    expect((mockEvents[0].payload.causedBy as any).trigger).toBe('vulnerability')
  })

  it('checkAndReplanIfExhausted 在精力透支（<=25）时自动触发，且同日不重复重排', async () => {
    mockWorldState = { energy: 15, mood: 60, socialNeed: 30 }

    mockEvents = [
      {
        id: 'evt-ex-1',
        roleId,
        scheduledAt: now + 3600 * 1000,
        status: 'planned',
        type: 'activity',
        payload: { date: '2026-11-10', activity: '剧烈伐木修船', mood: '劳碌' },
      },
    ]

    // 首次触发：应当成功重排
    const firstRun = await checkAndReplanIfExhausted(roleId, now)
    expect(firstRun).not.toBeNull()
    expect(firstRun?.replannedCount).toBe(1)
    expect(mockEvents[0].payload.causedBy).toBeDefined()

    // 再次触发：检测到今日已有 causedBy.trigger === 'vitals_exhaustion'，幂等跳过
    const secondRun = await checkAndReplanIfExhausted(roleId, now + 60000)
    expect(secondRun).toBeNull()
  })

  it('当精力充沛时，checkAndReplanIfExhausted 不会触发重排', async () => {
    mockWorldState = { energy: 90, mood: 85, socialNeed: 20 }
    mockEvents = [
      {
        id: 'evt-normal',
        roleId,
        scheduledAt: now + 3600 * 1000,
        status: 'planned',
        type: 'activity',
        payload: { date: '2026-11-10', activity: '日常探险', mood: '开心' },
      },
    ]

    const res = await checkAndReplanIfExhausted(roleId, now)
    expect(res).toBeNull()
    expect(mockEvents[0].payload.activity).toBe('日常探险')
  })

  it('当天聊天共鸣只微调首个未重排的未来槽位并标记 absorbed_in_script，跳过已被体征重排的槽位与 travel_wish', async () => {
    memDb.run(`CREATE TABLE IF NOT EXISTS companion_life_resonances (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      absorbed_at INTEGER
    )`)
    memDb.run(`INSERT INTO companion_life_resonances (id, status, absorbed_at) VALUES ('res-1', 'active', NULL)`)

    mockEvents = [
      {
        id: 'evt-exhausted',
        roleId,
        scheduledAt: now + 1800 * 1000,
        status: 'planned',
        type: 'activity',
        payload: { date: '2026-11-10', activity: '休养', mood: '疲惫', causedBy: { trigger: 'vitals_exhaustion' } },
      },
      {
        id: 'evt-free-1',
        roleId,
        scheduledAt: now + 3600 * 1000,
        status: 'planned',
        type: 'activity',
        payload: { date: '2026-11-10', activity: '在甲板吹海风', mood: '轻松' },
      },
      {
        id: 'evt-free-2',
        roleId,
        scheduledAt: now + 7200 * 1000,
        status: 'planned',
        type: 'activity',
        payload: { date: '2026-11-10', activity: '看晚霞', mood: '惬意' },
      },
    ]

    // travel_wish 属于跨日航程，不走当日单槽微调
    const skippedTravel = await adaptNextUpcomingSlotForResonance(
      roleId,
      { id: 'res-travel', kind: 'travel_wish', title: '去水之都', targetName: '水之都' },
      { now },
    )
    expect(skippedTravel.adapted).toBe(false)

    // cuisine_wish 应跳过 evt-exhausted，只微调 evt-free-1，保留 evt-free-2
    const adapted = await adaptNextUpcomingSlotForResonance(
      roleId,
      { id: 'res-1', kind: 'cuisine_wish', title: '晚上吃烤肉', targetName: '带骨烤肉', reason: '聊天约好今晚吃肉' },
      { now },
    )
    expect(adapted.adapted).toBe(true)
    expect(adapted.eventId).toBe('evt-free-1')
    expect(mockEvents[0].payload.activity).toBe('休养')
    expect(mockEvents[1].payload.activity).toContain('带骨烤肉')
    expect((mockEvents[1].payload.causedBy as Record<string, unknown>)?.trigger).toBe('chat_resonance')
    expect(mockEvents[2].payload.activity).toBe('看晚霞')

    const stmt = memDb.prepare("SELECT status, absorbed_at FROM companion_life_resonances WHERE id = 'res-1'")
    stmt.step()
    const row = stmt.getAsObject()
    stmt.free()
    expect(row.status).toBe('absorbed_in_script')
    expect(typeof row.absorbed_at).toBe('number')
  })
})

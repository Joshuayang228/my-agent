/**
 * 伙伴足迹与航海旅行自主演化（Travel Journey Progression）门禁测试
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

vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === 'universeId') return 'default'
    if (key === 'activeRoleId') return 'luffy'
    return ''
  }),
  setSetting: vi.fn(async () => {}),
  isActiveRole: vi.fn(async () => true),
}))

const {
  ensureTravelProgressionTable,
  listTravelProgressions,
  shouldProgressTravelJourney,
  checkAndProgressTravelJourney,
  triggerTravelProgression,
  TRAVEL_PROGRESSION_POLICY,
  VOYAGE_CANDIDATE_STOPS,
} = await import('../../electron/main/companion/life/travel-progression')

const {
  ensureStarterFootprints,
  listAssets,
  formatLifeAssetsSliceForPrompt,
} = await import('../../electron/main/companion/life/assets')

const {
  ensureResonanceTable,
} = await import('../../electron/main/companion/life/chat-resonance')

describe('伙伴足迹与航海旅行自主演化（Travel Journey Progression）', () => {
  beforeEach(async () => {
    memDb = new SQL.Database()
    sendMock.mockClear()
    await ensureTravelProgressionTable()
    await ensureResonanceTable()
  })

  it('航海时钟推移时自动推进新岛屿站点，主会话提示词切片自然感知最新经停点', async () => {
    await ensureStarterFootprints('luffy')

    // 初始状态下路飞有 active 航程「千里阳光号巡航」，已有 2 个站点
    const initialAssets = await listAssets('luffy', { kind: 'footprint' })
    const activeTrip = initialAssets.find((a) => a.payload.recordType === 'trip' && a.payload.status === 'active')
    expect(activeTrip).toBeDefined()
    const initialStops = activeTrip?.payload.stops as Array<Record<string, unknown>>
    expect(initialStops.length).toBe(2)

    // 初始 Prompt 切片展示最近站点
    const initialSlice = formatLifeAssetsSliceForPrompt(initialAssets)
    expect(initialSlice).toContain('进行中的旅程：千里阳光号巡航：未知岛屿的冒险航段（最近到过：共享草坪甲板与眺望台）')

    // 评估应当推进航程
    const now = new Date('2026-11-09T14:00:00+08:00').getTime()
    const decision = await shouldProgressTravelJourney('luffy', now)
    expect(decision.shouldProgress).toBe(true)
    expect(decision.triggerReason).toBe('scheduled_voyage')
    expect(decision.nextStop?.name).toBe('雷暴极光海 · 浮游巨兽栖息地')

    // 执行航海推进
    const result = await checkAndProgressTravelJourney('luffy', now)
    expect(result).not.toBeNull()
    expect(result?.ok).toBe(true)
    expect(result?.newStop?.name).toBe('雷暴极光海 · 浮游巨兽栖息地')

    // 验证更新后的资产
    const updatedAssets = await listAssets('luffy', { kind: 'footprint' })
    const updatedTrip = updatedAssets.find((a) => a.id === activeTrip?.id)
    const updatedStops = updatedTrip?.payload.stops as Array<Record<string, unknown>>
    expect(updatedStops.length).toBe(3)
    expect(updatedStops[2].name).toBe('雷暴极光海 · 浮游巨兽栖息地')

    // 主会话提示词切片实时感知最新站点
    const updatedSlice = formatLifeAssetsSliceForPrompt(updatedAssets)
    expect(updatedSlice).toContain('进行中的旅程：千里阳光号巡航：未知岛屿的冒险航段（最近到过：雷暴极光海 · 浮游巨兽栖息地）')

    // 广播已触发
    expect(sendMock).toHaveBeenCalledWith('companion:timeline-updated', expect.objectContaining({ roleId: 'luffy' }))
    expect(sendMock).toHaveBeenCalledWith('companion:travel-progressed', expect.objectContaining({
      roleId: 'luffy',
      tripTitle: '千里阳光号巡航：未知岛屿的冒险航段',
      stop: expect.objectContaining({ name: '雷暴极光海 · 浮游巨兽栖息地' }),
    }))

    // 历史记录已保存
    const history = await listTravelProgressions('luffy')
    expect(history.length).toBe(1)
    expect(history[0].stopName).toBe('雷暴极光海 · 浮游巨兽栖息地')
    expect(history[0].triggerReason).toBe('scheduled_voyage')
  })

  it('24小时冷却保护生效，防止短时间内频繁刷新航行站点', async () => {
    await ensureStarterFootprints('luffy')
    const now = new Date('2026-11-09T14:00:00+08:00').getTime()

    // 第一次推进成功
    await checkAndProgressTravelJourney('luffy', now)

    // 2 小时后再次评估（处于 24 小时冷却内）
    const twoHoursLater = now + 2 * 3600 * 1000
    const cooldownDecision = await shouldProgressTravelJourney('luffy', twoHoursLater)
    expect(cooldownDecision.shouldProgress).toBe(false)
    expect(cooldownDecision.reason).toBe('in_cooldown')

    // 25 小时后（冷却解除）
    const nextDay = now + 25 * 3600 * 1000
    const nextDecision = await shouldProgressTravelJourney('luffy', nextDay)
    expect(nextDecision.shouldProgress).toBe(true)
    expect(nextDecision.nextStop?.name).toBe('蜂巢浮游外海 · 补给集市浮标')
  })

  it('优先吸收用户在交流中表达的旅行心愿（travel_wish）并完成闭环', async () => {
    await ensureStarterFootprints('luffy')
    const now = new Date('2026-11-09T14:00:00+08:00').getTime()

    // 模拟用户在主会话中建议去尝尝水水肉或看巨型喷泉，chat-resonance 播种了 travel_wish
    const wishId = 'wish-water-seven-meat'
    memDb.run(
      `INSERT INTO companion_life_resonances
         (id, role_id, session_id, kind, title, target_name, user_quote, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wishId,
        'luffy',
        'sess-1',
        'travel_wish',
        '想去水之都水水肉大排档',
        '水之都水水肉大排档',
        '路飞你们去尝尝水水肉吧，听说比普通烤肉还嫩！',
        '用户极力推荐的七水之都美食打卡地',
        'active',
        now - 3600 * 1000,
      ],
    )

    // 评估航海推进：优先以该旅行心愿为新站点
    const decision = await shouldProgressTravelJourney('luffy', now)
    expect(decision.shouldProgress).toBe(true)
    expect(decision.triggerReason).toBe('user_travel_wish')
    expect(decision.resonanceId).toBe(wishId)
    expect(decision.nextStop?.name).toBe('水之都水水肉大排档')

    // 执行航海推进
    const result = await checkAndProgressTravelJourney('luffy', now)
    expect(result?.ok).toBe(true)
    expect(result?.newStop?.name).toBe('水之都水水肉大排档')

    // 验证 companion_life_resonances 中该心愿状态被标记为 completed 并留下回访引子
    const stmt = memDb.prepare('SELECT status, feedback_text, completed_at FROM companion_life_resonances WHERE id = ?')
    stmt.bind([wishId])
    expect(stmt.step()).toBe(true)
    const row = stmt.getAsObject()
    expect(row.status).toBe('completed')
    expect(row.feedback_text).toContain('水之都水水肉大排档')
    stmt.free()
  })

  it('支持通过 triggerTravelProgression 进行受控或自定义站点推进', async () => {
    await ensureStarterFootprints('luffy')
    const now = Date.now()

    const record = await triggerTravelProgression('luffy', {
      name: '神秘彩虹漩涡海域',
      story: '遇到了传说中的彩虹上升涡流，阳光号乘着七彩浪花飞跃暗礁！',
    }, now)

    expect(record).not.toBeNull()
    expect(record?.stopName).toBe('神秘彩虹漩涡海域')
    expect(record?.triggerReason).toBe('manual_trigger')

    const assets = await listAssets('luffy', { kind: 'footprint' })
    const slice = formatLifeAssetsSliceForPrompt(assets)
    expect(slice).toContain('最近到过：神秘彩虹漩涡海域')
  })
})

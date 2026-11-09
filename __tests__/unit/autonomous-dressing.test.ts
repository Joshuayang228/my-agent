/**
 * 伙伴衣柜与穿搭自主演化（Autonomous Contextual Dressing）门禁测试
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
}))

const {
  ensureAutonomousDressingTable,
  listAutonomousDressings,
  isWearingOutfit,
  scoreOutfitForContext,
  shouldPerformContextualDressing,
  checkAndPerformContextualDressing,
  AUTONOMOUS_DRESSING_POLICY,
} = await import('../../electron/main/companion/life/autonomous-dressing')

const {
  ensureStarterWardrobe,
  listAssets,
  changeWardrobe,
  formatLifeAssetsSliceForPrompt,
} = await import('../../electron/main/companion/life/assets')

describe('伙伴衣柜与穿搭自主演化（Autonomous Contextual Dressing）', () => {
  beforeEach(async () => {
    memDb = new SQL.Database()
    sendMock.mockClear()
    await ensureAutonomousDressingTable()
  })

  it('穿搭槽位比对与情境打分算法准确生效', () => {
    const slotsA = { top: 't1', bottom: 'b1', shoes: 's1' }
    const slotsB = { top: 't1', bottom: 'b1', shoes: 's1' }
    const slotsC = { top: 't1', bottom: 'b2', shoes: 's1' }

    expect(isWearingOutfit(slotsA, slotsB)).toBe(true)
    expect(isWearingOutfit(slotsA, slotsC)).toBe(false)
    expect(isWearingOutfit(undefined, slotsB)).toBe(false)

    const outfitAdventure = {
      id: 'outfit-adv',
      roleId: 'luffy',
      kind: 'wardrobe',
      name: '草帽冒险日常装',
      payload: {
        recordType: 'outfit',
        style: '轻快、耐造、随时能出发去航海冒险',
        description: '出厂日常穿搭',
      },
      acquiredAt: 1000,
      sourceEventId: null,
    }
    const outfitBanquet = {
      id: 'outfit-banquet',
      roleId: 'luffy',
      kind: 'wardrobe',
      name: '黄金乡庆典礼服',
      payload: {
        recordType: 'outfit',
        style: '参加盛大宴会与庆典的聚餐华服',
        description: '宴会聚餐',
      },
      acquiredAt: 1000,
      sourceEventId: null,
    }

    const scoreAdv = scoreOutfitForContext(outfitAdventure, '出海巡航与甲板吹风大冒险')
    const scoreBanquet = scoreOutfitForContext(outfitBanquet, '今晚举办全员篝火宴会聚餐')

    expect(scoreAdv).toBeGreaterThan(scoreOutfitForContext(outfitBanquet, '出海巡航与甲板吹风大冒险'))
    expect(scoreBanquet).toBeGreaterThan(scoreOutfitForContext(outfitAdventure, '今晚举办全员篝火宴会聚餐'))
  })

  it('冷启无穿着状态时自动为路飞穿上初始日常套装，Prompt 自然感知当前穿着', async () => {
    await ensureStarterWardrobe('luffy')

    // 初始状态下尚未生成 wear-state
    const initialAssets = await listAssets('luffy', { kind: 'wardrobe' })
    const initialWearState = initialAssets.find((a) => a.payload.recordType === 'wear-state')
    expect(initialWearState).toBeUndefined()

    // 判定应当进行初始穿搭
    const now = new Date('2026-11-09T08:00:00+08:00').getTime()
    const decision = await shouldPerformContextualDressing('luffy', now)
    expect(decision.shouldDress).toBe(true)
    expect(decision.reason).toBe('starter_dress')
    expect(decision.targetAsset?.name).toBe('草帽冒险日常装')
    expect(decision.expectedVersion).toBe(0)

    // 执行自主换装
    const result = await checkAndPerformContextualDressing('luffy', now)
    expect(result).not.toBeNull()
    expect(result?.ok).toBe(true)
    expect(result?.reason).toBe('starter_dress')
    expect(result?.dressingRecord?.outfitName).toBe('草帽冒险日常装')

    // 数据库中 wear-state 写入且版本为 1
    const updatedAssets = await listAssets('luffy')
    const updatedWearState = updatedAssets.find((a) => a.payload.recordType === 'wear-state')
    expect(updatedWearState).toBeDefined()
    expect(updatedWearState?.payload.outfitVersion).toBe(1)

    // 主会话提示词切片中自然呈现当前穿着
    const promptSlice = formatLifeAssetsSliceForPrompt(updatedAssets)
    expect(promptSlice).toContain('当前穿着：轻便红色背心、深蓝短裤、甲板凉鞋')

    // 广播通知已被触发
    expect(sendMock).toHaveBeenCalledWith('companion:timeline-updated', expect.objectContaining({ roleId: 'luffy' }))
    expect(sendMock).toHaveBeenCalledWith('companion:wardrobe-changed', expect.objectContaining({ roleId: 'luffy', reason: 'starter_dress' }))

    // 自主换装历史记录可查
    const history = await listAutonomousDressings('luffy')
    expect(history.length).toBe(1)
    expect(history[0].outfitName).toBe('草帽冒险日常装')
    expect(history[0].outfitVersion).toBe(1)
  })

  it('冷却期（4小时）与每日上限（2次）门控严格拦截高频换装', async () => {
    await ensureStarterWardrobe('luffy')
    const now = new Date('2026-11-09T08:00:00+08:00').getTime()

    // 第一次换装成功
    await checkAndPerformContextualDressing('luffy', now)

    // 1 小时后再次尝试（处于 4 小时冷却内）
    const nextHour = now + 3600 * 1000
    const cooldownDecision = await shouldPerformContextualDressing('luffy', nextHour)
    expect(cooldownDecision.shouldDress).toBe(false)
    expect(cooldownDecision.reason).toBe('in_cooldown')

    // 5 小时后（冷却解除），模拟第二次换装
    const fiveHoursLater = now + 5 * 3600 * 1000
    // 如果已有合适穿着且无新情境，判定为 already_properly_dressed
    const dressedDecision = await shouldPerformContextualDressing('luffy', fiveHoursLater)
    expect(dressedDecision.shouldDress).toBe(false)
    expect(dressedDecision.reason).toBe('already_properly_dressed')

    // 模拟当日直接插入达到 dailyLimit (2 次) 的记录
    memDb.run(
      `INSERT INTO companion_autonomous_dressings
         (id, role_id, asset_id, outfit_name, trigger_reason, outfit_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['mock-2', 'luffy', 'asset-2', '第二套', 'test', 2, now + 6 * 3600 * 1000],
    )

    // 冷却哪怕过了，达到每日上限依然拦截
    const tenHoursLater = now + 12 * 3600 * 1000
    const limitDecision = await shouldPerformContextualDressing('luffy', tenHoursLater)
    expect(limitDecision.shouldDress).toBe(false)
    expect(limitDecision.reason).toBe('daily_limit_reached')
  })

  it('用户近2小时内手动换装享有保护权，自主演化不得擅自覆盖', async () => {
    await ensureStarterWardrobe('luffy')
    const now = new Date('2026-11-09T10:00:00+08:00').getTime()

    // 先做一次冷启换装，版本为 1
    await checkAndPerformContextualDressing('luffy', now - 5 * 3600 * 1000)

    // 用户在 10:30 手动换了一件单品（例如换上红背心），使得 wear-state 的 acquiredAt 为 10:30，版本提升为 2
    // 但并未在 companion_autonomous_dressings 中留下对应记录
    const userChangeTime = now - 30 * 60 * 1000 // 30分钟前
    const topGarmentId = 'wardrobe:luffy:red-vest'
    await changeWardrobe({
      roleId: 'luffy',
      assetId: topGarmentId,
      expectedVersion: 1,
    })

    // 手动更新 acquiredAt 为 30 分钟前
    memDb.run('UPDATE companion_assets SET acquired_at = ? WHERE role_id = ? AND name = ?', [userChangeTime, 'luffy', '当前穿搭'])

    // 自主演化在 10:45 评估（距用户手动换装仅 15 分钟）
    const evaluateTime = userChangeTime + 15 * 60 * 1000
    const decision = await shouldPerformContextualDressing('luffy', evaluateTime)
    expect(decision.shouldDress).toBe(false)
    expect(decision.reason).toBe('user_manual_protection')
  })
})

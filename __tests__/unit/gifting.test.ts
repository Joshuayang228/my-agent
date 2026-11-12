/**
 * 专属物品赠送与羁绊好感（Companion Gifting & Bond Progression）门禁测试
 *
 * 背景：同伴关系是双向的情感连接；角色不仅会主动赠送用户专属信物，
 * 用户也应当能在日常相伴中主动挑选或定制心意礼物赠予角色（如路飞的最爱带骨大肉、神秘海图等）。
 * 角色收到礼物后，依据自身性格与喜好偏好产生真实、生动的第一人称回响，恢复生命体征并沉淀为长久羁绊。
 *
 * 设计意图：
 * 1. 验证礼物清单获取及角色专属喜爱程度（路飞的最爱为 bone-meat 和 treasure-map）；
 * 2. 验证用户赠礼流程：正确持久化进 companion_received_gifts 表并保存礼物分类与属性；
 * 3. 验证主会话留痕：角色第一人称致谢喜悦回响即刻推入主会话作为 assistant 消息；
 * 4. 验证体征增益与里程碑：根据礼物设定提升 mood / energy，并记录 gift_received 里程碑；
 * 5. 验证模型失败或缺省时的规则保底回响与全窗口事件广播。
 *
 * 关键约束：
 * - 纯内存测试，使用 sql.js 模拟 SQLite；
 * - 外部服务（LLM、主会话保存、Electron 窗口广播）由 Vitest mock 隔离。
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

const saveMessageMock = vi.fn()
const ensureMainSessionForRoleMock = vi.fn(async (roleId: string) => ({ id: `session-${roleId}-main` } as any))

vi.mock('../../electron/main/storage/session-store', () => ({
  ensureMainSessionForRole: ensureMainSessionForRoleMock,
  saveMessage: saveMessageMock,
  saveMessageIfAbsent: vi.fn(async (sessionId: string, message: any) => saveMessageMock(sessionId, message)),
}))

vi.mock('../../electron/main/llm/aux-config', () => ({
  loadAuxLLMConfig: vi.fn(async () => null),
}))

let currentWorldMood = 65
let currentWorldEnergy = 70
const setWorldStateMock = vi.fn(async (_roleId: string, state: any) => {
  currentWorldMood = state.mood
  currentWorldEnergy = state.energy
})

vi.mock('../../electron/main/companion/life/world-state', () => ({
  ensureWorldState: vi.fn(async (roleId: string) => ({
    roleId,
    mood: currentWorldMood,
    energy: currentWorldEnergy,
    situation: '万里阳光号甲板航行中',
  })),
}))

vi.mock('../../electron/main/companion/life/store', () => ({
  getRoleState: vi.fn(async (roleId: string) => ({
    roleId,
    world: {
      schemaVersion: 1,
      home: '千里阳光号',
      timezone: 'Asia/Shanghai',
      situation: '万里阳光号甲板航行中',
      mood: currentWorldMood,
      energy: currentWorldEnergy,
      socialNeed: 48,
      hunger: 0,
      sleepiness: 0,
      currentLocation: '甲板',
      locationDetail: '',
      currentActivity: '航行',
      statusTags: [],
      updatedAt: 0,
    },
  })),
  setWorldState: setWorldStateMock,
}))

const {
  ensureGiftTable,
  listAvailableGifts,
  listReceivedGifts,
  sendGiftToCompanion,
  PRESET_GIFTS,
} = await import('../../electron/main/companion/life/gifting')

describe('专属物品赠送与羁绊好感（Companion Gifting & Bond Progression）', () => {
  beforeEach(async () => {
    memDb = new SQL.Database()
    sendMock.mockClear()
    saveMessageMock.mockClear()
    ensureMainSessionForRoleMock.mockClear()
    setWorldStateMock.mockClear()
    currentWorldMood = 65
    currentWorldEnergy = 70
    await ensureGiftTable()
  })

  it('礼物清单正确加载，且路飞对带骨大肉与神秘海图具有最爱偏好', async () => {
    const gifts = await listAvailableGifts('luffy')
    expect(gifts.length).toBeGreaterThanOrEqual(5)

    const meat = gifts.find((g) => g.key === 'bone-meat')
    expect(meat).toBeDefined()
    expect(meat?.name).toBe('特制带骨烤肉')
    expect(meat?.category).toBe('food')
    expect(meat?.roleAffinity?.luffy).toBe('favorite')
    expect(meat?.vitalsBuff?.satiety).toBe(30)

    const map = gifts.find((g) => g.key === 'treasure-map')
    expect(map).toBeDefined()
    expect(map?.roleAffinity?.luffy).toBe('favorite')
  })

  it('用户赠送带骨大肉：持久化落库、生成专属第一人称欢呼回响并存入主会话', async () => {
    const record = await sendGiftToCompanion('luffy', 'bone-meat', '特地给你烤的大肉，吃饱了才有力气冒险！')

    expect(record.roleId).toBe('luffy')
    expect(record.giftKey).toBe('bone-meat')
    expect(record.giftName).toBe('特制带骨烤肉')
    expect(record.category).toBe('food')
    expect(record.userNote).toBe('特地给你烤的大肉，吃饱了才有力气冒险！')
    expect(record.companionReaction).toContain('大肉')
    expect(record.companionReaction).toContain('同伴')

    // 检查落库
    const list = await listReceivedGifts('luffy')
    expect(list.length).toBe(1)
    expect(list[0].id).toBe(record.id)

    // 检查主会话留痕
    expect(ensureMainSessionForRoleMock).toHaveBeenCalledWith('luffy')
    expect(saveMessageMock).toHaveBeenCalledTimes(1)
    const [sessionId, message] = saveMessageMock.mock.calls[0]
    expect(sessionId).toBe('session-luffy-main')
    expect(message.role).toBe('assistant')
    expect(message.content).toContain('【送上了礼物 · 特制带骨烤肉】')
    expect(message.content).toContain('特地给你烤的大肉，吃饱了才有力气冒险！')

    // 检查广播通知
    expect(sendMock).toHaveBeenCalledWith('companion:gift-received', expect.objectContaining({
      roleId: 'luffy',
      gift: expect.objectContaining({ giftKey: 'bone-meat' }),
    }))
  })

  it('赠礼联动生命体征提升与多份礼物历史按时间倒序', async () => {
    expect(currentWorldMood).toBe(65)
    expect(currentWorldEnergy).toBe(70)

    // 送大肉: mood + 25, energy + 15
    await sendGiftToCompanion('luffy', 'bone-meat', undefined, { now: 1000 })
    expect(currentWorldMood).toBe(90) // 65 + 25
    expect(currentWorldEnergy).toBe(85) // 70 + 15

    // 送海图: mood + 20, energy + 10
    await sendGiftToCompanion('luffy', 'treasure-map', undefined, { now: 2000 })
    expect(currentWorldMood).toBe(100) // max 100
    expect(currentWorldEnergy).toBe(95)

    const list = await listReceivedGifts('luffy')
    expect(list.length).toBe(2)
    // 倒序排列：第 1 个是 treasure-map (now 2000)，第 2 个是 bone-meat (now 1000)
    expect(list[0].giftKey).toBe('treasure-map')
    expect(list[1].giftKey).toBe('bone-meat')
  })

  it('支持受控 Mock 模型响应并在主会话如实展现', async () => {
    const customReaction = '哇哈哈！这是专门为我做的大探险罗盘吗！只要跟着你的指引，我们就是世界上最自由的草帽海贼团！出发！'
    const record = await sendGiftToCompanion('luffy', 'star-compass', '送你的罗盘', {
      mockResponse: { reactionText: customReaction, emotion: '狂喜' },
    })

    expect(record.companionReaction).toBe(customReaction)
    const [, message] = saveMessageMock.mock.calls[0]
    expect(message.content).toContain(customReaction)
  })

  it('不同角色赠礼具备清晰的人设隔离与保底回响', async () => {
    const linRecord = await sendGiftToCompanion('lin', 'warm-scarf', '天冷了，注意保暖')
    expect(linRecord.roleId).toBe('lin')
    expect(linRecord.companionReaction).toContain('收到你送的礼物啦')
    expect(linRecord.companionReaction).toContain('心里暖洋洋的')

    // 角色隔离：查询 luffy 不应包含 lin 的记录
    const luffyList = await listReceivedGifts('luffy')
    expect(luffyList.length).toBe(0)

    const linList = await listReceivedGifts('lin')
    expect(linList.length).toBe(1)
    expect(linList[0].giftKey).toBe('warm-scarf')
  })

  it('拒绝未登记礼物和超长寄语，避免伪造礼物记录', async () => {
    await expect(sendGiftToCompanion('luffy', 'unknown-gift')).rejects.toThrow('礼物不存在')
    await expect(sendGiftToCompanion('luffy', 'bone-meat', '字'.repeat(501))).rejects.toThrow('赠礼寄语无效')
  })
})

/**
 * 伙伴求助与生活共同决策（Co-Decisions & Shared Choices）单测门禁
 *
 * 背景：数字伙伴遇到生活、航向或日常抉择时，向用户发起两难求助；
 * 用户在卡片上做出选择后，伙伴产生充满人设特征的第一人称反馈，并在主会话留痕；
 * 关键抉择被明日生活脚本（Life Script）吸收，实现因果闭环。
 *
 * 设计意图：
 * 1. 验证内置预设抉择（Luffy 初始航向抉择）在角色首次访问时自动投递为 pending 决策；
 * 2. 验证用户裁决后状态正确变更为 resolved，记录所选选项，并触发事件广播与会话留言；
 * 3. 验证幂等性：已裁决决策重复提交不覆盖旧结果；
 * 4. 验证吸收机制：未吸收的已解决决策能被生活脚本上下文拉取（getRecentResolvedCoDecision），且标记为 absorbed 后不再重复拉取。
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
}))

vi.mock('../../electron/main/llm/aux-config', () => ({
  loadAuxLLMConfig: vi.fn(async () => null),
}))

const {
  ensureCoDecisionTable,
  getPendingCoDecision,
  listCoDecisions,
  resolveCoDecision,
  createCoDecision,
  getRecentResolvedCoDecision,
  markCoDecisionAbsorbed,
} = await import('../../electron/main/companion/life/co-decision')

describe('伙伴求助与生活共同决策（Co-Decisions & Shared Choices）', () => {
  beforeEach(async () => {
    memDb = new SQL.Database()
    sendMock.mockClear()
    saveMessageMock.mockClear()
    ensureMainSessionForRoleMock.mockClear()
    await ensureCoDecisionTable()
  })

  it('初始状态下获取路飞的 pending 决策，自动播种初始航向抉择', async () => {
    const pending = await getPendingCoDecision('luffy')
    expect(pending).not.toBeNull()
    expect(pending?.roleId).toBe('luffy')
    expect(pending?.status).toBe('pending')
    expect(pending?.title).toBe('明天的航向大抉择！')
    expect(pending?.options.length).toBe(3)
    expect(pending?.options[0].id).toBe('opt-meat')
    expect(pending?.options[1].id).toBe('opt-ruins')

    // 再次调用应当返回同一条 pending 决策，而不是重复创建
    const pendingAgain = await getPendingCoDecision('luffy')
    expect(pendingAgain?.id).toBe(pending?.id)
  })

  it('用户做出裁决后，状态正确更新为 resolved，并记录第一人称人设反馈与广播', async () => {
    const pending = await getPendingCoDecision('luffy')
    expect(pending).not.toBeNull()
    if (!pending) return

    const result = await resolveCoDecision(pending.id, 'opt-meat')
    expect(result).not.toBeNull()
    expect(result?.status).toBe('resolved')
    expect(result?.selectedOptionId).toBe('opt-meat')
    expect(result?.selectedOptionLabel).toBe('西边：超级大肉宴会！')
    expect(result?.companionReaction).toContain('大肉')

    // 检查广播
    expect(sendMock).toHaveBeenCalledWith('companion:timeline-updated', expect.objectContaining({ roleId: 'luffy' }))
    expect(sendMock).toHaveBeenCalledWith('companion:co-decision-resolved', expect.objectContaining({
      roleId: 'luffy',
      decision: expect.objectContaining({
        id: pending.id,
        selectedOptionId: 'opt-meat',
      }),
    }))

    // 检查主会话留痕
    expect(ensureMainSessionForRoleMock).toHaveBeenCalledWith('luffy')
    expect(saveMessageMock).toHaveBeenCalledWith('session-luffy-main', expect.objectContaining({
      role: 'assistant',
      content: expect.stringContaining('大肉'),
    }))

    // 此时再查询 pending 应当为空（因为已被解决）
    const pendingNow = await getPendingCoDecision('luffy')
    expect(pendingNow).toBeNull()

    // 列表查询包含该条已解决决策
    const all = await listCoDecisions('luffy')
    expect(all.length).toBe(1)
    expect(all[0].status).toBe('resolved')
  })

  it('决策裁决具备幂等性，已解决的决策不能被重复覆盖', async () => {
    const pending = await getPendingCoDecision('luffy')
    expect(pending).not.toBeNull()
    if (!pending) return

    const firstResult = await resolveCoDecision(pending.id, 'opt-meat')
    const originalReaction = firstResult?.companionReaction

    // 再次尝试切换为 opt-ruins
    const secondResult = await resolveCoDecision(pending.id, 'opt-ruins')
    expect(secondResult).not.toBeNull()
    expect(secondResult?.selectedOptionId).toBe('opt-meat')
    expect(secondResult?.companionReaction).toBe(originalReaction)
  })

  it('解决后的共同决策能被明日生活脚本上下文提取，并在吸收后标记 absorbed', async () => {
    const pending = await getPendingCoDecision('luffy')
    expect(pending).not.toBeNull()
    if (!pending) return

    await resolveCoDecision(pending.id, 'opt-meat')

    // 生活脚本生成器调用 getRecentResolvedCoDecision
    const recent = await getRecentResolvedCoDecision('luffy')
    expect(recent).not.toBeNull()
    expect(recent?.id).toBe(pending.id)
    expect(recent?.selectedOptionLabel).toBe('西边：超级大肉宴会！')

    // 生活脚本吸收后标记 absorbed
    if (recent) {
      await markCoDecisionAbsorbed(recent.id)
    }

    // 再次调用 getRecentResolvedCoDecision 返回 null，避免生活日程无限重复同一抉择
    const afterAbsorbed = await getRecentResolvedCoDecision('luffy')
    expect(afterAbsorbed).toBeNull()
  })

  it('支持自定义创建新共同决策', async () => {
    const custom = await createCoDecision('lin', {
      title: '今晚去哪里散步？',
      dilemma: '窗外刚下过雨，西湖边吹微风，但运河那边的旧书店今天也有灯光。',
      options: [
        { id: 'lake', label: '去西湖边吹晚风' },
        { id: 'canal', label: '去运河桥下的旧书店' },
      ],
    })

    expect(custom).not.toBeNull()
    expect(custom?.id).toBeDefined()
    expect(custom?.roleId).toBe('lin')
    expect(custom?.status).toBe('pending')
    expect(custom?.title).toBe('今晚去哪里散步？')

    const pending = await getPendingCoDecision('lin')
    expect(pending?.id).toBe(custom?.id)
    expect(pending?.title).toBe('今晚去哪里散步？')
    expect(pending?.options.length).toBe(2)
  })
})

/**
 * 角色高光回忆重温（Nostalgic Reminiscence）单元测试
 *
 * 验证目标：
 * 1. 当存在长期记忆 feedback（我们之间）时，能够作为高光回忆候选被拾取；
 * 2. 当记忆中包含 [深夜感悟] 时，自动解析为 epiphany 来源并以亲切口吻重温；
 * 3. 当存在专属信物（keepsakes）时，能够提取信物羁绊背景；
 * 4. 4 小时冷却保护有效，避免高频复读；
 * 5. formatConversationImpulseForPrompt 正确注入【高光回忆羁绊】提示词插槽。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>

vi.mock('../../electron/main/storage/database', () => ({
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

const {
  pickNostalgicReminiscence,
  _resetNostalgiaState,
  NOSTALGIA_COOLDOWN_MS,
} = await import('../../electron/main/companion/life/nostalgia')

const { addMemory } = await import('../../electron/main/storage/memory-store')
const { ensureInnerThoughtTable } = await import('../../electron/main/companion/life/inner-thoughts')
const { triggerGiftKeepsake, ensureKeepsakeTable } = await import(
  '../../electron/main/companion/growth/relationship-keepsake'
)
const { formatConversationImpulseForPrompt } = await import('../../electron/main/companion/orchestrator')

describe('角色高光回忆重温（Nostalgic Reminiscence）', () => {
  beforeEach(async () => {
    memDb = new SQL.Database()
    _resetNostalgiaState()
    await ensureInnerThoughtTable()
    await ensureKeepsakeTable()
  })

  it('当存在长期记忆 feedback 时，成功提取回忆候选', async () => {
    // 播种一条深度默契记忆
    await addMemory('feedback', '用户喜欢在深夜边听音乐边写代码，是个做事很专注执着的人。', {
      roleId: 'luffy',
    })

    const now = Date.now()
    const item = await pickNostalgicReminiscence('luffy', now, { force: true, sourceKind: 'memory_feedback' })

    expect(item).not.toBeNull()
    expect(item?.sourceKind).toBe('memory_feedback')
    expect(item?.text).toContain('两人默契')
    expect(item?.text).toContain('专注执着')
  })

  it('当存在深夜感悟时，识别为 epiphany 来源并提取感悟心声', async () => {
    // 播种一条深夜感悟
    await addMemory('feedback', '[深夜感悟] 无论前方海域有多凶险，只要有彼此信任的同伴在身边，每一步都是最好的冒险！', {
      roleId: 'luffy',
    })

    const now = Date.now()
    const item = await pickNostalgicReminiscence('luffy', now, { force: true, sourceKind: 'epiphany' })

    expect(item).not.toBeNull()
    expect(item?.sourceKind).toBe('epiphany')
    expect(item?.text).toContain('日记写下的心声')
    expect(item?.text).toMatch(/最好的冒险|充满勇气/)
  })

  it('当拥有专属信物时，能够提取信物寄语与羁绊', async () => {
    const now = Date.now()
    // 路飞初始会拥有生命卡信物
    const item = await pickNostalgicReminiscence('luffy', now, { force: true })

    expect(item).not.toBeNull()
    expect(item?.text).toBeTruthy()
  })

  it('4小时冷却门控有效：冷却期内再次请求返回 null，重置或 force 可绕过', async () => {
    await addMemory('feedback', '两人一起约定要抵达拉夫德鲁。', { roleId: 'luffy' })

    const now = Date.now()
    const first = await pickNostalgicReminiscence('luffy', now)
    expect(first).not.toBeNull()

    // 1 小时后再次获取（冷却期内）
    const second = await pickNostalgicReminiscence('luffy', now + 3600 * 1000)
    expect(second).toBeNull()

    // 开启 force 仍可获取
    const forced = await pickNostalgicReminiscence('luffy', now + 3600 * 1000, { force: true })
    expect(forced).not.toBeNull()

    // 重置状态后可重新获取
    _resetNostalgiaState()
    const afterReset = await pickNostalgicReminiscence('luffy', now + 3600 * 1000)
    expect(afterReset).not.toBeNull()
  })

  it('formatConversationImpulseForPrompt 正确注入【高光回忆羁绊】提示词插槽', () => {
    const prompt = formatConversationImpulseForPrompt({
      socialNeed: 80,
      currentActivity: '坐在狮子船头看海',
      nostalgicReminiscence: '你前几天夜里在日记写下的心声：“无论前方海域有多凶险，只要有彼此信任的同伴在身边，每一步都是最好的冒险！”',
    })

    expect(prompt).toBeDefined()
    expect(prompt).toContain('【高光回忆羁绊】')
    expect(prompt).toContain('前几天夜里在日记写下的心声')
    expect(prompt).toContain('找合适时机像真人一样顺口带出上述近况')
  })
})

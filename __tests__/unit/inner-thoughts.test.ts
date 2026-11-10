/**
 * 私密内心独白与日记（Inner Thoughts & Private Journal Stream）门禁测试
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
    title: '特等席上的微风与烤肉',
    content: '站在船头吹着海风，山治烤的肉香飘了满船！真想快点到达下一座岛屿，展开全新的大冒险！',
    mood: '热血沸腾',
    weather: '万里无云',
    location: '万里阳光号·特等席',
    activity: '趴在狮子头上闻烤肉香',
  }),
}))

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete: vi.fn(async () => llmState.response),
}))

const {
  ensureInnerThoughtTable,
  decideInnerThought,
  triggerInnerThought,
  listInnerThoughts,
  toggleInnerThoughtFavorite,
  deleteInnerThought,
  INNER_THOUGHT_COOLDOWN_MS,
  INNER_THOUGHT_DAILY_LIMIT,
} = await import('../../electron/main/companion/life/inner-thoughts')

describe('私密内心独白与日记（Inner Thoughts & Private Journal Stream）', () => {
  beforeEach(async () => {
    memDb = new SQL.Database()
    memDb.run(`
      CREATE TABLE IF NOT EXISTS companion_world_states (
        role_id          TEXT PRIMARY KEY,
        current_activity TEXT,
        current_location TEXT,
        home             TEXT,
        energy           INTEGER NOT NULL DEFAULT 80,
        mood             INTEGER NOT NULL DEFAULT 80,
        social_need      INTEGER NOT NULL DEFAULT 50,
        updated_at       INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO companion_world_states (role_id, current_activity, current_location, home, energy, mood, social_need, updated_at)
      VALUES ('luffy', '瞭望台吹风看星星', '万里阳光号·瞭望台', '万里阳光号', 85, 90, 75, 100000);
    `)
    sendMock.mockClear()
  })

  it('决策引擎正确校验频次、冷却与沉思时间窗口', () => {
    const now = 1700000000000

    // 1. 每日上限拦截
    const overLimit = decideInnerThought({
      lastThoughtAt: null,
      thoughtsToday: INNER_THOUGHT_DAILY_LIMIT,
      now,
      localHour: 22,
    })
    expect(overLimit.allow).toBe(false)
    expect(overLimit.reason).toBe('daily-limit')

    // 2. 冷却时间未到拦截 (6小时)
    const onCooldown = decideInnerThought({
      lastThoughtAt: now - 3600 * 1000,
      thoughtsToday: 0,
      now,
      localHour: 22,
    })
    expect(onCooldown.allow).toBe(false)
    expect(onCooldown.reason).toBe('cooldown')

    // 3. 非适合沉思时间段拦截（下午 14 点）
    const afternoon = decideInnerThought({
      lastThoughtAt: now - INNER_THOUGHT_COOLDOWN_MS - 1000,
      thoughtsToday: 0,
      now,
      localHour: 14,
    })
    expect(afternoon.allow).toBe(false)
    expect(afternoon.reason).toBe('non-reflective-time')

    // 4. 夜间正常允许 (22 点)
    const nightAllowed = decideInnerThought({
      lastThoughtAt: now - INNER_THOUGHT_COOLDOWN_MS - 1000,
      thoughtsToday: 0,
      now,
      localHour: 22,
    })
    expect(nightAllowed.allow).toBe(true)
    expect(nightAllowed.reason).toBe('ok')

    // 5. 清晨正常允许 (7 点)
    const morningAllowed = decideInnerThought({
      lastThoughtAt: null,
      thoughtsToday: 0,
      now,
      localHour: 7,
    })
    expect(morningAllowed.allow).toBe(true)
    expect(morningAllowed.reason).toBe('ok')
  })

  it('表初始化为路飞自动播种3篇高温度starter日记并支持列表与收藏', async () => {
    await ensureInnerThoughtTable()
    const thoughts = await listInnerThoughts('luffy')
    expect(thoughts.length).toBe(3)

    // 检查字段映射
    const first = thoughts[0]
    expect(first.roleId).toBe('luffy')
    expect(first.isFavorite).toBe(true)
    expect(first.title).toContain('昨晚跟你在甲板上聊起海贼王')
    expect(first.content).toContain('虽然你平时总在忙各种事')

    // 切换收藏状态
    const updatedFav = await toggleInnerThoughtFavorite(first.id)
    expect(updatedFav).toBe(false)
    const afterToggle = await listInnerThoughts('luffy')
    expect(afterToggle.find((t) => t.id === first.id)?.isFavorite).toBe(false)

    // 恢复收藏
    const reFav = await toggleInnerThoughtFavorite(first.id)
    expect(reFav).toBe(true)

    // 删除单篇日记
    await deleteInnerThought(first.id)
    const afterDelete = await listInnerThoughts('luffy')
    expect(afterDelete.length).toBe(2)
  })

  it('模型触发与确定性人设保底生成并广播事件', async () => {
    const now = Date.now()
    // 1. LLM 正常返回场景
    const thought = await triggerInnerThought('luffy', '夜间发呆', now, {
      llmConfig: { apiKey: 'sk-test', baseUrl: 'https://api.test.com', model: 'gpt-4o' } as any,
    })
    expect(thought).not.toBeNull()
    expect(thought?.title).toBe('特等席上的微风与烤肉')
    expect(thought?.mood).toBe('热血沸腾')
    expect(thought?.weather).toBe('万里无云')

    // 验证广播
    expect(sendMock).toHaveBeenCalledWith('companion:inner-thought-created', expect.objectContaining({
      id: thought?.id,
      title: '特等席上的微风与烤肉',
    }))

    // 验证持久化查出
    const list = await listInnerThoughts('luffy')
    expect(list.some((t) => t.id === thought?.id)).toBe(true)

    // 2. 无模型或失败时平滑保底
    const fallbackThought = await triggerInnerThought('luffy', '无模型场景', now + 1000)
    expect(fallbackThought).not.toBeNull()
    expect(fallbackThought?.title).toBe('特等席吹来的海风')
    expect(fallbackThought?.content).toContain('万里阳光号在海上跑得轻快极了')
  })
})

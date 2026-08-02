/**
 * 成长反思：门闸 + JSON 解析 + null 不写 mutable
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: { getAllWindows: () => [] },
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

vi.mock('../../electron/main/services/task-queue', () => ({
  taskQueue: { enqueue: vi.fn(() => 'task-1') },
}))

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete: vi.fn(),
}))

vi.mock('../../electron/main/storage/memory-store', () => ({
  listMemories: vi.fn(async () => []),
  listFeedbackForRole: vi.fn(async () => []),
}))

vi.mock('../../electron/main/companion/growth/life-signals', () => ({
  collectLifeSignalsForRole: vi.fn(async () => '【近动态】\n- 08-02 12:00 午饭散步（放松） · 附近街道'),
  formatLifeSignalsForReflection: vi.fn(() => ''),
  LIFE_SIGNAL_MOMENT_LIMIT: 12,
}))

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>
/** 按 role 分桶的成长时钟 JSON */
let growthByRole = '{}'
/** 旧全局时钟（迁移源） */
let growthLegacy = ''
const settingsMap: Record<string, string> = {
  universeId: 'default',
  activeRoleId: 'lin',
}

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === 'companionGrowthStartedAtByRole') return growthByRole
    if (key === 'companionGrowthStartedAt') return growthLegacy
    return settingsMap[key] ?? ''
  }),
  setSetting: vi.fn(async (key: string, value: string) => {
    if (key === 'companionGrowthStartedAtByRole') growthByRole = value
    else if (key === 'companionGrowthStartedAt') growthLegacy = value
    else settingsMap[key] = value
  }),
  getAllSettings: vi.fn(async () => ({
    ...settingsMap,
    companionGrowthStartedAt: growthLegacy,
    companionGrowthStartedAtByRole: growthByRole,
  })),
}))

let userMsgCount = 0
vi.mock('../../electron/main/storage/session-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../electron/main/storage/session-store')>()
  return {
    ...actual,
    countUserMessagesForRoleSince: vi.fn(async () => userMsgCount),
    listRecentUserMessagesForRole: vi.fn(async () => ['你好', '继续', '谢谢']),
  }
})

const {
  shouldReflectNow,
  COLD_START_MS,
  COOLDOWN_MS,
  ensureGrowthStartedAt,
  getGrowthStartedAt,
} = await import('../../electron/main/companion/growth/reflection-gate')
const { recordReflectionRun } = await import('../../electron/main/companion/growth/reflection-log')
const { __test, runReflectionNow } = await import(
  '../../electron/main/companion/growth/reflection-service'
)
const { getMutable } = await import('../../electron/main/companion/growth/mutable-store')
const { chatComplete } = await import('../../electron/main/llm/index')

function seedRoleClock(roleId: string, at: number) {
  const map = growthByRole.trim() ? JSON.parse(growthByRole) as Record<string, number> : {}
  map[roleId] = at
  growthByRole = JSON.stringify(map)
}

describe('companion reflection gate', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    growthByRole = '{}'
    growthLegacy = ''
    settingsMap.activeRoleId = 'lin'
    userMsgCount = 10
    memDb.run(`
      CREATE TABLE companion_mutable (
        role_id TEXT PRIMARY KEY, body TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL
      )
    `)
    memDb.run(`
      CREATE TABLE companion_mutable_versions (
        id TEXT PRIMARY KEY, role_id TEXT NOT NULL, version INTEGER NOT NULL,
        body TEXT NOT NULL, created_at INTEGER NOT NULL, summary TEXT NOT NULL DEFAULT '',
        UNIQUE(role_id, version)
      )
    `)
  })

  afterEach(() => {
    memDb.close()
    vi.mocked(chatComplete).mockReset()
  })

  it('冷启动 72h 内拒绝', async () => {
    const now = Date.now()
    seedRoleClock('lin', now - 1000)
    const g = await shouldReflectNow('lin', { now })
    expect(g.allowed).toBe(false)
    expect(g.reason).toBe('cold-start-72h')
  })

  it('冷却 24h 内拒绝', async () => {
    const now = Date.now()
    seedRoleClock('lin', now - COLD_START_MS - 1000)
    await recordReflectionRun('lin', { at: now - 1000, changed: false, summary: 'prev' })
    const g = await shouldReflectNow('lin', { now })
    expect(g.allowed).toBe(false)
    expect(g.reason).toBe('cooldown')
    expect(COOLDOWN_MS).toBeGreaterThan(0)
  })

  it('消息不足拒绝', async () => {
    const now = Date.now()
    seedRoleClock('lin', now - COLD_START_MS - 1000)
    userMsgCount = 2
    const g = await shouldReflectNow('lin', { now })
    expect(g.allowed).toBe(false)
    expect(g.reason).toBe('insufficient-messages')
  })

  it('门闸通过', async () => {
    const now = Date.now()
    await ensureGrowthStartedAt('lin', now - COLD_START_MS - 10_000)
    userMsgCount = 8
    const g = await shouldReflectNow('lin', { now })
    expect(g.allowed).toBe(true)
  })

  it('M22-G1：成长时钟按 role 分桶', async () => {
    const now = Date.now()
    await ensureGrowthStartedAt('lin', now - COLD_START_MS - 10_000)
    await ensureGrowthStartedAt('zhou', now - 1000)

    expect(await getGrowthStartedAt('lin')).toBe(now - COLD_START_MS - 10_000)
    expect(await getGrowthStartedAt('zhou')).toBe(now - 1000)

    userMsgCount = 10
    expect((await shouldReflectNow('lin', { now })).allowed).toBe(true)
    expect((await shouldReflectNow('zhou', { now })).allowed).toBe(false)
    expect((await shouldReflectNow('zhou', { now })).reason).toBe('cold-start-72h')
  })

  it('M22-G1：旧全局时钟迁移到活跃主角', async () => {
    const now = Date.now()
    const legacy = now - COLD_START_MS - 5000
    growthLegacy = String(legacy)
    settingsMap.activeRoleId = 'lin'
    growthByRole = '{}'

    expect(await getGrowthStartedAt('lin')).toBe(legacy)
    // 迁移后 map 已写入；zhou 仍无独立时钟
    expect(await getGrowthStartedAt('zhou')).toBe(0)
    await ensureGrowthStartedAt('zhou', now)
    expect(await getGrowthStartedAt('zhou')).toBe(now)
    expect(await getGrowthStartedAt('lin')).toBe(legacy)
  })
})

describe('companion reflection runner', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    growthByRole = JSON.stringify({ lin: Date.now() - COLD_START_MS - 60_000 })
    growthLegacy = ''
    userMsgCount = 10
    memDb.run(`
      CREATE TABLE companion_mutable (
        role_id TEXT PRIMARY KEY, body TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL
      )
    `)
    memDb.run(`
      CREATE TABLE companion_mutable_versions (
        id TEXT PRIMARY KEY, role_id TEXT NOT NULL, version INTEGER NOT NULL,
        body TEXT NOT NULL, created_at INTEGER NOT NULL, summary TEXT NOT NULL DEFAULT '',
        UNIQUE(role_id, version)
      )
    `)
  })

  afterEach(() => {
    memDb.close()
    vi.mocked(chatComplete).mockReset()
  })

  it('parseReflectionJson 识别 null', () => {
    expect(__test.parseReflectionJson('{"newMutable":null,"summary":"ok"}').newMutable).toBeNull()
    expect(__test.parseReflectionJson('{"newMutable":"语气更短","summary":"微调"}').newMutable).toBe(
      '语气更短',
    )
  })

  it('buildReflectionPrompt 含生活薄信号且禁止抄行程进 MUTABLE', () => {
    const prompt = __test.buildReflectionPrompt({
      roleName: '林晚',
      protectedSummary: '独立个体',
      currentMutable: '少客套',
      recentUserMessages: ['你好'],
      feedbackNotes: [],
      lifeSignals: '【近动态】\n- 08-02 12:00 午饭散步',
    })
    expect(prompt).toContain('近况生活信号')
    expect(prompt).toContain('午饭散步')
    expect(prompt).toContain('不得抄进 MUTABLE')
  })

  it('LLM 返回 null 不改 mutable', async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce('{"newMutable":null,"summary":"no-change"}')
    const before = await getMutable('lin')
    const r = await runReflectionNow('lin', {
      apiKey: 'x', baseUrl: 'http://x', model: 'm',
    }, { force: true })
    expect(r.changed).toBe(false)
    expect(await getMutable('lin')).toBe(before)
    const call = vi.mocked(chatComplete).mock.calls[0]?.[0] as {
      messages: Array<{ content: string }>
    }
    expect(call.messages[0].content).toContain('近况生活信号')
    expect(call.messages[0].content).toContain('午饭散步')
  })

  it('LLM 返回正文则写入', async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce(
      '{"newMutable":"回复再短一点，先给结论。","summary":"更短"}',
    )
    const r = await runReflectionNow('lin', {
      apiKey: 'x', baseUrl: 'http://x', model: 'm',
    }, { force: true })
    expect(r.changed).toBe(true)
    expect(r.version).toBe(1)
    expect(await getMutable('lin')).toContain('先给结论')
  })
})

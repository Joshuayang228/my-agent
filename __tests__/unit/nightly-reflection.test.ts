import { runLocalTransaction } from '../helpers/local-transaction'
/**
 * 角色深夜反思与心灵领悟（Nightly Reflection & Epiphany）单元测试
 *
 * 验证目标：
 * 1. 夜间时段（22:00～04:00）或 force 触发能够顺利生成深夜反思；
 * 2. 白天非深夜时段无 force 时自动略过；
 * 3. 20 小时冷却门控有效，防止重复轰炸；
 * 4. 成功生成后，日记记录标记 thoughtType='nightly_reflection'，包含心灵感悟（epiphany）；
 * 5. 心灵感悟同步写入长期记忆的 feedback 分桶（我们之间）；
 * 6. 向窗口广播 companion:nightly-reflection-created 与 companion:inner-thought-created。
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
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>

vi.mock('../../electron/main/storage/database', () => ({
  withDatabaseTransaction: async (work: (db: typeof memDb) => Promise<unknown>) => runLocalTransaction(memDb, work),
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/llm/aux-config', () => ({
  loadAuxLLMConfig: vi.fn(async () => null),
}))

vi.mock('../../electron/main/storage/session-store', () => ({
  listRecentUserMessagesForRole: vi.fn(async () => ['今天一起把代码都重构好了，真有默契！']),
}))

const {
  checkAndTriggerNightlyReflection,
  triggerNightlyReflection,
  NIGHTLY_REFLECTION_COOLDOWN_MS,
} = await import('../../electron/main/companion/life/nightly-reflection')

const { listInnerThoughts, ensureInnerThoughtTable } = await import(
  '../../electron/main/companion/life/inner-thoughts'
)

const { ensureMemoryTable, listFeedbackForRole } = await import('../../electron/main/storage/memory-store')
const { recoverCompanionFollowups } = await import('../../electron/main/companion/application/companion-followups')
const { commitConversationCompletion } = await import('../../electron/main/agent/conversation-application-service')

describe('角色深夜反思与心灵领悟（Nightly Reflection & Epiphany）', () => {
  beforeEach(async () => {
    memDb = new SQL.Database()
    sendMock.mockClear()
    await ensureInnerThoughtTable()
    memDb.run(`UPDATE companion_inner_thoughts SET created_at = 1000`)
  })

  it('白天非深夜时段且未开启 force 时，不触发反思', async () => {
    // 构造下午 14:30 的时间戳
    const dayTime = new Date('2026-11-09T14:30:00+08:00').getTime()
    const result = await checkAndTriggerNightlyReflection('luffy', dayTime, { force: false })
    expect(result).toBeNull()
  })

  it('深夜时段（23:30）触发深夜反思，并提炼心灵感悟沉淀至日记与长期记忆', async () => {
    const nightTime = new Date('2026-11-09T23:30:00+08:00').getTime()
    const result = await checkAndTriggerNightlyReflection('luffy', nightTime)

    expect(result).not.toBeNull()
    expect(result?.roleId).toBe('luffy')
    expect(result?.thoughtType).toBe('nightly_reflection')
    expect(result?.title).toContain('星光')
    expect(result?.isFavorite).toBe(true)
    expect(result?.epiphany).toBeTruthy()
    expect(result?.epiphany).toContain('同伴')

    // 验证 companion_inner_thoughts 持久化数据
    const allThoughts = await listInnerThoughts('luffy')
    const saved = allThoughts.find((t) => t.id === result?.id)
    expect(saved).toBeDefined()
    expect(saved?.thoughtType).toBe('nightly_reflection')
    expect(saved?.epiphany).toBe(result?.epiphany)

    // 验证长期记忆 feedback 分桶成功写入感悟
    const feedbacks = await listFeedbackForRole('luffy')
    const epiphanyMemory = feedbacks.find((m) => m.content.includes('[深夜感悟]'))
    expect(epiphanyMemory).toBeDefined()
    expect(epiphanyMemory?.content).toContain(result?.epiphany)

    // 验证窗口广播事件
    expect(sendMock).toHaveBeenCalledWith('companion:nightly-reflection-created', expect.objectContaining({
      id: result?.id,
      thoughtType: 'nightly_reflection',
    }))
    expect(sendMock).toHaveBeenCalledWith('companion:inner-thought-created', expect.objectContaining({
      id: result?.id,
      thoughtType: 'nightly_reflection',
    }))
  })

  it('冷却门控有效：20 小时内再次触发时自动略过，除非 force 为 true', async () => {
    const nightTime1 = new Date('2026-11-09T23:30:00+08:00').getTime()
    const first = await checkAndTriggerNightlyReflection('luffy', nightTime1)
    expect(first).not.toBeNull()

    // 5 小时后（凌晨 04:30，在冷却期内）
    const nightTime2 = nightTime1 + 5 * 3600 * 1000
    const second = await checkAndTriggerNightlyReflection('luffy', nightTime2, { force: false })
    expect(second).toBeNull()

    // 开启 force 时允许强制触发
    const forced = await checkAndTriggerNightlyReflection('luffy', nightTime2, { force: true })
    expect(forced).not.toBeNull()
  })

  it('日记先保存，记忆写入失败后可从数据库重开恢复，重复投递不会重建已删除记忆', async () => {
    await ensureMemoryTable()
    memDb.run("CREATE TRIGGER reject_nightly_memory BEFORE INSERT ON memories BEGIN SELECT RAISE(ABORT, 'fixture-memory-failure'); END")
    const result = await triggerNightlyReflection('luffy', Date.now(), { force: true })
    expect((await listInnerThoughts('luffy')).some(thought => thought.id === result?.id)).toBe(true)
    expect(await listFeedbackForRole('luffy')).toHaveLength(0)
    expect(memDb.exec("SELECT status FROM companion_outbox WHERE kind = 'followup:nightly-memory'")[0]?.values).toEqual([['failed']])

    const snapshot = memDb.export()
    memDb.close()
    memDb = new SQL.Database(snapshot)
    memDb.run('DROP TRIGGER reject_nightly_memory')
    memDb.run("UPDATE companion_outbox SET next_attempt_at = 0 WHERE kind = 'followup:nightly-memory'")
    await recoverCompanionFollowups()
    expect(await listFeedbackForRole('luffy')).toHaveLength(1)
    expect(memDb.exec("SELECT status FROM companion_outbox WHERE kind = 'followup:nightly-memory'")[0]?.values).toEqual([['delivered']])

    // 模拟消费已提交但 Outbox 确认未写盘，用户删除后的记忆不能因重投递复活。
    memDb.run("DELETE FROM memories WHERE category = 'feedback'")
    memDb.run("UPDATE companion_outbox SET status = 'processing', lease_until = 0 WHERE kind = 'followup:nightly-memory'")
    await recoverCompanionFollowups()
    expect(await listFeedbackForRole('luffy')).toHaveLength(0)
    expect(memDb.exec("SELECT status FROM companion_outbox WHERE kind = 'followup:nightly-memory'")[0]?.values).toEqual([['delivered']])
  })

  it('对话回复与结算登记共同提交，重开后的体征结算只执行一次', async () => {
    memDb.run('CREATE TABLE reply_probe (id TEXT PRIMARY KEY)')
    const input = {
      roleId: 'luffy',
      sessionId: 'session-probe',
      assistantMessageId: 'reply-probe',
      occurredAt: Date.now(),
      saveReply: async () => { memDb.run('INSERT INTO reply_probe VALUES (?)', ['reply-probe']) },
    }
    const { getCompanionRuntimeState } = await import('../../electron/main/companion/core/state/runtime-state')
    const before = (await getCompanionRuntimeState('luffy')).socialNeed
    memDb.run("CREATE TRIGGER reject_turn_outbox BEFORE INSERT ON companion_outbox BEGIN SELECT RAISE(ABORT, 'fixture-turn-outbox'); END")
    await expect(commitConversationCompletion(input)).rejects.toThrow('fixture-turn-outbox')
    expect(memDb.exec('SELECT COUNT(*) FROM reply_probe')[0]?.values[0][0]).toBe(0)
    memDb.run('DROP TRIGGER reject_turn_outbox')
    await commitConversationCompletion(input)
    expect(memDb.exec('SELECT id FROM reply_probe')[0]?.values).toEqual([['reply-probe']])
    expect((await getCompanionRuntimeState('luffy')).socialNeed).toBe(before)
    const snapshot = memDb.export()
    memDb.close()
    memDb = new SQL.Database(snapshot)
    memDb.run(`CREATE TRIGGER expire_vitals_claim AFTER UPDATE OF lease_until ON companion_outbox
      WHEN NEW.kind = 'followup:chat-vitals' AND NEW.status = 'processing' AND NEW.lease_until > 0
      BEGIN UPDATE companion_outbox SET lease_until = 0 WHERE id = NEW.id; END`)
    await recoverCompanionFollowups()
    expect((await getCompanionRuntimeState('luffy')).socialNeed).toBe(before)
    expect(memDb.exec("SELECT status FROM companion_outbox WHERE kind = 'followup:chat-vitals'")[0]?.values).toEqual([['failed']])
    memDb.run('DROP TRIGGER expire_vitals_claim')
    memDb.run("UPDATE companion_outbox SET next_attempt_at = 0 WHERE kind = 'followup:chat-vitals'")
    await recoverCompanionFollowups()
    const settled = (await getCompanionRuntimeState('luffy')).socialNeed
    expect(settled).toBeLessThan(before)
    memDb.run("UPDATE companion_outbox SET status = 'processing', lease_until = 0 WHERE kind = 'followup:chat-vitals'")
    await recoverCompanionFollowups()
    expect((await getCompanionRuntimeState('luffy')).socialNeed).toBe(settled)
  })
})

import { runLocalTransaction } from '../helpers/local-transaction'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>
const saveMessageIfAbsent = vi.fn(async () => undefined)

vi.mock('../../electron/main/storage/database', () => ({
  withDatabaseTransaction: async (work: (db: typeof memDb) => Promise<unknown>) => runLocalTransaction(memDb, work),
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))
vi.mock('../../electron/main/storage/session-store', () => ({ saveMessageIfAbsent }))

const { enqueueCompanionSessionMessage } = await import('../../electron/main/companion/application/session-outbox')
const { ensureCompanionCoreSchema } = await import('../../electron/main/companion/core/schema')
const { pruneTerminalCompanionCoreLedgers } = await import('../../electron/main/companion/core/execution/ledger')

describe('人物世界主会话 Outbox', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    saveMessageIfAbsent.mockClear()
  })

  it('消息写入经过 Outbox 并按消息 ID 幂等投递', async () => {
    await enqueueCompanionSessionMessage({
      roleId: 'luffy',
      sessionId: 'session-1',
      message: { id: 'message-1', role: 'assistant', content: '测试消息', timestamp: 100 },
    })
    expect(saveMessageIfAbsent).toHaveBeenCalledWith('session-1', expect.objectContaining({ id: 'message-1' }))
    expect(memDb.exec("SELECT kind, status, attempt FROM companion_outbox WHERE dedupe_key = 'main-session-message:message-1'")[0]?.values[0]).toEqual(['main-session-message', 'delivered', 1])
  })

  it('pruneTerminalCompanionCoreLedgers 仅清理过期终态记录，保留 running / pending 记录（B12）', async () => {
    await ensureCompanionCoreSchema()
    const now = 1_750_000_000_000
    const expired = now - 20 * 24 * 60 * 60 * 1000
    const recent = now - 1_000

    memDb.run(
      `INSERT INTO companion_execution_runs (id, role_id, action_type, status, started_at, completed_at)
       VALUES ('run-old-completed', 'luffy', 'life-tick', 'completed', ?, ?),
              ('run-recent-completed', 'luffy', 'life-tick', 'completed', ?, ?),
              ('run-old-running', 'luffy', 'life-tick', 'running', ?, NULL)`,
      [expired, expired, recent, recent, expired],
    )
    memDb.run(
      `INSERT INTO companion_outbox (id, role_id, kind, dedupe_key, payload_json, status, created_at, delivered_at)
       VALUES ('outbox-old-delivered', 'luffy', 'timeline-updated', 'd1', '{}', 'delivered', ?, ?),
              ('outbox-old-pending', 'luffy', 'timeline-updated', 'd2', '{}', 'pending', ?, NULL)`,
      [expired, expired, expired],
    )

    const result = pruneTerminalCompanionCoreLedgers(memDb, now)
    expect(result.prunedRuns).toBe(1)
    expect(result.prunedOutbox).toBe(1)
    const remainingRuns = memDb.exec('SELECT id FROM companion_execution_runs ORDER BY id ASC')[0]?.values.map(r => r[0])
    expect(remainingRuns).toEqual(['run-old-running', 'run-recent-completed'])
    const remainingOutbox = memDb.exec('SELECT id FROM companion_outbox ORDER BY id ASC')[0]?.values.map(r => r[0])
    expect(remainingOutbox).toEqual(['outbox-old-pending'])
  })
})

import { runLocalTransaction } from '../helpers/local-transaction'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>
let windows: Array<{ isDestroyed: () => boolean; webContents: { send: ReturnType<typeof vi.fn> } }> = []

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => windows },
}))
vi.mock('../../electron/main/storage/database', () => ({
  withDatabaseTransaction: async (work: (db: typeof memDb) => Promise<unknown>) => runLocalTransaction(memDb, work),
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

const { enqueueCompanionOutbox, dispatchCompanionOutbox } = await import('../../electron/main/companion/core/outbox/outbox')
const { dispatchCompanionWindowOutbox } = await import('../../electron/main/companion/adapters/window-outbox-dispatcher')
const { resetCompanionCoreSchemaForTesting } = await import('../../electron/main/companion/core/schema')

describe('人物世界窗口 Outbox 适配器', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    resetCompanionCoreSchemaForTesting()
    windows = []
  })

  it('没有窗口时保留失败状态，窗口恢复后完成投递', async () => {
    await enqueueCompanionOutbox({ roleId: 'luffy', kind: 'test-notification', dedupeKey: 'window-test-1', payload: { ok: true } })
    expect(await dispatchCompanionWindowOutbox()).toBe(0)
    expect(memDb.exec("SELECT status, attempt FROM companion_outbox WHERE dedupe_key = 'window-test-1'")[0]?.values[0]).toEqual(['failed', 1])

    const send = vi.fn()
    windows = [{ isDestroyed: () => false, webContents: { send } }]
    memDb.run("UPDATE companion_outbox SET next_attempt_at = 0 WHERE dedupe_key = 'window-test-1'")
    expect(await dispatchCompanionWindowOutbox()).toBe(1)
    expect(send).toHaveBeenCalledWith('companion:test-notification', { ok: true })
    expect(memDb.exec("SELECT status, attempt FROM companion_outbox WHERE dedupe_key = 'window-test-1'")[0]?.values[0]).toEqual(['delivered', 2])
  })

  it('过期 processing 租约会在下一轮恢复并重新投递', async () => {
    await enqueueCompanionOutbox({ roleId: 'luffy', kind: 'test-lease', dedupeKey: 'window-lease-1', payload: { ok: true } })
    memDb.run("UPDATE companion_outbox SET status = 'processing', claimed_at = 1, lease_until = 1 WHERE dedupe_key = 'window-lease-1'")
    const send = vi.fn()
    windows = [{ isDestroyed: () => false, webContents: { send } }]
    expect(await dispatchCompanionWindowOutbox()).toBe(1)
    expect(send).toHaveBeenCalledWith('companion:test-lease', { ok: true })
  })

  it('达到最大投递次数后停止重试，并回收过期租约', async () => {
    await enqueueCompanionOutbox({ roleId: 'luffy', kind: 'test-max-attempts', dedupeKey: 'window-max-attempts-1', payload: { ok: true } })
    memDb.run("UPDATE companion_outbox SET max_attempts = 1 WHERE dedupe_key = 'window-max-attempts-1'")
    const deliver = vi.fn(async () => { throw new Error('窗口暂不可用') })

    expect(await dispatchCompanionOutbox({ deliver })).toBe(0)
    expect(deliver).toHaveBeenCalledTimes(1)
    memDb.run("UPDATE companion_outbox SET next_attempt_at = 0 WHERE dedupe_key = 'window-max-attempts-1'")
    expect(await dispatchCompanionOutbox({ deliver })).toBe(0)
    expect(deliver).toHaveBeenCalledTimes(1)

    await enqueueCompanionOutbox({ roleId: 'luffy', kind: 'test-expired-max', dedupeKey: 'window-expired-max-1', payload: { ok: true } })
    memDb.run("UPDATE companion_outbox SET status = 'processing', attempt = 1, claimed_at = 1, lease_until = 1, max_attempts = 1 WHERE dedupe_key = 'window-expired-max-1'")
    expect(await dispatchCompanionOutbox({ deliver })).toBe(0)
    expect(memDb.exec("SELECT status, lease_until, last_error FROM companion_outbox WHERE dedupe_key = 'window-expired-max-1'")[0]?.values[0]).toEqual(['failed', null, '达到最大投递次数，停止自动重试。'])
  })
})

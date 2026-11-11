import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>
let windows: Array<{ isDestroyed: () => boolean; webContents: { send: ReturnType<typeof vi.fn> } }> = []

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => windows },
}))
vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

const { enqueueCompanionOutbox } = await import('../../electron/main/companion/core/outbox/outbox')
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
    expect(await dispatchCompanionWindowOutbox()).toBe(1)
    expect(send).toHaveBeenCalledWith('companion:test-notification', { ok: true })
    expect(memDb.exec("SELECT status, attempt FROM companion_outbox WHERE dedupe_key = 'window-test-1'")[0]?.values[0]).toEqual(['delivered', 2])
  })
})

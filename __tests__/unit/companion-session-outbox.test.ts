import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>
const saveMessageIfAbsent = vi.fn(async () => undefined)

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))
vi.mock('../../electron/main/storage/session-store', () => ({ saveMessageIfAbsent }))

const { enqueueCompanionSessionMessage } = await import('../../electron/main/companion/application/session-outbox')

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
})

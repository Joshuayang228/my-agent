import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
  withDatabaseTransaction: vi.fn(async (work: (db: typeof memDb) => Promise<unknown>) => {
    memDb.run('BEGIN')
    try {
      const result = await work(memDb)
      memDb.run('COMMIT')
      return result
    } catch (error) {
      memDb.run('ROLLBACK')
      throw error
    }
  }),
}))

const { createCompanionLifeEvent } = await import('../../electron/main/companion/application/life-event')
const { createCompanionDayScript } = await import('../../electron/main/companion/application/day-script')
const { getCompanionDomainEventById } = await import('../../electron/main/companion/core/events/domain-events')

describe('Companion 事实入口', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
  })

  it('生活事件同时写入旧查询投影和 Core Domain Event，并按事件 ID 幂等', async () => {
    const input = {
      id: 'event-gateway-1',
      roleId: 'luffy',
      scheduledAt: 100,
      status: 'planned' as const,
      type: 'moment',
      payload: { activity: '甲板看海' },
      dayScriptId: null,
    }
    const first = await createCompanionLifeEvent(input)
    const second = await createCompanionLifeEvent(input)
    expect(second.id).toBe(first.id)
    expect(memDb.exec('SELECT COUNT(*) FROM companion_events')[0].values[0][0]).toBe(1)
    const coreId = String(memDb.exec("SELECT id FROM companion_domain_events WHERE type = 'life_event_created'")[0].values[0][0])
    const core = await getCompanionDomainEventById(coreId)
    expect(core?.type).toBe('life_event_created')
    expect(core?.sourceId).toBe('event-gateway-1')
  })

  it('日剧本入口会写入剧本投影和 Core 事实', async () => {
    const row = await createCompanionDayScript({
      roleId: 'luffy',
      date: '2026-11-14',
      payload: { date: '2026-11-14', theme: '平静的一天', slots: [] },
    })
    expect(row.roleId).toBe('luffy')
    expect(memDb.exec('SELECT COUNT(*) FROM companion_day_scripts')[0].values[0][0]).toBe(1)
    expect(memDb.exec("SELECT COUNT(*) FROM companion_domain_events WHERE type = 'day_script_created'")[0].values[0][0]).toBe(1)
  })
})

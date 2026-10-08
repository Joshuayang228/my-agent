import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
let db: InstanceType<typeof SQL.Database>
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: vi.fn(async () => db), persist: vi.fn() }))
vi.mock('../../electron/main/utils/logger', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }))
vi.mock('../../electron/main/companion/identity/loader', () => ({ loadRelations: () => ({ edges: [{ from: 'lin', to: 'yao', type: 'friend', note: '相处方式' }] }) }))
vi.mock('../../electron/main/companion/cast/roster', () => ({ listRelatedCast: () => [{ id: 'yao', name: '阿遥', description: '人物介绍', summary: '摘要' }] }))
const { getContactsForRole } = await import('../../electron/main/companion/cast/contacts')
const { insertEvent, replaceEventLinks, insertMoment } = await import('../../electron/main/companion/life/store')
const { createAsset } = await import('../../electron/main/companion/life/assets')

describe('通讯录真实事件投影', () => {
  beforeEach(() => { db = new SQL.Database() })
  afterEach(() => db.close())
  it('关系与介绍分开，已发布共同在场事件可多条呈现，重载后不制造经历', async () => {
    const trip = await createAsset({ roleId: 'lin', kind: 'footprint', name: '旅行', payload: { recordType: 'trip', status: 'active', start: '2026-09-26', destination: '苏州' } })
    if (!trip.ok) throw new Error(trip.error)
    for (const [index, roleId, status, person] of [[1, 'lin', 'published', 'yao'], [2, 'lin', 'published', 'yao'], [3, 'lin', 'planned', 'yao'], [4, 'other', 'published', 'yao'], [5, 'lin', 'published', 'missing']] as const) {
      const event = await insertEvent({ roleId, status, scheduledAt: index, type: 'walk', dayScriptId: null, payload: { title: `经历-${index}`, story: `故事-${index}` } })
      await replaceEventLinks(roleId, event.id, [{ targetType: 'cast', targetId: person, relation: 'coframe' }, ...(index === 1 ? [{ targetType: 'asset', targetId: trip.asset.id, relation: 'references' }] : [])])
      await insertMoment({ roleId, eventId: event.id, publishedAt: index, text: `动态-${index}` })
    }
    const saved = db.export()
    db.close(); db = new SQL.Database(saved)
    const data = await getContactsForRole('lin')
    expect(data.people).toEqual([{ id: 'yao', name: '阿遥', introduction: '人物介绍' }])
    expect(data.relations).toEqual([{ ownerRoleId: 'lin', personId: 'yao', relationType: 'friend', summary: '相处方式' }])
    expect(data.experiences.map(item => item.title)).toEqual(['经历-2', '经历-1'])
    expect(data.experiences.every(item => item.ownerRoleId === 'lin' && item.personId === 'yao')).toBe(true)
    expect(data.experiences[1].references).toContainEqual({ kind: 'trip', targetId: trip.asset.id })
    expect(data.experiences[0].story).toBe('故事-2')
  })
})

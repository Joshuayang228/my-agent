import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { queryCompanionEvidence } from '../../electron/main/debug/companion-evidence'
import type { DebugEvidenceRecord, DebugEvidenceScope } from '../../src/shared/debug-evidence'
import { projectWardrobeRecords, wardrobeFields } from '../../src/components/debug/wardrobe-projection'

const record = (id: string, payload: Record<string, unknown>): DebugEvidenceRecord => ({ id, kind: 'wardrobe', data: { payload, acquired_at: 0 }, roleId: 'lin', title: id, source: 'companion_assets', time: null, body: '', status: '', truncated: false, links: [] })
describe('衣柜真实记录投影', () => {
  it('单件 / 套装 / 状态 / 未知分开，不把单件字段解释为版本', () => {
    const rows = [record('legacy', { category: 'top', outfitVersion: 999 }), record('outfit', { recordType: 'outfit', slots: { top: 'shirt', bottom: 'pants', shoes: 'shoes' }, outfitVersion: 2 }), record('state', { recordType: 'wear-state', slots: { top: 'shirt' }, outfitVersion: 1.5 }), record('future', { recordType: 'future', category: 'top' })]
    const before = JSON.stringify(rows), items = projectWardrobeRecords(rows)
    expect(items.map(item => item.kind)).toEqual(['garment', 'outfit', 'wear-state', 'unknown'])
    expect(items[0].meta).toBe('上装')
    expect(items[1].meta).toBe('版本 v2')
    expect(items[1].slots?.map(slot => slot.id)).toEqual(['shirt', 'pants', 'shoes'])
    expect(items[2].meta).toBe('版本字段无效')
    expect(wardrobeFields(items[0], 'Asia/Shanghai')).toContainEqual(['收录时间', '未记录'])
    expect(JSON.stringify(rows)).toBe(before)
  })
  it('原始槽位不先 trim 再冒充有效关联，坏结构和冲突状态均保留', () => {
    const rows = [record('bad-id', { recordType: 'wear-state', slots: { top: ' shirt ' } }), record('bad-slots', { recordType: 'outfit', slots: {} }), record('state-a', { recordType: 'wear-state', slots: { top: 'shirt' } }), record('state-b', { recordType: 'wear-state', slots: { top: 'other' } })]
    const items = projectWardrobeRecords(rows)
    expect(items[0].slots).toBeUndefined()
    expect(items[0].issue).toContain('原始保存值不一致')
    expect(items[0].record.data.payload).toEqual({ recordType: 'wear-state', slots: { top: ' shirt ' } })
    expect(items[1].issue).toContain('有效衣物槽位')
    expect(items.filter(item => item.kind === 'wear-state')).toHaveLength(3)
  })
  it('真实 SQL 分页保留同人物 / 资产类型，未读槽位不被补成缺失或默认衣物', async () => {
    const SQL = await initSqlJs(), db = new SQL.Database()
    try {
      db.run('CREATE TABLE companion_assets (id TEXT PRIMARY KEY, role_id TEXT, kind TEXT, name TEXT, payload_json TEXT, acquired_at INTEGER)')
      for (const [id, role, kind, payload, at] of [['shirt', 'lin', 'wardrobe', { category: 'top' }, 1], ['outfit', 'lin', 'wardrobe', { recordType: 'wear-state', slots: { top: 'shirt' } }, 2], ['foreign', 'zhou', 'wardrobe', { category: 'top' }, 3], ['home', 'lin', 'home', {}, 4]] as const) db.run('INSERT INTO companion_assets VALUES (?, ?, ?, ?, ?, ?)', [id, role, kind, id, JSON.stringify(payload), at])
      const scope: DebugEvidenceScope = { roles: [{ id: 'lin', name: '林' }, { id: 'zhou', name: '周' }], activeRoleId: 'lin', universeId: 'default', ready: true }
      const before = db.export(), first = queryCompanionEvidence({ view: 'wardrobe', roleId: 'lin', limit: 1 }, db, scope)
      const firstItems = projectWardrobeRecords(first.records)
      expect(firstItems[0].slots?.[0].id).toBe('shirt')
      expect(firstItems.some(item => item.id === 'shirt')).toBe(false)
      const next = queryCompanionEvidence({ view: 'wardrobe', roleId: 'lin', limit: 1, cursor: first.nextCursor }, db, scope)
      expect(next.records.map(row => row.id)).toEqual(['shirt'])
      for (const id of ['foreign', 'home', 'missing']) expect(queryCompanionEvidence({ view: 'wardrobe', roleId: 'lin', recordId: id }, db, scope).records).toEqual([])
      expect(db.export()).toEqual(before)
    } finally { db.close() }
  })
})

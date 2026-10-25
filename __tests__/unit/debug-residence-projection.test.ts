import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { queryCompanionEvidence } from '../../electron/main/debug/companion-evidence'
import type { DebugEvidenceRecord, DebugEvidenceScope } from '../../src/shared/debug-evidence'
import { projectResidenceRecords, residenceFields } from '../../src/components/debug/residence-projection'
import { residenceParent } from '../../src/components/debug/ResidenceReading'

const record = (id: string, kind: string, payload: Record<string, unknown>, roleId = 'lin'): DebugEvidenceRecord => ({ id, kind, data: { payload }, roleId, title: id, source: 'companion_assets', time: null, body: '', status: '', truncated: false, links: [] })

describe('家居真实资产阅读投影', () => {
  it('住所、空间与物件只按同人物真实类型和 ID 关联，不按同名推断', () => {
    const records = [record('home', 'home', { recordType: 'residence' }), record('space', 'home', { recordType: 'space', residenceId: 'home' }), record('item', 'furniture', { spaceId: 'space', displayInHome: false }), record('wrong', 'furniture', { spaceId: 'home' }), record('cross', 'furniture', { spaceId: 'foreign' }), record('foreign', 'home', { recordType: 'space' }, 'zhou')]
    const before = JSON.stringify(records)
    const items = projectResidenceRecords(records)
    expect(items.map(item => item.kind)).toEqual(['residence', 'space', 'object', 'object', 'object', 'space'])
    expect(residenceParent(items[1], items)?.id).toBe('home')
    expect(residenceParent(items[2], items)?.id).toBe('space')
    expect(residenceParent(items[3], items)).toBeUndefined()
    expect(residenceParent(items[4], items)).toBeUndefined()
    expect(items[2].displayInHome).toBe(false)
    expect(JSON.stringify(records)).toBe(before)
  })
  it('旧类型、坏引用和陈列字段保留原文，不修正后冒充有效关系', () => {
    const records = [record('unknown', 'home', { recordType: 'old-home' }), record('bad', 'furniture', { spaceId: ' space ', displayInHome: 'true', displayEvidence: [12] }), record('unplaced', 'furniture', {})]
    records[0].truncated = true
    const items = projectResidenceRecords(records)
    expect(items[0].kind).toBe('unknown')
    expect(items[0].notice).toContain('截断')
    expect(items[1].parentId).toBeUndefined()
    expect(items[1].parentIssue).toContain('格式异常')
    expect(items[1].displayInHome).toBeUndefined()
    expect(items[1].displayIssue).toContain('格式异常')
    expect(residenceFields(items[1])).toContainEqual(['展示依据', '字段异常，见原文'])
    expect(items[1].record).toBe(records[1])
    expect(items[1].record.data.payload).toEqual({ spaceId: ' space ', displayInHome: 'true', displayEvidence: [12] })
    expect(residenceFields(items[2])).toContainEqual(['空间', '未归置'])
  })
  it('真实 SQL 分页未读到父级时不判不存在，显式同人物引用可单独读取，查询不回写', async () => {
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    try {
      db.run('CREATE TABLE companion_assets (id TEXT PRIMARY KEY, role_id TEXT, kind TEXT, name TEXT, payload_json TEXT, acquired_at INTEGER)')
      for (const [id, owner, kind, payload, time] of [['home', 'lin', 'home', { recordType: 'residence' }, 1], ['space', 'lin', 'home', { recordType: 'space', residenceId: 'home' }, 2], ['item', 'lin', 'furniture', { spaceId: 'space' }, 3], ['foreign', 'zhou', 'home', { recordType: 'space' }, 4]] as const) db.run('INSERT INTO companion_assets VALUES (?, ?, ?, ?, ?, ?)', [id, owner, kind, id, JSON.stringify(payload), time])
      const scope: DebugEvidenceScope = { roles: [{ id: 'lin', name: '林' }, { id: 'zhou', name: '周' }], activeRoleId: 'lin', universeId: 'default', ready: true }
      const before = db.export()
      const first = queryCompanionEvidence({ view: 'residence', roleId: 'lin', limit: 1 }, db, scope)
      const item = projectResidenceRecords(first.records)[0]
      expect(item.id).toBe('item')
      expect(item.parentId).toBe('space')
      expect(residenceParent(item, [item])).toBeUndefined()
      expect(queryCompanionEvidence({ view: 'residence', roleId: 'lin', recordId: 'space' }, db, scope).records[0].id).toBe('space')
      expect(queryCompanionEvidence({ view: 'residence', roleId: 'lin', recordId: 'foreign' }, db, scope).records).toEqual([])
      expect(db.export()).toEqual(before)
    } finally { db.close() }
  })
})

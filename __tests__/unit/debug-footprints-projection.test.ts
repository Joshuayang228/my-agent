import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { queryCompanionEvidence } from '../../electron/main/debug/companion-evidence'
import type { DebugEvidenceRecord, DebugEvidenceScope } from '../../src/shared/debug-evidence'
import { projectFootprintRecords } from '../../src/components/debug/footprints-projection'

const record = (id: string, payload: Record<string, unknown>): DebugEvidenceRecord => ({ id, kind: 'footprint', data: { payload, acquired_at: Date.parse('2026-10-25T00:00:00Z') }, roleId: 'lin', title: id, source: 'companion_assets', time: null, body: '', status: '', truncated: false, links: [] })
describe('足迹真实资产阅读投影', () => {
  it('只按明确类型与状态分组，收录日期不能补造旅行日期，坏原文保留', () => {
    const records = [record('active', { recordType: 'trip', status: 'active', destination: '河边', start: '2026-10-20' }), record('plan', { recordType: 'trip', status: 'planned', destination: '山边' }), record('place', { recordType: 'place', status: 'completed' }), record('unknown', { recordType: 'legacy', status: 'completed' }), record('bad', { recordType: 'trip', status: 'completed', start: '2026-02-30', end: '2026-03-01', destination: '河边', stops: [null, { id: 'same', name: '停留', story: '正文', date: 'bad' }, { id: 'same', name: '重复', story: '保留' }] })]
    const before = JSON.stringify(records)
    const items = projectFootprintRecords(records)
    expect(items.map(item => item.group)).toEqual(['actual', 'planned', 'place', 'unknown', 'actual'])
    expect(items[1].dateLabel).toBe('旅行日期未提供')
    expect(items[2].dateLabel).toBe('访问日期未记录')
    expect(items[3].issue).toBeTruthy()
    expect(items[4].issue).toBeTruthy()
    expect(items[4].sortDate).toBe('')
    expect(items[4].stops).toHaveLength(3)
    expect(items[4].stops[1].date).toBeUndefined()
    expect(new Set(items[4].stops.map(stop => stop.key)).size).toBe(3)
    expect(items[4].record).toBe(records[4])
    expect(JSON.stringify(records)).toBe(before)
  })
  it('真实 SQL 分页 / 显式目标限定人物和资产类型且不回写', async () => {
    const SQL = await initSqlJs(), db = new SQL.Database()
    try {
      db.run('CREATE TABLE companion_assets (id TEXT PRIMARY KEY, role_id TEXT, kind TEXT, name TEXT, payload_json TEXT, acquired_at INTEGER)')
      for (const [id, role, kind, payload, time] of [['old', 'lin', 'footprint', { recordType: 'place' }, 1], ['trip', 'lin', 'footprint', { recordType: 'trip', status: 'planned', destination: '海边' }, 2], ['foreign', 'zhou', 'footprint', {}, 3], ['other', 'lin', 'home', {}, 4]] as const) db.run('INSERT INTO companion_assets VALUES (?, ?, ?, ?, ?, ?)', [id, role, kind, id, JSON.stringify(payload), time])
      const scope: DebugEvidenceScope = { roles: [{ id: 'lin', name: '林' }, { id: 'zhou', name: '周' }], activeRoleId: 'lin', universeId: 'default', ready: true }
      const before = db.export()
      const first = queryCompanionEvidence({ view: 'footprints', roleId: 'lin', limit: 1 }, db, scope)
      expect(first.records.map(row => row.id)).toEqual(['trip'])
      expect(first.hasMore).toBe(true)
      const next = queryCompanionEvidence({ view: 'footprints', roleId: 'lin', limit: 1, cursor: first.nextCursor }, db, scope)
      expect(projectFootprintRecords([...first.records, ...next.records]).map(item => item.group)).toEqual(['planned', 'place'])
      for (const id of ['foreign', 'other', 'missing']) expect(queryCompanionEvidence({ view: 'footprints', roleId: 'lin', recordId: id }, db, scope).records).toEqual([])
      expect(db.export()).toEqual(before)
    } finally { db.close() }
  })
})

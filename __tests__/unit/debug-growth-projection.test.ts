import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { queryCompanionEvidence } from '../../electron/main/debug/companion-evidence'
import type { DebugEvidenceRecord, DebugEvidenceScope } from '../../src/shared/debug-evidence'
import { projectGrowthRecords } from '../../src/components/debug/growth-projection'

const record = (source: string, data: Record<string, unknown>, body = ''): DebugEvidenceRecord => ({ id: 'lin', source, data, body, roleId: 'lin', kind: source, title: 'lin', status: '', time: null, truncated: false, links: [] })
describe('成长来源与真实阅读投影', () => {
  it('相同人物 ID 的覆盖与反思独立，空正文不补默认，坏结果原文保留', () => {
    const rows = [record('companion_mutable', { version: 2, updated_at: 0 }), record('companion_reflection_state', { last_run_at: -1, runs: [null, { at: 0, changed: 'true', summary: '摘要' }, { at: 1000, changed: false, summary: '已存结果' }] }), record('Role Pack mutable.default', {}, '默认定义'), record('unexpected', { version: 999 })]
    const before = JSON.stringify(rows), items = projectGrowthRecords(rows, 'Asia/Shanghai')
    expect(items.map(item => item.kind)).toEqual(['current', 'reflection', 'default', 'unknown'])
    expect(new Set(items.map(item => item.key)).size).toBe(4)
    expect(items[0].body).toBe('')
    expect(items[0].at).toBe('未记录')
    expect(items[1].lastRunAt).toBe('未记录')
    expect(items[1].issue).toBeTruthy()
    expect(items[1].runs).toHaveLength(3)
    expect(items[1].runs[1].changed).toBeUndefined()
    expect(items[1].record).toBe(rows[1])
    expect(JSON.stringify(rows)).toBe(before)
  })
  it('真实查询的当前覆盖与反思不被历史分页重复，坏 JSON 不丢其他来源且无回写', async () => {
    const SQL = await initSqlJs(), db = new SQL.Database()
    try {
      db.run('CREATE TABLE companion_mutable (role_id TEXT, body TEXT, version INTEGER, updated_at INTEGER)')
      db.run('CREATE TABLE companion_reflection_state (role_id TEXT, last_run_at INTEGER, runs_json TEXT, updated_at INTEGER)')
      db.run('CREATE TABLE companion_mutable_versions (id TEXT, role_id TEXT, version INTEGER, body TEXT, created_at INTEGER, summary TEXT)')
      db.run("INSERT INTO companion_mutable VALUES ('lin','',2,1000)")
      db.run("INSERT INTO companion_reflection_state VALUES ('lin',0,'bad-json',1000)")
      db.run("INSERT INTO companion_mutable_versions VALUES ('v2','lin',2,'版本二',2000,'摘要二'),('v1','lin',1,'版本一',1000,'摘要一'),('foreign','zhou',1,'其他人物',3000,'')")
      const scope: DebugEvidenceScope = { roles: [{ id: 'lin', name: '林' }, { id: 'zhou', name: '周' }], activeRoleId: 'lin', universeId: 'default', ready: true }
      const before = db.export()
      const first = queryCompanionEvidence({ view: 'growth', roleId: 'lin', limit: 1 }, db, scope)
      expect(first.issues).toHaveLength(1)
      expect(first.records.map(row => row.source)).toEqual(['companion_mutable', 'companion_mutable_versions'])
      const next = queryCompanionEvidence({ view: 'growth', roleId: 'lin', limit: 1, cursor: first.nextCursor }, db, scope)
      expect(next.records.map(row => row.id)).toEqual(['v1'])
      expect(queryCompanionEvidence({ view: 'growth', roleId: 'lin', recordId: 'foreign' }, db, scope).records).toEqual([])
      expect(projectGrowthRecords([...first.records, ...next.records], first.timezone)[0].body).toBe('')
      expect(db.export()).toEqual(before)
    } finally { db.close() }
  })
})

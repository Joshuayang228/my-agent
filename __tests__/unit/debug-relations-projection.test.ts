import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { queryCompanionEvidence } from '../../electron/main/debug/companion-evidence'
import type { DebugEvidenceRecord, DebugEvidenceScope } from '../../src/shared/debug-evidence'
import { projectRelationRecords } from '../../src/components/debug/relations-projection'

describe('通讯录真实共同在场读取', () => {
  it('同名人物不合并，反向定义与坏事件保留，缺失 ID 不补造来源', () => {
    const record = (id: string, data: Record<string, unknown>): DebugEvidenceRecord => ({ id, source: 'Role Pack / Universe relations', data, body: '', roleId: 'lin', kind: 'relation', title: id, status: '', time: null, truncated: false, links: [] })
    const records = [record('a', { name: '同名人物', relations: [{ from: 'lin', to: 'a', type: 'friend', note: '正方向' }, { from: 'a', to: 'lin', type: 'colleague', note: '反方向' }], experiences: [null, { id: 'event', time: 0, payload: { activity: '整理', text: '经历正文' } }] }), record('b', { name: '同名人物', relations: [null], experiences: [] }), record('c', { relations: 'bad', experiences: 'bad' })]
    const before = JSON.stringify(records), items = projectRelationRecords(records, 'Asia/Shanghai')
    expect(items.map(item => item.id)).toEqual(['a', 'b', 'c'])
    expect(items[0].edges.map(edge => edge.note)).toEqual(['正方向', '反方向'])
    expect(items[0].experiences).toHaveLength(2)
    expect(items[0].experiences?.[0].id).toBeUndefined()
    expect(items[0].experiences?.[1].at).toBe('未记录')
    expect(items[1].experiences).toEqual([])
    expect(items[2].experiences).toBeUndefined()
    expect(items[2].experienceIssue).toBeTruthy()
    expect(items[2].name).toBe('c')
    expect(JSON.stringify(records)).toBe(before)
  })
  it('共同事件载荷被读取边界截断时保留截断标记', async () => {
    const SQL = await initSqlJs(), db = new SQL.Database()
    try {
      db.run('CREATE TABLE companion_events (id TEXT, role_id TEXT, scheduled_at INTEGER, status TEXT, payload_json TEXT)')
      db.run('CREATE TABLE companion_event_links (id TEXT, role_id TEXT, event_id TEXT, target_id TEXT, target_type TEXT, relation TEXT)')
      db.run('INSERT INTO companion_events VALUES (?, ?, ?, ?, ?)', ['event', 'lin', 1000, 'published', JSON.stringify({ activity: '整理', apiKey: 'fixture-private-value', labels: Array.from({ length: 101 }, (_, i) => `标签${i}`) })])
      db.run("INSERT INTO companion_event_links VALUES ('cast','lin','event','chen','cast','coframe')")
      const scope: DebugEvidenceScope = { roles: [{ id: 'lin', name: '林' }], activeRoleId: 'lin', universeId: 'default', ready: true }
      const before = db.export()
      const result = queryCompanionEvidence({ view: 'relations', roleId: 'lin', recordId: 'chen' }, db, scope)
      expect(JSON.stringify(result)).not.toContain('fixture-private-value')
      expect(JSON.stringify(result)).toContain('凭据字段已隐藏')
      expect(db.export()).toEqual(before)
      expect(result.records[0].truncated).toBe(true)
      expect(result.records[0].data.experiences).toHaveLength(1)
    } finally { db.close() }
  })
  it('同一人物和事件的多条共同在场关联只返回一次事件，不跨人物或回写', async () => {
    const SQL = await initSqlJs(), db = new SQL.Database()
    try {
      db.run('CREATE TABLE companion_events (id TEXT, role_id TEXT, scheduled_at INTEGER, status TEXT, payload_json TEXT)')
      db.run('CREATE TABLE companion_event_links (id TEXT, role_id TEXT, event_id TEXT, target_id TEXT, target_type TEXT, relation TEXT)')
      db.run("INSERT INTO companion_events VALUES ('event','lin',1000,'published','{}'),('foreign','zhou',2000,'published','{}'),('planned','lin',3000,'planned','{}'),('bad','lin',4000,'published','bad-json')")
      db.run("INSERT INTO companion_event_links VALUES ('cast','lin','event','chen','cast','coframe'),('person','lin','event','chen','person','participant'),('foreign','zhou','foreign','chen','cast','coframe'),('planned','lin','planned','chen','cast','coframe'),('bad','lin','bad','chen','cast','coframe')")
      const scope: DebugEvidenceScope = { roles: [{ id: 'lin', name: '林' }, { id: 'zhou', name: '周' }], activeRoleId: 'lin', universeId: 'default', ready: true }
      const before = db.export()
      const result = queryCompanionEvidence({ view: 'relations', roleId: 'lin', recordId: 'chen' }, db, scope)
      expect(result.records).toHaveLength(1)
      expect(result.records[0].data.experiences).toEqual([{ id: 'event', time: 1000, payload: {} }])
      expect(result.issues).toEqual(['一条共同经历格式损坏'])
      expect(result.hasMore).toBe(false)
      expect(queryCompanionEvidence({ view: 'relations', roleId: 'lin', recordId: 'missing' }, db, scope).records).toEqual([])
      expect(db.export()).toEqual(before)
    } finally { db.close() }
  })
})

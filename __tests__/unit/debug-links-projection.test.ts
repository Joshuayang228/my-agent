import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { queryCompanionEvidence } from '../../electron/main/debug/companion-evidence'
import type { DebugEvidenceRecord, DebugEvidenceScope } from '../../src/shared/debug-evidence'
import { projectLinkRecords, linkFields } from '../../src/components/debug/links-projection'

const record = (id: string, data: Record<string, unknown>): DebugEvidenceRecord => ({ id, data, kind: 'link', roleId: 'lin', title: id, source: 'companion_event_links', time: Date.now(), body: '', status: '', truncated: false, links: [] })
describe('生活事件单边真实投影', () => {
  it('保存名不当当前目标名，字符串 / 数组元数据与完整标识均保留', () => {
    const rows = [record('saved', { event_id: 'event', target_id: 'asset', target_type: 'asset', relation: 'references', created_at: 0, metadata: { name: '旧保存名'.repeat(50), note: '关联备注', target_id: '不能替代真实目标' } }), record('string', { metadata: '有效 JSON 字符串', relation: 'future' }), record('array', { metadata: [1, 2], target_id: 'a'.repeat(64), target_type: 'image' })]
    const before = JSON.stringify(rows), items = projectLinkRecords(rows)
    expect(items[0].title.length).toBeLessThan(110)
    expect(items[0].title).toContain('保存名')
    expect(items[0].metadata?.name).toBe('旧保存名'.repeat(50))
    expect(items[0].targetId).toBe('asset')
    expect(items[0].record.links).toEqual([])
    expect(items[1].metadata).toBeNull()
    expect(items[2].metadata).toBeNull()
    expect(items[2].targetId).toHaveLength(64)
    expect(linkFields(items[0], 'Asia/Shanghai')).toContainEqual(['关联创建时间', '未记录'])
    expect(JSON.stringify(rows)).toBe(before)
  })
  it('真实 SQL 只返回同人物明确定位，元数据名称不重建目标，创建日 / 游标和原文保留', async () => {
    const SQL = await initSqlJs(), db = new SQL.Database()
    try {
      db.run('CREATE TABLE companion_event_links (id TEXT, role_id TEXT, event_id TEXT, target_type TEXT, target_id TEXT, relation TEXT, metadata_json TEXT, created_at INTEGER)')
      db.run('CREATE TABLE companion_events (id TEXT, role_id TEXT)')
      db.run('CREATE TABLE companion_assets (id TEXT, role_id TEXT, kind TEXT, name TEXT)')
      db.run("INSERT INTO companion_events VALUES ('event','lin')")
      db.run("INSERT INTO companion_assets VALUES ('asset','lin','furniture','当前新名称'), ('foreign','zhou','furniture','同名旧资产')")
      const at = Date.parse('2026-10-26T06:00:00Z')
      for (const [id, role, type, target, meta, offset] of [['a', 'lin', 'asset', 'asset', { name: '旧保存名' }, 0], ['b', 'lin', 'image', 'a'.repeat(64), '字符串元数据', 1], ['c', 'lin', 'asset', 'foreign', { name: '同名旧资产', target_id: 'asset' }, 2], ['foreign', 'zhou', 'asset', 'asset', {}, 3]] as const) db.run('INSERT INTO companion_event_links VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, role, 'event', type, target, 'references', JSON.stringify(meta), at + offset])
      const scope: DebugEvidenceScope = { roles: [{ id: 'lin', name: '林' }, { id: 'zhou', name: '周' }], activeRoleId: 'lin', universeId: 'default', ready: true }
      const before = db.export(), result = queryCompanionEvidence({ view: 'links', roleId: 'lin', date: '2026-10-26' }, db, scope)
      expect(result.records).toHaveLength(3)
      expect(result.records.find(row => row.id === 'a')?.links).toContainEqual({ view: 'residence', id: 'asset', label: '查看明确关联的资产' })
      expect(projectLinkRecords(result.records).find(item => item.id === 'a')?.title).toContain('旧保存名')
      for (const id of ['b', 'c']) expect(result.records.find(row => row.id === id)?.links.some(link => link.view !== 'recent')).toBe(false)
      const first = queryCompanionEvidence({ view: 'links', roleId: 'lin', limit: 1 }, db, scope)
      expect(queryCompanionEvidence({ view: 'links', roleId: 'lin', limit: 1, cursor: first.nextCursor }, db, scope).records[0].id).toBe('b')
      expect(queryCompanionEvidence({ view: 'links', roleId: 'lin', recordId: 'foreign' }, db, scope).records).toEqual([])
      expect(queryCompanionEvidence({ view: 'links', roleId: 'lin', date: '2026-10-25' }, db, scope).records).toEqual([])
      expect(db.export()).toEqual(before)
    } finally { db.close() }
  })
})

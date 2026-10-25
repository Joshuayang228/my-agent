import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { queryCompanionEvidence } from '../../electron/main/debug/companion-evidence'
import type { DebugEvidenceRecord, DebugEvidenceScope } from '../../src/shared/debug-evidence'
import { projectMomentRecords } from '../../src/components/debug/moments-projection'

const record = (data: Record<string, unknown>): DebugEvidenceRecord => ({ id: 'moment', source: 'companion_moments', data, body: '不作为空正文替代', roleId: 'lin', kind: 'moment', title: '事件标题不可补正文', status: '', time: Date.now(), truncated: false, links: [] })
describe('动态发布与互动阅读投影', () => {
  it('只用已保存正文和发布时间，未知 / 空互动分开，坏条目保留', () => {
    const rows = [record({ text: '', published_at: 0, meta: { interactions: [null, { kind: 'coframe', castName: '予' }] } }), record({ text: '动态正文', userInteractions: [] }), record({ userInteractions: [null, { actor_id: 'user', kind: 'unexpected', created_at: 0, text: '未知原文' }] })]
    const before = JSON.stringify(rows), items = projectMomentRecords(rows, 'Asia/Shanghai')
    expect(items[0].text).toBe('')
    expect(items[0].preview).toBe('动态正文为空')
    expect(items[0].publishedAt).toBe('未记录')
    expect(items[0].cast).toHaveLength(1)
    expect(items[0].castIssue).toBeTruthy()
    expect(items[0].userInteractions).toBeUndefined()
    expect(items[1].userInteractions).toEqual([])
    expect(items[2].userInteractions).toHaveLength(2)
    expect(items[2].userInteractions?.[1].kind).toBe('未识别的互动')
    expect(items[2].userIssue).toBeTruthy()
    expect(JSON.stringify(rows)).toBe(before)
  })
  it('真实 SQL 按发布日与人物过滤，用户互动有界且明确来源，查询不写入', async () => {
    const SQL = await initSqlJs(), db = new SQL.Database()
    try {
      db.run('CREATE TABLE companion_moments (id TEXT, role_id TEXT, text TEXT, meta_json TEXT, published_at INTEGER, event_id TEXT)')
      db.run('CREATE TABLE companion_events (id TEXT, role_id TEXT)')
      db.run('CREATE TABLE companion_moment_user_interactions (id TEXT, role_id TEXT, moment_id TEXT, actor_id TEXT, kind TEXT, text TEXT, created_at INTEGER)')
      const at = Date.parse('2026-10-24T16:30:00Z')
      db.run('INSERT INTO companion_moments VALUES (?, ?, ?, ?, ?, ?)', ['moment', 'lin', '发布正文', '{}', at, 'event'])
      db.run("INSERT INTO companion_events VALUES ('event','lin')")
      for (let i = 0; i < 51; i++) db.run('INSERT INTO companion_moment_user_interactions VALUES (?, ?, ?, ?, ?, ?, ?)', [String(i), 'lin', 'moment', 'user', 'comment', `评论${i}`, at + i])
      db.run('INSERT INTO companion_moment_user_interactions VALUES (?, ?, ?, ?, ?, ?, ?)', ['foreign', 'zhou', 'moment', 'user', 'comment', '跨人物不可读', at + 100])
      const scope: DebugEvidenceScope = { roles: [{ id: 'lin', name: '林' }, { id: 'zhou', name: '周' }], activeRoleId: 'lin', universeId: 'default', ready: true }
      const before = db.export()
      const result = queryCompanionEvidence({ view: 'moments', roleId: 'lin', date: '2026-10-25' }, db, scope)
      expect(result.records).toHaveLength(1)
      expect(result.records[0].truncated).toBe(true)
      const item = projectMomentRecords(result.records, result.timezone)[0]
      expect(item.userInteractions).toHaveLength(50)
      expect(item.userInteractions?.some(row => row.text.includes('跨人物'))).toBe(false)
      expect(item.record.links).toContainEqual({ view: 'recent', id: 'event', label: '来源生活事件' })
      for (const extra of [{ date: '2026-10-24' }, { recordId: 'missing' }, { roleId: 'zhou' }]) expect(queryCompanionEvidence({ view: 'moments', roleId: 'lin', ...extra }, db, scope).records).toEqual([])
      expect(db.export()).toEqual(before)
    } finally { db.close() }
  })
})

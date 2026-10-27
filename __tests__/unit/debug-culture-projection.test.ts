import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { queryCompanionEvidence } from '../../electron/main/debug/companion-evidence'
import type { DebugEvidenceRecord, DebugEvidenceScope } from '../../src/shared/debug-evidence'
import { projectCultureRecords } from '../../src/components/debug/culture-projection'

const record = (id: string, kind: string, payload: Record<string, unknown>): DebugEvidenceRecord => ({ id, kind, data: { payload, acquired_at: Date.parse('2026-10-26T06:00:00Z') }, roleId: 'lin', title: id, source: 'companion_assets', time: null, body: '', status: '', truncated: false, links: [] })
describe('文化作品与笔记真实阅读', () => {
  it('四类状态只读各自字段，归档 / 未识别保留，正文优先级与笔记时间独立', () => {
    const records = [record('book', 'bookshelf', { readingStatus: 'reading', summary: '作品说明', detail: '完整说明', author: '作者', readingNotes: [{ id: 'new', text: '笔记二', occurredAt: 2000 }, { id: 'old', text: '笔记一', createdAt: 1000 }] }), record('film', 'culture', { type: 'film', watchStatus: 'watching' }), record('music', 'culture', { type: 'music', listeningStatus: 'revisiting', visibility: 'archived' }), record('photo', 'culture', { type: 'photography', workStatus: 'published' }), record('unknown', 'culture', { type: 'future' }), record('missing', 'bookshelf', { watchStatus: 'finished' })]
    const before = JSON.stringify(records), items = projectCultureRecords(records, 'Asia/Shanghai')
    expect(items.map(item => item.status)).toEqual(['阅读中', '观看中', '最近常听', '已发布作品', '状态未识别', '状态未记录'])
    expect(items[0].body).toBe('完整说明')
    expect(items[0].notes.map(note => note.id)).toEqual(['new', 'old'])
    expect(items[0].notes[0].at).toContain('发生时间')
    expect(items[0].notes[1].at).toContain('创建时间')
    expect(items[2].archived).toBe(true)
    expect(JSON.stringify(records)).toBe(before)
  })
  it('显式空 / 坏笔记数组不复活旧 note，无数组的旧笔记不借收录日补时间', () => {
    const items = projectCultureRecords([record('empty', 'bookshelf', { readingNotes: [], note: '不可回退' }), record('bad', 'bookshelf', { readingNotes: [{ id: 'same', text: '一' }, { id: 'same', text: '二' }], note: '不可替代坏数组' }), record('legacy', 'bookshelf', { note: '旧笔记' }), record('progress', 'bookshelf', { currentPage: 20, totalPages: 10 })], 'Asia/Shanghai')
    expect(items[0].notes).toEqual([])
    expect(items[0].emptyNotes).toContain('未回退旧笔记')
    expect(items[1].notes).toEqual([])
    expect(items[1].notesIssue).toBe(true)
    expect(items[2].notes[0]).toMatchObject({ id: 'legacy:note', text: '旧笔记', at: '笔记时间：未记录' })
    expect(items[3].issue).toContain('当前进度不能超过总量')
  })
  it('物件资产进入文化与物品阅读但不伪装成作品', () => {
    const items = projectCultureRecords([record('hat', 'symbolic-item', { description: '稳定象征物', condition: '稳定保管', seededFrom: 'world.default' })], 'Asia/Shanghai')
    expect(items[0]).toMatchObject({ type: 'object', status: '物件资料', body: '稳定象征物' })
  })
  it('真实 SQL 包含旧书架和文化资产，分页 / 归档不丢记录且无跨人物或回写', async () => {
    const SQL = await initSqlJs(), db = new SQL.Database()
    try {
      db.run('CREATE TABLE companion_assets (id TEXT PRIMARY KEY, role_id TEXT, kind TEXT, name TEXT, payload_json TEXT, acquired_at INTEGER)')
      for (const [id, owner, kind, payload, at] of [['old', 'lin', 'bookshelf', { note: '旧笔记' }, 1], ['music', 'lin', 'culture', { type: 'music', visibility: 'archived' }, 2], ['foreign', 'zhou', 'culture', {}, 3], ['home', 'lin', 'home', {}, 4]] as const) db.run('INSERT INTO companion_assets VALUES (?, ?, ?, ?, ?, ?)', [id, owner, kind, id, JSON.stringify(payload), at])
      const scope: DebugEvidenceScope = { roles: [{ id: 'lin', name: '林' }, { id: 'zhou', name: '周' }], activeRoleId: 'lin', universeId: 'default', ready: true }
      const before = db.export(), first = queryCompanionEvidence({ view: 'items', roleId: 'lin', limit: 1 }, db, scope)
      expect(projectCultureRecords(first.records, first.timezone)[0].archived).toBe(true)
      const next = queryCompanionEvidence({ view: 'items', roleId: 'lin', limit: 1, cursor: first.nextCursor }, db, scope)
      expect(projectCultureRecords(next.records, next.timezone)[0].type).toBe('reading')
      for (const id of ['foreign', 'home', 'missing']) expect(queryCompanionEvidence({ view: 'items', roleId: 'lin', recordId: id }, db, scope).records).toEqual([])
      expect(db.export()).toEqual(before)
    } finally { db.close() }
  })
})

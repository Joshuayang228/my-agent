import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import type { DebugEvidenceRecord, DebugEvidenceScope } from '../../src/shared/debug-evidence'
import { queryCompanionEvidence } from '../../electron/main/debug/companion-evidence'
import { MemoryReading, filterMemories, memoryGroup, memoryScope } from '../../src/components/debug/MemoryReading'

describe('正式记忆阅读与实际范围', () => {
  it('未知类别和空正文保留，筛选只作用已读行且原文不变', () => {
    const records: DebugEvidenceRecord[] = [
      { id: 'unknown', roleId: '', source: 'memories', kind: 'constructor', title: '不能代正文', body: '', time: null, status: '', truncated: false, links: [], data: { content: '', extra: '原始未知字段' } },
      { id: 'own', roleId: 'lin', source: 'memories', kind: 'feedback', title: '', body: '长正文。'.repeat(90), time: null, status: '', truncated: true, links: [], data: { content: '长正文。'.repeat(90) } },
    ]
    const before = JSON.stringify(records)
    expect(memoryGroup('constructor')).toBeUndefined()
    expect(memoryScope(records[0])).toBe('显式共享')
    expect(filterMemories(records, 'workflow', '')).toEqual([records[1]])
    expect(filterMemories(records, 'all', 'UNKNOWN')).toEqual([records[0]])
    const html = renderToStaticMarkup(createElement(MemoryReading, { records, allRecords: records, selectedId: 'unknown', timezone: 'Asia/Shanghai', onSelect: () => {} }))
    expect(html).toContain('其他类别')
    expect(html).toContain('原始未知字段')
    expect(html).toContain('更新时间未记录')
    expect(html).toContain('已读记录未返回正文')
    expect(html).not.toContain('不能代正文')
    expect(html).toContain('不保证正文完整')
    expect(JSON.stringify(records)).toBe(before)
  })
  it('真实 SQL 只读取本桶与共享，凭据排除不阻断分页，显式目标不越桶且无回写', async () => {
    const SQL = await initSqlJs(), db = new SQL.Database()
    try {
      db.run('CREATE TABLE memories (id TEXT PRIMARY KEY, role_id TEXT, category TEXT, content TEXT, updatedAt INTEGER)')
      for (const [id, role, kind, body, at] of [['credential', '', 'fact', 'password 是测试占位', 6], ['own', 'lin', 'feedback', '完整反馈。'.repeat(1800), 5], ['foreign', 'zhou', 'fact', '其他桶事实', 4], ['shared', '', 'preference', '共享表达', 3], ['empty', 'lin', 'constructor', '', 2]] as const) db.run('INSERT INTO memories VALUES (?, ?, ?, ?, ?)', [id, role, kind, body, at])
      const scope: DebugEvidenceScope = { roles: [{ id: 'lin', name: '林' }, { id: 'zhou', name: '周' }], activeRoleId: 'lin', universeId: 'default', ready: true }
      const before = db.export(), collected: DebugEvidenceRecord[] = []
      let cursor: string | undefined
      for (let page = 0; page < 8; page++) {
        const result = queryCompanionEvidence({ view: 'memories', roleId: 'lin', limit: 1, cursor }, db, scope)
        if (page === 0) { expect(result.records).toEqual([]); expect(result.hasMore).toBe(true); expect(result.issues).toContain('含凭据的记忆未展示') }
        collected.push(...result.records); cursor = result.nextCursor
        if (!result.hasMore) break
      }
      expect(collected.map(record => record.id)).toEqual(['own', 'shared', 'empty'])
      expect(collected[0].truncated).toBe(true)
      expect(collected[2].body).toBe('')
      expect(queryCompanionEvidence({ view: 'memories', roleId: 'lin', recordId: 'foreign' }, db, scope).records).toEqual([])
      expect(queryCompanionEvidence({ view: 'memories', roleId: 'lin', recordId: 'missing' }, db, scope).records).toEqual([])
      expect(queryCompanionEvidence({ view: 'memories', roleId: 'zhou', recordId: 'shared' }, db, scope).records[0].id).toBe('shared')
      expect(db.export()).toEqual(before)
    } finally { db.close() }
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import { queryCompanionEvidence } from '../../electron/main/debug/companion-evidence'
import type { DebugEvidenceRecord, DebugEvidenceScope } from '../../src/shared/debug-evidence'
import { ProfileReading, profileSourceScope } from '../../src/components/debug/ProfileReading'

describe('正式画像来源与阅读边界', () => {
  it('真实 SQL 保留跨桶全局来源、限定反馈且分页排除凭据，不回写或补缺失 ID', async () => {
    const SQL = await initSqlJs(), db = new SQL.Database()
    try {
      db.run('CREATE TABLE memories (id TEXT PRIMARY KEY, role_id TEXT, category TEXT, content TEXT, updatedAt INTEGER)')
      for (const [id, role, kind, body, at] of [['secret', '', 'fact', 'password 是测试占位', 8], ['shared', '', 'identity', '共享身份', 7], ['own', 'lin', 'feedback', '完整反馈。'.repeat(1800), 6], ['foreign-feedback', 'zhou', 'feedback', '不可显示的反馈', 5], ['foreign-voice', 'zhou', 'voice', '全局表达来源', 4], ['other', 'zhou', 'event', '其他类别来源', 3], ['empty', '', 'future', '', 2]] as const) db.run('INSERT INTO memories VALUES (?, ?, ?, ?, ?)', [id, role, kind, body, at])
      const scope: DebugEvidenceScope = { roles: [{ id: 'lin', name: '林' }, { id: 'zhou', name: '周' }], activeRoleId: 'lin', universeId: 'default', ready: true }
      const before = db.export(), records: DebugEvidenceRecord[] = []
      let cursor: string | undefined
      for (let page = 0; page < 10; page++) {
        const result = queryCompanionEvidence({ view: 'profile', roleId: 'lin', limit: 1, cursor }, db, scope)
        if (page === 0) { expect(result.records).toEqual([]); expect(result.issues).toContain('含凭据的记忆未展示'); expect(result.hasMore).toBe(true) }
        records.push(...result.records)
        cursor = result.nextCursor
        if (!result.hasMore) break
      }
      expect(records.map(record => record.id)).toEqual(['shared', 'own', 'foreign-voice', 'other', 'empty'])
      expect(records.find(record => record.id === 'own')?.truncated).toBe(true)
      expect(records.find(record => record.id === 'empty')?.body).toBe('')
      expect(queryCompanionEvidence({ view: 'profile', roleId: 'lin', recordId: 'foreign-feedback' }, db, scope).records).toEqual([])
      expect(queryCompanionEvidence({ view: 'profile', roleId: 'lin', recordId: 'missing' }, db, scope).records).toEqual([])
      expect(queryCompanionEvidence({ view: 'memories', roleId: 'lin', recordId: 'foreign-voice' }, db, scope).records).toEqual([])
      expect(profileSourceScope(records[2])).toContain('保存桶 zhou')
      const html = renderToStaticMarkup(createElement(ProfileReading, { records, selectedId: 'other', timezone: 'Asia/Shanghai', onSelect: () => {}, renderActions: () => null }))
      expect(html).toContain('其他类别来源')
      expect(html).toContain('原类别</dt><dd>event')
      expect(html).not.toContain('不可显示的反馈')
      expect(html).not.toContain('password')
      expect(db.export()).toEqual(before)
    } finally { db.close() }
  })
})

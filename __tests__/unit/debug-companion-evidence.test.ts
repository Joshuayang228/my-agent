import { beforeAll, afterEach, describe, expect, it } from 'vitest'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { queryCompanionEvidence } from '../../electron/main/debug/companion-evidence'
import type { DebugEvidenceScope } from '../../src/shared/types'
import { parseWorldJson } from '../../electron/main/companion/life/world-codec'
import { projectScheduleSlots } from '../../src/components/debug/schedule-projection'

let SQL: SqlJsStatic
let db: Database
const scope: DebugEvidenceScope = { roles: [{ id: 'lin', name: '林' }, { id: 'zhou', name: '周' }], activeRoleId: 'lin', universeId: 'default', ready: true }
beforeAll(async () => { SQL = await initSqlJs() })
afterEach(() => { db?.close() })
function database() { db = new SQL.Database(); return db }
function events() {
  database().run('CREATE TABLE companion_events (id TEXT PRIMARY KEY, role_id TEXT, scheduled_at INTEGER, status TEXT, type TEXT, payload_json TEXT)')
  for (const [id, role] of [['c', 'lin'], ['b', 'lin'], ['a', 'lin'], ['z', 'zhou']]) db.run('INSERT INTO companion_events VALUES (?, ?, ?, ?, ?, ?)', [id, role, Date.parse('2026-10-13T12:00:00Z'), 'published', 'reading', '{"activity":"阅读"}'])
}

describe('Debug 专用只读证据', () => {
  it('人物档案的指定缺失 ID 不返回另一份当前人物定义', () => {
    database()
    expect(queryCompanionEvidence({ view: 'character', roleId: 'lin', recordId: 'missing' }, db, scope).records).toEqual([])
    expect(queryCompanionEvidence({ view: 'character', roleId: 'lin', recordId: 'lin' }, db, scope).records[0]?.id).toBe('lin')
  })
  it('真实日剧本查询可投影为独立计划时段，读取与排序不回写数据库', () => {
    database().run('CREATE TABLE companion_day_scripts (id TEXT, role_id TEXT, date TEXT, payload_json TEXT, created_at INTEGER)')
    db.run('INSERT INTO companion_day_scripts VALUES (?, ?, ?, ?, ?)', ['day', 'lin', '2026-10-25', JSON.stringify({ slots: [{ hour: 14, minute: 30, activity: '阅读', location: '书房' }, { hour: 9, minute: 15, activity: '整理' }] }), 1])
    const before = db.export()
    const result = queryCompanionEvidence({ view: 'schedule', roleId: 'lin', date: '2026-10-25' }, db, scope)
    const projected = projectScheduleSlots(result.records)
    expect(projected.issues).toEqual([])
    expect(projected.slots.map(slot => [slot.time, slot.activity, slot.index])).toEqual([['09:15', '整理', 1], ['14:30', '阅读', 0]])
    expect(projected.slots[0].record.source).toBe('companion_day_scripts')
    expect(projected.slots[0].record.links).toEqual([])
    expect(db.export()).toEqual(before)
  })
  it('成长表已存在但未覆盖时仍显示真实 Pack 默认，不把空表当空人格', () => {
    database().run('CREATE TABLE companion_mutable (role_id TEXT, body TEXT, version INTEGER, updated_at INTEGER)')
    const before = db.export()
    const result = queryCompanionEvidence({ view: 'growth', roleId: 'lin' }, db, scope)
    expect(result.records[0]).toMatchObject({ id: 'lin:pack-default', source: 'Role Pack mutable.default', time: null })
    expect(result.records[0].body.length).toBeGreaterThan(0)
    expect(db.export()).toEqual(before)
  })
  it('当前世界使用生产 codec，保留存储差异并且不回写修复', () => {
    database().run('CREATE TABLE companion_role_state (role_id TEXT, world_json TEXT, updated_at INTEGER)')
    db.run("INSERT INTO companion_role_state VALUES ('lin', '{}', 1)")
    const before = db.export()
    const result = queryCompanionEvidence({ view: 'now', roleId: 'lin' }, db, scope)
    expect(result.records[0].data.world).toEqual(parseWorldJson('{}', 'lin'))
    expect(result.records[0].data.storedWorld).toEqual({})
    expect(db.export()).toEqual(before)
  })
  it('指定当前快照只匹配同人物实际记录，缺失引用不返回替代快照', () => {
    database().run('CREATE TABLE companion_role_state (role_id TEXT, world_json TEXT, updated_at INTEGER)')
    db.run("INSERT INTO companion_role_state VALUES ('lin', '{}', 1)")
    for (const view of ['now', 'location'] as const) {
      expect(queryCompanionEvidence({ view, roleId: 'lin', recordId: 'missing' }, db, scope).records).toEqual([])
      expect(queryCompanionEvidence({ view, roleId: 'lin', recordId: 'lin' }, db, scope).records[0]?.id).toBe('lin')
    }
  })
  it('显式目标在所属角色内查询，不被第一页范围隐藏或跨人物取出', () => {
    events()
    expect(queryCompanionEvidence({ view: 'recent', roleId: 'lin', recordId: 'a', limit: 1 }, db, scope).records.map(record => record.id)).toEqual(['a'])
    expect(queryCompanionEvidence({ view: 'recent', roleId: 'lin', recordId: 'z' }, db, scope).records).toEqual([])
    expect(() => queryCompanionEvidence({ view: 'recent', roleId: 'lin', recordId: 'a', cursor: 'bad' }, db, scope)).toThrow()
  })
  it('资产关联只解析同人物真实目标，不留下跨人物死链接', () => {
    database().run('CREATE TABLE companion_event_links (id TEXT, role_id TEXT, event_id TEXT, target_type TEXT, target_id TEXT, relation TEXT, created_at INTEGER)')
    db.run('CREATE TABLE companion_assets (id TEXT, role_id TEXT, kind TEXT, name TEXT, payload_json TEXT, acquired_at INTEGER)')
    db.run("INSERT INTO companion_assets VALUES ('own-trip','lin','footprint','旅行','{}',1), ('other-trip','zhou','footprint','别人的旅行','{}',1)")
    db.run("INSERT INTO companion_event_links VALUES ('own','lin','event','asset','own-trip','visited',1), ('foreign','lin','event','asset','other-trip','visited',1)")
    const result = queryCompanionEvidence({ view: 'links', roleId: 'lin' }, db, scope)
    expect(result.records.find(record => record.id === 'own')?.links).toContainEqual({ view: 'footprints', id: 'own-trip', label: '查看明确关联的资产' })
    expect(result.records.find(record => record.id === 'foreign')?.links.some(link => link.id === 'other-trip')).toBe(false)
  })
  it('日程按显式记录查询，不借另一人物或要求样张当天', () => {
    database().run('CREATE TABLE companion_day_scripts (id TEXT, role_id TEXT, date TEXT, payload_json TEXT, created_at INTEGER)')
    db.run("INSERT INTO companion_day_scripts VALUES ('yesterday','lin','2026-10-12','{\"slots\":[]}',1)")
    expect(queryCompanionEvidence({ view: 'schedule', roleId: 'lin', recordId: 'yesterday' }, db, scope).records[0]?.data.date).toBe('2026-10-12')
    expect(queryCompanionEvidence({ view: 'schedule', roleId: 'zhou', recordId: 'yesterday' }, db, scope).records).toEqual([])
  })
  it('缺表不创建、不初始化，数据库不可用单独报告', () => {
    database()
    const before = db.export()
    expect(queryCompanionEvidence({ view: 'recent', roleId: 'lin' }, db, scope)).toMatchObject({ state: 'ready', records: [], hasMore: false, total: null })
    expect(db.export()).toEqual(before)
    expect(queryCompanionEvidence({ view: 'recent', roleId: 'lin' }, null, scope).state).toBe('unavailable')
  })
  it('角色隔离、同时间稳定分页和游标范围绑定，读取不改变库', () => {
    events()
    const before = db.export()
    const first = queryCompanionEvidence({ view: 'recent', roleId: 'lin', limit: 2 }, db, scope)
    expect(first.records.map(record => record.id)).toEqual(['c', 'b'])
    expect(first.hasMore).toBe(true)
    const second = queryCompanionEvidence({ view: 'recent', roleId: 'lin', limit: 2, cursor: first.nextCursor }, db, scope)
    expect(second.records.map(record => record.id)).toEqual(['a'])
    expect(second.hasMore).toBe(false)
    expect(() => queryCompanionEvidence({ view: 'recent', roleId: 'zhou', cursor: first.nextCursor }, db, scope)).toThrow()
    expect(() => queryCompanionEvidence({ view: 'activity', roleId: 'lin', cursor: first.nextCursor }, db, scope)).toThrow()
    expect(db.export()).toEqual(before)
  })
  it('非法日期、角色、超限、未知参数与恶意游标在查询前拒绝', () => {
    database()
    for (const extra of [{ limit: 101 }, { limit: 0 }, { date: '2026-02-30' }, { roleId: '../lin' }, { sql: 'DROP TABLE memories' }, { view: 'arbitrary' }, { cursor: 'bad' }]) {
      expect(() => queryCompanionEvidence({ view: 'recent', roleId: 'lin', ...extra }, db, scope)).toThrow()
    }
  })
  it('损坏记录局部失败，正常内容保留，凭据在主进程隐藏', () => {
    events()
    db.run('UPDATE companion_events SET payload_json = ? WHERE id = ?', ['{broken', 'b'])
    db.run('UPDATE companion_events SET payload_json = ? WHERE id = ?', ['{"activity":"password=my-private-value","secret":"my-private-value"}', 'c'])
    const result = queryCompanionEvidence({ view: 'recent', roleId: 'lin' }, db, scope)
    expect(result.records.map(record => record.id)).toEqual(['c', 'a'])
    expect(result.issues).toHaveLength(1)
    expect(JSON.stringify(result)).not.toContain('my-private-value')
  })
  it('日期按人物时区筛选，不用 UTC 日界；来源不宣称执行完成', () => {
    events()
    db.run('UPDATE companion_events SET scheduled_at = ? WHERE id = ?', [Date.parse('2026-10-12T18:00:00Z'), 'a'])
    const result = queryCompanionEvidence({ view: 'recent', roleId: 'lin', date: '2026-10-13' }, db, scope)
    expect(result.records.map(record => record.id)).toContain('a')
    expect(result.timezone).toBe('Asia/Shanghai')
    expect(result.boundary).toContain('未保存的执行结果不补造')
  })
  it('记忆仅返回本人物与显式共享；画像准确保留全局及反馈角色范围', () => {
    database().run('CREATE TABLE memories (id TEXT PRIMARY KEY, role_id TEXT, category TEXT, content TEXT, updatedAt INTEGER)')
    for (const [id, role, category] of [['shared', '', 'preference'], ['own', 'lin', 'feedback'], ['other', 'zhou', 'feedback'], ['global-fact', 'zhou', 'fact']]) db.run('INSERT INTO memories VALUES (?, ?, ?, ?, ?)', [id, role, category, '普通记忆', 1])
    expect(queryCompanionEvidence({ view: 'memories', roleId: 'lin' }, db, scope).records.map(record => record.id).sort()).toEqual(['own', 'shared'])
    expect(queryCompanionEvidence({ view: 'profile', roleId: 'lin' }, db, scope).records.map(record => record.id).sort()).toEqual(['global-fact', 'own', 'shared'])
  })
})

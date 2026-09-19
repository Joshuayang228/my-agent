import initSqlJs from 'sql.js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: { getPath: () => '' }, ipcMain: { handle: vi.fn() }, dialog: {}, safeStorage: { isEncryptionAvailable: () => false } }))
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: async () => db, persist: vi.fn() }))
import * as store from '../../electron/main/companion/life/store'
import { addMomentCommentForRole, toggleMomentLikeForRole } from '../../electron/main/companion/life/moments'
import { collectMomentBackup, isValidMomentBackup } from '../../electron/main/storage/moment-backup'
import { importBackupPayload, isValidExportData } from '../../electron/main/ipc/data-export'

const SQL = await initSqlJs()
let db: InstanceType<typeof SQL.Database>
beforeEach(async () => {
  db = new SQL.Database()
  const event = await store.insertEvent({ roleId: 'lin', scheduledAt: 1, status: 'published', type: 'home', payload: { location: '家中', grantAsset: { kind: 'home', name: '不应重新发放' } }, dayScriptId: 'not-restored' })
  const moment = (await store.insertMoment({ roleId: 'lin', eventId: event.id, publishedAt: 1, text: '原动态', meta: { location: '家中', interactions: [{ kind: 'comment', castName: '朋友', text: '原卡司评论' }] } }))!
  await toggleMomentLikeForRole('lin', moment.id)
  await addMomentCommentForRole('lin', moment.id, '用户自己的评论')
})
afterEach(() => db.close())
function clear() {
  db.run('DELETE FROM companion_moment_user_interactions; DELETE FROM companion_moments; DELETE FROM companion_events;')
}
const payload = () => ({ sessions: [], livingAssets: [], livingAssetSeeds: [], momentHistory: collectMomentBackup(db) })
const count = (table: string) => db.exec(`SELECT COUNT(*) FROM ${table}`)[0].values[0][0]

it('真实赞评连同来源事件和动态往返，重开仍可见，重复导入不覆盖当前内容或重放奖励', async () => {
  const data = payload()
  expect(isValidExportData({ version: 1, exportedAt: 1, memories: [], settings: {}, ...data })).toBe(true)
  clear()
  const persist = vi.fn()
  importBackupPayload(db, { ...data, persist })
  expect(persist).toHaveBeenCalledTimes(1)
  const snapshot = db.export(); db.close(); db = new SQL.Database(snapshot)
  expect(collectMomentBackup(db)).toEqual(data.momentHistory)
  expect(db.exec('SELECT status, day_script_id FROM companion_events')[0].values).toEqual([['published', null]])
  expect(count('companion_assets')).toBe(0)
  db.run("UPDATE companion_moments SET text = '当前动态'")
  db.run("UPDATE companion_moment_user_interactions SET text = '当前评论' WHERE kind = 'comment'")
  importBackupPayload(db, data)
  expect((await store.listMoments('lin'))[0].text).toBe('当前动态')
  expect((await store.listMomentUserInteractions('lin')).find(row => row.kind === 'comment')?.text).toBe('当前评论')
  expect(count('companion_moment_user_interactions')).toBe(2)
})

it.each(['role', 'missing-event', 'missing-moment', 'actor', 'comment', 'like', 'planned', 'duplicate', 'size'])('非法历史包 %s 在写入前拒绝', kind => {
  const data = payload()
  const history = data.momentHistory
  if (kind === 'role') history.interactions[0].roleId = 'another'
  if (kind === 'missing-event') history.events = []
  if (kind === 'missing-moment') history.moments = []
  if (kind === 'actor') history.interactions[0].actorId = 'cast'
  if (kind === 'comment') history.interactions.find(row => row.kind === 'comment')!.text = '评'.repeat(281)
  if (kind === 'like') history.interactions.push({ ...history.interactions.find(row => row.kind === 'like')!, id: 'extra-like' })
  if (kind === 'planned') (history.events[0] as any).status = 'planned'
  if (kind === 'duplicate') history.moments.push(history.moments[0])
  if (kind === 'size') history.events[0].payload = { text: 'x'.repeat(20_001) }
  expect(isValidMomentBackup(history)).toBe(false)
  expect(isValidExportData({ version: 1, exportedAt: 1, memories: [], settings: {}, ...data })).toBe(false)
})

it.each(['sql', 'persist'])('历史导入 %s 失败不留下事件、动态、用户互动', kind => {
  const data = payload()
  clear()
  if (kind === 'sql') db.run("CREATE TRIGGER fail_comment BEFORE INSERT ON companion_moment_user_interactions WHEN NEW.kind = 'comment' BEGIN SELECT RAISE(ABORT, 'fixture'); END")
  expect(() => importBackupPayload(db, { ...data, persist: () => { if (kind === 'persist') throw new Error('fixture') } })).toThrow()
  expect(count('companion_events')).toBe(0)
  expect(count('companion_moments')).toBe(0)
  expect(count('companion_moment_user_interactions')).toBe(0)
})

it('现有动态归属不同拒绝整份导入，现有记录不改写', () => {
  const data = payload()
  db.run("UPDATE companion_moments SET role_id = 'other'")
  expect(() => importBackupPayload(db, data)).toThrow('动态归属冲突')
  expect(db.exec('SELECT role_id FROM companion_moments')[0].values[0][0]).toBe('other')
})

it('数据库中互动丢失来源时导出失败而非静默丢弃', () => {
  db.run('DELETE FROM companion_events')
  expect(() => collectMomentBackup(db)).toThrow('关联不完整')
})

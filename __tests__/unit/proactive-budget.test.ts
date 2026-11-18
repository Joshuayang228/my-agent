import { beforeEach, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'
import { runLocalTransaction } from '../helpers/local-transaction'

const SQL = await initSqlJs()
let db: InstanceType<typeof SQL.Database>
const settings = vi.hoisted(() => ({ max: '2', muted: 'false' }))
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: async () => db, persist: vi.fn(), withDatabaseTransaction: async (work: (db: typeof db) => Promise<unknown>) => runLocalTransaction(db, work) }))
vi.mock('../../electron/main/storage/settings-store', () => ({ getSetting: async (key: string) => key === 'companionMomentTipsMaxPerDay' ? settings.max : key === 'companionMomentTipsMuted' ? settings.muted : key.includes('Quiet') ? '0' : '' }))
const { enqueueAutomaticProactiveNotification, runAutomaticProactiveAction } = await import('../../electron/main/companion/application/proactive-budget')
const now = new Date(2026, 10, 17, 12).getTime()

beforeEach(() => { db = new SQL.Database(); settings.max = '2'; settings.muted = 'false' })

it('不同动作跨 tick、跨数据库重开共用角色预算，其他人物独立', async () => {
  const action = vi.fn(async () => ({ triggered: true }))
  expect(await runAutomaticProactiveAction('a', now, action)).toEqual({ triggered: true })
  expect(await runAutomaticProactiveAction('a', now + 1000, action)).toBeNull()
  expect(await runAutomaticProactiveAction('a', now + 3600_000, action)).toEqual({ triggered: true })
  const snapshot = db.export(); db.close(); db = new SQL.Database(snapshot)
  expect(await runAutomaticProactiveAction('a', now + 7200_000, action)).toBeNull()
  expect(await runAutomaticProactiveAction('b', now + 7200_000, action)).toEqual({ triggered: true })
  expect(action).toHaveBeenCalledTimes(3)
})

it('空结果和失败释放预留，静音时不调用动作', async () => {
  expect(await runAutomaticProactiveAction('a', now, async () => null)).toBeNull()
  await expect(runAutomaticProactiveAction('a', now, async () => { throw new Error('failed') })).rejects.toThrow('failed')
  const action = vi.fn(async () => ({ greeted: true }))
  expect(await runAutomaticProactiveAction('a', now, action)).toEqual({ greeted: true })
  settings.muted = 'true'
  expect(await runAutomaticProactiveAction('b', now, action)).toBeNull()
  expect(action).toHaveBeenCalledTimes(1)
})

it('通知入队失败回滚名额，与现有提醒动作共用间隔和静音', async () => {
  await expect(enqueueAutomaticProactiveNotification('a', now, async () => {
    throw new Error('outbox write failed')
  })).rejects.toThrow('outbox write failed')
  const enqueue = vi.fn(async () => {})
  await enqueueAutomaticProactiveNotification('a', now, enqueue)
  const action = vi.fn(async () => ({ greeted: true }))
  expect(await runAutomaticProactiveAction('a', now + 1000, action)).toBeNull()
  expect(action).not.toHaveBeenCalled()
  settings.muted = 'true'
  await enqueueAutomaticProactiveNotification('b', now, enqueue)
  expect(enqueue).toHaveBeenCalledTimes(1)
})

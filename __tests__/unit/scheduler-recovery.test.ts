import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ directory: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => fixture.directory },
  Notification: { isSupported: () => false },
  BrowserWindow: { getAllWindows: () => [] },
}))

import { closeDatabase, getDatabase, withDatabaseTransaction } from '../../electron/main/storage/database'
import { setSetting } from '../../electron/main/storage/settings-store'
import { createTask, getTask, initScheduler, setHeadlessRunner, shutdownScheduler } from '../../electron/main/scheduler'

beforeEach(async () => {
  fixture.directory = fs.mkdtempSync(path.resolve(os.tmpdir(), 'my-agent-scheduler-'))
  vi.useFakeTimers()
  await setSetting('activeRoleId', 'luffy')
  await setSetting('universeId', 'default')
  await initScheduler()
})

afterEach(() => {
  shutdownScheduler()
  vi.useRealTimers()
  closeDatabase()
  fs.rmSync(fixture.directory, { recursive: true, force: true })
})

it('先持久领取指定时刻，成功后才更新最近执行时间并继续调度', async () => {
  let release!: (value: string) => void
  const callback = vi.fn(() => new Promise<string>(resolve => { release = resolve }))
  setHeadlessRunner(callback)
  const task = await createTask({ name: '定时提醒', prompt: '整理今日待办', intervalMs: 1000 })
  await setSetting('activeRoleId', 'nami')
  await vi.advanceTimersByTimeAsync(1000)
  expect(callback).toHaveBeenCalledOnce()
  expect(callback).toHaveBeenCalledWith(task.prompt, task.name, expect.objectContaining({
    taskId: task.id, scheduledAt: task.nextRunAt, roleId: 'luffy', universeId: 'default',
  }))
  const db = await getDatabase()
  expect(db.exec('SELECT status FROM scheduled_task_runs')[0].values).toEqual([['running']])
  expect((await getTask(task.id))?.lastRunAt).toBeUndefined()
  release('done')
  await vi.advanceTimersByTimeAsync(0)
  expect(db.exec('SELECT status FROM scheduled_task_runs')[0].values).toEqual([['completed']])
  expect((await getTask(task.id))?.nextRunAt).toBeGreaterThan(task.nextRunAt!)
})

it('重启会执行已到期且尚未领取的时刻，并保留创建时绑定的人物', async () => {
  const callback = vi.fn(async () => 'done')
  setHeadlessRunner(callback)
  const task = await createTask({ name: '待执行', prompt: '报告进度', intervalMs: 1000 })
  shutdownScheduler()
  await setSetting('activeRoleId', 'nami')
  closeDatabase()
  await vi.advanceTimersByTimeAsync(3000)
  await initScheduler()
  await vi.advanceTimersByTimeAsync(0)
  expect(callback).toHaveBeenCalledOnce()
  expect(callback.mock.calls[0]?.length).toBe(3)
  const db = await getDatabase()
  expect(db.exec('SELECT scheduled_at, role_id, status FROM scheduled_task_runs')[0].values).toEqual([[task.nextRunAt, 'luffy', 'completed']])
})

it('重启标记中断的已领取时刻，并跳到下一次执行', async () => {
  const callback = vi.fn(async () => 'done')
  setHeadlessRunner(callback)
  const task = await createTask({ name: '避免重复', prompt: '整理日程', intervalMs: 1000 })
  shutdownScheduler()
  await withDatabaseTransaction(async db => {
    db.run("INSERT INTO scheduled_task_runs (task_id, scheduled_at, run_id, role_id, universe_id, status, started_at) VALUES (?, ?, ?, ?, ?, 'running', ?)",
      [task.id, task.nextRunAt!, 'previous-run', 'luffy', 'default', Date.now()])
  })
  closeDatabase()
  await vi.advanceTimersByTimeAsync(3000)
  await initScheduler()
  await vi.advanceTimersByTimeAsync(0)
  expect(callback).not.toHaveBeenCalled()
  expect((await getDatabase()).exec('SELECT status FROM scheduled_task_runs')[0].values).toEqual([['interrupted']])
  await vi.advanceTimersByTimeAsync(1000)
  expect(callback).toHaveBeenCalledOnce()
})

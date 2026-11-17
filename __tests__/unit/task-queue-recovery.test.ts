import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const fixture = vi.hoisted(() => ({ directory: '', windows: true, send: vi.fn() }))
vi.mock('electron', () => ({
  app: { getPath: () => fixture.directory },
  BrowserWindow: { getAllWindows: () => fixture.windows ? [{ webContents: { send: fixture.send } }] : [] },
}))
import * as database from '../../electron/main/storage/database'
import { TaskQueueManager } from '../../electron/main/services/task-queue'

let queue: TaskQueueManager
beforeEach(async () => {
  fixture.directory = fs.mkdtempSync(path.join(os.tmpdir(), 'task-queue-'))
  fixture.windows = true
  fixture.send.mockReset()
  await database.getDatabase()
  queue = new TaskQueueManager()
})
afterEach(async () => {
  vi.useRealTimers()
  await queue.shutdown()
  vi.restoreAllMocks()
  database._resetDatabaseForTests()
  fs.rmSync(fixture.directory, { recursive: true, force: true })
})

const complete = (id: string) => vi.waitFor(() => expect(queue.getTask(id)?.status).toBe('completed'))

describe('Task Queue 重启恢复', () => {
  it('恢复 running 并使用实际处理器完成任务', async () => {
    const db = await database.getDatabase()
    db.run(`INSERT INTO background_tasks (id, session_id, type, status, notified, created_at, updated_at)
      VALUES ('recover', 'session', 'smart-title', 'running', 0, 100, 100)`)
    database.persist()
    const fn = vi.fn(async () => {})
    queue.registerRecoveryHandler('smart-title', async () => fn)
    const recovered = await queue.recoverPendingTasks()
    expect(recovered[0]?.status).toBe('pending')
    await complete('recover')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('无窗口完成的任务在重启后恢复待通知，确认成功后再次重启不重投', async () => {
    fixture.windows = false
    const id = await queue.enqueue('session', 'profile-extract', async () => {})
    await complete(id)
    await queue.shutdown()
    database.closeDatabase()
    queue = new TaskQueueManager()
    fixture.windows = true
    const recovered = await queue.recoverPendingTasks()
    expect(recovered).toHaveLength(1)
    expect(recovered[0]).toMatchObject({ id, status: 'completed', notified: false })
    expect(queue.syncForRenderer().pendingNotify.map(task => task.id)).toEqual([id])
    expect(await queue.acknowledgeNotification(id)).toBe(true)
    await queue.shutdown()
    database.closeDatabase()
    queue = new TaskQueueManager()
    expect(await queue.recoverPendingTasks()).toEqual([])
  })

  it('确认写盘失败保留未确认状态，重启后继续投递', async () => {
    const id = await queue.enqueue('session', 'smart-title', async () => {})
    await complete(id)
    vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('ack-disk-full') })
    await expect(queue.acknowledgeNotification(id)).rejects.toThrow('数据库保存失败')
    expect(queue.getTask(id)?.notified).toBe(false)
    await queue.shutdown()
    database._resetDatabaseForTests()
    queue = new TaskQueueManager()
    expect((await queue.recoverPendingTasks())[0]).toMatchObject({ id, status: 'completed', notified: false })
  })

  it('重启保留重试次数和等待时间，缺少处理器明确失败', async () => {
    const db = await database.getDatabase()
    const retryAt = Date.now() + 60000
    db.run(`INSERT INTO background_tasks (id, session_id, type, status, notified, created_at, updated_at, retry_count, next_retry_at)
      VALUES ('retry', 'session', 'smart-title', 'pending', 0, 100, 100, 2, ?)`, [retryAt])
    db.run(`INSERT INTO background_tasks (id, session_id, type, status, notified, created_at, updated_at)
      VALUES ('unsupported', 'session', 'profile-extract', 'pending', 0, 100, 100)`)
    database.persist()
    const fn = vi.fn(async () => {})
    queue.registerRecoveryHandler('smart-title', async () => fn)
    await queue.recoverPendingTasks()
    expect(queue.getTask('retry')).toMatchObject({ status: 'pending', retryCount: 2, nextRetryAt: retryAt })
    expect(fn).not.toHaveBeenCalled()
    expect(queue.getTask('unsupported')).toMatchObject({ status: 'failed', notified: false })
  })
})

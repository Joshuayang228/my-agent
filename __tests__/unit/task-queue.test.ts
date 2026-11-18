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

describe('Task Queue 持久生命周期', () => {
  it('入队返回已保存的唯一 ID', async () => {
    const ids = await Promise.all([queue.enqueue('s1', 'smart-title', async () => {}), queue.enqueue('s1', 'smart-title', async () => {})])
    expect(new Set(ids).size).toBe(2)
    expect(ids[0]).toMatch(/^task-[0-9a-f-]{36}$/)
    const db = await database.getDatabase()
    expect(db.exec('SELECT COUNT(*) FROM background_tasks')[0].values[0][0]).toBe(2)
  })

  it('任务完成后保存 completed，只有 Renderer 确认才设置 notified', async () => {
    const fn = vi.fn(async () => {})
    const id = await queue.enqueue('s2', 'smart-title', fn)
    await complete(id)
    expect(fn).toHaveBeenCalledOnce()
    expect(queue.getTask(id)?.notified).toBe(false)
    expect(queue.syncForRenderer().pendingNotify.map(task => task.id)).toContain(id)
    expect(await queue.acknowledgeNotification(id)).toBe(true)
    expect(queue.getTask(id)?.notified).toBe(true)
    expect(await queue.acknowledgeNotification(id)).toBe(true)
    expect(queue.getActiveTasks()).toEqual([])
  })

  it('同一持久来源重放时保留原任务终态和接收确认', async () => {
    const fn = vi.fn(async () => {})
    const task = { id: 'task-persona-reflection-source', sessionId: 'original-session',
      name: 'persona-reflection' as const, fn, checkpoint: { updatedAt: 123 } }
    expect(await queue.enqueueOnce(task)).toBe(true)
    await complete(task.id)
    expect(await queue.acknowledgeNotification(task.id)).toBe(true)
    await queue.shutdown()
    database._resetDatabaseForTests()
    queue = new TaskQueueManager()
    expect(await queue.enqueueOnce(task)).toBe(false)
    expect(fn).toHaveBeenCalledOnce()
    const db = await database.getDatabase()
    expect(db.exec('SELECT status, notified FROM background_tasks WHERE id = ?', [task.id])[0]?.values).toEqual([['completed', 1]])
  })

  it('业务失败指数退避，重试耗尽落为 failed 且不暴露内部错误', async () => {
    vi.useFakeTimers()
    const fn = vi.fn(async () => { throw new Error('private failure') })
    const id = await queue.enqueue('s3', 'smart-title', fn)
    await vi.advanceTimersByTimeAsync(10)
    expect(queue.getTask(id)).toMatchObject({ status: 'pending', retryCount: 1 })
    await vi.advanceTimersByTimeAsync(8000)
    expect(fn).toHaveBeenCalledTimes(4)
    expect(queue.getTask(id)).toMatchObject({ status: 'failed', retryCount: 4, notified: false })
    expect(queue.getTask(id)?.error).not.toContain('private')
  })

  it('取消 pending 任务先保存，再从待运行队列移除', async () => {
    let release!: () => void
    const blocker = await queue.enqueue('s4', 'smart-title', () => new Promise<void>(resolve => { release = resolve }))
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    try {
      const fn = vi.fn(async () => {})
      const target = await queue.enqueue('s4', 'vector-index-user', fn)
      expect(await queue.cancel(target)).toBe(true)
      expect(queue.getTask(target)?.status).toBe('cancelled')
      expect(await queue.cancel(target)).toBe(false)
      expect(fn).not.toHaveBeenCalled()
    } finally { release() }
    await complete(blocker)
  })

  it('一个任务的业务失败不阻塞后续任务', async () => {
    await queue.enqueue('s5', 'smart-title', async () => { throw new Error('fail') })
    const next = await queue.enqueue('s5', 'smart-title', async () => {})
    await complete(next)
    expect(queue.getActiveTasks('another-session')).toEqual([])
  })

  it('入队保存失败拒绝接受任务，执行函数不会运行', async () => {
    const fn = vi.fn(async () => {})
    vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('disk-full') })
    await expect(queue.enqueue('s6', 'smart-title', fn)).rejects.toThrow('数据库保存失败')
    expect(fn).not.toHaveBeenCalled()
    expect(queue.getActiveTasks()).toEqual([])
  })

  it('running 保存失败不能启动执行函数', async () => {
    const db = await database.getDatabase()
    db.run("CREATE TRIGGER fail_running BEFORE INSERT ON background_tasks WHEN NEW.status = 'running' BEGIN SELECT RAISE(ABORT, 'running-failure'); END")
    const fn = vi.fn(async () => {})
    const id = await queue.enqueue('s7', 'smart-title', fn)
    await queue.shutdown()
    expect(fn).not.toHaveBeenCalled()
    expect(queue.getTask(id)?.status).toBe('pending')
  })

  it('completed 保存失败不能重试已成功的执行函数', async () => {
    const db = await database.getDatabase()
    db.run("CREATE TRIGGER fail_completed BEFORE INSERT ON background_tasks WHEN NEW.status = 'completed' BEGIN SELECT RAISE(ABORT, 'completed-failure'); END")
    const fn = vi.fn(async () => {})
    const id = await queue.enqueue('s8', 'smart-title', fn)
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce())
    await queue.shutdown()
    expect(fn).toHaveBeenCalledOnce()
    expect(queue.getTask(id)?.status).toBe('running')
    expect(fixture.send.mock.calls.some(call => call[1].type === 'task:completed')).toBe(false)
  })

  it('发送通知异常不影响已经保存的完成事实，也不触发业务重试', async () => {
    fixture.send.mockImplementation(() => { throw new Error('window-closed') })
    const fn = vi.fn(async () => {})
    const id = await queue.enqueue('s9', 'smart-title', fn)
    await complete(id)
    expect(fn).toHaveBeenCalledOnce()
    expect(queue.getTask(id)?.notified).toBe(false)
  })
})

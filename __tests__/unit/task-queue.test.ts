/**
 * TaskQueueManager 单元测试（M09 任务生命周期）
 *
 * 测试重点：
 * - 任务状态机（pending → running → completed/failed）
 * - 幂等通知（notified 标志防止重复发送）
 * - 取消 pending 任务
 * - 错误被捕获不崩溃队列
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock BrowserWindow，避免在非 Electron 环境下崩溃
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [{
      webContents: {
        send: vi.fn(),
      },
    }],
  },
}))

vi.mock('../../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

// M16：关键转移会 await 落盘；测试里不碰真实 sql.js / electron app
vi.mock('../../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => ({
    run: vi.fn(),
    prepare: vi.fn(),
  })),
  persist: vi.fn(),
}))

// 每次测试使用独立实例（不用单例）
async function makeQueue() {
  vi.resetModules()
  const mod = await import('../../../electron/main/services/task-queue')
  return mod.TaskQueueManager
    ? new (mod as unknown as { TaskQueueManager: new () => InstanceType<typeof import('../../../electron/main/services/task-queue').taskQueue.constructor> }).TaskQueueManager()
    : mod.taskQueue
}

// 因为 task-queue.ts 导出的是单例，测试直接用模块级 mock
// 下面用一个工厂函数来获取每次测试重置的 mock
import { taskQueue } from '../../../electron/main/services/task-queue'

describe('TaskQueueManager', () => {
  beforeEach(() => {
    // 清空内部状态（通过 cancel 无法完全重置，使用 vi.resetModules 会有 ESM 问题）
    // 这里直接用动态导入后的单例做测试，接受状态可能跨测试残留
    vi.clearAllMocks()
  })

  it('enqueue 返回唯一 taskId', () => {
    const id1 = taskQueue.enqueue('s1', 'smart-title', async () => {})
    const id2 = taskQueue.enqueue('s1', 'smart-title', async () => {})
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^task-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('任务完成后状态变为 completed', async () => {
    let done = false
    const id = taskQueue.enqueue('s2', 'smart-title', async () => {
      done = true
    })

    // 等待异步执行
    await new Promise<void>(r => setTimeout(r, 50))

    expect(done).toBe(true)
    const task = taskQueue.getTask(id)
    expect(task?.status).toBe('completed')
  })

  it('任务首次抛错后进入 pending 重试，retryCount 递增', async () => {
    const id = taskQueue.enqueue('s3', 'smart-title', async () => {
      throw new Error('测试失败')
    })

    await new Promise<void>(r => setTimeout(r, 50))

    const task = taskQueue.getTask(id)
    // 第一次失败后：retryCount=1，status=pending（等待 1s 后重试）
    expect(task?.retryCount).toBe(1)
    expect(task?.status).toBe('pending')
  })

  it('重试耗尽后状态变为 failed，包含 error 信息', async () => {
    vi.useFakeTimers()
    try {
      let callCount = 0
      const id = taskQueue.enqueue('s3b', 'smart-title', async () => {
        callCount++
        throw new Error('测试失败')
      })

      // 首次执行（微任务，0ms）+ 三次重试（1s/2s/4s），超过 7s 即全部耗尽
      await vi.advanceTimersByTimeAsync(8000)

      const task = taskQueue.getTask(id)
      expect(task?.status).toBe('failed')
      expect(task?.error).toBe('后台任务执行失败，请检查配置或稍后重试。')
      expect(task?.error).not.toContain('测试失败')
      expect(callCount).toBe(4) // 首次 + 3 次重试
    } finally {
      vi.useRealTimers()
    }
  })

  it('任务完成后 notified 置为 true', async () => {
    const id = taskQueue.enqueue('s4', 'profile-extract', async () => {})
    await new Promise<void>(r => setTimeout(r, 50))

    const task = taskQueue.getTask(id)
    expect(task?.notified).toBe(true)
  })

  it('取消 pending 任务成功，不执行', async () => {
    // 先让队列忙，阻塞后续（await 落盘后 fn 才启动，需等到 running 再 release）
    let release: (() => void) | undefined
    const blocker = taskQueue.enqueue('s5', 'smart-title', () =>
      new Promise<void>(r => { release = r }),
    )

    const cancelTargetId = taskQueue.enqueue('s5', 'vector-index-user', async () => {
      throw new Error('不应该执行')
    })

    const cancelled = taskQueue.cancel(cancelTargetId)
    expect(cancelled).toBe(true)

    // 等到 blocker 真正进入 running（release 已被赋值）
    for (let i = 0; i < 20 && !release; i++) {
      await new Promise<void>(r => setTimeout(r, 10))
    }
    expect(release).toBeTypeOf('function')
    release!()
    await new Promise<void>(r => setTimeout(r, 50))

    const task = taskQueue.getTask(cancelTargetId)
    expect(task?.status).toBe('cancelled')
    expect(task?.error).toBeUndefined()

    const blockerTask = taskQueue.getTask(blocker)
    expect(blockerTask?.status).toBe('completed')
  })

  it('任务失败不影响后续任务执行', async () => {
    let secondRan = false
    taskQueue.enqueue('s6', 'smart-title', async () => {
      throw new Error('第一个失败')
    })
    taskQueue.enqueue('s6', 'smart-title', async () => {
      secondRan = true
    })

    await new Promise<void>(r => setTimeout(r, 100))
    expect(secondRan).toBe(true)
  })

  it('getActiveTasks 只返回 pending/running 状态', async () => {
    const id = taskQueue.enqueue('s7', 'smart-title', async () => {})

    // 完成前应该有 pending/running 状态
    await new Promise<void>(r => setTimeout(r, 50))

    // 完成后不再出现在 active 列表
    const active = taskQueue.getActiveTasks('s7')
    // completed tasks should not appear
    const found = active.find(t => t.id === id)
    expect(found).toBeUndefined()
  })
})

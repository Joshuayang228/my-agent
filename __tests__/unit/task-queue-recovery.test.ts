import { runLocalTransaction } from '../helpers/local-transaction'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send: vi.fn() } }],
  },
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('../../electron/main/utils/tracer', () => ({
  startLinkedAsyncSpan: () => ({ end: vi.fn() }),
}))

describe('Task Queue recovery handlers', () => {
  it('rebuilds a persisted running task and completes it', async () => {
    let stepped = false
    const row = {
      id: 'task-recover',
      session_id: 'session-1',
      type: 'smart-title',
      status: 'running',
      notified: 0,
      created_at: 100,
      updated_at: 100,
      error: null,
      checkpoint: null,
    }
    const db = {
      run: vi.fn(),
      prepare: vi.fn(() => ({
        step: () => {
          if (stepped) return false
          stepped = true
          return true
        },
        getAsObject: () => row,
        free: vi.fn(),
      })),
    }
    vi.doMock('../../electron/main/storage/database', () => ({
      withDatabaseTransaction: async (work: (db: typeof db) => Promise<unknown>) => runLocalTransaction(db, work), getDatabase: vi.fn(async () => db),
      persist: vi.fn(),
    }))

    const { TaskQueueManager } = await import('../../electron/main/services/task-queue')
    const queue = new TaskQueueManager()
    let ran = false
    queue.registerRecoveryHandler('smart-title', async () => async () => {
      ran = true
    })

    const recovered = await queue.recoverPendingTasks()
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(recovered[0]?.status).toBe('pending')
    expect(ran).toBe(true)
    expect(queue.getTask('task-recover')?.status).toBe('completed')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, getActiveTasks, syncForRenderer, cancel } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  getActiveTasks: vi.fn(() => [{ id: 'task-1' }]),
  syncForRenderer: vi.fn(() => ({ active: [{ id: 'task-1' }], pendingNotify: [] })),
  cancel: vi.fn(() => true),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => { handlers.set(channel, handler) }),
  },
}))
vi.mock('../../electron/main/services/task-queue', () => ({
  taskQueue: { getActiveTasks, syncForRenderer, cancel },
}))
vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  hashForLog: (value: string) => `hash:${value.length}`,
}))

import { registerTasksIPC } from '../../electron/main/ipc/tasks'

describe('任务 IPC 输入边界', () => {
  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
    registerTasksIPC()
  })

  it('list / sync 接受空 sessionId，并拒绝超长或非字符串输入', () => {
    const list = handlers.get('task:list')!
    const sync = handlers.get('task:sync')!

    expect(list({}, undefined)).toEqual([{ id: 'task-1' }])
    expect(getActiveTasks).toHaveBeenCalledWith(undefined)
    expect(list({}, 'x'.repeat(201))).toEqual([])
    expect(list({}, 42)).toEqual([])
    expect(sync({}, 'x'.repeat(201))).toEqual({ active: [], pendingNotify: [] })
  })

  it('cancel 只接受有界 taskId', () => {
    const handler = handlers.get('task:cancel')!
    expect(handler({}, 'task-1')).toBe(true)
    expect(cancel).toHaveBeenCalledWith('task-1')
    expect(handler({}, '')).toBe(false)
    expect(handler({}, 'x'.repeat(201))).toBe(false)
    expect(handler({}, null)).toBe(false)
  })
})

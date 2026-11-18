import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { invalidateCompanionLifecycle } from '../../electron/main/utils/companion-lifecycle'
import { startLifeTicker, stopLifeTicker } from '../../electron/main/agent/companion-life-ticker'

const { workflow, send } = vi.hoisted(() => ({
  workflow: vi.fn<(now: number, context: { roleId: string; universeId: string; signal: AbortSignal }) => Promise<unknown>>(),
  send: vi.fn(),
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [{ isDestroyed: () => false, webContents: { send } }] },
}))
vi.mock('../../electron/main/agent-host/host', () => ({ runCompanionLifeTickWorkflow: workflow }))
vi.mock('../../electron/main/companion/application/companion-followups', () => ({ recoverCompanionFollowups: async () => {} }))
vi.mock('../../electron/main/companion/life/engine', () => ({
  resolveActiveLifeScope: async () => ({ roleId: 'luffy', universeId: 'one-piece' }),
}))
vi.mock('../../electron/main/companion/core/persistence/life-repository', () => ({ listEvents: async () => [] }))
vi.mock('../../electron/main/companion/core/commands/gateway', () => ({
  executeCompanionCommand: async ({ handler }: { handler: () => Promise<unknown> }) => handler(),
}))

beforeEach(() => {
  vi.useFakeTimers()
  workflow.mockReset()
  send.mockClear()
})
afterEach(() => {
  stopLifeTicker()
  vi.useRealTimers()
})

it('停止后迟到的 tick 无法发送通知或给新时钟增加计时器', async () => {
  const oldRun = Promise.withResolvers<unknown>()
  workflow.mockImplementationOnce(() => oldRun.promise)
  startLifeTicker(20)
  await vi.advanceTimersByTimeAsync(20)
  const context = workflow.mock.calls[0][1]
  expect(context).toMatchObject({ roleId: 'luffy', universeId: 'one-piece' })
  stopLifeTicker()
  startLifeTicker(20)
  expect(context.signal.aborted).toBe(true)
  oldRun.resolve({ roleId: 'luffy', paused: false })
  await vi.advanceTimersByTimeAsync(0)
  expect(send).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(1)
})

it('切走再切回仍使旧请求失效，随后使用新代的信号恢复正常时钟', async () => {
  const oldRun = Promise.withResolvers<unknown>()
  workflow.mockImplementationOnce(() => oldRun.promise)
  workflow.mockResolvedValue({ roleId: 'luffy', paused: true })
  startLifeTicker(20)
  await vi.advanceTimersByTimeAsync(20)
  invalidateCompanionLifecycle()
  invalidateCompanionLifecycle()
  expect(workflow.mock.calls[0][1].signal.aborted).toBe(true)
  oldRun.resolve({ roleId: 'luffy', paused: false })
  await vi.advanceTimersByTimeAsync(20)
  expect(workflow).toHaveBeenCalledTimes(2)
  expect(workflow.mock.calls[1][1].signal.aborted).toBe(false)
  expect(send).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(1)
})

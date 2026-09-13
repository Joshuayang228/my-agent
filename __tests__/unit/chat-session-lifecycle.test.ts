import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ chat: vi.fn(), abort: vi.fn(), remove: vi.fn() }))
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events')
  const ipc = Object.assign(new EventEmitter(), { handle: vi.fn() })
  return { ipcMain: ipc }
})
vi.mock('../../electron/main/agent/runtime', () => ({ runtime: { chat: mocks.chat, abort: mocks.abort } }))
vi.mock('../../electron/main/storage/session-store', () => ({ deleteSession: mocks.remove }))

import { ipcMain } from 'electron'
import { registerChatIPC } from '../../electron/main/ipc/chat'
import { registerSessionIPC } from '../../electron/main/ipc/session'
import { ToolRegistry } from '../../electron/main/tools/registry'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

function sender(id: number) {
  return Object.assign(new EventEmitter(), { id, send: vi.fn(), isDestroyed: vi.fn(() => false) })
}

const message = { id: 'user-1', role: 'user', content: 'hello', timestamp: 1 }
type Handler = (...args: any[]) => Promise<unknown>
let handlers: Map<string, Handler>

beforeEach(() => {
  vi.clearAllMocks()
  ipcMain.removeAllListeners()
  mocks.remove.mockResolvedValue(undefined)
  registerChatIPC(new ToolRegistry())
  registerSessionIPC()
  handlers = new Map(vi.mocked(ipcMain.handle).mock.calls as [string, Handler][])
})

describe('Chat / Session 真实 handler 生命周期', () => {
  it('done 事件之后仍等待 Runtime 收尾，取消/关闭期间拒绝重复发送，合并重复删除', async () => {
    const cleanup = deferred()
    const reachedDone = deferred()
    mocks.chat.mockImplementation(async function* () {
      yield { type: 'done', reason: 'completed' }
      reachedDone.resolve()
      await cleanup.promise
    })
    const owner = sender(1)
    const run = handlers.get('chat:send')!({ sender: owner }, 'side-1', message)
    await reachedDone.promise
    const remove = handlers.get('session:delete')!({ sender: owner }, 'side-1')
    const duplicate = handlers.get('session:delete')!({ sender: owner }, 'side-1')
    await Promise.resolve()
    expect(mocks.abort).toHaveBeenCalledWith('side-1')
    expect(mocks.remove).not.toHaveBeenCalled()
    await expect(handlers.get('chat:send')!({ sender: owner }, 'side-1', message)).rejects.toThrow('正在关闭')
    cleanup.resolve()
    await Promise.all([run, remove, duplicate])
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('side-1')
    expect(owner.listenerCount('destroyed')).toBe(0)
  })

  it('异窗不能停止/删除活跃会话，同窗重复发送不能覆盖运行所有权', async () => {
    const cleanup = deferred()
    mocks.chat.mockImplementation(async function* () { await cleanup.promise })
    const owner = sender(2)
    const outsider = sender(3)
    const run = handlers.get('chat:send')!({ sender: owner }, 'side-2', message)
    await handlers.get('chat:abort')!({ sender: outsider }, 'side-2')
    await handlers.get('chat:abort')!({ sender: owner })
    expect(mocks.abort).not.toHaveBeenCalled()
    await expect(handlers.get('session:delete')!({ sender: outsider }, 'side-2')).rejects.toThrow('另一个窗口')
    await expect(handlers.get('chat:send')!({ sender: owner }, 'side-2', message)).rejects.toThrow('正在处理中')
    await handlers.get('chat:abort')!({ sender: owner }, 'side-2')
    expect(mocks.abort).toHaveBeenCalledExactlyOnceWith('side-2')
    cleanup.resolve()
    await run
  })

  it('关闭立即拒绝待确认工具并清除监听，异窗确认不能消费正确窗口的请求', async () => {
    let approved: boolean | undefined
    mocks.chat.mockImplementation(async function* (_id, _message, _registry, confirm) {
      approved = await confirm('write_file', { path: 'a.txt' })
    })
    const owner = sender(4)
    const run = handlers.get('chat:send')!({ sender: owner }, 'side-confirm', message)
    const payload = owner.send.mock.calls.find(([channel]) => channel === 'tool:confirm-request')![1]
    const channel = `tool:confirm-response:${payload.requestId}`
    ipcMain.emit(channel, { sender: sender(5) }, true)
    await Promise.resolve()
    expect(approved).toBeUndefined()
    expect(ipcMain.listenerCount(channel)).toBe(1)
    await handlers.get('session:delete')!({ sender: owner }, 'side-confirm')
    await run
    expect(approved).toBe(false)
    expect(ipcMain.listenerCount(channel)).toBe(0)
  })

  it('删除失败保留记录并释放删除锁，允许重试', async () => {
    const owner = sender(6)
    mocks.remove.mockRejectedValueOnce(new Error('disk unavailable'))
    await expect(handlers.get('session:delete')!({ sender: owner }, 'side-error')).rejects.toThrow('会话删除失败，请稍后重试')
    await handlers.get('session:delete')!({ sender: owner }, 'side-error')
    expect(mocks.remove).toHaveBeenCalledTimes(2)
  })

  it('窗口销毁取消待确认工具，结束后不向销毁窗口发送事件', async () => {
    mocks.chat.mockImplementation(async function* (_id, _message, _registry, confirm) {
      expect(await confirm('write_file', {})).toBe(false)
      yield { type: 'done', reason: 'aborted' }
    })
    const owner = sender(7)
    const run = handlers.get('chat:send')!({ sender: owner }, 'side-destroyed', message)
    owner.isDestroyed.mockReturnValue(true)
    owner.emit('destroyed')
    await run
    expect(mocks.abort).toHaveBeenCalledWith('side-destroyed')
    expect(owner.send.mock.calls.every(([channel]) => channel !== 'chat:event')).toBe(true)
    expect(owner.listenerCount('destroyed')).toBe(0)
  })
})

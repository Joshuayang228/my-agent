import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), execFile: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn, execFile: mocks.execFile }))
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))
vi.mock('../../electron/main/sandbox/effective-sandbox', () => ({ loadEffectiveSandbox: async () => 'workspace-write' }))
vi.mock('../../electron/main/sandbox/permission-engine', () => ({ checkCommandPermission: () => ({ allowed: true }) }))
vi.mock('../../electron/main/agent/project-memory', () => ({ getWorkspaceRoot: () => process.cwd() }))
vi.mock('../../electron/main/utils/safe-process-env', () => ({ buildSafeChildProcessEnv: () => ({}) }))
vi.mock('../../electron/main/utils/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn() }), hashForLog: () => 'hash' }))

import { ipcMain } from 'electron'
import { registerTerminalIPC } from '../../electron/main/ipc/terminal'

function fakeChild() {
  return Object.assign(new EventEmitter(), {
    pid: 4242, exitCode: null as number | null, signalCode: null as string | null,
    stdout: Object.assign(new EventEmitter(), { setEncoding: vi.fn() }), stderr: Object.assign(new EventEmitter(), { setEncoding: vi.fn() }), stdin: { end: vi.fn() }, kill: vi.fn(),
  })
}
function fakeSender(id = 1) {
  return Object.assign(new EventEmitter(), { id, send: vi.fn(), isDestroyed: vi.fn(() => false) })
}

type Handler = (...args: any[]) => any
let handlers: Map<string, Handler>
let child: ReturnType<typeof fakeChild>
let sender: ReturnType<typeof fakeSender>

beforeEach(() => {
  vi.clearAllMocks()
  child = fakeChild()
  sender = fakeSender()
  mocks.spawn.mockReturnValue(child)
  mocks.execFile.mockImplementation((_file, _args, _options, callback) => callback(null))
  registerTerminalIPC()
  handlers = new Map(vi.mocked(ipcMain.handle).mock.calls as [string, Handler][])
})

afterEach(() => {
  child.emit('close', 0)
  vi.useRealTimers()
})

async function start() {
  const result = await handlers.get('terminal:run')!({ sender }, { command: 'echo fixture' })
  expect(result.ok).toBe(true)
  await handlers.get('terminal:ready')!({ sender }, result.runId)
  return result.runId as string
}

describe('终端真实 handler 生命周期', () => {
  it.skipIf(process.platform !== 'win32')('终止合并重复请求，直到 close 才成功', async () => {
    const id = await start()
    let settled = false
    const stopping = handlers.get('terminal:kill')!({ sender }, id).then((result: unknown) => { settled = true; return result })
    const duplicate = handlers.get('terminal:kill')!({ sender }, id)
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(mocks.execFile).toHaveBeenCalledTimes(1)
    child.emit('close', -1)
    expect(await stopping).toEqual({ ok: true })
    expect(await duplicate).toEqual({ ok: true })
    expect(await handlers.get('terminal:ready')!({ sender }, id)).toEqual({ ok: false })
    expect(sender.listenerCount('destroyed')).toBe(0)
  })

  it('早到的大块 stdout/stderr 和退出按序缓存，握手后无截断地冲刷', async () => {
    const { runId } = await handlers.get('terminal:run')!({ sender }, { command: 'echo fixture' })
    child.stdout.emit('data', 'x'.repeat(12_000))
    child.stderr.emit('data', 'error output\n')
    child.emit('close', 0)
    expect(sender.send).not.toHaveBeenCalled()
    await handlers.get('terminal:ready')!({ sender }, runId)
    expect(sender.send.mock.calls.filter(([channel]) => channel === 'terminal:stdout').map(([, payload]) => payload.chunk).join('')).toBe('x'.repeat(12_000))
    expect(sender.send.mock.calls.map(([channel]) => channel)).toEqual(['terminal:stdout', 'terminal:stdout', 'terminal:stderr', 'terminal:exit'])
    expect(mocks.execFile).not.toHaveBeenCalled()
  })

  it('异窗不能握手或终止他人的 run', async () => {
    const id = await start()
    const outsider = fakeSender(2)
    expect(await handlers.get('terminal:ready')!({ sender: outsider }, id)).toEqual({ ok: false })
    expect(await handlers.get('terminal:kill')!({ sender: outsider }, id)).toEqual({ ok: false })
    expect(mocks.execFile).not.toHaveBeenCalled()
  })

  it('已退出但始终没有握手的缓存会到期释放', async () => {
    vi.useFakeTimers()
    const { runId } = await handlers.get('terminal:run')!({ sender }, { command: 'echo fixture' })
    child.stdout.emit('data', 'early')
    child.emit('close', 0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await handlers.get('terminal:ready')!({ sender }, runId)).toEqual({ ok: false })
    expect(sender.listenerCount('destroyed')).toBe(0)
    expect(sender.send).not.toHaveBeenCalled()
  })

  it.skipIf(process.platform !== 'win32')('窗口销毁终止其进程，不向已销毁窗口发事件', async () => {
    const id = await start()
    sender.isDestroyed.mockReturnValue(true)
    sender.emit('destroyed')
    expect(mocks.execFile).toHaveBeenCalledTimes(1)
    child.emit('close', -1)
    await Promise.resolve()
    expect(sender.send).not.toHaveBeenCalled()
    expect(await handlers.get('terminal:ready')!({ sender }, id)).toEqual({ ok: false })
  })

  it.skipIf(process.platform !== 'win32')('taskkill 失败不假报成功，运行记录允许再次终止', async () => {
    const id = await start()
    mocks.execFile.mockImplementation((_file, _args, _options, callback) => callback(new Error('fixture denied')))
    expect(await handlers.get('terminal:kill')!({ sender }, id)).toMatchObject({ ok: false })
    expect(await handlers.get('terminal:ready')!({ sender }, id)).toMatchObject({ ok: true })
  })

  it('spawn error 之后 close 仅推送一次退出', async () => {
    await start()
    child.emit('error', new Error('fixture spawn failure'))
    expect(sender.send.mock.calls.filter(([channel]) => channel === 'terminal:exit')).toHaveLength(0)
    child.emit('close', -1)
    expect(sender.send.mock.calls.filter(([channel]) => channel === 'terminal:exit')).toHaveLength(1)
  })

  it.skipIf(process.platform !== 'win32')('终止超时返回失败，后续可以重新终止', async () => {
    vi.useFakeTimers()
    const id = await start()
    const stopping = handlers.get('terminal:kill')!({ sender }, id)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await stopping).toEqual({ ok: false })
    expect(sender.send.mock.calls.filter(([channel]) => channel === 'terminal:exit')).toHaveLength(0)
    const retry = handlers.get('terminal:kill')!({ sender }, id)
    child.emit('close', -1)
    expect(await retry).toEqual({ ok: true })
    expect(mocks.execFile).toHaveBeenCalledTimes(2)
  })

  it.skipIf(process.platform !== 'win32')('未握手的活进程到期终止，不再接受迟到握手', async () => {
    vi.useFakeTimers()
    const { runId } = await handlers.get('terminal:run')!({ sender }, { command: 'echo fixture' })
    child.stdout.emit('data', 'early')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(mocks.execFile).toHaveBeenCalledTimes(1)
    expect(await handlers.get('terminal:ready')!({ sender }, runId)).toEqual({ ok: false })
    child.emit('close', -1)
    expect(sender.send).not.toHaveBeenCalled()
    expect(sender.listenerCount('destroyed')).toBe(0)
  })

  it.skipIf(process.platform !== 'win32')('命令超时触发终止，但 close 前不发布退出', async () => {
    vi.useFakeTimers()
    await start()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mocks.execFile).toHaveBeenCalledTimes(1)
    expect(sender.send).toHaveBeenCalledWith('terminal:stderr', expect.objectContaining({ chunk: expect.stringContaining('正在终止') }))
    expect(sender.send.mock.calls.filter(([channel]) => channel === 'terminal:exit')).toHaveLength(0)
    child.emit('close', -1)
    expect(sender.send.mock.calls.filter(([channel]) => channel === 'terminal:exit')).toHaveLength(1)
  })
})

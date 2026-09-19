import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpServerConfig } from '../../src/shared/types'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => Promise<any>>(), windows: [] as any[],
  confirm: vi.fn(), getSetting: vi.fn(), setSetting: vi.fn(), authorize: vi.fn(), clear: vi.fn(), cancelOwner: vi.fn(),
  connect: vi.fn(), disconnect: vi.fn(), sync: vi.fn(), open: vi.fn(),
}))
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: (...args: any[]) => Promise<any>) => mocks.handlers.set(name, handler) },
  BrowserWindow: { getAllWindows: () => mocks.windows }, dialog: { showMessageBox: mocks.confirm }, shell: { openExternal: mocks.open } }))
vi.mock('../../electron/main/storage/settings-store', () => ({ getSetting: mocks.getSetting, setSetting: mocks.setSetting }))
vi.mock('../../electron/main/mcp/oauth', () => ({
  mcpOAuthSessions: { authorize: mocks.authorize, clear: mocks.clear, cancelOwner: mocks.cancelOwner },
  McpOAuthRegistrationError: class extends Error {},
}))
vi.mock('../../electron/main/mcp/client', () => ({ mcpManager: { setStatusListener: vi.fn(), setElicitationHandler: vi.fn(), connect: mocks.connect, disconnect: mocks.disconnect } }))
vi.mock('../../electron/main/mcp/bridge', () => ({ syncMcpToolsToRegistry: mocks.sync, removeMcpToolsFromRegistry: vi.fn() }))
import { registerMcpIPC } from '../../electron/main/ipc/mcp'
import { ToolRegistry } from '../../electron/main/tools/registry'

const config: McpServerConfig = { id: 'saved', name: 'saved', command: '', args: [], transport: 'streamable-http', url: 'https://example.com/mcp', oauth: {}, enabled: true, allowedTools: [] }
function owner(id: number) {
  const sender = Object.assign(new EventEmitter(), { id, mainFrame: {}, isDestroyed: () => false })
  mocks.windows.push({ webContents: sender, isDestroyed: () => false, show: vi.fn(), focus: vi.fn(), isMinimized: () => false })
  return { sender, senderFrame: sender.mainFrame }
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.handlers.clear(); mocks.windows.length = 0
  mocks.getSetting.mockResolvedValue(JSON.stringify([config]))
  mocks.confirm.mockResolvedValue({ response: 1 }); mocks.connect.mockResolvedValue(undefined); mocks.disconnect.mockResolvedValue(undefined); mocks.sync.mockReturnValue(0)
  registerMcpIPC(new ToolRegistry())
})
const invoke = (name: string, ...args: any[]) => mocks.handlers.get(name)!(...args)

describe('OAuth IPC 窗口归属与迟到结果', () => {
  it('子框架不能发起授权，其他窗口不能取消当前窗口的登录', async () => {
    const first = owner(1); const other = owner(2)
    expect((await invoke('mcp:connect', { ...first, senderFrame: {} }, config)).success).toBe(false)
    expect(mocks.confirm).not.toHaveBeenCalled()
    let release!: () => void
    mocks.authorize.mockImplementation(() => new Promise<void>(resolve => { release = resolve }))
    const running = invoke('mcp:connect', first, config)
    await vi.waitFor(() => expect(mocks.authorize).toHaveBeenCalledTimes(1))
    expect(await invoke('mcp:cancel-login', other, config.id)).toEqual({ success: false })
    expect(await invoke('mcp:cancel-login', first, config.id)).toEqual({ success: true })
    release()
    expect((await running).success).toBe(false)
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(mocks.setSetting).not.toHaveBeenCalled()
  })

  it.each(['destroyed', 'render-process-gone', 'navigation', 'config-change'] as const)('%s 后的授权结果不能接管连接', async mode => {
    const event = owner(1)
    let release!: () => void
    mocks.authorize.mockImplementation(() => new Promise<void>(resolve => { release = resolve }))
    const running = invoke('mcp:connect', event, config)
    await vi.waitFor(() => expect(mocks.authorize).toHaveBeenCalledTimes(1))
    if (mode === 'navigation') event.sender.emit('did-start-navigation', {}, 'https://invalid', false, true)
    else if (mode === 'config-change') mocks.getSetting.mockResolvedValue('[]')
    else event.sender.emit(mode)
    release()
    expect((await running).success).toBe(false)
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it('确认框等待期间也可取消，迟到确认不打开浏览器', async () => {
    const event = owner(1)
    let release!: (value: unknown) => void
    mocks.confirm.mockImplementation(() => new Promise(resolve => { release = resolve }))
    const running = invoke('mcp:connect', event, config)
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1))
    await invoke('mcp:cancel-login', event, config.id)
    expect((await running).success).toBe(false)
    release({ response: 1 })
    await Promise.resolve()
    expect(mocks.authorize).not.toHaveBeenCalled()
  })
})

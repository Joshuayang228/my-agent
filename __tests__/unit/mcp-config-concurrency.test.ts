import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpServerConfig } from '../../src/shared/types'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => Promise<any>>(), getSetting: vi.fn(), setSetting: vi.fn(),
  setAllowedTools: vi.fn(), sync: vi.fn(), confirm: vi.fn(),
}))
vi.mock('electron', () => ({
  ipcMain: { handle: (name: string, handler: (...args: any[]) => Promise<any>) => mocks.handlers.set(name, handler) },
  BrowserWindow: { getFocusedWindow: () => ({}), getAllWindows: () => [{}] }, dialog: { showMessageBox: mocks.confirm },
}))
vi.mock('../../electron/main/storage/settings-store', () => ({
  isAppSettingKey: (key: string) => key === 'mcpServers', MAX_SETTING_VALUE_LENGTH: 1_000_000,
  getSetting: mocks.getSetting, setSetting: mocks.setSetting,
}))
vi.mock('../../electron/main/mcp/client', () => ({ mcpManager: {
  setElicitationHandler: vi.fn(), isConnected: () => true, setAllowedTools: mocks.setAllowedTools,
  getAllTools: () => ['one', 'two'].map((name) => ({ serverId: 'existing', name })),
} }))
vi.mock('../../electron/main/mcp/bridge', () => ({ syncMcpToolsToRegistry: mocks.sync }))
vi.mock('../../electron/main/sandbox/permission-engine', () => ({ loadRules: vi.fn() }))
vi.mock('../../electron/main/llm/index', () => ({ chatComplete: vi.fn(), LLMError: class extends Error {} }))
vi.mock('../../electron/main/llm/aux-config', () => ({ loadMainLLMConfig: vi.fn() }))

import { registerSettingsIPC } from '../../electron/main/ipc/settings'
import { registerMcpIPC } from '../../electron/main/ipc/mcp'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { withMcpConfigLock } from '../../electron/main/mcp/config-lock'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}
let stored: string
const config: McpServerConfig = { id: 'existing', name: '已有服务', command: 'node', args: [], enabled: true }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.handlers.clear()
  stored = JSON.stringify([config])
  mocks.getSetting.mockImplementation(async () => stored)
  mocks.setSetting.mockImplementation(async (_key, value) => { stored = value })
  mocks.confirm.mockResolvedValue({ response: 1 })
  registerSettingsIPC()
  registerMcpIPC(new ToolRegistry())
})

describe('MCP 主进程配置写入串行', () => {
  it('整表写盘尚未完成时工具许可不得读取旧快照', async () => {
    const started = deferred(); const release = deferred()
    mocks.setSetting.mockImplementationOnce(async (_key, value) => { started.resolve(); await release.promise; stored = value })
    const whole = mocks.handlers.get('settings:set')!({}, 'mcpServers', JSON.stringify([{ ...config, name: '新名称' }]))
    await started.promise
    const permission = mocks.handlers.get('mcp:set-tool-allowed')!({}, 'existing', 'one', false)
    await Promise.resolve(); await Promise.resolve()
    expect(mocks.getSetting).toHaveBeenCalledTimes(1)
    release.resolve()
    await whole
    expect(await permission).toEqual({ success: true, allowed: false })
    expect(JSON.parse(stored)).toEqual([{ ...config, name: '新名称', allowedTools: ['two'] }])
  })

  it('两个并发工具禁用均保留，保存失败不更新活动许可且释放锁', async () => {
    await Promise.all(['one', 'two'].map((tool) => mocks.handlers.get('mcp:set-tool-allowed')!({}, 'existing', tool, false)))
    expect(JSON.parse(stored)[0].allowedTools).toEqual([])
    mocks.setAllowedTools.mockClear()
    mocks.setSetting.mockRejectedValueOnce(new Error('fixture storage failure'))
    expect(await mocks.handlers.get('mcp:set-tool-allowed')!({}, 'existing', 'one', true)).toEqual({ success: false, error: '工具许可未保存，请重试。' })
    expect(mocks.setAllowedTools).not.toHaveBeenCalled()
    expect(JSON.parse(stored)[0].allowedTools).toEqual([])
    expect((await mocks.handlers.get('mcp:set-tool-allowed')!({}, 'existing', 'one', true)).success).toBe(true)
    expect(JSON.parse(stored)[0].allowedTools).toEqual(['one'])
  })

  it('整表入口与向导使用同一个锁，拒绝确认或写盘失败后后续任务仍能进入', async () => {
    const started = deferred(); const release = deferred()
    const held = withMcpConfigLock(async () => { started.resolve(); await release.promise })
    await started.promise
    const next = mocks.handlers.get('settings:set')!({}, 'mcpServers', stored)
    await Promise.resolve(); await Promise.resolve()
    expect(mocks.getSetting).not.toHaveBeenCalled()
    release.resolve(); await held; await next
    mocks.confirm.mockResolvedValueOnce({ response: 0 })
    await expect(mocks.handlers.get('settings:set')!({}, 'mcpServers', JSON.stringify([{ ...config, command: 'other' }]))).rejects.toThrow('用户取消')
    mocks.setSetting.mockRejectedValueOnce(new Error('fixture write error'))
    await expect(mocks.handlers.get('settings:set')!({}, 'mcpServers', stored)).rejects.toThrow()
    await expect(mocks.handlers.get('settings:set')!({}, 'mcpServers', stored)).resolves.toBeUndefined()
  })
})

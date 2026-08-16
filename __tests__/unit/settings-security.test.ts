import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAllSettings, getSetting, setSetting, handlers, showMessageBox, loadMainLLMConfig, chatComplete, browserState } = vi.hoisted(() => ({
  getAllSettings: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  handlers: new Map<string, (...args: any[]) => any>(),
  showMessageBox: vi.fn(),
  loadMainLLMConfig: vi.fn(),
  chatComplete: vi.fn(),
  browserState: { window: {} as object | null },
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => handlers.set(channel, handler)),
  },
  BrowserWindow: { getFocusedWindow: () => browserState.window, getAllWindows: () => browserState.window ? [browserState.window] : [] },
  dialog: { showMessageBox },
  safeStorage: { isEncryptionAvailable: () => false },
}))
vi.mock('../../electron/main/storage/settings-store', () => ({
  isAppSettingKey: (key: string) => ['llmApiKey', 'mcpServers', 'executionMode', 'llmModel', 'permissionRules'].includes(key),
  MAX_SETTING_VALUE_LENGTH: 1_000_000,
  getAllSettings,
  getSetting,
  setSetting,
}))
vi.mock('../../electron/main/sandbox/permission-engine', () => ({ loadRules: vi.fn() }))
vi.mock('../../electron/main/llm/index', () => ({ chatComplete, LLMError: class LLMError extends Error {} }))
vi.mock('../../electron/main/llm/aux-config', () => ({ loadMainLLMConfig }))
vi.mock('../../electron/main/prompts/keys', () => ({ PROMPT_KEYS: { connectionTest: 'test' } }))

import { getRendererSettings, registerSettingsIPC } from '../../electron/main/ipc/settings'

describe('设置 IPC 安全视图', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.clear()
    getAllSettings.mockResolvedValue({
      llmApiKey: 'sk-real-secret',
      llmBaseUrl: 'https://api.example.com/v1',
      llmModel: 'model',
      mcpServers: JSON.stringify([{ id: 'mcp-1', name: 'server', command: 'node', args: [], enabled: true, env: { TOKEN: 'real-secret' } }]),
      executionMode: 'auto',
    })
    getSetting.mockResolvedValue('[]')
    loadMainLLMConfig.mockResolvedValue({ apiKey: 'sk-stored-secret', baseUrl: 'https://api.example.com/v1', model: 'model' })
    chatComplete.mockResolvedValue({ content: '连接成功' })
    showMessageBox.mockResolvedValue({ response: 1 })
    browserState.window = {}
  })

  it('settings:get 不返回 API Key 原文，MCP env 只返回哨兵', async () => {
    const view = await getRendererSettings()
    expect(view.llmApiKey).toBe('')
    expect(view.llmApiKeyConfigured).toBe('true')
    expect(view.mcpServers).toContain('__MY_AGENT_REDACTED__')
    expect(view.mcpServers).not.toContain('sk-real-secret')
    expect(view.mcpServers).not.toContain('real-secret')
  })

  it('连接测试可以由主进程使用已保存 Key，而不要求 Renderer 重新读取 Key', async () => {
    registerSettingsIPC()
    const handler = handlers.get('settings:test-connection')
    expect(handler).toBeDefined()
    const result = await handler?.({}, { useStoredApiKey: true, baseUrl: 'https://api.example.com/v1', model: 'model' })
    expect(result).toMatchObject({ ok: true })
    expect(loadMainLLMConfig).toHaveBeenCalledWith({ baseUrl: 'https://api.example.com/v1', model: 'model' })
    expect(chatComplete).toHaveBeenCalled()
  })

  it('Renderer 不能仅靠传入 full-access 绕过主进程确认', async () => {
    registerSettingsIPC()
    getSetting.mockResolvedValueOnce('auto')
    showMessageBox.mockResolvedValueOnce({ response: 0 })
    const handler = handlers.get('settings:set')
    await expect(handler?.({}, 'executionMode', 'full-access')).rejects.toThrow('用户取消高风险设置变更')
    expect(setSetting).not.toHaveBeenCalledWith('executionMode', 'full-access')
  })

  it('Renderer 回传脱敏 MCP 配置时不覆盖主进程旧 secret', async () => {
    registerSettingsIPC()
    getSetting.mockResolvedValueOnce(JSON.stringify([{ id: 'mcp-1', name: 'server', command: 'node', args: [], enabled: true, env: { TOKEN: 'real-secret' } }]))
    const handler = handlers.get('settings:set')
    const redacted = JSON.stringify([{ id: 'mcp-1', name: 'server', command: 'node', args: [], enabled: true, env: { TOKEN: '__MY_AGENT_REDACTED__' } }])
    await handler?.({}, 'mcpServers', redacted)
    expect(setSetting).toHaveBeenCalledWith('mcpServers', expect.stringContaining('real-secret'))
    expect(setSetting).toHaveBeenCalledWith('mcpServers', expect.not.stringContaining('__MY_AGENT_REDACTED__'))
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAllSettings, getSetting, setSetting, saveModelConfiguration, handlers, showMessageBox, loadMainLLMConfig, chatComplete, fetchRemoteModels, browserState } = vi.hoisted(() => ({
  getAllSettings: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  saveModelConfiguration: vi.fn(),
  handlers: new Map<string, (...args: any[]) => any>(),
  showMessageBox: vi.fn(),
  loadMainLLMConfig: vi.fn(),
  chatComplete: vi.fn(),
  fetchRemoteModels: vi.fn(),
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
  isAppSettingKey: (key: string) => ['llmTemperature', 'sessionTokenBudget', 'dailyTokenBudget', 'llmApiKey', 'mcpServers', 'modelConnections', 'executionMode', 'llmModel', 'permissionRules', 'companionResponseNote'].includes(key),
  MAX_SETTING_VALUE_LENGTH: 1_000_000,
  getAllSettings,
  getSetting,
  setSetting,
  saveModelConfiguration,
}))
vi.mock('../../electron/main/sandbox/permission-engine', () => ({ loadRules: vi.fn() }))
vi.mock('../../electron/main/llm/index', () => ({ chatComplete, LLMError: class LLMError extends Error {} }))
vi.mock('../../electron/main/llm/aux-config', () => ({ loadMainLLMConfig }))
vi.mock('../../electron/main/llm/model-discovery', () => ({ fetchRemoteModels }))
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
      modelConnections: JSON.stringify([{
        id: 'conn-1',
        name: 'primary',
        baseUrl: 'https://api.example.com/v1',
        model: 'model',
        apiKey: 'sk-connection-secret',
        enabled: true,
      }]),
      mcpServers: JSON.stringify([{ id: 'mcp-1', name: 'server', command: 'node', args: [], enabled: true, env: { TOKEN: 'real-secret' } }]),
      executionMode: 'auto',
    })
    getSetting.mockResolvedValue('[]')
    loadMainLLMConfig.mockImplementation(async (overrides?: { apiKey?: string; baseUrl?: string; model?: string }) => ({
      apiKey: 'sk-stored-secret',
      baseUrl: 'https://api.example.com/v1',
      model: 'model',
      ...overrides,
    }))
    chatComplete.mockResolvedValue({ content: '连接成功' })
    fetchRemoteModels.mockResolvedValue({ ok: true, models: ['gpt-4o'] })
    showMessageBox.mockResolvedValue({ response: 1 })
    browserState.window = {}
  })

  it('settings:get 不返回 API Key 原文，MCP env 只返回哨兵', async () => {
    const view = await getRendererSettings()
    expect(view.llmApiKey).toBe('')
    expect(view.llmApiKeyConfigured).toBe('true')
    expect(view.llmConnectionReady).toBe('true')
    expect(view.mcpServers).toContain('__MY_AGENT_REDACTED__')
    expect(view.mcpServers).not.toContain('sk-real-secret')
    expect(view.mcpServers).not.toContain('real-secret')
    expect(view.modelConnections).not.toContain('sk-connection-secret')
    expect(JSON.parse(view.modelConnections)[0]).toMatchObject({ apiKey: '', hasApiKey: true })
  })

  it.each([
    ['llmTemperature', ''], ['llmTemperature', 'NaN'], ['llmTemperature', 'Infinity'], ['llmTemperature', '-1'], ['llmTemperature', '2.01'],
    ['sessionTokenBudget', '-1'], ['dailyTokenBudget', '1.5'], ['dailyTokenBudget', '9007199254740992'], ['sessionTokenBudget', '12abc'],
  ])('拒绝非法模型参数 %s=%s 且不写盘', async (key, value) => {
    registerSettingsIPC()
    await expect(handlers.get('settings:set')!({}, key, value)).rejects.toThrow()
    expect(setSetting).not.toHaveBeenCalled()
  })

  it.each([['llmTemperature', '0'], ['llmTemperature', '0.75'], ['llmTemperature', '2'], ['sessionTokenBudget', '0'], ['dailyTokenBudget', '10000']])('合法模型参数 %s=%s 进入真实保存接口', async (key, value) => {
    registerSettingsIPC()
    await handlers.get('settings:set')!({}, key, value)
    expect(setSetting).toHaveBeenCalledWith(key, value)
  })

  it('就绪状态按真实主连接计算，不按全局 Key 状态推断', async () => {
    loadMainLLMConfig.mockResolvedValueOnce({ apiKey: '', baseUrl: 'http://127.0.0.1:11434/v1', model: 'local' })
    expect(await getRendererSettings()).toMatchObject({ llmConnectionReady: 'true', llmEffectiveModel: 'local', llmEffectiveBaseUrl: 'http://127.0.0.1:11434/v1' })
    loadMainLLMConfig.mockResolvedValueOnce({ apiKey: '', baseUrl: 'https://remote.test/v1', model: 'remote' })
    const remote = await getRendererSettings()
    expect(remote.llmApiKeyConfigured).toBe('true')
    expect(remote.llmConnectionReady).toBe('false')
  })

  it.each(['settings:test-connection', 'settings:fetch-models'])('%s 放行回环无 Key，且不借用全局凭据', async (channel) => {
    registerSettingsIPC()
    expect(await handlers.get(channel)!({}, { baseUrl: 'http://127.0.0.1:11434/v1', model: 'local', provider: 'openai' })).toMatchObject({ ok: true })
    const config = channel === 'settings:test-connection' ? chatComplete.mock.calls[0][0].config : fetchRemoteModels.mock.calls[0][0]
    expect(config.apiKey).toBe('')
    expect(config.provider).toBe('openai')
  })

  it('整组保存先验证两个字段，再合并密钥并只调用一次专用存储', async () => {
    registerSettingsIPC()
    const connection = { id: 'c', name: 'test', baseUrl: 'https://example.test/v1', model: 'm', enabled: true }
    getSetting.mockResolvedValue(JSON.stringify([{ ...connection, apiKey: 'fixture-stored' }]))
    const routes = JSON.stringify([{ purpose: 'primary', connectionId: 'c', model: 'm', enabled: true }])
    const call = handlers.get('settings:save-model-configuration')!
    for (const invalid of [null, { connections: '[]', routes: '{}' }, { connections: '[null]', routes }, { connections: JSON.stringify([connection, connection]), routes }]) {
      await expect(call({}, invalid)).rejects.toThrow()
    }
    expect(saveModelConfiguration).not.toHaveBeenCalled()
    await call({}, { connections: JSON.stringify([connection]), routes })
    expect(saveModelConfiguration).toHaveBeenCalledTimes(1)
    const saved = saveModelConfiguration.mock.calls[0][0]
    expect(JSON.parse(saved.connections)[0]).toMatchObject({ id: 'c', apiKey: 'fixture-stored' })
    expect(saved.routes).toBe(routes)
    expect(setSetting).not.toHaveBeenCalled()
  })

  it('整组写入串行，失败释放队列且下一次读取最新密钥', async () => {
    registerSettingsIPC()
    let release!: () => void
    saveModelConfiguration.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { release = () => reject(new Error('fixture-write-failed')) }))
    const input = { connections: '[]', routes: '[]' }
    const call = handlers.get('settings:save-model-configuration')!
    const first = call({}, input)
    const rejected = expect(first).rejects.toThrow('fixture-write-failed')
    const second = call({}, input)
    await vi.waitFor(() => expect(saveModelConfiguration).toHaveBeenCalledTimes(1))
    expect(getSetting).toHaveBeenCalledTimes(1)
    release()
    await rejected
    await second
    expect(saveModelConfiguration).toHaveBeenCalledTimes(2)
    expect(getSetting).toHaveBeenCalledTimes(2)
  })
  it('显式协议经连接测试进入唯一配置工厂', async () => {
    registerSettingsIPC()
    const result = await handlers.get('settings:test-connection')!({}, { apiKey: 'fixture-draft', baseUrl: 'https://custom.test/v1', model: 'fixture-model', provider: 'anthropic' })
    expect(result).toMatchObject({ ok: true })
    expect(loadMainLLMConfig).toHaveBeenCalledWith({ apiKey: 'fixture-draft', baseUrl: 'https://custom.test/v1', model: 'fixture-model', provider: 'anthropic' })
    expect(chatComplete.mock.calls[0][0].config.provider).toBe('anthropic')
  })

  it.each(['settings:test-connection', 'settings:fetch-models'])('%s 不因 id 相同而把已存 Key 发往不同端点或协议', async (channel) => {
    registerSettingsIPC()
    for (const change of [{ baseUrl: 'https://other.test/v1' }, { provider: 'anthropic' }]) {
      const result = await handlers.get(channel)!({}, { useStoredApiKey: true, connectionId: 'conn-1', baseUrl: 'https://api.example.com/v1', model: 'model', ...change })
      expect(result.ok).toBe(false)
    }
    expect(chatComplete).not.toHaveBeenCalled()
    expect(fetchRemoteModels).not.toHaveBeenCalled()
  })

  it('编辑保存只在同端点同协议时保留已存密钥，来源和预设身份正常保存', async () => {
    registerSettingsIPC()
    const previous = { id: 'conn-1', name: 'before', baseUrl: 'https://api.example.com/v1', provider: 'openai', model: 'model', apiKey: 'fixture-stored', enabled: true }
    getSetting.mockResolvedValue(JSON.stringify([previous]))
    const save = async (patch: object) => {
      await handlers.get('settings:set')!({}, 'modelConnections', JSON.stringify([{ ...previous, apiKey: '', ...patch }]))
      return JSON.parse(setSetting.mock.calls.at(-1)![1])[0]
    }
    expect(await save({ name: 'renamed', source: 'custom', presetId: '' })).toMatchObject({ name: 'renamed', apiKey: 'fixture-stored', source: 'custom', provider: 'openai' })
    expect((await save({ baseUrl: 'https://other.test/v1' })).apiKey).toBe('')
    expect((await save({ provider: 'anthropic' })).apiKey).toBe('')
    expect((await save({ baseUrl: 'https://other.test/v1', apiKey: 'fixture-new' })).apiKey).toBe('fixture-new')
  })

  it('相处偏好写入独立字段，拒绝超长输入', async () => {
    registerSettingsIPC()
    const handler = handlers.get('settings:set')!
    await handler({}, 'companionResponseNote', '先说结论')
    expect(setSetting).toHaveBeenCalledWith('companionResponseNote', '先说结论')
    expect(setSetting).not.toHaveBeenCalledWith('systemPrompt', expect.anything())
    setSetting.mockClear()
    await expect(handler({}, 'companionResponseNote', '好'.repeat(4001))).rejects.toThrow()
    expect(setSetting).not.toHaveBeenCalled()
  })

  it('Streamable HTTP Bearer 在设置读取时脱敏，回传哨兵保留原值，换地址拒绝', async () => {
    const config = { id: 'remote', name: 'remote', command: '', args: [], enabled: true, transport: 'streamable-http', url: 'https://example.com/mcp', bearerToken: 'fixture-only-token' }
    getAllSettings.mockResolvedValue({ llmApiKey: '', mcpServers: JSON.stringify([config]) })
    const view = await getRendererSettings()
    expect(view.mcpServers).not.toContain('fixture-only-token')
    expect(view.mcpServers).toContain('__MY_AGENT_REDACTED__')
    registerSettingsIPC()
    getSetting.mockResolvedValue(JSON.stringify([config]))
    await handlers.get('settings:set')!({}, 'mcpServers', view.mcpServers)
    expect(setSetting).toHaveBeenCalledWith('mcpServers', JSON.stringify([config]))
    expect(showMessageBox).not.toHaveBeenCalled()
    setSetting.mockClear()
    const redirected = JSON.parse(view.mcpServers)
    redirected[0].url = 'https://other.example/mcp'
    await expect(handlers.get('settings:set')!({}, 'mcpServers', JSON.stringify(redirected))).rejects.toThrow()
    expect(setSetting).not.toHaveBeenCalled()
  })

  it('连接测试可以由主进程使用已保存 Key，而不要求 Renderer 重新读取 Key', async () => {
    registerSettingsIPC()
    const handler = handlers.get('settings:test-connection')
    expect(handler).toBeDefined()
    const result = await handler?.({}, { useStoredApiKey: true, connectionId: 'conn-1', baseUrl: 'https://api.example.com/v1', model: 'model' })
    expect(result).toMatchObject({ ok: true })
    expect(loadMainLLMConfig).toHaveBeenCalledWith({ apiKey: 'sk-connection-secret', baseUrl: 'https://api.example.com/v1', model: 'model' })
    expect(chatComplete).toHaveBeenCalled()
  })

  it('draft key tests do not read stored connection secrets', async () => {
    registerSettingsIPC()
    const handler = handlers.get('settings:test-connection')
    const result = await handler?.({}, { apiKey: 'sk-draft-secret', baseUrl: 'https://api.example.com/v1', model: 'model' })
    expect(result).toMatchObject({ ok: true })
    expect(loadMainLLMConfig).toHaveBeenCalledWith({ apiKey: 'sk-draft-secret', baseUrl: 'https://api.example.com/v1', model: 'model' })
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

  it('settings:fetch-models does not send a request without an API key', async () => {
    registerSettingsIPC()
    const handler = handlers.get('settings:fetch-models')
    const result = await handler?.({}, { apiKey: '', baseUrl: 'https://api.example.com/v1' })
    expect(result).toMatchObject({ ok: false, reason: 'missing-key', retryable: false })
    expect(fetchRemoteModels).not.toHaveBeenCalled()
    expect(loadMainLLMConfig).not.toHaveBeenCalled()
  })

  it('settings:fetch-models injects the stored connection key by connectionId', async () => {
    registerSettingsIPC()
    const handler = handlers.get('settings:fetch-models')
    const result = await handler?.({}, { useStoredApiKey: true, connectionId: 'conn-1', baseUrl: 'https://api.example.com/v1' })
    expect(result).toEqual({ ok: true, models: ['gpt-4o'] })
    expect(loadMainLLMConfig).toHaveBeenCalledWith({ apiKey: 'sk-connection-secret', baseUrl: 'https://api.example.com/v1' })
    expect(fetchRemoteModels).toHaveBeenCalled()
  })

  it('settings:fetch-models uses a draft key without reading stored secrets', async () => {
    registerSettingsIPC()
    const handler = handlers.get('settings:fetch-models')
    fetchRemoteModels.mockResolvedValueOnce({ ok: false, error: 'API Key invalid', reason: 'auth', retryable: true })
    const result = await handler?.({}, { apiKey: 'sk-draft-secret', baseUrl: 'https://api.example.com/v1' })
    expect(result).toEqual({ ok: false, error: 'API Key invalid', reason: 'auth', retryable: true })
    expect(loadMainLLMConfig).toHaveBeenCalledWith({ apiKey: 'sk-draft-secret', baseUrl: 'https://api.example.com/v1' })
    expect(JSON.stringify(result)).not.toContain('sk-connection-secret')
    expect(JSON.stringify(result)).not.toContain('sk-draft-secret')
  })

  it('useStoredApiKey without connectionId does not fall back to the global key', async () => {
    registerSettingsIPC()
    const testResult = await handlers.get('settings:test-connection')?.({}, { useStoredApiKey: true, baseUrl: 'https://api.example.com/v1', model: 'model' })
    expect(loadMainLLMConfig).toHaveBeenCalledWith({ apiKey: '', baseUrl: 'https://api.example.com/v1', model: 'model' })
    expect(testResult).toEqual({ ok: false, error: '\u8bf7\u5148\u914d\u7f6e API Key' })
    expect(chatComplete).not.toHaveBeenCalled()
    loadMainLLMConfig.mockClear()
    const fetchResult = await handlers.get('settings:fetch-models')?.({}, { useStoredApiKey: true, baseUrl: 'https://api.example.com/v1' })
    expect(loadMainLLMConfig).toHaveBeenCalledWith({ apiKey: '', baseUrl: 'https://api.example.com/v1' })
    expect(fetchResult).toMatchObject({ ok: false, reason: 'missing-key', retryable: false })
    expect(fetchRemoteModels).not.toHaveBeenCalled()
    expect(JSON.stringify(fetchResult)).not.toContain('sk-connection-secret')
    expect(JSON.stringify(fetchResult)).not.toContain('sk-real-secret')
  })
})

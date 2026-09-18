import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __test, loadAuxLLMConfig, loadImageLLMConfig, loadMainLLMConfig } from '../../electron/main/llm/aux-config'
import type { ModelConnectionProfile, ModelRoutePurpose } from '../../src/shared/types'
import { buildFallbackConfig } from '../../electron/main/llm/failover'
import { hasLLMAuthentication } from '../../src/shared/llm-connection-test'

const { getAllSettings, getSetting } = vi.hoisted(() => ({ getAllSettings: vi.fn(), getSetting: vi.fn() }))
vi.mock('../../electron/main/storage/settings-store', () => ({ getAllSettings, getSetting }))

describe('model configuration factories', () => {
  it('Temperature 零值必须原样传入模型配置', async () => {
    getAllSettings.mockResolvedValue({ llmTemperature: '0', modelConnections: '[]', modelRoutes: '[]' })
    expect((await loadMainLLMConfig()).temperature).toBe(0)
  })
  const loaders = { primary: loadMainLLMConfig, auxiliary: loadAuxLLMConfig, image: loadImageLLMConfig }
  const legacy = { llmApiKey: 'test-global-key', llmBaseUrl: 'https://legacy.test/v1', llmModel: 'legacy-model', auxModel: '' }
  function configure(purpose: ModelRoutePurpose, connection: Partial<ModelConnectionProfile> = {}) {
    getAllSettings.mockResolvedValue({
      ...legacy,
      modelConnections: JSON.stringify([
        { id: 'main', name: 'Main', baseUrl: 'https://main.test', model: 'main-model', apiKey: 'test-main-key', provider: 'anthropic', enabled: true },
        { id: 'target', name: 'Target', baseUrl: 'https://target.test/v1', model: 'target-model', enabled: true, ...connection },
      ]),
      modelRoutes: JSON.stringify([
        ...(purpose !== 'primary' ? [{ purpose: 'primary', connectionId: 'main', model: 'main-model', enabled: true }] : []),
        { purpose, connectionId: 'target', model: 'selected-model', enabled: true },
      ]),
    })
  }
  beforeEach(() => { vi.clearAllMocks(); getSetting.mockResolvedValue('') })

  it('辅助链按每个目标计算 thinking，不把首选策略带给备用', async () => {
    getAllSettings.mockResolvedValue({ ...legacy,
      modelConnections: JSON.stringify([
        { id: 'a', baseUrl: 'https://api.deepseek.com/v1', apiKey: 'a-key', enabled: true },
        { id: 'b', baseUrl: 'https://b.test/v1', apiKey: 'b-key', enabled: true },
      ]),
      modelRoutes: JSON.stringify([
        { purpose: 'auxiliary', connectionId: 'a', model: 'deepseek-reasoner', enabled: true },
        { purpose: 'auxiliary', connectionId: 'b', model: 'plain', enabled: true },
      ]),
    })
    const config = await loadAuxLLMConfig()
    expect(config.thinking).toEqual({ type: 'disabled' })
    const fallback = buildFallbackConfig(config, config.fallbackModels![0])
    expect(fallback.thinking).toBeUndefined()
    expect(fallback.runtimeAssetKeys).toBeUndefined()
    expect(fallback.apiKey).toBe('b-key')
  })

  it('首连接未配 Key 但独立备用有凭据时用途可启动', () => {
    expect(hasLLMAuthentication({ baseUrl: 'https://a.test', apiKey: '', fallbackModels: [{ baseUrl: 'https://b.test', apiKey: 'b-key' }] })).toBe(true)
    expect(hasLLMAuthentication({ baseUrl: 'https://a.test', apiKey: '', fallbackModels: [{ baseUrl: 'https://b.test', apiKey: '' }] })).toBe(false)
  })

  it.each(['auxiliary', 'image'] as const)('%s 独立用途不继承主用途备用列表', async (purpose) => {
    getAllSettings.mockResolvedValue({ ...legacy,
      modelConnections: JSON.stringify([{ id: 'a', baseUrl: 'https://a.test', apiKey: 'a-key', enabled: true }]),
      modelRoutes: JSON.stringify([
        { purpose: 'primary', connectionId: 'a', model: 'main', enabled: true },
        { purpose: 'primary', connectionId: 'a', model: 'main-backup', enabled: true },
        { purpose, connectionId: 'a', model: 'independent', enabled: true },
      ]),
    })
    expect((await loadMainLLMConfig()).fallbackModels).toHaveLength(1)
    expect((await loaders[purpose]()).fallbackModels).toBeUndefined()
    for (const override of [{ model: 'probe' }, { apiKey: 'probe-key' }, { provider: 'openai' as const }]) {
      expect((await loadMainLLMConfig(override)).fallbackModels).toBeUndefined()
    }
  })

  it.each(['primary', 'auxiliary', 'image'] as const)('%s 按用途顺序装配独立凭据备用链并过滤停用项', async (purpose) => {
    getAllSettings.mockResolvedValue({ ...legacy,
      modelConnections: JSON.stringify([
        { id: 'a', baseUrl: 'https://a.test/v1', apiKey: 'a-key', provider: 'anthropic', enabled: true },
        { id: 'b', baseUrl: 'http://127.0.0.1:1234/v1', apiKey: '', provider: 'openai', enabled: true },
        { id: 'off', baseUrl: 'https://off.test', enabled: false },
      ]),
      modelRoutes: JSON.stringify([
        { purpose, connectionId: 'off', model: 'off', enabled: true },
        { purpose, connectionId: 'a', model: 'first', enabled: true },
        { purpose, connectionId: 'a', model: 'disabled', enabled: false },
        { purpose, connectionId: 'missing', model: 'missing', enabled: true },
        { purpose, connectionId: 'b', model: 'second', enabled: true },
        { purpose, connectionId: 'b', model: 'second', enabled: true },
      ]),
    })
    const config = await loaders[purpose]()
    expect(config).toMatchObject({ model: 'first', apiKey: 'a-key', provider: 'anthropic' })
    expect(config.fallbackModels).toHaveLength(1)
    expect(config.fallbackModels?.[0]).toMatchObject({ model: 'second', baseUrl: 'http://127.0.0.1:1234/v1', apiKey: '', provider: 'openai' })
    expect((await loadMainLLMConfig({ baseUrl: 'https://test-only.test', model: 'probe' })).fallbackModels).toBeUndefined()
  })

  it.each(['primary', 'auxiliary', 'image'] as const)('%s 路由缺少密钥时不借用主连接、全局或环境密钥', async (purpose) => {
    configure(purpose)
    vi.stubEnv('LLM_API_KEY', 'test-environment-key')
    try {
      const config = await loaders[purpose]()
      expect(config.baseUrl).toBe('https://target.test/v1')
      expect(config.apiKey).toBe('')
    } finally { vi.unstubAllEnvs() }
  })

  it.each(['primary', 'auxiliary', 'image'] as const)('%s 保留目标连接的显式协议和自己的密钥', async (purpose) => {
    configure(purpose, { provider: 'gemini', apiKey: 'test-target-key' })
    expect(await loaders[purpose]()).toMatchObject({
      provider: 'gemini', apiKey: 'test-target-key', baseUrl: 'https://target.test/v1', model: 'selected-model',
    })
  })

  it.each(['auxiliary', 'image'] as const)('%s 未指定协议时按目标地址推断，不继承主连接的协议', async (purpose) => {
    configure(purpose)
    expect((await loaders[purpose]()).provider).toBe('auto')
  })

  it.each(['primary', 'auxiliary', 'image'] as const)('%s 空配置不读取旧身份或环境变量', async purpose => {
    getAllSettings.mockResolvedValue({ ...legacy, auxModel: 'old-aux', modelConnections: '[]', modelRoutes: '[]' })
    getSetting.mockImplementation(async key => key === 'auxModel' ? 'old-aux' : '')
    vi.stubEnv('LLM_API_KEY', 'test-environment-key')
    vi.stubEnv('LLM_BASE_URL', 'http://127.0.0.1:1234/v1')
    vi.stubEnv('LLM_MODEL', 'environment-model')
    try {
      const config = await loaders[purpose]()
      expect(config).toMatchObject({ apiKey: '', baseUrl: '', model: '' })
      expect(hasLLMAuthentication(config)).toBe(false)
      expect(config.fallbackModels).toBeUndefined()
    } finally { vi.unstubAllEnvs() }
  })

  it.each(['auxiliary', 'image'] as const)('%s 未单独安排时沿用新主用途，不读取旧辅助型号', async purpose => {
    configure('primary', { apiKey: 'main-key', provider: 'openai' })
    getSetting.mockImplementation(async key => key === 'auxModel' ? 'old-aux' : '')
    expect(await loaders[purpose]()).toMatchObject({ model: 'selected-model', baseUrl: 'https://target.test/v1', apiKey: 'main-key' })
  })

  it('空配置仍允许显式完整的一次性测试', async () => {
    getAllSettings.mockResolvedValue({ ...legacy, modelConnections: '[]', modelRoutes: '[]' })
    expect(await loadMainLLMConfig({ apiKey: 'probe-key', baseUrl: 'https://probe.test', model: 'probe', provider: 'gemini' })).toMatchObject({ apiKey: 'probe-key', baseUrl: 'https://probe.test', model: 'probe', provider: 'gemini' })
  })

  it.each(['disabled-route', 'disabled-connection', 'missing-connection', 'malformed'] as const)('%s 不触发旧主配置回退', async state => {
    getAllSettings.mockResolvedValue({ ...legacy,
      modelConnections: state === 'malformed' ? '{' : JSON.stringify([{ id: 'a', baseUrl: 'https://route.test', apiKey: 'route-key', enabled: state !== 'disabled-connection' }]),
      modelRoutes: JSON.stringify([{ purpose: 'primary', connectionId: state === 'missing-connection' ? 'missing' : 'a', model: 'route-model', enabled: state !== 'disabled-route' }]),
    })
    expect(await loadMainLLMConfig()).toMatchObject({ baseUrl: '', model: '', apiKey: '' })
  })

  it('一次性测试指定新地址时不继承已保存主路由的协议', async () => {
    configure('primary', { provider: 'anthropic', apiKey: 'test-target-key' })
    expect(await loadMainLLMConfig({ baseUrl: 'https://another.test/v1', apiKey: 'test-draft-key' })).toMatchObject({
      baseUrl: 'https://another.test/v1', apiKey: 'test-draft-key', provider: 'auto',
    })
    expect((await loadMainLLMConfig({ baseUrl: 'https://another.test/v1', provider: 'gemini' })).provider).toBe('gemini')
    expect((await loadMainLLMConfig({ baseUrl: 'https://another.test/v1' })).apiKey).toBe('')
    expect(await loadMainLLMConfig({ model: 'another-model' })).toMatchObject({
      model: 'another-model', provider: 'anthropic', apiKey: 'test-target-key',
    })
  })
})

describe('model routing', () => {
  it('只选择启用连接和启用路由，并覆盖路由模型名', () => {
    const result = __test.resolveRoutedConfig(
      JSON.stringify([
        { id: 'primary', name: '主连接', baseUrl: 'https://example.test/v1', model: 'fallback', apiKey: 'secret', enabled: true },
        { id: 'off', name: '停用连接', baseUrl: 'https://off.test/v1', model: 'off', enabled: false },
      ]),
      JSON.stringify([
        { purpose: 'primary', connectionId: 'off', model: 'off-model', enabled: true },
        { purpose: 'primary', connectionId: 'primary', model: 'routed-model', enabled: true },
      ]),
      'primary',
    )

    expect(result).toMatchObject({ id: 'primary', baseUrl: 'https://example.test/v1', model: 'routed-model', apiKey: 'secret' })
  })

  it('图片用途只解析 image 路由，未配置时由调用方回退主模型', () => {
    const connections = JSON.stringify([{ id: 'vision', name: '视觉连接', baseUrl: 'https://vision.test/v1', model: 'vision-default', apiKey: 'secret', enabled: true }])
    const routes = JSON.stringify([{ purpose: 'image', connectionId: 'vision', model: 'vision-model', enabled: true }])
    expect(__test.resolveRoutedConfig(connections, routes, 'image')).toMatchObject({ id: 'vision', model: 'vision-model' })
    expect(__test.resolveRoutedConfig(connections, routes, 'primary')).toBeNull()
  })
  it('坏 JSON、缺失连接或空模型安全回退为空', () => {
    expect(__test.resolveRoutedConfig('{', '[]', 'primary')).toBeNull()
    expect(__test.resolveRoutedConfig('[]', JSON.stringify([{ purpose: 'primary', connectionId: 'missing', model: 'x', enabled: true }]), 'primary')).toBeNull()
    expect(__test.resolveRoutedConfig(JSON.stringify([{ id: 'c', baseUrl: 'https://example.test', enabled: true }]), JSON.stringify([{ purpose: 'primary', connectionId: 'c', model: ' ', enabled: true }]), 'primary')).toBeNull()
  })

  it('清单存在时只接受已启用模型，空清单仍兼容旧单模型字段', () => {
    const connections = JSON.stringify([{
      id: 'primary',
      name: '主连接',
      baseUrl: 'https://example.test/v1',
      model: 'legacy-model',
      models: [
        { id: 'gpt-4o', enabled: true },
        { id: 'gpt-4o-mini', enabled: false },
      ],
      enabled: true,
    }])
    expect(__test.resolveRoutedConfig(
      connections,
      JSON.stringify([{ purpose: 'primary', connectionId: 'primary', model: 'gpt-4o-mini', enabled: true }]),
      'primary',
    )).toBeNull()
    expect(__test.resolveRoutedConfig(
      connections,
      JSON.stringify([{ purpose: 'primary', connectionId: 'primary', model: 'gpt-4o', enabled: true }]),
      'primary',
    )).toMatchObject({ id: 'primary', model: 'gpt-4o' })
    expect(__test.resolveRoutedConfig(
      JSON.stringify([{ id: 'legacy', baseUrl: 'https://legacy.test/v1', model: 'legacy-model', enabled: true }]),
      JSON.stringify([{ purpose: 'primary', connectionId: 'legacy', model: 'legacy-model', enabled: true }]),
      'primary',
    )).toMatchObject({ id: 'legacy', model: 'legacy-model' })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __test, loadAuxLLMConfig, loadImageLLMConfig, loadMainLLMConfig } from '../../electron/main/llm/aux-config'
import type { ModelConnectionProfile, ModelRoutePurpose } from '../../src/shared/types'

const { getAllSettings, getSetting } = vi.hoisted(() => ({ getAllSettings: vi.fn(), getSetting: vi.fn() }))
vi.mock('../../electron/main/storage/settings-store', () => ({ getAllSettings, getSetting }))

describe('model configuration factories', () => {
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

  it('没有用途路由时仍完整回退原有主模型配置', async () => {
    getAllSettings.mockResolvedValue({ ...legacy, modelConnections: '[]', modelRoutes: '[]' })
    const main = await loadMainLLMConfig()
    expect(main).toMatchObject({ apiKey: legacy.llmApiKey, baseUrl: legacy.llmBaseUrl, model: legacy.llmModel })
    expect(await loadImageLLMConfig()).toEqual(main)
    expect(await loadAuxLLMConfig()).toEqual(main)
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

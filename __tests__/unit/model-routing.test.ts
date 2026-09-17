import { describe, expect, it } from 'vitest'
import { __test } from '../../electron/main/llm/aux-config'

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

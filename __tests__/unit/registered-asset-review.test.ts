import { describe, expect, it, vi } from 'vitest'
import { filterRegisteredAssets, registeredAssetBody, registeredAssetGroup, registeredAssetKind, uniqueRegisteredAssets } from '../../src/components/debug/registered-asset-review'
import type { ModelContextAsset } from '../../src/shared/types'

vi.mock('electron', () => ({ app: { getPath: () => 'C:/tmp/my-agent-test' }, safeStorage: { isEncryptionAvailable: () => false } }))
const { getPromptAssets } = await import('../../electron/main/prompts/registry')

const assets = getPromptAssets()
describe('正式提示词审阅展示规则', () => {
  it('真实目录按唯一 key 计数，提示词与其他来源分开且全部可达', () => {
    const doubled = [...assets, ...assets]
    expect(uniqueRegisteredAssets(doubled)).toHaveLength(assets.length)
    const prompts = filterRegisteredAssets(doubled, 'prompts', '', '')
    const other = filterRegisteredAssets(doubled, 'other', '', '')
    expect(prompts.every(asset => asset.assetType === 'prompt')).toBe(true)
    expect(prompts.length + other.length).toBe(assets.length)
    expect(filterRegisteredAssets(doubled, 'all', '', '')).toHaveLength(assets.length)
  })
  it('主对话优先、平台后置；名称和读取顺序不影响排序且不改输入', () => {
    const input = [...assets].reverse().map(asset => ({ ...asset, name: '变化的名称' }))
    const before = input.map(asset => asset.key)
    const sorted = filterRegisteredAssets(input, 'all', '', '')
    expect(sorted[0].purpose).toBe('主对话语义模块编译')
    expect(registeredAssetGroup(sorted.at(-1)!)).toBe('平台规则与上下文')
    expect(sorted.map(asset => asset.key)).toEqual(filterRegisteredAssets(assets, 'all', '', '').map(asset => asset.key))
    expect(input.map(asset => asset.key)).toEqual(before)
  })
  it('搜索真实用途、模板与定义；人物筛选保留共用来源', () => {
    const selected = assets.find(asset => asset.definitions?.length)!
    expect(filterRegisteredAssets(assets, 'all', '', selected.definitions![0]).some(asset => asset.key === selected.key)).toBe(true)
    expect(filterRegisteredAssets(assets, 'all', '', selected.purpose).some(asset => asset.key === selected.key)).toBe(true)
    const sample = assets[0]
    const input = [{ ...sample, key: 'a', roleIds: ['a'] }, { ...sample, key: 'b', roleIds: ['b'] }, { ...sample, key: 'shared', roleIds: [] }]
    expect(filterRegisteredAssets(input, 'all', 'a', '').map(asset => asset.key).sort()).toEqual(['a', 'shared'])
  })
  it('仅使用正文或模板，不把预览冒充实际正文；空字符串保持原值', () => {
    const base = { ...assets[0], content: undefined, locale: 'zh-CN', locales: {}, preview: '预览不能复制' } as ModelContextAsset
    expect(registeredAssetBody(base)).toBeNull()
    expect(registeredAssetKind(base)).toBe('动态组装')
    expect(registeredAssetBody({ ...base, content: '' })).toBe('')
    expect(registeredAssetBody({ ...base, locales: { 'zh-CN': { template: '{{real}}' } } })).toBe('{{real}}')
    expect(registeredAssetKind({ ...base, contentKind: 'schema', content: '{}' })).toBe('结构内容')
  })
})

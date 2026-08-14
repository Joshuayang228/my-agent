import { describe, expect, it } from 'vitest'
import { getPromptAssets, getRuntimePromptAssetTraces, resolvePromptAssetTraces } from '../../electron/main/prompts/registry'

const REQUIRED_KEYS = [
  'system-layers',
  'loop-default',
  'playground-default',
  'l3-collapse',
  'l4-autocompact',
  'profile-extraction',
  'session-title',
  'connection-test',
  'companion-reflection',
  'companion-catchup',
  'companion-moment-polish',
  'companion-day-script',
  'subagent-system',
] as const

describe('debug prompt assets', () => {
  it('目录来自生产注册表且包含静态与动态 Prompt', () => {
    const assets = getPromptAssets()
    expect(assets.length).toBeGreaterThanOrEqual(5)
    expect(assets.some((asset) => asset.key === 'loop-default' && asset.content?.includes('乐于助人的 AI 助手'))).toBe(true)
    expect(assets.some((asset) => asset.key === 'system-layers' && asset.mode === 'dynamic')).toBe(true)
    for (const asset of assets) {
      expect(asset.key).toBeTruthy()
      expect(asset.id).toBe(asset.key)
      expect(asset.source).toBe(asset.sourcePath)
      expect(asset.purpose).toBeTruthy()
      expect(asset.role).toBeTruthy()
      expect(asset.version).toBeTruthy()
      expect(asset.locale).toBe('zh-CN')
      expect(asset.locales['zh-CN']).toBeDefined()
      expect(asset.dynamic).toBe(asset.mode === 'dynamic')
      expect(Array.isArray(asset.slots)).toBe(true)
    }
  })

  it('稳定 key 唯一且核心资产都能按 key 找到', () => {
    const assets = getPromptAssets()
    const keys = assets.map((asset) => asset.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of REQUIRED_KEYS) {
      expect(keys).toContain(key)
    }
    expect(keys).toContain('role-ayu-protected-md')
  })

  it('静态资产把真实正文登记到当前 locale，动态资产只登记插槽', () => {
    const assets = getPromptAssets()
    const loop = assets.find((asset) => asset.key === 'loop-default')
    const system = assets.find((asset) => asset.key === 'system-layers')
    expect(loop?.locales['zh-CN'].template).toBe(loop?.content)
    expect(system?.locales['zh-CN'].template).toBeUndefined()
    expect(system?.slots.some((slot) => slot.name === 'persona')).toBe(true)
  })

  it('调用级解析保留声明顺序、去重并显式返回未知 key', () => {
    const result = resolvePromptAssetTraces([
      'profile-extraction',
      'l3-collapse',
      'profile-extraction',
      'missing-prompt-key',
    ])
    expect(result.assets.map((asset) => asset.key)).toEqual(['profile-extraction', 'l3-collapse'])
    expect(result.assets[0]).toMatchObject({
      source: 'electron/main/prompts/texts.ts',
      version: '1.0.0',
      locale: 'zh-CN',
    })
    expect(result.unknownKeys).toEqual(['missing-prompt-key'])
  })

  it('当前 System 装配快照通过同一注册表返回来源与版本追踪', () => {
    const traces = getRuntimePromptAssetTraces('missing-role')
    expect(traces.map((trace) => trace.key)).toEqual(['system-layers'])
    expect(traces[0]).toMatchObject({
      purpose: '主对话 System 四层组装',
      role: 'system',
      source: 'electron/main/agent/prompt-builder.ts',
      locale: 'zh-CN',
      mode: 'dynamic',
    })
  })
})

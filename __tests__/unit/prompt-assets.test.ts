import { describe, expect, it } from 'vitest'
import { getPromptAssets, getRuntimePromptAssetTraces, resolvePromptAssetTraces } from '../../electron/main/prompts/registry'
import { PROMPT_KEYS } from '../../electron/main/prompts/keys'
import { modelContextFingerprint } from '../../electron/main/prompts/fingerprint'
import { EXTRACTION_PROMPT } from '../../electron/main/prompts/texts'
import { EVAL_JUDGE_TEMPLATE } from '../../electron/main/prompts/eval-judge'

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
  'eval-judge',
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
      expect(asset.fingerprint).toMatch(/^[a-f0-9]{16}$/)
      expect(['content', 'structure']).toContain(asset.fingerprintKind)
      expect(asset.assetType).toBeTruthy()
      expect(asset.ownership).toBeTruthy()
      expect(asset.contentKind).toBeTruthy()
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

  it('静态资产登记真实正文，动态资产可登记模板骨架或运行时插槽', () => {
    const assets = getPromptAssets()
    const loop = assets.find((asset) => asset.key === 'loop-default')
    const system = assets.find((asset) => asset.key === 'system-layers')
    expect(loop?.locales['zh-CN'].template).toBe(loop?.content)
    expect(system?.locales['zh-CN'].template).toBeUndefined()
    expect(assets.find((asset) => asset.key === PROMPT_KEYS.evalJudge)?.locales['zh-CN'].template).toBe(EVAL_JUDGE_TEMPLATE)
    expect(system?.slots.some((slot) => slot.name === 'persona')).toBe(true)
  })

  it('核心类型化 key 全部存在，静态正文与动态模板生成稳定指纹', () => {
    const assets = getPromptAssets()
    const keys = new Set(assets.map((asset) => asset.key))
    for (const key of Object.values(PROMPT_KEYS)) expect(keys.has(key)).toBe(true)

    const profile = assets.find((asset) => asset.key === PROMPT_KEYS.profileExtraction)
    const judge = assets.find((asset) => asset.key === PROMPT_KEYS.evalJudge)
    expect(profile?.fingerprint).toBe(modelContextFingerprint(EXTRACTION_PROMPT))
    expect(profile?.fingerprintKind).toBe('content')
    expect(judge?.fingerprint).toBe(modelContextFingerprint(EVAL_JUDGE_TEMPLATE))
    expect(judge?.fingerprintKind).toBe('content')
    expect(modelContextFingerprint(`${EXTRACTION_PROMPT}。`)).not.toBe(profile?.fingerprint)
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

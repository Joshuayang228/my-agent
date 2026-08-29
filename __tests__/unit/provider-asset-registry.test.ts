import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  PROVIDER_PRESETS,
  PROVIDER_PRESET_GROUPS,
  QUICK_PROVIDER_PRESETS,
} from '../../src/shared/provider-presets'
import { buildOpenAIRequest } from '../../electron/main/llm/request-builders'

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp/my-agent-test' },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))

const { getProviderAssetCatalog } = await import('../../electron/main/llm/provider-asset-registry')

describe('模型 Provider 生产资产目录', () => {
  it('模型预设使用唯一注册表，Settings 与 Chat 不再维护平行数组', () => {
    expect(PROVIDER_PRESETS.map((preset) => preset.key)).toEqual([
      'provider-preset:openai:gpt-4o',
      'provider-preset:openai:gpt-4o-mini',
      'provider-preset:openai:gpt-5.5',
      'provider-preset:anthropic:claude-sonnet',
      'provider-preset:anthropic:claude-sonnet-4-6',
      'provider-preset:google:gemini-3.1-flash-preview',
      'provider-preset:xai:grok-4',
      'provider-preset:deepseek:v3',
      'provider-preset:deepseek:v4-flash',
      'provider-preset:deepseek:reasoner',
      'provider-preset:qwen:max',
      'provider-preset:moonshot:kimi-k2',
      'provider-preset:moonshot:kimi-k2.6',
      'provider-preset:minimax:m2.5',
      'provider-preset:zhipu:glm-4.5',
      'provider-preset:siliconflow:qwen3-235b',
      'provider-preset:xiaomi:mimo-v2.5-pro',
      'provider-preset:volces:doubao-seed-2-pro',
      'provider-preset:kimi-coding:kimi-for-coding',
      'provider-preset:aliyun-coding:qwen3-coder',
      'provider-preset:minimax-coding:m2.5',
      'provider-preset:zhipu-coding:glm-4.5',
      'provider-preset:volces-coding:doubao-seed-2-pro',
      'provider-preset:xiaomi-coding:mimo-v2-pro',
      'provider-preset:openrouter:gpt-4.1',
      'provider-preset:pipellm:claude-sonnet-4-6',
      'provider-preset:miyang:gemini-3-flash',
      'provider-preset:tokendance:glm-5.1',
      'provider-preset:local:ollama',
      'provider-preset:local:lm-studio',
    ])
    expect(PROVIDER_PRESET_GROUPS.map((group) => group.items.length)).toEqual([7, 11, 6, 4, 2])
    expect(QUICK_PROVIDER_PRESETS.map((preset) => preset.model)).toEqual([
      'gpt-4o',
      'gpt-4o-mini',
      'deepseek-chat',
      'deepseek-v4-flash',
    ])

    const settingsSource = readFileSync('src/components/SettingsPanel.tsx', 'utf-8')
    const appSource = readFileSync('src/App.tsx', 'utf-8')
    const promptManagerSource = readFileSync('src/components/debug/PromptManagerPanel.tsx', 'utf-8')
    expect(settingsSource).toContain('PROVIDER_PRESET_GROUPS')
    expect(settingsSource).not.toContain('const PRESET_GROUPS')
    expect(appSource).toContain('QUICK_PROVIDER_PRESETS')
    expect(appSource).not.toContain('const MODEL_PRESETS')
    expect(promptManagerSource).toContain("asset.assetType !== 'provider-capability'")
    expect(promptManagerSource).toContain("asset.assetType !== 'provider-policy'")
    expect(promptManagerSource).toContain("asset.assetType !== 'provider-preset'")
  })

  it('OpenAI 请求纯构造器保留工具、Response Format、Thinking 和图片结构', () => {
    const request = buildOpenAIRequest({
      config: {
        apiKey: 'unit-test-secret',
        baseUrl: 'https://example.test/v1',
        model: 'test-model',
        thinking: { type: 'disabled' },
      },
      messages: [{
        id: 'user',
        role: 'user',
        content: '看图',
        timestamp: 0,
        images: [{ dataUrl: 'data:image/png;base64,AA==', mimeType: 'image/png' }],
      }],
      tools: [{
        name: 'read_info',
        description: '读取信息',
        parameters: { type: 'object', properties: {} },
        metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
        execute: async () => 'unused',
      }],
      responseFormat: { type: 'json_object' },
    })

    expect(request.url).toBe('https://example.test/v1/chat/completions')
    expect(request.headers.Authorization).toBe('Bearer unit-test-secret')
    expect(request.body).toMatchObject({
      model: 'test-model',
      stream: true,
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
    })
    expect(JSON.stringify(request.body.messages)).toContain('image_url')
    expect(request.body.tools).toBeTruthy()
  })

  it('登记三协议、五项跨 Provider 策略和全部内置预设', () => {
    const assets = getProviderAssetCatalog()
    const keys = assets.map((asset) => asset.key)

    expect(keys.filter((key) => key.startsWith('provider-capability:'))).toEqual([
      'provider-capability:openai',
      'provider-capability:anthropic',
      'provider-capability:gemini',
    ])
    expect(keys.filter((key) => key.startsWith('provider-policy:'))).toEqual([
      'provider-policy:auto-detection',
      'provider-policy:aux-thinking',
      'provider-policy:context-window',
      'provider-policy:vision-fallback',
      'provider-policy:sequential-failover',
    ])
    expect(keys.filter((key) => key.startsWith('provider-preset:'))).toHaveLength(PROVIDER_PRESETS.length)
    expect(new Set(keys).size).toBe(keys.length)
    for (const asset of assets) {
      expect(asset.category).toBe('provider')
      expect(asset.ownership).toBe('builtin')
      expect(asset.status).toBe('active')
      expect(asset.fingerprint).toMatch(/^[a-f0-9]{16}$/)
    }
  })

  it('协议能力来自真实构造器，并保守区分适配器能力与具体模型保证', () => {
    const assets = getProviderAssetCatalog()
    const openai = JSON.parse(assets.find((asset) => asset.key === 'provider-capability:openai')!.content!)
    const anthropic = JSON.parse(assets.find((asset) => asset.key === 'provider-capability:anthropic')!.content!)
    const gemini = JSON.parse(assets.find((asset) => asset.key === 'provider-capability:gemini')!.content!)

    expect(openai.request.authentication).toBe('bearer-header')
    expect(openai.capabilities).toMatchObject({
      streaming: true,
      toolCalling: true,
      responseFormat: true,
      thinkingParameter: true,
      nativeVisionMapping: true,
    })
    expect(anthropic.request.authentication).toBe('x-api-key-header')
    expect(anthropic.capabilities).toMatchObject({
      streaming: true,
      toolCalling: true,
      promptCache: true,
      nativeVisionMapping: false,
    })
    expect(gemini.request.authentication).toBe('query-parameter')
    expect(gemini.capabilities).toMatchObject({
      streaming: true,
      toolCalling: true,
      nativeVisionMapping: false,
    })
  })

  it('Context、Thinking、Vision 和 Failover 资产来自生产事实且不包含运行缓存', () => {
    const assets = getProviderAssetCatalog()
    const context = JSON.parse(assets.find((asset) => asset.key === 'provider-policy:context-window')!.content!)
    const thinking = JSON.parse(assets.find((asset) => asset.key === 'provider-policy:aux-thinking')!.content!)
    const vision = JSON.parse(assets.find((asset) => asset.key === 'provider-policy:vision-fallback')!.content!)
    const failover = JSON.parse(assets.find((asset) => asset.key === 'provider-policy:sequential-failover')!.content!)

    expect(context).toMatchObject({
      outputReserveTokens: 8000,
      minimumEffectiveTokens: 16000,
      unknownModelFallback: 120000,
      vendorRealtimeSpec: false,
    })
    expect(context.examples).toEqual({ claude: 192000, gemini: 992000, unknown: 120000 })
    expect(thinking.runtimeCapabilityCacheIncluded).toBe(false)
    expect(vision.runtimeDenyCacheIncluded).toBe(false)
    expect(failover).toMatchObject({ mode: 'sequential', primaryFirst: true, recursiveFallbackDisabled: true })
  })

  it('静态 Provider 目录不包含凭据或用户当前配置', () => {
    const serialized = JSON.stringify(getProviderAssetCatalog())

    expect(serialized).not.toContain('__provider_asset_secret__')
    expect(serialized).not.toContain('unit-test-secret')
    expect(serialized).not.toContain('Authorization: Bearer')
    expect(serialized).not.toContain('llmCapabilityCache')
    expect(serialized).not.toContain('probedAt')
  })
})

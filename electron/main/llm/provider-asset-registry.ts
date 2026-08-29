/**
 * 模型 Provider 能力生产资产注册表。
 *
 * 背景：Provider 协议、预设和跨模型策略分散在 Router、LLM 入口、Thinking、Context 与 UI 中。
 * 设计意图：使用脱敏合成请求和生产纯函数生成只读能力资产，只陈述当前适配器真实行为。
 * 关键约束：不得读取用户设置、能力缓存、请求记录或任何 API Key；厂商外部宣称不属于代码事实。
 */

import type {
  ChatMessage,
  LLMConfig,
  ModelContextAsset,
  ModelContextAssetType,
  ToolDefinition,
} from '../../../src/shared/types'
import { PROVIDER_PRESETS } from '../../../src/shared/provider-presets'
import { PROVIDER_ASSET_KEYS } from './provider-asset-keys'
export { PROVIDER_ASSET_KEYS } from './provider-asset-keys'
import {
  DEFAULT_MAX_TOKENS,
  MIN_EFFECTIVE_CONTEXT_TOKENS,
  MODEL_CONTEXT_WINDOWS,
  OUTPUT_RESERVE_TOKENS,
  getEffectiveContextWindow,
} from '../agent/model-context-window'
import { modelContextFingerprint } from '../prompts/fingerprint'
import { SEQUENTIAL_FAILOVER_POLICY } from './failover'
import {
  PROVIDER_DETECTION_RULES,
  buildAnthropicBody,
  buildGeminiBody,
  detectProviderFromBaseUrl,
} from './provider-router'
import {
  buildOpenAICompatibleMessages,
  buildOpenAIRequest,
  toOpenAITool,
} from './request-builders'
import {
  AUX_THINKING_DECISION_PRIORITY,
  THINKING_DISABLE_BASE_URL_PATTERNS,
  THINKING_DISABLE_MODEL_RULE,
} from './thinking'
import {
  VISION_FALLBACK_POLICY,
  VISION_RELATED_ERROR_MARKERS,
} from './vision'

const PROVIDER_ASSET_VERSION = '1.0.0'

const SYNTHETIC_SECRET = '__provider_asset_secret__'

function jsonContent(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function preview(content: string, max = 420): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact
}

function providerAsset(input: {
  key: string
  name: string
  purpose: string
  role: string
  source: string
  assetType: Extract<ModelContextAssetType, 'provider-capability' | 'provider-policy' | 'provider-preset'>
  content: string
  dependencies?: string[]
}): ModelContextAsset {
  return {
    key: input.key,
    id: input.key,
    name: input.name,
    category: 'provider',
    purpose: input.purpose,
    role: input.role,
    desc: '模型 Provider 的内置适配器、策略或预设事实；不包含用户配置与凭据。',
    source: input.source,
    sourcePath: input.source,
    version: PROVIDER_ASSET_VERSION,
    fingerprint: modelContextFingerprint(input.content),
    fingerprintKind: 'content',
    assetType: input.assetType,
    ownership: 'builtin',
    contentKind: 'data',
    mode: 'static',
    locale: 'zh-CN',
    locales: { 'zh-CN': { template: input.content } },
    slots: [],
    status: 'active',
    dependencies: input.dependencies ?? [],
    preview: preview(input.content),
    content: input.content,
    dynamic: false,
  }
}

function syntheticConfig(model: string): LLMConfig {
  return {
    apiKey: SYNTHETIC_SECRET,
    baseUrl: 'https://provider.invalid',
    model,
    temperature: 0.4,
    topP: 0.9,
    maxTokens: 1024,
    thinking: { type: 'disabled' },
  }
}

function syntheticMessages(): ChatMessage[] {
  return [
    { id: 'system', role: 'system', content: '系统说明', timestamp: 0 },
    {
      id: 'user',
      role: 'user',
      content: '请分析图片',
      timestamp: 0,
      images: [{ dataUrl: 'data:image/png;base64,AA==', mimeType: 'image/png', fileName: 'sample.png' }],
    },
  ]
}

function syntheticTool(): ToolDefinition {
  return {
    name: 'sample_tool',
    description: '示例工具',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '查询内容' } },
      required: ['query'],
    },
    metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
    inputExamples: [{ query: '示例' }],
    execute: async () => 'unused',
  }
}

function requestShape(input: {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
}) {
  const url = new URL(input.url)
  return {
    endpointPath: url.pathname,
    queryParameters: [...url.searchParams.keys()].sort(),
    headerNames: Object.keys(input.headers).sort(),
    bodyKeys: Object.keys(input.body).sort(),
  }
}

function authMethod(shape: ReturnType<typeof requestShape>): string {
  if (shape.headerNames.includes('Authorization')) return 'bearer-header'
  if (shape.headerNames.includes('x-api-key')) return 'x-api-key-header'
  if (shape.queryParameters.includes('key')) return 'query-parameter'
  return 'none'
}

function protocolCapabilityContents() {
  const config = syntheticConfig('sample-model')
  const messages = syntheticMessages()
  const tool = syntheticTool()
  const openaiRequest = buildOpenAIRequest({
    config,
    messages,
    tools: [tool],
    responseFormat: { type: 'json_object' },
  })
  const intermediateMessages = buildOpenAICompatibleMessages(messages)
  const intermediateTools = [toOpenAITool(tool)]
  const anthropicRequest = buildAnthropicBody(config, intermediateMessages, intermediateTools, { enablePromptCache: true })
  const geminiRequest = buildGeminiBody(config, intermediateMessages, intermediateTools)
  const openaiShape = requestShape(openaiRequest)
  const anthropicShape = requestShape(anthropicRequest)
  const geminiShape = requestShape(geminiRequest)

  return {
    openai: {
      protocol: 'openai-compatible-chat-completions',
      request: { ...openaiShape, authentication: authMethod(openaiShape) },
      capabilities: {
        streaming: openaiRequest.body.stream === true,
        usageInStream: Boolean(openaiRequest.body.stream_options),
        systemPrompt: 'messages-role-system',
        toolCalling: Array.isArray(openaiRequest.body.tools),
        responseFormat: Boolean(openaiRequest.body.response_format),
        thinkingParameter: Boolean(openaiRequest.body.thinking),
        promptCache: false,
        nativeVisionMapping: JSON.stringify(openaiRequest.body.messages).includes('image_url'),
      },
    },
    anthropic: {
      protocol: 'anthropic-messages',
      request: { ...anthropicShape, authentication: authMethod(anthropicShape) },
      capabilities: {
        streaming: anthropicRequest.body.stream === true,
        systemPrompt: 'separate-system-field',
        toolCalling: Array.isArray(anthropicRequest.body.tools),
        responseFormat: false,
        thinkingParameter: false,
        promptCache: anthropicShape.headerNames.includes('anthropic-beta'),
        nativeVisionMapping: JSON.stringify(anthropicRequest.body).includes('"source"'),
      },
    },
    gemini: {
      protocol: 'gemini-stream-generate-content',
      request: { ...geminiShape, authentication: authMethod(geminiShape) },
      capabilities: {
        streaming: new URL(geminiRequest.url).searchParams.get('alt') === 'sse',
        systemPrompt: 'systemInstruction',
        toolCalling: Array.isArray(geminiRequest.body.tools),
        responseFormat: false,
        thinkingParameter: false,
        promptCache: false,
        nativeVisionMapping: /inlineData|fileData/.test(JSON.stringify(geminiRequest.body)),
      },
    },
  }
}

function protocolAssets(): ModelContextAsset[] {
  const contents = protocolCapabilityContents()
  return [
    providerAsset({
      key: PROVIDER_ASSET_KEYS.openai,
      name: '模型 Provider · OpenAI Compatible',
      purpose: '描述 OpenAI Chat Completions 兼容适配器的真实请求能力',
      role: 'provider-adapter',
      source: 'electron/main/llm/request-builders.ts',
      assetType: 'provider-capability',
      content: jsonContent(contents.openai),
    }),
    providerAsset({
      key: PROVIDER_ASSET_KEYS.anthropic,
      name: '模型 Provider · Anthropic',
      purpose: '描述 Anthropic Messages 适配器的真实请求能力',
      role: 'provider-adapter',
      source: 'electron/main/llm/provider-router.ts',
      assetType: 'provider-capability',
      content: jsonContent(contents.anthropic),
    }),
    providerAsset({
      key: PROVIDER_ASSET_KEYS.gemini,
      name: '模型 Provider · Gemini',
      purpose: '描述 Gemini streamGenerateContent 适配器的真实请求能力',
      role: 'provider-adapter',
      source: 'electron/main/llm/provider-router.ts',
      assetType: 'provider-capability',
      content: jsonContent(contents.gemini),
    }),
  ]
}

function policyAssets(): ModelContextAsset[] {
  const policies = [
    {
      key: PROVIDER_ASSET_KEYS.autoDetection,
      name: 'Provider 策略 · 自动检测',
      purpose: '说明显式 Provider、Base URL 规则和未知端点回退顺序',
      source: 'electron/main/llm/provider-router.ts',
      dependencies: ['provider-capability:openai', 'provider-capability:anthropic', 'provider-capability:gemini'],
      content: {
        explicitProviderPriority: true,
        rules: PROVIDER_DETECTION_RULES.map(({ pattern, provider }) => ({ pattern: pattern.source, provider })),
        fallback: 'openai',
      },
    },
    {
      key: PROVIDER_ASSET_KEYS.auxThinking,
      name: 'Provider 策略 · 辅助 Thinking',
      purpose: '说明辅助模型关闭 Thinking 的缓存与启发式优先级',
      source: 'electron/main/llm/thinking.ts',
      dependencies: [],
      content: {
        decisionPriority: [...AUX_THINKING_DECISION_PRIORITY],
        baseUrlPatterns: THINKING_DISABLE_BASE_URL_PATTERNS.map((pattern) => pattern.source),
        modelRule: THINKING_DISABLE_MODEL_RULE,
        mainConfigFactory: 'loadMainLLMConfig',
        auxConfigFactory: 'loadAuxLLMConfig + withAuxThinking',
        runtimeCapabilityCacheIncluded: false,
      },
    },
    {
      key: PROVIDER_ASSET_KEYS.contextWindow,
      name: 'Provider 策略 · Context Window',
      purpose: '说明模型家族窗口、输出预留和未知模型保守回退',
      source: 'electron/main/agent/model-context-window.ts',
      dependencies: [],
      content: {
        familyRules: MODEL_CONTEXT_WINDOWS.map((entry) => ({ ...entry })),
        outputReserveTokens: OUTPUT_RESERVE_TOKENS,
        minimumEffectiveTokens: MIN_EFFECTIVE_CONTEXT_TOKENS,
        unknownModelFallback: DEFAULT_MAX_TOKENS,
        examples: {
          claude: getEffectiveContextWindow('claude-sonnet'),
          gemini: getEffectiveContextWindow('gemini-2.0-flash'),
          unknown: getEffectiveContextWindow('custom-model'),
        },
        vendorRealtimeSpec: false,
      },
    },
    {
      key: PROVIDER_ASSET_KEYS.visionFallback,
      name: 'Provider 策略 · Vision 降级',
      purpose: '说明图片能力的乐观尝试、拒绝缓存和去图重试规则',
      source: 'electron/main/llm/vision.ts',
      dependencies: ['provider-capability:openai', 'provider-capability:anthropic', 'provider-capability:gemini'],
      content: {
        policy: VISION_FALLBACK_POLICY,
        errorMarkers: [...VISION_RELATED_ERROR_MARKERS],
        runtimeDenyCacheIncluded: false,
      },
    },
    {
      key: PROVIDER_ASSET_KEYS.sequentialFailover,
      name: 'Provider 策略 · 顺序 Failover',
      purpose: '说明主模型失败后备用模型的顺序、继承和覆盖规则',
      source: 'electron/main/llm/failover.ts',
      dependencies: ['provider-policy:auto-detection'],
      content: SEQUENTIAL_FAILOVER_POLICY,
    },
  ] as const

  return policies.map((policy) => providerAsset({
    key: policy.key,
    name: policy.name,
    purpose: policy.purpose,
    role: 'provider-policy',
    source: policy.source,
    assetType: 'provider-policy',
    dependencies: [...policy.dependencies],
    content: jsonContent(policy.content),
  }))
}

function presetAssets(): ModelContextAsset[] {
  return PROVIDER_PRESETS.map((preset) => {
    const provider = detectProviderFromBaseUrl(preset.baseUrl)
    const content = jsonContent({
      providerId: preset.providerId,
      group: preset.group,
      label: preset.label,
      baseUrl: preset.baseUrl,
      quickAccess: preset.quickAccess,
      routedProvider: provider,
      credentialIncluded: false,
      capabilityGuarantee: '具体模型能力需连接测试或 Playground 探测',
    })
    return providerAsset({
      key: preset.key,
      name: `Provider 入口 · ${preset.label}`,
      purpose: 'Settings 与 Chat 快切共享的内置 Provider 入口模板',
      role: 'provider-preset',
      source: 'src/shared/provider-presets.ts',
      assetType: 'provider-preset',
      dependencies: [`provider-capability:${provider}`],
      content,
    })
  })
}

/** 构建 Provider 协议能力、跨 Provider 策略和内置预设目录。 */
export function getProviderAssetCatalog(): ModelContextAsset[] {
  const assets = [...protocolAssets(), ...policyAssets(), ...presetAssets()]
  const serialized = JSON.stringify(assets)
  if (serialized.includes(SYNTHETIC_SECRET)) {
    throw new Error('Provider 资产脱敏失败：检测到合成凭据')
  }
  return assets
}

/**
 * LLM Provider 路由 — 根据 baseUrl 或显式配置自动路由到不同适配器。
 *
 * Alice 方法论 Ch.7：LLM Adapter 抽象；多模型支持；统一 yield 接口。
 *
 * 路由逻辑：
 * 1. 如果 config.provider 显式指定，直接使用
 * 2. 否则根据 baseUrl 自动检测
 * 3. 默认 fallback 到 OpenAI 兼容格式
 */

import type { LLMConfig, LLMProvider } from '../../../src/shared/types'
import { createLogger } from '../utils/logger'

const log = createLogger('ProviderRouter')

const PROVIDER_PATTERNS: Array<{ pattern: RegExp; provider: LLMProvider }> = [
  { pattern: /anthropic\.com|claude\.ai/, provider: 'anthropic' },
  { pattern: /googleapis\.com|generativelanguage/, provider: 'gemini' },
  { pattern: /openai\.com|deepseek\.com|api\.openai|together\.xyz|groq\.com|openrouter\.ai/, provider: 'openai' },
]

/**
 * 检测 Provider 类型
 */
export function detectProvider(config: LLMConfig): Exclude<LLMProvider, 'auto'> {
  if (config.provider && config.provider !== 'auto') {
    return config.provider
  }

  for (const { pattern, provider } of PROVIDER_PATTERNS) {
    if (pattern.test(config.baseUrl)) {
      log.debug('Provider auto-detected', { baseUrl: config.baseUrl, provider })
      return provider as Exclude<LLMProvider, 'auto'>
    }
  }

  log.debug('Provider fallback to openai', { baseUrl: config.baseUrl })
  return 'openai'
}

/**
 * 构建 Anthropic Messages API 请求体
 */
export function buildAnthropicBody(
  config: LLMConfig,
  messages: Record<string, unknown>[],
  tools?: Record<string, unknown>[],
  options?: { enablePromptCache?: boolean },
): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
  const enableCache = options?.enablePromptCache ?? false
  const systemMessages = messages.filter(m => m.role === 'system')
  const nonSystemMessages = messages.filter(m => m.role !== 'system')

  const apiMessages = nonSystemMessages.map(m => {
    if (m.role === 'assistant' && m.tool_calls) {
      const toolUse = (m.tool_calls as Array<Record<string, unknown>>).map(tc => ({
        type: 'tool_use',
        id: (tc as Record<string, unknown>).id,
        name: ((tc as Record<string, unknown>).function as Record<string, string>)?.name,
        input: JSON.parse(((tc as Record<string, unknown>).function as Record<string, string>)?.arguments || '{}'),
      }))
      const content: unknown[] = []
      if (m.content) content.push({ type: 'text', text: m.content })
      content.push(...toolUse)
      return { role: 'assistant', content }
    }
    if (m.role === 'tool') {
      return {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: m.tool_call_id,
          content: m.content,
        }],
      }
    }
    return m
  })

  const body: Record<string, unknown> = {
    model: config.model,
    messages: apiMessages,
    max_tokens: config.maxTokens || 4096,
    stream: true,
  }

  if (systemMessages.length > 0) {
    const systemText = systemMessages.map(m => m.content).join('\n\n')
    if (enableCache) {
      body.system = [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }]
    } else {
      body.system = systemText
    }
  }
  if (config.temperature !== undefined) body.temperature = config.temperature
  if (config.topP !== undefined) body.top_p = config.topP

  if (tools && tools.length > 0) {
    const mapped = tools.map(t => {
      const fn = (t as Record<string, unknown>).function as Record<string, unknown>
      return {
        name: fn.name,
        description: fn.description,
        input_schema: fn.parameters,
      }
    })
    if (enableCache && mapped.length > 0) {
      (mapped[mapped.length - 1] as Record<string, unknown>).cache_control = { type: 'ephemeral' }
    }
    body.tools = mapped
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  }
  if (enableCache) {
    headers['anthropic-beta'] = 'prompt-caching-2024-07-31'
  }

  return {
    url: `${config.baseUrl}/v1/messages`,
    headers,
    body,
  }
}

/**
 * 构建 Gemini API 请求体
 */
export function buildGeminiBody(
  config: LLMConfig,
  messages: Record<string, unknown>[],
  tools?: Record<string, unknown>[],
): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
  const systemInstruction = messages
    .filter(m => m.role === 'system')
    .map(m => m.content as string)
    .join('\n\n')

  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content as string }],
    }))

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: config.temperature,
      topP: config.topP,
      maxOutputTokens: config.maxTokens,
    },
  }

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] }
  }

  if (tools && tools.length > 0) {
    body.tools = [{
      functionDeclarations: tools.map(t => {
        const fn = (t as Record<string, unknown>).function as Record<string, unknown>
        return {
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        }
      }),
    }]
  }

  const model = config.model || 'gemini-pro'
  return {
    url: `${config.baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${config.apiKey}`,
    headers: { 'Content-Type': 'application/json' },
    body,
  }
}

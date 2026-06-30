import type {
  ChatMessage,
  LLMConfig,
  ToolDefinition,
  ToolCall,
  ToolResult,
  AgentStreamEvent,
  ResponseFormat,
} from '../../../src/shared/types'
import { detectProvider, buildAnthropicBody, buildGeminiBody } from './provider-router'
import { createLogger } from '../utils/logger'

const llmLog = createLogger('LLM')

// ── 对外接口 ──

export interface StreamChatOptions {
  config: LLMConfig
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  signal?: AbortSignal
  responseFormat?: ResponseFormat
  /** 启用 Prompt Cache（Anthropic cache_control） */
  enablePromptCache?: boolean
}

export interface StreamChatResult {
  content: string | null
  toolCalls: ToolCall[]
  usage: { promptTokens: number; completionTokens: number; cacheReadTokens?: number; cacheCreationTokens?: number } | null
  /** LLM 停止原因：stop=正常结束, length/max_tokens=截断, tool_calls=工具调用 */
  stopReason?: string
}

/**
 * 流式调用 LLM，支持 failover 降级。
 * 主模型失败时，按 config.fallbackModels 顺序自动重试备用模型。
 */
export async function* streamChat(
  options: StreamChatOptions,
): AsyncGenerator<AgentStreamEvent, StreamChatResult> {
  const { config } = options
  const fallbacks = config.fallbackModels ?? []

  try {
    return yield* streamChatSingle(options)
  } catch (err) {
    if (fallbacks.length === 0) throw err
    llmLog.warn('Primary model failed, attempting failover', {
      model: config.model,
      error: err instanceof Error ? err.message : String(err),
      fallbackCount: fallbacks.length,
    })
  }

  for (let i = 0; i < fallbacks.length; i++) {
    const fb = fallbacks[i]
    const fbConfig = {
      ...config,
      model: fb.model,
      baseUrl: fb.baseUrl ?? config.baseUrl,
      apiKey: fb.apiKey ?? config.apiKey,
      provider: fb.provider ?? config.provider,
      fallbackModels: undefined,
    }
    try {
      llmLog.info(`Failover attempt ${i + 1}/${fallbacks.length}`, { model: fb.model })
      yield { type: 'text', content: `\n\n> ⚡ 主模型不可用，已切换到 ${fb.model}\n\n` }
      return yield* streamChatSingle({ ...options, config: fbConfig })
    } catch (fbErr) {
      llmLog.warn(`Failover model failed: ${fb.model}`, {
        error: fbErr instanceof Error ? fbErr.message : String(fbErr),
      })
      if (i === fallbacks.length - 1) throw fbErr
    }
  }

  throw new Error('All models (primary + fallbacks) failed')
}

/**
 * 单模型流式调用（内部实现）。
 */
async function* streamChatSingle(
  options: StreamChatOptions,
): AsyncGenerator<AgentStreamEvent, StreamChatResult> {
  const { config, messages, tools, signal, responseFormat } = options
  const provider = detectProvider(config)

  if (provider === 'anthropic') {
    return yield* streamChatAnthropic(options)
  }

  if (provider === 'gemini') {
    return yield* streamChatGemini(options)
  }

  // OpenAI 兼容格式（也覆盖 DeepSeek / Groq / OpenRouter 等）
  const stripImages = isVisionDenied(config) || !hasImages(messages)

  const buildBody = (strip: boolean) => {
    const b: Record<string, unknown> = {
      model: config.model,
      messages: buildAPIMessages(messages, { stripImages: strip }),
      stream: true,
      stream_options: { include_usage: true },
    }
    if (config.temperature !== undefined) b.temperature = config.temperature
    if (config.topP !== undefined) b.top_p = config.topP
    if (config.maxTokens !== undefined) b.max_tokens = config.maxTokens
    if (responseFormat && responseFormat.type !== 'text') b.response_format = responseFormat
    if (tools && tools.length > 0) b.tools = tools.map(toOpenAITool)
    return b
  }

  const doFetch = async (body: Record<string, unknown>) => {
    return fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })
  }

  let response = await doFetch(buildBody(stripImages))

  // Vision 动态降级：如果带图片发送失败且是 vision 相关错误，自动去图片重试
  if (!response.ok && !stripImages && hasImages(messages)) {
    const error = await response.text()
    if (isVisionRelatedError(error)) {
      llmLog.warn('Vision not supported, retrying without images', { model: config.model })
      markVisionDenied(config)
      response = await doFetch(buildBody(true))
    } else {
      throw new Error(`LLM API error (${response.status}): ${error}`)
    }
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LLM API error (${response.status}): ${error}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''

  let contentAcc = ''
  const toolCallsAcc: Map<number, { id: string; name: string; arguments: string }> = new Map()
  let usage: { promptTokens: number; completionTokens: number } | null = null
  let stopReason: string | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue

      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(data)
      } catch {
        continue
      }

      // usage 统计（某些模型在最后一个 chunk 里返回）
      const u = parsed.usage as Record<string, number> | undefined
      if (u) {
        usage = {
          promptTokens: u.prompt_tokens ?? 0,
          completionTokens: u.completion_tokens ?? 0,
        }
      }

      const choices = parsed.choices as Array<Record<string, unknown>> | undefined
      if (!choices || choices.length === 0) continue

      const finishReason = choices[0].finish_reason as string | undefined
      if (finishReason) stopReason = finishReason

      const delta = choices[0].delta as Record<string, unknown> | undefined
      if (!delta) continue

      // 文本内容
      const textContent = delta.content as string | undefined
      if (textContent) {
        contentAcc += textContent
        yield { type: 'text', content: textContent }
      }

      // reasoning / thinking（部分模型支持）
      const reasoning = (delta as Record<string, unknown>).reasoning_content as string | undefined
      if (reasoning) {
        yield { type: 'thinking', content: reasoning }
      }

      // tool_calls delta — 边流式边 yield
      const tcDeltas = delta.tool_calls as Array<Record<string, unknown>> | undefined
      if (tcDeltas) {
        for (const tcDelta of tcDeltas) {
          const index = tcDelta.index as number
          const fn = tcDelta.function as Record<string, unknown> | undefined
          const existing = toolCallsAcc.get(index)

          if (!existing) {
            const id = (tcDelta.id as string) || ''
            const name = (fn?.name as string) || ''
            const argChunk = (fn?.arguments as string) || ''
            toolCallsAcc.set(index, { id, name, arguments: argChunk })
            yield { type: 'tool_call_delta', index, id: id || undefined, name: name || undefined, argumentsDelta: argChunk }
          } else {
            const argChunk = (fn?.arguments as string) || ''
            if (argChunk) {
              existing.arguments += argChunk
              yield { type: 'tool_call_delta', index, argumentsDelta: argChunk }
            }
          }
        }
      }
    }
  }

  if (usage) {
    yield { type: 'usage', promptTokens: usage.promptTokens, completionTokens: usage.completionTokens }
  }

  const toolCalls: ToolCall[] = Array.from(toolCallsAcc.values()).map((tc) => ({
    id: tc.id,
    name: tc.name,
    arguments: tc.arguments,
  }))

  return {
    content: contentAcc || null,
    toolCalls,
    usage,
    stopReason,
  }
}

// ── 内部工具函数 ──

/** 将 ChatMessage[] 转为 OpenAI API 格式 */
function buildAPIMessages(
  messages: ChatMessage[],
  opts?: { stripImages?: boolean },
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = []
  const stripImages = opts?.stripImages ?? false

  for (const msg of messages) {
    if (msg.role === 'user' || msg.role === 'system') {
      if (msg.images && msg.images.length > 0) {
        if (stripImages) {
          const placeholders = msg.images.map(img => `[图片: ${img.fileName || '附件'}]`).join(' ')
          const text = [msg.content, placeholders].filter(Boolean).join('\n')
          result.push({ role: msg.role, content: text })
        } else {
          const contentParts: Record<string, unknown>[] = []
          if (msg.content) {
            contentParts.push({ type: 'text', text: msg.content })
          }
          for (const img of msg.images) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: img.dataUrl, detail: 'auto' },
            })
          }
          result.push({ role: msg.role, content: contentParts })
        }
      } else {
        result.push({ role: msg.role, content: msg.content })
      }
    } else if (msg.role === 'assistant') {
      const apiMsg: Record<string, unknown> = { role: 'assistant' }
      if (msg.content) apiMsg.content = msg.content
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        apiMsg.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        }))
      }
      result.push(apiMsg)
    } else if (msg.role === 'tool') {
      result.push({
        role: 'tool',
        tool_call_id: msg.toolCallId,
        content: msg.content,
      })
    }
  }

  return result
}

/**
 * 动态 Vision 支持检测 — 基于缓存的乐观策略。
 *
 * 1. 默认乐观（假设支持图片）
 * 2. 首次 API 返回 image_url 相关错误时标记为不支持
 * 3. 结果按 model+baseUrl 缓存，后续直接使用
 */
const visionDenyCache = new Set<string>()

function getVisionCacheKey(config: LLMConfig): string {
  return `${config.baseUrl}::${config.model}`
}

function isVisionDenied(config: LLMConfig): boolean {
  return visionDenyCache.has(getVisionCacheKey(config))
}

function markVisionDenied(config: LLMConfig): void {
  const key = getVisionCacheKey(config)
  visionDenyCache.add(key)
  llmLog.info('Vision support marked as denied', { model: config.model, baseUrl: config.baseUrl })
}

function isVisionRelatedError(errorText: string): boolean {
  const lower = errorText.toLowerCase()
  return lower.includes('image_url') ||
    lower.includes('unknown variant') ||
    lower.includes('invalid content type') ||
    lower.includes('does not support image') ||
    lower.includes('multimodal') ||
    lower.includes('vision')
}

function hasImages(messages: ChatMessage[]): boolean {
  return messages.some(m => m.images && m.images.length > 0)
}

/** 将我们的 ToolDefinition 转为 OpenAI tools 格式 */
function toOpenAITool(tool: ToolDefinition): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }
}

/** 构建 tool_result 消息（给下一轮 LLM 调用用） */
export function buildToolResultMessages(results: ToolResult[]): Record<string, unknown>[] {
  return results.map((r) => ({
    role: 'tool',
    tool_call_id: r.callId,
    content: r.content,
  }))
}

// ── Anthropic SSE 流式适配 ──

async function* streamChatAnthropic(
  options: StreamChatOptions,
): AsyncGenerator<AgentStreamEvent, StreamChatResult> {
  const { config, messages, tools, signal, enablePromptCache } = options
  const stripImages = isVisionDenied(config) || !hasImages(messages)
  const apiMessages = buildAPIMessages(messages, { stripImages })
  const openaiTools = tools ? tools.map(toOpenAITool) : undefined
  const { url, headers, body } = buildAnthropicBody(config, apiMessages, openaiTools, { enablePromptCache })

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error (${response.status}): ${error}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''
  let contentAcc = ''
  const toolCallsAcc: Map<string, { id: string; name: string; arguments: string }> = new Map()
  let usage: StreamChatResult['usage'] = null
  let stopReason: string | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)

      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(data)
      } catch {
        continue
      }

      const eventType = parsed.type as string

      if (eventType === 'content_block_start') {
        const contentBlock = parsed.content_block as Record<string, unknown>
        if (contentBlock?.type === 'tool_use') {
          const idx = String(parsed.index)
          toolCallsAcc.set(idx, {
            id: contentBlock.id as string,
            name: contentBlock.name as string,
            arguments: '',
          })
          yield { type: 'tool_call_delta', index: Number(idx), id: contentBlock.id as string, name: contentBlock.name as string, argumentsDelta: '' }
        }
      }

      if (eventType === 'content_block_delta') {
        const delta = parsed.delta as Record<string, unknown>
        if (delta?.type === 'text_delta') {
          const text = delta.text as string
          contentAcc += text
          yield { type: 'text', content: text }
        }
        if (delta?.type === 'input_json_delta') {
          const partial = delta.partial_json as string || ''
          const toolIdx = String((parsed as Record<string, unknown>).index)
          const existing = toolCallsAcc.get(toolIdx)
          if (existing) {
            existing.arguments += partial
            yield { type: 'tool_call_delta', index: Number(toolIdx), argumentsDelta: partial }
          }
        }
      }

      if (eventType === 'message_delta') {
        const delta = (parsed as Record<string, unknown>).delta as Record<string, unknown> | undefined
        if (delta?.stop_reason) {
          stopReason = delta.stop_reason as string
        }
        const u = (parsed as Record<string, unknown>).usage as Record<string, number> | undefined
        if (u) {
          usage = {
            promptTokens: usage?.promptTokens || 0,
            completionTokens: u.output_tokens ?? 0,
          }
        }
      }

      if (eventType === 'message_start') {
        const msg = (parsed as Record<string, unknown>).message as Record<string, unknown> | undefined
        const u = msg?.usage as Record<string, number> | undefined
        if (u) {
          usage = {
            promptTokens: u.input_tokens ?? 0,
            completionTokens: u.output_tokens ?? 0,
            cacheReadTokens: u.cache_read_input_tokens,
            cacheCreationTokens: u.cache_creation_input_tokens,
          }
        }
      }
    }
  }

  if (usage) {
    yield { type: 'usage', promptTokens: usage.promptTokens, completionTokens: usage.completionTokens }
    if (usage.cacheReadTokens || usage.cacheCreationTokens) {
      llmLog.info('Prompt cache stats', {
        cacheRead: usage.cacheReadTokens ?? 0,
        cacheCreation: usage.cacheCreationTokens ?? 0,
      })
    }
  }

  const toolCalls: ToolCall[] = Array.from(toolCallsAcc.values()).map(tc => ({
    id: tc.id,
    name: tc.name,
    arguments: tc.arguments,
  }))

  return { content: contentAcc || null, toolCalls, usage, stopReason }
}

// ── Gemini SSE 流式适配 ──

async function* streamChatGemini(
  options: StreamChatOptions,
): AsyncGenerator<AgentStreamEvent, StreamChatResult> {
  const { config, messages, tools, signal } = options
  const stripImages = isVisionDenied(config) || !hasImages(messages)
  const apiMessages = buildAPIMessages(messages, { stripImages })
  const openaiTools = tools ? tools.map(toOpenAITool) : undefined
  const { url, headers, body } = buildGeminiBody(config, apiMessages, openaiTools)

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${error}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''
  let contentAcc = ''
  const toolCallsAcc: Map<number, { id: string; name: string; arguments: string }> = new Map()
  let usage: StreamChatResult['usage'] = null
  let stopReason: string | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)

      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(data)
      } catch {
        continue
      }

      const candidates = parsed.candidates as Array<Record<string, unknown>> | undefined
      if (candidates && candidates.length > 0) {
        const finishReason = candidates[0].finishReason as string | undefined
        if (finishReason) {
          stopReason = finishReason === 'MAX_TOKENS' ? 'max_tokens' : finishReason.toLowerCase()
        }

        const content = candidates[0].content as Record<string, unknown> | undefined
        const parts = content?.parts as Array<Record<string, unknown>> | undefined

        if (parts) {
          for (const part of parts) {
            if (part.text) {
              const text = part.text as string
              contentAcc += text
              yield { type: 'text', content: text }
            }

            if (part.functionCall) {
              const fc = part.functionCall as Record<string, unknown>
              const idx = toolCallsAcc.size
              const id = `gemini_call_${idx}`
              const name = fc.name as string
              const fnArgs = JSON.stringify(fc.args || {})
              toolCallsAcc.set(idx, { id, name, arguments: fnArgs })
              yield { type: 'tool_call_delta', index: idx, id, name, argumentsDelta: fnArgs }
            }
          }
        }
      }

      const usageMeta = parsed.usageMetadata as Record<string, number> | undefined
      if (usageMeta) {
        usage = {
          promptTokens: usageMeta.promptTokenCount ?? 0,
          completionTokens: usageMeta.candidatesTokenCount ?? 0,
        }
      }
    }
  }

  if (usage) {
    yield { type: 'usage', promptTokens: usage.promptTokens, completionTokens: usage.completionTokens }
  }

  const toolCalls: ToolCall[] = Array.from(toolCallsAcc.values()).map(tc => ({
    id: tc.id,
    name: tc.name,
    arguments: tc.arguments,
  }))

  return { content: contentAcc || null, toolCalls, usage, stopReason }
}

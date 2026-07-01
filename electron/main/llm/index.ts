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

/**
 * 携带 HTTP 状态码和服务端 retry-after 的 LLM 错误。
 *
 * 纯字符串 Error 会丢掉 429/503 响应里的 `retry-after` header，
 * 导致上层重试只能盲目指数退避。这个类把这些信息随错误一起传出去，
 * 让 loop 的重试能遵从服务端指定的等待时间（对照 CC withRetry.ts:530）。
 */
export class LLMError extends Error {
  status: number
  /** 服务端要求的重试等待毫秒数（来自 retry-after header），无则 undefined */
  retryAfterMs?: number
  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message)
    this.name = 'LLMError'
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * 从响应头解析 retry-after。
 * 支持两种格式：整数秒（`retry-after: 30`）或 HTTP 日期。
 * @returns 毫秒数，解析不出则 undefined
 */
export function parseRetryAfterMs(response: Response): number | undefined {
  const raw = response.headers.get('retry-after')
  if (!raw) return undefined
  const asSeconds = Number(raw)
  if (Number.isFinite(asSeconds)) return asSeconds * 1000
  const asDate = Date.parse(raw)
  if (Number.isFinite(asDate)) {
    const delta = asDate - Date.now()
    return delta > 0 ? delta : undefined
  }
  return undefined
}

// ── 对外接口 ──

export interface StreamChatOptions {
  config: LLMConfig
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  signal?: AbortSignal
  responseFormat?: ResponseFormat
  /** 启用 Prompt Cache（Anthropic cache_control） */
  enablePromptCache?: boolean
  /** 调用方标识（用于日志归因和成本统计），如 'main' / 'summary' / 'profile' */
  caller?: string
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

  llmLog.info('streamChat start', {
    caller: options.caller ?? 'unknown',
    model: config.model,
    messageCount: options.messages.length,
    toolCount: options.tools?.length ?? 0,
  })

  try {
    return yield* streamChatSingle(options)
  } catch (err) {
    if (fallbacks.length === 0) throw err
    llmLog.warn('Primary model failed, attempting failover', {
      caller: options.caller ?? 'unknown',
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
      throw new LLMError(`LLM API error (${response.status}): ${error}`, response.status, parseRetryAfterMs(response))
    }
  }

  if (!response.ok) {
    const error = await response.text()
    throw new LLMError(`LLM API error (${response.status}): ${error}`, response.status, parseRetryAfterMs(response))
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
        // >0 guard：只在拿到正数时更新，防止代理在中间 chunk 塞 0 值覆盖真实统计
        usage = {
          promptTokens: (u.prompt_tokens ?? 0) > 0 ? u.prompt_tokens : (usage?.promptTokens ?? 0),
          completionTokens: (u.completion_tokens ?? 0) > 0 ? u.completion_tokens : (usage?.completionTokens ?? 0),
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
    throw new LLMError(`Anthropic API error (${response.status}): ${error}`, response.status, parseRetryAfterMs(response))
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
          // 合并更新而非重建：message_delta 只带 output_tokens，
          // input_tokens / cache tokens 来自更早的 message_start，必须保留。
          // 且用 >0 guard 防止 delta 的 0 值覆盖 start 的真实值（对照 CC claude.ts:2924）。
          usage = {
            ...(usage ?? { promptTokens: 0, completionTokens: 0 }),
            completionTokens: u.output_tokens > 0 ? u.output_tokens : (usage?.completionTokens ?? 0),
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

// ── 非流式便捷入口 ──

export interface ChatCompleteOptions {
  config: LLMConfig
  /** 简单的对话消息（system / user / assistant），辅助调用无需完整 ChatMessage */
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  /** 覆盖温度（辅助调用通常用低温） */
  temperature?: number
  /** 覆盖最大输出 token */
  maxTokens?: number
  /** 调用方标识，用于日志归因（如 'summary' / 'profile' / 'title'） */
  caller?: string
  /** 超时（毫秒）。非流式无中间反馈，默认放宽到 120s */
  timeoutMs?: number
  /** 外部中断信号，与超时信号合并 */
  signal?: AbortSignal
}

/**
 * 非流式 LLM 调用 —— 辅助场景（摘要 / 画像提取 / 标题生成）的统一入口。
 *
 * 设计（对照 CC queryModelWithoutStreaming / Alice 单一流式接口）：
 * 内部复用 streamChat 的完整路由链（三家 Provider 适配 + Vision 降级 + failover），
 * 把流式生成器消费到结束、只取最终文本。不为非流式单独维护一套请求/解析逻辑。
 *
 * 与 streamChat 的差异：
 * - 不传 tools（辅助调用不需要工具）
 * - 丢弃流式事件，只 return 完整字符串
 * - 独立放宽超时（非流式没有 token 心跳）
 *
 * @returns 模型输出的完整文本；失败或空结果时抛出错误由调用方兜底
 */
export async function chatComplete(options: ChatCompleteOptions): Promise<string> {
  const { config, messages, temperature, maxTokens, caller, timeoutMs = 120_000, signal } = options

  // 合并「外部中断」和「超时」两个信号
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal

  // 用调用方指定的温度/上限覆盖 config，收敛为一次性调用
  const callConfig: LLMConfig = {
    ...config,
    temperature: temperature ?? config.temperature,
    maxTokens: maxTokens ?? config.maxTokens,
    fallbackModels: config.fallbackModels,
  }

  const chatMessages: ChatMessage[] = messages.map((m, i) => ({
    id: `cc_${i}`,
    role: m.role,
    content: m.content,
    timestamp: Date.now(),
  }))

  const startedAt = Date.now()
  // 消费整个流式生成器，只取最终结果（方案 A：流式收敛）
  const gen = streamChat({ config: callConfig, messages: chatMessages, signal: combinedSignal, caller })
  let result: StreamChatResult
  while (true) {
    const next = await gen.next()
    if (next.done) {
      result = next.value
      break
    }
    // 流式事件对辅助调用无用，直接丢弃
  }

  llmLog.info('chatComplete done', {
    caller: caller ?? 'unknown',
    model: callConfig.model,
    ms: Date.now() - startedAt,
    promptTokens: result.usage?.promptTokens ?? 0,
    completionTokens: result.usage?.completionTokens ?? 0,
  })

  const content = result.content?.trim()
  if (!content) {
    throw new Error(`chatComplete returned empty content (caller=${caller ?? 'unknown'})`)
  }
  return content
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
    throw new LLMError(`Gemini API error (${response.status}): ${error}`, response.status, parseRetryAfterMs(response))
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

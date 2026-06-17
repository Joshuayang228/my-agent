import type {
  ChatMessage,
  LLMConfig,
  ToolDefinition,
  ToolCall,
  ToolResult,
  AgentStreamEvent,
} from '../../../src/shared/types'
import { detectProvider, buildAnthropicBody } from './provider-router'

// ── 对外接口 ──

export interface StreamChatOptions {
  config: LLMConfig
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  signal?: AbortSignal
}

export interface StreamChatResult {
  content: string | null
  toolCalls: ToolCall[]
  usage: { promptTokens: number; completionTokens: number } | null
}

/**
 * 流式调用 LLM，边 yield 事件边积累最终结果。
 * 调用方通过 for-await 消费事件，循环结束后读 return value 拿完整结果。
 */
export async function* streamChat(
  options: StreamChatOptions,
): AsyncGenerator<AgentStreamEvent, StreamChatResult> {
  const { config, messages, tools, signal } = options
  const provider = detectProvider(config)

  if (provider === 'anthropic') {
    return yield* streamChatAnthropic(options)
  }

  // OpenAI 兼容格式（也覆盖 DeepSeek / Groq / OpenRouter 等）
  const body: Record<string, unknown> = {
    model: config.model,
    messages: buildAPIMessages(messages),
    stream: true,
    stream_options: { include_usage: true },
  }

  if (config.temperature !== undefined) body.temperature = config.temperature
  if (config.topP !== undefined) body.top_p = config.topP
  if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens

  if (tools && tools.length > 0) {
    body.tools = tools.map(toOpenAITool)
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  })

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

      // tool_calls delta
      const tcDeltas = delta.tool_calls as Array<Record<string, unknown>> | undefined
      if (tcDeltas) {
        for (const tcDelta of tcDeltas) {
          const index = tcDelta.index as number
          const existing = toolCallsAcc.get(index)

          if (!existing) {
            toolCallsAcc.set(index, {
              id: (tcDelta.id as string) || '',
              name: ((tcDelta.function as Record<string, unknown>)?.name as string) || '',
              arguments: ((tcDelta.function as Record<string, unknown>)?.arguments as string) || '',
            })
          } else {
            const fn = tcDelta.function as Record<string, unknown> | undefined
            if (fn?.arguments) {
              existing.arguments += fn.arguments as string
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
  }
}

// ── 内部工具函数 ──

/** 将 ChatMessage[] 转为 OpenAI API 格式 */
function buildAPIMessages(messages: ChatMessage[]): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = []

  for (const msg of messages) {
    if (msg.role === 'user' || msg.role === 'system') {
      result.push({ role: msg.role, content: msg.content })
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
  const { config, messages, tools, signal } = options
  const apiMessages = buildAPIMessages(messages)
  const openaiTools = tools ? tools.map(toOpenAITool) : undefined
  const { url, headers, body } = buildAnthropicBody(config, apiMessages, openaiTools)

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
  let usage: { promptTokens: number; completionTokens: number } | null = null

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

      if (eventType === 'content_block_delta') {
        const delta = parsed.delta as Record<string, unknown>
        if (delta?.type === 'text_delta') {
          const text = delta.text as string
          contentAcc += text
          yield { type: 'text', content: text }
        }
        if (delta?.type === 'input_json_delta') {
          const partial = delta.partial_json as string
          const toolId = (parsed as Record<string, unknown>).index as string
          const existing = toolCallsAcc.get(toolId)
          if (existing) existing.arguments += partial || ''
        }
      }

      if (eventType === 'content_block_start') {
        const contentBlock = parsed.content_block as Record<string, unknown>
        if (contentBlock?.type === 'tool_use') {
          const idx = String(parsed.index)
          toolCallsAcc.set(idx, {
            id: contentBlock.id as string,
            name: contentBlock.name as string,
            arguments: '',
          })
        }
      }

      if (eventType === 'message_delta') {
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
          }
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

  return { content: contentAcc || null, toolCalls, usage }
}

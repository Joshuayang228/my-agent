/**
 * Provider 请求构造纯函数。
 *
 * 背景：OpenAI 请求体曾藏在 streamChatSingle 闭包中，Debug 无法验证真实字段而只能复制说明。
 * 设计意图：三协议适配器都通过可测试的纯构造器形成请求；网络发送仍由 llm/index.ts 负责。
 * 关键约束：构造器会携带传入的 API Key，调用方不得把返回 headers / URL 原样写入日志或资产目录。
 */

import type {
  ChatMessage,
  LLMConfig,
  ResponseFormat,
  ToolDefinition,
} from '../../../src/shared/types'

/** 将 ChatMessage[] 转为 OpenAI 兼容消息格式，供三家适配器继续转换。 */
export function buildOpenAICompatibleMessages(
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
          if (msg.content) contentParts.push({ type: 'text', text: msg.content })
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

/** 将 inputExamples 拼到工具描述末尾，三家 Provider 共用同一文本。 */
export function appendExamplesToDescription(tool: ToolDefinition): string {
  if (!tool.inputExamples || tool.inputExamples.length === 0) return tool.description
  const examples = tool.inputExamples
    .map((example, index) => `示例 ${index + 1}：${JSON.stringify(example)}`)
    .join('\n')
  return `${tool.description}\n\n输入示例：\n${examples}`
}

/** 将 ToolDefinition 转为 OpenAI tools 格式，Anthropic / Gemini 再从该中间形态映射。 */
export function toOpenAITool(tool: ToolDefinition): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: appendExamplesToDescription(tool),
      parameters: tool.parameters,
    },
  }
}

/**
 * 构造 OpenAI Compatible Chat Completions 请求。
 *
 * 背景：运行时需要在 Vision 首次失败后用同一参数去图重试。
 * 设计意图：把 URL、认证方式和 body 放进同一纯函数，首次请求与降级请求只改变 stripImages。
 * 关键约束：返回值包含 Authorization；只允许交给 fetch，Debug 资产必须自行脱敏摘要。
 */
export function buildOpenAIRequest(input: {
  config: LLMConfig
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  responseFormat?: ResponseFormat
  stripImages?: boolean
}): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
  const { config, messages, tools, responseFormat } = input
  const body: Record<string, unknown> = {
    model: config.model,
    messages: buildOpenAICompatibleMessages(messages, { stripImages: input.stripImages }),
    stream: true,
    stream_options: { include_usage: true },
  }
  if (config.temperature !== undefined) body.temperature = config.temperature
  if (config.topP !== undefined) body.top_p = config.topP
  if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens
  if (config.thinking) body.thinking = config.thinking
  if (responseFormat && responseFormat.type !== 'text') body.response_format = responseFormat
  if (tools && tools.length > 0) body.tools = tools.map(toOpenAITool)

  return {
    url: `${config.baseUrl}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body,
  }
}

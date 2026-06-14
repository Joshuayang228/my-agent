// ── 消息 ──

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  /** assistant 消息可能携带工具调用 */
  toolCalls?: ToolCall[]
  /** tool 消息关联的 tool_call id */
  toolCallId?: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface ToolResult {
  callId: string
  name: string
  content: string
  isError?: boolean
}

// ── 工具定义 ──

export interface ToolParameter {
  type: string
  description?: string
  enum?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameter>
    required?: string[]
  }
  metadata: ToolMetadata
  execute: (args: Record<string, unknown>) => Promise<string>
}

export interface ToolMetadata {
  isReadOnly: boolean
  isDestructive: boolean
  isConcurrencySafe: boolean
}

// ── LLM ──

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
}

/** LLM 单轮返回的结构化结果 */
export interface LLMResponse {
  content: string | null
  toolCalls: ToolCall[]
}

// ── Agent Loop ──

export interface AgentLoopOptions {
  config: LLMConfig
  messages: ChatMessage[]
  tools: ToolDefinition[]
  systemPrompt?: string
  maxIterations?: number
  signal?: AbortSignal
  /** 破坏性工具执行前的确认回调，返回 true 允许执行 */
  confirmTool?: (name: string, args: Record<string, unknown>) => Promise<boolean>
}

export type AgentStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_start'; callId: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_end'; callId: string; name: string; result: string; isError?: boolean }
  | { type: 'tool_confirm'; callId: string; name: string; args: Record<string, unknown> }
  | { type: 'usage'; promptTokens: number; completionTokens: number }
  | { type: 'error'; message: string }
  | { type: 'done' }

// ── 人格 ──

export interface PersonaConfig {
  id: string
  name: string
  description: string
}

// ── 会话 ──

export interface ChatSession {
  id: string
  messages: ChatMessage[]
  createdAt: number
}

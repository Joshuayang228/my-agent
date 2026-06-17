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

export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'auto'

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature?: number
  topP?: number
  maxTokens?: number
  /** Provider 类型（auto = 根据 baseUrl 自动检测） */
  provider?: LLMProvider
}

/** LLM 单轮返回的结构化结果 */
export interface LLMResponse {
  content: string | null
  toolCalls: ToolCall[]
}

// ── Agent Loop ──

export type ExecutionMode = 'auto' | 'confirm-all' | 'plan-first'

export interface AgentLoopOptions {
  config: LLMConfig
  messages: ChatMessage[]
  tools: ToolDefinition[]
  systemPrompt?: string
  maxIterations?: number
  signal?: AbortSignal
  /** 破坏性工具执行前的确认回调，返回 true 允许执行 */
  confirmTool?: (name: string, args: Record<string, unknown>) => Promise<boolean>
  /** 每次迭代前动态过滤可用工具（如 Skill allowed_tools 限制） */
  filterTools?: (tools: ToolDefinition[]) => ToolDefinition[]
  /** 执行模式：auto=自动(仅破坏性确认) | confirm-all=全部确认 | plan-first=先计划后执行 */
  executionMode?: ExecutionMode
}

export type AgentStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
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

// ── 记忆 ──

export type MemoryCategory = 'identity' | 'preference' | 'fact' | 'workflow' | 'voice'

export interface MemoryEntry {
  id: string
  category: MemoryCategory
  content: string
  createdAt: number
  updatedAt: number
}

// ── 会话 ──

export interface ChatSession {
  id: string
  messages: ChatMessage[]
  createdAt: number
}

// ── Skill 系统 ──

export interface SkillFrontmatter {
  name: string
  description: string
  when_to_use?: string
  allowed_tools?: string[]
  disable_model_invocation?: boolean
  version?: string
}

export interface SkillDefinition {
  /** Frontmatter 元数据 */
  meta: SkillFrontmatter
  /** Skill 正文（Markdown） */
  body: string
  /** 文件路径 */
  filePath: string
  /** 来源：内置 / 用户 */
  source: 'builtin' | 'user'
}

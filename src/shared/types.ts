// ── 消息 ──

export interface ImageAttachment {
  /** base64 编码的图片数据（data:image/png;base64,...） */
  dataUrl: string
  /** MIME 类型 */
  mimeType: string
  /** 文件名（可选） */
  fileName?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  /** assistant 消息可能携带工具调用 */
  toolCalls?: ToolCall[]
  /** tool 消息关联的 tool_call id */
  toolCallId?: string
  /** 图片附件（多模态消息） */
  images?: ImageAttachment[]
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
  execute: (args: Record<string, unknown>, ctx?: ToolContext) => Promise<string>
  /**
   * 工具结果大小上限（字符数）。超过此值时，结果将被写入临时文件，返回文件路径。
   *
   * 默认值：50,000
   * 特殊值：Infinity = 永不落盘（如 file_read，防止循环：读文件 → 写临时文件 → 读临时文件）
   */
  maxResultSizeChars?: number
}

/**
 * buildTool() 的输入类型 — metadata 字段全部可选，工厂函数负责填充 fail-closed 默认值：
 * - isReadOnly: false（假设会写状态）
 * - isDestructive: false
 * - isConcurrencySafe: false（假设不可并发）
 * - maxResultSizeChars: 50_000
 */
export interface ToolDef {
  name: string
  description: string
  parameters: ToolDefinition['parameters']
  metadata?: Partial<ToolMetadata>
  execute: ToolDefinition['execute']
  maxResultSizeChars?: number
}

export interface ToolMetadata {
  isReadOnly: boolean
  isDestructive: boolean
  isConcurrencySafe: boolean
}

/** 工具执行时注入的运行时上下文 */
export interface ToolContext {
  /** 当前工作区根目录 */
  workdir: string
  /** 当前会话 ID */
  sessionId: string
  /** 取消信号 */
  signal?: AbortSignal
}

// ── LLM ──

export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'auto'

export type ResponseFormat =
  | { type: 'text' }
  | { type: 'json_object' }
  | { type: 'json_schema'; json_schema: { name: string; strict?: boolean; schema: Record<string, unknown> } }

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature?: number
  topP?: number
  maxTokens?: number
  /** Provider 类型（auto = 根据 baseUrl 自动检测） */
  provider?: LLMProvider
  /** 备用模型列表，主模型失败时按序降级 */
  fallbackModels?: FallbackModelConfig[]
}

export interface FallbackModelConfig {
  model: string
  baseUrl?: string
  apiKey?: string
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
  /** 工具执行上下文（workdir/sessionId/signal），注入到所有工具 */
  toolContext?: ToolContext
}

/** Agent 循环终止原因 */
export type TerminalReason =
  | 'completed'         // LLM 返回纯文本，正常结束
  | 'max_turns'         // 达到最大迭代次数
  | 'aborted'           // 被 AbortSignal 取消
  | 'prompt_too_long'   // 413 压缩后仍超限
  | 'model_error'       // LLM 调用不可恢复错误

export type AgentStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'tool_call_delta'; index: number; id?: string; name?: string; argumentsDelta: string }
  | { type: 'tool_start'; callId: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_end'; callId: string; name: string; result: string; isError?: boolean }
  | { type: 'tool_confirm'; callId: string; name: string; args: Record<string, unknown> }
  | { type: 'usage'; promptTokens: number; completionTokens: number }
  | { type: 'error'; message: string }
  | { type: 'done'; reason: TerminalReason }

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

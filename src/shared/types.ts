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
  /** 压缩边界标记元数据（由上下文压缩系统写入，供调试/可观测性使用） */
  compactMetadata?: CompactMetadata
  /** 本轮注入的记忆引用芯片（M29-G1；会话持久化可选，UI 可先挂本地） */
  memoryCitations?: MemoryCitation[]
}

/** 本轮向量召回命中（注入 Prompt 的那批，已去 mem- 镜像） */
export interface MemoryCitation {
  id: string
  category: string
  /** 短摘要（截断正文） */
  summary: string
  score?: number
}

/** Prompt 资产目录的 IPC 数据契约；正文仍由主进程生产代码或 Role Pack 提供。 */
export type PromptAssetKind =
  | 'system'
  | 'context'
  | 'companion'
  | 'subagent'
  | 'ui'
  | 'tool'
  | 'skill'
  | 'eval'
  | 'external'
  | 'memory'
  | 'permission'
  | 'provider'
export type PromptAssetMode = 'static' | 'dynamic'
export type ModelContextAssetType =
  | 'prompt'
  | 'tool-schema'
  | 'skill'
  | 'eval-judge'
  | 'eval-case'
  | 'eval-grader'
  | 'companion-manifest'
  | 'companion-profile'
  | 'companion-world'
  | 'companion-scene'
  | 'companion-life'
  | 'memory-strategy'
  | 'permission-policy'
  | 'sandbox-policy'
  | 'provider-capability'
  | 'provider-policy'
  | 'provider-preset'
export type ModelContextOwnership = 'builtin' | 'role-pack' | 'user' | 'external'
export type ModelContextFingerprintKind = 'content' | 'structure'
export type ModelContextContentKind = 'static' | 'template' | 'schema' | 'data' | 'runtime'
export type AgentAssetStatus = 'active' | 'disabled' | 'deprecated' | 'experimental'

declare const promptAssetKeyBrand: unique symbol
export type PromptAssetKey = string & { readonly [promptAssetKeyBrand]: true }
export type PromptAssetKeyList = readonly [PromptAssetKey, ...PromptAssetKey[]]

export interface PromptSlot {
  name: string
  source: string
  lifecycle: string
}

export interface PromptLocaleAsset {
  /** 静态正文或动态模板骨架；最终插槽值仍以真实调用记录为准。 */
  template?: string
}

export interface PromptAsset {
  /** 稳定语义标识；文案改动和文件移动不得随意改变。 */
  key: string
  /** 兼容现有 Debug UI 的展示标识；新代码应以 key 为索引。 */
  id: string
  name: string
  category: PromptAssetKind
  purpose: string
  role: string
  desc: string
  /** 生产来源的可读路径或组装器标识。 */
  source: string
  /** 兼容现有 UI 的来源字段，与 source 保持一致。 */
  sourcePath: string
  version: string
  /** 自动指纹；静态资产基于正文，动态资产基于模板或结构描述。 */
  fingerprint: string
  fingerprintKind: ModelContextFingerprintKind
  assetType: ModelContextAssetType
  ownership: ModelContextOwnership
  contentKind: ModelContextContentKind
  mode: PromptAssetMode
  locale: string
  locales: Record<string, PromptLocaleAsset>
  slots: PromptSlot[]
  /** 生产资产生命周期；旧 Prompt 资产缺省视为 active。 */
  status?: AgentAssetStatus
  /** 派生资产指向其稳定来源 key；只用于追踪，不复制来源正文。 */
  derivedFrom?: string
  /** 影响该资产生成或解释的其他稳定资产 key。 */
  dependencies?: string[]
  preview?: string
  content?: string
  /** 兼容旧调用方；新代码应读取 mode。 */
  dynamic?: boolean
}

export type PromptAssetTrace = Pick<
  PromptAsset,
  | 'key'
  | 'purpose'
  | 'role'
  | 'source'
  | 'version'
  | 'fingerprint'
  | 'fingerprintKind'
  | 'locale'
  | 'mode'
  | 'slots'
>

export type ModelContextAsset = PromptAsset

export type AgentAssetUsageRelation = 'used' | 'available' | 'triggered' | 'matched'
export type AgentAssetUsageKind =
  | 'llm-input'
  | 'provider-route'
  | 'provider-policy'
  | 'tool-available'
  | 'tool-execution'
  | 'skill-activation'
  | 'memory-operation'
  | 'permission-decision'
export type AgentAssetUsageStatus = 'running' | 'success' | 'error' | 'blocked' | 'denied'
export type AgentAssetUsageMetadataValue = string | number | boolean | string[]

/** 真实运行节点与生产资产稳定 key 的脱敏关联；不承载 Prompt、参数或用户数据正文。 */
export interface AgentAssetUsageEvidence {
  id: string
  assetKey: string
  assetName: string
  assetType: ModelContextAssetType
  assetVersion: string
  assetFingerprint: string
  relation: AgentAssetUsageRelation
  usageKind: AgentAssetUsageKind
  sessionId?: string
  interactionSpanId?: string
  spanId: string
  parentSpanId?: string
  occurredAt: number
  status: AgentAssetUsageStatus
  metadata: Record<string, AgentAssetUsageMetadataValue>
}

export interface AgentAssetUsageQuery {
  assetKey?: string
  spanId?: string
  sessionId?: string
  interactionSpanId?: string
  usageKind?: AgentAssetUsageKind
  limit?: number
  offset?: number
}

export interface AgentAssetUsageQueryResult {
  records: AgentAssetUsageEvidence[]
  total: number
}

export interface DebugPromptSnapshot {
  full: string
  layers: { l1: string; l2: string; l3: string; l4: string }
  persona: { id: string; name: string }
  charCount: number
  estimatedTokens: number
  /** 本次当前装配实际引用的 Prompt 资产，不等同于完整目录。 */
  assets: PromptAssetTrace[]
}

/** 压缩边界元数据 — 标记一次压缩发生的位置与效果 */
export interface CompactMetadata {
  /** 触发的压缩层级 */
  level: 'L3_Collapse' | 'L4_AutoCompact'
  /** 压缩前的估算 token 数 */
  preCompactTokens: number
  /** 压缩后的估算 token 数 */
  postCompactTokens: number
  /** 触发来源：主动检查 / 413 被动触发 */
  trigger: 'proactive' | 'reactive_413'
  /** 压缩发生时间戳 */
  compactedAt: number
  /** 是否使用了 LLM 摘要（false = 规则降级） */
  usedLLM: boolean
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
  /**
   * 工具调用示例（对照 Anthropic Advanced Tool Use：input_examples 使调用准确率 72%→90%）。
   * 每个示例是一组合法的参数对象，展示参数格式约定 / 可选参数组合 / 嵌套结构用法。
   * 序列化时追加到 description 末尾（拼文本对所有 provider 通用，不依赖某 provider 的特殊字段）。
   */
  inputExamples?: Array<Record<string, unknown>>
  /**
   * 工具别名（M04）：LLM 若用旧名/简称调用，Registry 解析到主 name。
   * 别名不得与其他工具主名或别名冲突。
   */
  aliases?: string[]
  /**
   * 运行时按参数解析元数据（M04 元数据函数化）。
   * 未提供时用静态 metadata；提供时在权限/并发决策前与静态字段浅合并。
   */
  resolveMetadata?: (args: Record<string, unknown>) => Partial<ToolMetadata>
}

// ── LLM Debug 持久化（现有 tracer Span 的正文扩展）──

export interface LLMCallSummary {
  id: string
  sessionId?: string
  parentSpanId?: string
  startedAt: number
  endedAt?: number
  provider: string
  model: string
  caller: string
  status: 'pending' | 'success' | 'error'
  promptTokens: number
  completionTokens: number
  totalTokens: number
  toolCallCount: number
  cacheReadTokens: number
  cacheCreationTokens: number
  durationMs: number
  error?: string
}

export interface LLMCallDetail extends LLMCallSummary {
  requestMessages: unknown
  requestTools: unknown
  requestExtra: Record<string, unknown>
  responseContent?: string | null
  responseReasoning?: string
  responseToolCalls: unknown
}

export interface LLMCallQuery {
  sessionId?: string
  includeSubagents?: boolean
  caller?: string
  model?: string
  status?: LLMCallSummary['status']
  /** 仅搜索未加密元数据；请求/响应正文通过详情接口懒加载。 */
  search?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface LLMCallQueryResult {
  records: LLMCallSummary[]
  total: number
  storageBytes: number
}

export interface LLMSubagentSession {
  debugSessionId: string
  mainSessionId: string
  role: string
  parentSpanId?: string
  createdAt: number
}

export type LLMCallEvent =
  | { type: 'started' | 'updated' | 'ended'; record: LLMCallSummary }
  | { type: 'cleared'; sessionId?: string }

// ── Debug Persona Eval 报告 ──

export interface PersonaEvalGraderResult {
  graderName: string
  result: {
    pass: boolean
    violations: string[]
    evidence: string[]
  }
}

export interface PersonaEvalMessageSnapshot {
  role: ChatMessage['role']
  content: string
}

/** 一次 Trial 实际交给 AgentLoop 的初始输入快照；不包含 API Key。 */
export interface PersonaEvalAgentInputSnapshot {
  model: string
  baseUrl: string
  executionMode: ExecutionMode
  systemPrompt: string
  messages: PersonaEvalMessageSnapshot[]
  toolNames: string[]
}

export interface PersonaEvalJudgeCheckSnapshot {
  id: string
  question: string
}

/** Model Judge 在 Agent 回复后收到的评分计划；全部 checks 在一次调用中判断。 */
export interface PersonaEvalJudgeSnapshot {
  graderName: string
  invocationMode: 'single-call'
  systemContext: string
  checks: PersonaEvalJudgeCheckSnapshot[]
}

export type HumanReviewRating = 1 | 2 | 3 | 4 | 5
export type HumanReviewIssueLevel = 'none' | 'minor' | 'major'
export type HumanReviewVerdict = 'pass' | 'revise' | 'uncertain'

/** 单个 Persona Eval Trial 的独立人工审阅记录；不参与自动 Eval 判定。 */
export interface PersonaEvalHumanReview {
  reportFileName: string
  scenarioId: string
  trialId: string
  naturalness?: HumanReviewRating
  roleConsistency?: HumanReviewRating
  emotionalAttunement?: HumanReviewRating
  forcedOptimism?: HumanReviewIssueLevel
  planPushing?: HumanReviewIssueLevel
  psychologicalDiagnosis?: HumanReviewIssueLevel
  templatedness?: HumanReviewIssueLevel
  verdict?: HumanReviewVerdict
  notes: string
  updatedAt: number
}

export type PersonaEvalHumanReviewInput = Omit<PersonaEvalHumanReview, 'updatedAt'>
export type PersonaEvalHumanReviewDeleteInput = Pick<PersonaEvalHumanReview, 'reportFileName' | 'scenarioId' | 'trialId'>
export type PersonaEvalHumanReviewSaveResult =
  | { ok: true; review: PersonaEvalHumanReview }
  | { ok: false; error: string }

export interface PersonaEvalTrialReport {
  id: string
  description: string
  pass: boolean
  durationMs: number
  graderResults: PersonaEvalGraderResult[]
  agentTexts: string[]
  /** 旧报告可能没有该字段；新报告保存本次真实 Agent 输入。 */
  agentInput?: PersonaEvalAgentInputSnapshot
  /** 旧报告可能没有该字段；新报告保存一次性 Judge 检查项。 */
  judge?: PersonaEvalJudgeSnapshot
  error?: string
  mode?: 'mock' | 'real'
}

export interface PersonaEvalScenarioReport {
  id: string
  description: string
  pass: boolean
  passes: number
  k: number
  trials: PersonaEvalTrialReport[]
}

export interface PersonaEvalReport {
  timestamp: string
  mode: 'real'
  model: string
  baseUrl: string
  pass: boolean
  totalScenarios: number
  passedScenarios: number
  k: number
  scenarios: PersonaEvalScenarioReport[]
}

export interface PersonaEvalReportSummary {
  fileName: string
  timestamp: string
  model: string
  baseUrl: string
  pass: boolean
  totalScenarios: number
  passedScenarios: number
  k: number
}

export interface DebugPersonaEvalReport extends PersonaEvalReport {
  fileName: string
}

export interface DebugPersonaEvalIndex {
  reportDir: string
  reports: PersonaEvalReportSummary[]
  latest: DebugPersonaEvalReport | null
  skippedFiles: number
}

export interface SkillEvalInputSnapshot {
  userPrompt: string
  model: string
  baseUrl: string
  skill: {
    name: string
    version: string
    source: 'builtin' | 'user'
    fingerprint: string
    toolName: string
  }
  expectedActivation: boolean
  allowedTools: string[]
}

export interface SkillEvalEvidence {
  activations: SkillActivationTrace[]
  toolCalls: string[]
  injectionObserved: boolean
  agentText: string
}

export interface SkillEvalCaseReport {
  id: string
  description: string
  pass: boolean
  durationMs: number
  input: SkillEvalInputSnapshot
  evidence: SkillEvalEvidence
  graderResults: PersonaEvalGraderResult[]
  error?: string
}

export interface SkillEvalReport {
  timestamp: string
  mode: 'mock' | 'real'
  model: string
  baseUrl: string
  pass: boolean
  totalCases: number
  passedCases: number
  cases: SkillEvalCaseReport[]
}

export interface SkillEvalReportSummary {
  fileName: string
  timestamp: string
  mode: 'mock' | 'real'
  model: string
  baseUrl: string
  pass: boolean
  totalCases: number
  passedCases: number
}

export interface DebugSkillEvalReport extends SkillEvalReport {
  fileName: string
}

export interface DebugSkillEvalIndex {
  reportDir: string
  reports: SkillEvalReportSummary[]
  latest: DebugSkillEvalReport | null
  skippedFiles: number
}

export type DebugEvalSuite = 'mock' | 'skill' | 'persona-real'
export type DebugEvalRunState = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface DebugEvalRunPlan {
  suite: DebugEvalSuite
  label: string
  command: string
  requiresConfirmation: boolean
  available: boolean
  unavailableReason?: string
  model?: string
  baseUrl?: string
  hasApiKey?: boolean
  passK?: number
  scenarioCount?: number
  estimatedAgentCalls?: number
  estimatedJudgeCalls?: number
}

export interface DebugEvalScenarioProgress {
  id: string
  completedTrials: number
  passedTrials: number
  totalTrials: number
  state: 'pending' | 'running' | 'passed' | 'failed'
}

export interface DebugEvalRunStatus {
  runId?: string
  suite?: DebugEvalSuite
  state: DebugEvalRunState
  startedAt?: number
  endedAt?: number
  exitCode?: number
  cancelRequested?: boolean
  output: string
  error?: string
  latestReportFile?: string
  completedTrials?: number
  totalTrials?: number
  scenarios?: DebugEvalScenarioProgress[]
}

export type DebugEvalRunEvent = { type: 'status'; status: DebugEvalRunStatus }

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
  inputExamples?: Array<Record<string, unknown>>
  aliases?: string[]
  resolveMetadata?: (args: Record<string, unknown>) => Partial<ToolMetadata>
}

export interface ToolMetadata {
  isReadOnly: boolean
  isDestructive: boolean
  isConcurrencySafe: boolean
  /** 长任务标记：跳过工具执行超时（如 delegate_task 会跑完整子 Agent 循环，远超 30s） */
  longRunning?: boolean
}

/** 工具内部实际触发权限 / 路径策略时上报的脱敏资产证据。 */
export interface ToolAssetUsageReport {
  assetKey: string
  relation: AgentAssetUsageRelation
  usageKind: AgentAssetUsageKind
  status: AgentAssetUsageStatus
  spanId?: string
  metadata?: Record<string, unknown>
}

export type ToolAssetUsageReporter = (report: ToolAssetUsageReport) => void

/** 工具执行时注入的运行时上下文 */
export interface ToolContext {
  /** 当前工作区根目录 */
  workdir: string
  /** 当前会话 ID */
  sessionId: string
  /** 取消信号 */
  signal?: AbortSignal
  /** 父 span ID，用于调用链嵌套（M7 tracing） */
  parentSpanId?: string
  /**
   * 工具注册表引用，供 delegate_task 等需要创建子 Agent 的工具使用。
   * 类型为 unknown 避免 shared/types.ts 循环 import 主进程模块，使用方按需断言。
   */
  registry?: unknown
  /** 父 Agent 执行模式 —— 供 delegate_task 传给子 Agent 实现权限只降不升（G4） */
  executionMode?: ExecutionMode
  /** 本会话绑定的主角（供 feedback 记忆分桶等） */
  roleId?: string
  /** 会话种别：召唤时子 Agent 须守 M26 任务工边界（M26-G2） */
  sessionKind?: 'main' | 'summon'
  /** 当前请求中已激活的 Skill；只记录来源和指纹元数据，不复制正文。 */
  skillActivations?: SkillActivationTrace[]
  /** 工具内部真实触发权限 / 路径策略时的脱敏上报回调。 */
  assetUsageReporter?: ToolAssetUsageReporter
  /** 当前批次 callId → tool span，用于把守卫证据精确挂到实际工具节点。 */
  assetUsageSpanIdByCall?: Record<string, string>
}

// ── LLM ──

export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'auto'

export type ResponseFormat =
  | { type: 'text' }
  | { type: 'json_object' }
  | { type: 'json_schema'; json_schema: { name: string; strict?: boolean; schema: Record<string, unknown> } }

export interface LLMConnectionTestInput {
  /** 新输入的 Key；留空时可由主进程使用已安全保存的 Key。 */
  apiKey?: string
  /** 使用主进程安全存储中的已保存 Key。 */
  useStoredApiKey?: boolean
  baseUrl: string
  model: string
}

/** Renderer 可见设置：敏感值只返回状态，不返回原文。 */
export interface RendererSettings extends Record<string, string> {
  llmApiKey: ''
  llmApiKeyConfigured: 'true' | 'false'
  mcpServers: string
}

export type LLMConnectionTestResult =
  | { ok: true; model: string; ms: number }
  | { ok: false; error: string }

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature?: number
  topP?: number
  maxTokens?: number
  /**
   * OpenAI 兼容请求体上的 thinking 开关（DeepSeek V4 / Kimi 等）。
   * undefined = 不传，走厂商默认；辅助调用经能力探测或启发式后常设为 disabled。
   * 对照 Alice provider `extraParams.thinking`。
   */
  thinking?: { type: 'enabled' | 'disabled' }
  /** Provider 类型（auto = 根据 baseUrl 自动检测） */
  provider?: LLMProvider
  /** 备用模型列表，主模型失败时按序降级 */
  fallbackModels?: FallbackModelConfig[]
  /** 仅供本进程 Debug 证据链使用；不得序列化进 Provider 请求。 */
  runtimeAssetKeys?: string[]
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

/** auto / confirm-all / plan-first 管确认；full-access 跳过确认且有效沙箱为放开路径 */
export type ExecutionMode = 'auto' | 'confirm-all' | 'plan-first' | 'full-access'

export interface AgentLoopOptions {
  config: LLMConfig
  messages: ChatMessage[]
  tools: ToolDefinition[]
  systemPrompt?: string
  /** 本次 Loop 实际使用的 Prompt 注册表稳定 key；来源与版本由 LLM 入口统一解析。 */
  promptAssetKeys?: PromptAssetKeyList
  /** 当前 Loop 已激活的 Skill 元数据；正文仍只保留在真实请求消息中。 */
  skillActivations?: SkillActivationTrace[]
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
  /** 父 interaction span ID，用于将 loop 内的子 span 挂在同一棵调用链树下 */
  interactionSpanId?: string
  /**
   * 覆盖默认 streamChat 实现，主要供 eval / 集成测试使用。
   * 传入时 loop 不调真实 LLM，而是走这个函数。
   * 前缀下划线提示：仅测试/eval 场景，勿在生产业务逻辑里使用。
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _streamChatOverride?: (options: any) => AsyncGenerator<any, any>
}

/** Agent 循环终止原因 */
export type TerminalReason =
  | 'completed'         // LLM 返回纯文本，正常结束
  | 'max_turns'         // 达到最大迭代次数
  | 'aborted'           // 被 AbortSignal 取消
  | 'prompt_too_long'   // 413 压缩后仍超限
  | 'model_error'       // LLM 调用不可恢复错误
  | 'too_many_denials'  // 拒绝次数超限（Deny-and-Continue 熔断，防无限撞墙）

export type AgentStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'tool_call_delta'; index: number; id?: string; name?: string; argumentsDelta: string }
  | { type: 'tool_start'; callId: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_end'; callId: string; name: string; result: string; isError?: boolean }
  | { type: 'tool_confirm'; callId: string; name: string; args: Record<string, unknown> }
  | { type: 'usage'; promptTokens: number; completionTokens: number }
  | { type: 'error'; message: string; code?: string }
  | { type: 'execution_mode_changed'; mode: ExecutionMode; reason: string }
  | {
      /** M29-G1：本轮注入 Prompt 的记忆引用（供 UI 芯片） */
      type: 'memory_citations'
      items: MemoryCitation[]
    }
  | {
      /** M4 compactMetadata 可观测事件 — 压缩发生后由 agentLoop yield */
      type: 'compact'
      level: 'L3_Collapse' | 'L4_AutoCompact'
      preTokens: number
      postTokens: number
      trigger: 'proactive' | 'reactive_413'
      usedLLM: boolean
    }
  | { type: 'done'; reason: TerminalReason }

// ── Companion 主角 ──

/** 设置页 / IPC 列表用的主角摘要 */
export interface RoleSummary {
  id: string
  name: string
  description: string
}

/** @deprecated 使用 RoleSummary */
export type PersonaConfig = RoleSummary

// ── 记忆 ──

export type MemoryCategory = 'identity' | 'preference' | 'fact' | 'workflow' | 'voice' | 'feedback'

export interface MemoryEntry {
  id: string
  category: MemoryCategory
  content: string
  createdAt: number
  updatedAt: number
  /**
   * 归属主角（主要给 feedback 分桶，防反思串味）。
   * 空字符串 = 未分桶（旧数据或全局类记忆）。
   */
  roleId?: string
}

// ── 后台任务（M11 任务生命周期）──

/**
 * 后台任务类型。
 * 这些任务在主对话结束后异步执行，产出注入 M5 记忆系统。
 */
export type TaskType =
  | 'profile-extract'    // 用户画像提取（→ SQLite + 向量库）
  | 'smart-title'        // 智能标题生成
  | 'vector-index-user'  // 用户消息向量索引
  | 'persona-reflection' // 活跃主角 MUTABLE 低频反思（成长核）

/** 后台任务五态状态机 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** 长任务断点（M09）：重试/恢复时可续接的轻量状态 */
export interface TaskCheckpoint {
  step?: number
  label?: string
  payload?: Record<string, unknown>
  updatedAt: number
}

/** 可通过 IPC 查询的任务摘要（不含 fn） */
export interface BackgroundTaskInfo {
  id: string
  name: TaskType
  sessionId: string
  status: TaskStatus
  /** 是否已向渲染进程发送完成/失败通知（幂等标志） */
  notified: boolean
  createdAt: number
  updatedAt: number
  error?: string
  /** 已重试次数（指数退避，最多 MAX_RETRIES=3 次） */
  retryCount?: number
  /** 断点续接数据（JSON） */
  checkpoint?: TaskCheckpoint
}

/**
 * 任务生命周期事件，通过 `task:event` IPC 通道推送给渲染进程。
 * 渲染进程订阅后按 type 分发（可显示 Toast、更新状态 pill 等）。
 */
export type TaskLifecycleEvent =
  | { type: 'task:started';   task: BackgroundTaskInfo }
  | { type: 'task:completed'; task: BackgroundTaskInfo }
  | { type: 'task:failed';    task: BackgroundTaskInfo }

/** 会话种类：main=活跃主角主线；summon=名册召唤（装载对方 Pack，不启生活世界） */
export type SessionKind = 'main' | 'summon'

export interface ChatSession {
  id: string
  messages: ChatMessage[]
  createdAt: number
  /** 创建时绑定的角色 id，中途不可改 */
  roleId: string
  /** 缺省视为 main（旧数据迁移后默认 main） */
  sessionKind?: SessionKind
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

export type SkillValidationSeverity = 'error' | 'warning'

export interface SkillValidationIssue {
  severity: SkillValidationSeverity
  code: string
  field?: string
  message: string
}

export interface SkillValidationResult {
  valid: boolean
  issues: SkillValidationIssue[]
  name?: string
  meta?: SkillFrontmatter
}

export interface SkillVersionInfo {
  version: number
  createdAt: number
  current: boolean
}

export interface SkillActivationTrace {
  name: string
  toolName: string
  source: 'builtin' | 'user'
  version: string
  fingerprint: string
  reason?: string
  activatedAt: number
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

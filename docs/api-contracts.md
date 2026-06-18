# 模块间接口契约

> 模块间的接口定义。改一端时 AI 知道另一端要配合。

## 约定

- 接口变更时**必须同步更新此文档**
- 改接口前先检查这里，确认影响范围
- 所有接口使用 TypeScript 类型定义（源码在 `src/shared/types.ts`）

---

## 核心类型（src/shared/types.ts）

```typescript
interface ImageAttachment {
  dataUrl: string        // base64 编码图片数据（data:image/png;base64,...）
  mimeType: string       // MIME 类型
  fileName?: string      // 文件名（可选）
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]       // assistant 消息携带的工具调用
  toolCallId?: string          // tool 消息关联的 tool_call id
  images?: ImageAttachment[]   // 图片附件（多模态消息）  ← P14
}

interface ToolCall {
  id: string
  name: string
  arguments: string  // JSON string
}

interface ToolResult {
  callId: string
  name: string
  content: string
  isError?: boolean
}

interface ToolDefinition {
  name: string
  description: string
  parameters: { type: 'object'; properties: Record<string, ToolParameter>; required?: string[] }
  metadata: ToolMetadata
  execute: (args: Record<string, unknown>) => Promise<string>
}

interface ToolMetadata {
  isReadOnly: boolean
  isDestructive: boolean
  isConcurrencySafe: boolean
}

type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'auto'  // ← P13

interface FallbackModelConfig {                    // ← P15
  model: string
  baseUrl?: string
  apiKey?: string
  provider?: LLMProvider
}

interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature?: number            // ← P8
  topP?: number                   // ← P8
  maxTokens?: number              // ← P8
  provider?: LLMProvider          // auto = 根据 baseUrl 自动检测  ← P13
  fallbackModels?: FallbackModelConfig[]  // 备用模型降级链  ← P15
}

type ResponseFormat =             // ← P15
  | { type: 'text' }
  | { type: 'json_object' }
  | { type: 'json_schema'; json_schema: { name: string; strict?: boolean; schema: Record<string, unknown> } }

type ExecutionMode = 'auto' | 'confirm-all' | 'plan-first'  // ← P10

interface AgentLoopOptions {
  config: LLMConfig
  messages: ChatMessage[]
  tools: ToolDefinition[]
  systemPrompt?: string
  maxIterations?: number
  signal?: AbortSignal
  confirmTool?: (name: string, args: Record<string, unknown>) => Promise<boolean>
  filterTools?: (tools: ToolDefinition[]) => ToolDefinition[]  // ← P10 Skill allowed_tools
  executionMode?: ExecutionMode  // ← P10
}

type AgentStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'tool_start'; callId: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_end'; callId: string; name: string; result: string; isError?: boolean }
  | { type: 'tool_call_delta'; index: number; id?: string; name?: string; argumentsDelta: string }  // ← P15
  | { type: 'tool_confirm'; callId: string; name: string; args: Record<string, unknown> }
  | { type: 'usage'; promptTokens: number; completionTokens: number }
  | { type: 'error'; message: string }
  | { type: 'done' }

interface SkillFrontmatter {           // ← P9
  name: string
  description: string
  when_to_use?: string
  allowed_tools?: string[]
  disable_model_invocation?: boolean
  version?: string
}

interface SkillDefinition {            // ← P9
  meta: SkillFrontmatter
  body: string
  filePath: string
  source: 'builtin' | 'user'
}
```

## IPC 通道（渲染进程 ↔ 主进程）

### 会话管理（ipc/session.ts）

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `session:list` | → | - | `SessionSummary[]` |
| `session:create` | → | - | `ChatSession` |
| `session:get` | → | `sessionId` | `ChatSession \| null` |
| `session:delete` | → | `sessionId` | `void` |
| `session:rename` | → | `sessionId, title` | `void` |
| `message:delete` | → | `messageId` | `void` |
| `session:fork` | → | `sessionId, upToMessageId` | `ChatSession` | ← P16
| `session:tokenUsage` | → | `sessionId` | `{ promptTokens, completionTokens }` | ← P10

### 聊天（ipc/chat.ts）

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `chat:send` | → | `sessionId, messages[]` | `void`（通过 `chat:event` 推送事件流） |
| `chat:abort` | → | `sessionId?` | `void` | ← P11 传 sessionId
| `chat:event` | ← | `AgentStreamEvent` | -（渲染进程监听） |
| `tool:confirm-request` | ← | `{ requestId, name, args }` | - |
| `tool:confirm-response:{id}` | → | `approved: boolean` | - |

### 设置（ipc/settings.ts）

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `settings:get` | → | - | `AppSettings` |
| `settings:set` | → | `key, value` | `void` |

```typescript
// AppSettings 完整字段（P12 扩展）
interface AppSettings {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  llmTemperature: string
  llmTopP: string
  llmMaxTokens: string
  systemPrompt: string
  personaId: string
  mcpServers: string           // JSON string — McpServerConfig[]
  sandboxMode: string          // read-only | workspace-write | full-access  ← P10
  executionMode: string        // auto | confirm-all | plan-first            ← P10
  auxModel: string             // 辅助模型（留空沿用主模型）               ← P12
  sessionTokenBudget: string   // 会话级 Token 预算（0=无限制）            ← P12
  dailyTokenBudget: string     // 日级 Token 预算（0=无限制）              ← P12
}
```

### 记忆（ipc/memory.ts）

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `memory:list` | → | `category?` | `MemoryEntry[]` |
| `memory:add` | → | `category, content` | `MemoryEntry` |
| `memory:delete` | → | `id` | `void` |
| `memory:update` | → | `id, content` | `void` |

### 人格（ipc/persona.ts）

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `persona:list` | → | - | `PersonaInfo[]` |
| `persona:get-current` | → | - | `PersonaInfo` |

### MCP（ipc/mcp.ts）

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `mcp:connect` | → | `McpServerConfig` | `{ success, toolCount?, error? }` |
| `mcp:disconnect` | → | `serverId` | `{ success }` |
| `mcp:status` | → | - | `McpServerStatus[]` |
| `mcp:list-tools` | → | `serverId?` | `McpTool[]` |

```typescript
// McpServerConfig（P14 扩展 SSE 传输）
interface McpServerConfig {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  enabled: boolean
  transport?: 'stdio' | 'sse'  // 默认 stdio  ← P14
  url?: string                  // SSE 传输的远程 URL ← P14
}
```

### Skill（ipc/skills.ts）← P9

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `skills:list` | → | - | `SkillDefinition[]` |
| `skills:get` | → | `name` | `SkillDefinition \| null` |
| `skills:save` | → | `name, content` | `void` |
| `skills:delete` | → | `name` | `void` |
| `skills:reload` | → | - | `void` |

### 数据导出（ipc/data-export.ts）← P6

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `data:export` | → | - | `void`（弹出保存对话框） |
| `data:import` | → | - | `{ imported: number }` |

### 调试面板（ipc/debug.ts）← P5/P12

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `debug:system-prompt` | → | - | `{ full, layers, persona, charCount, estimatedTokens }` |
| `debug:tools` | → | - | `ToolInfo[]` |
| `debug:system-info` | → | - | `SystemInfo` |
| `debug:traces` | → | - | `{ spans, callerStats, dailyTokenUsage }` | ← P12

### 定时任务（ipc/scheduler.ts）← P16

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `scheduler:list` | → | - | `ScheduledTask[]` |
| `scheduler:create` | → | `{ name, prompt, cron?, intervalMs? }` | `ScheduledTask` |
| `scheduler:update` | → | `id, updates` | `void` |
| `scheduler:delete` | → | `id` | `void` |
| `scheduler:triggered` | ← | `{ taskId, name, prompt }` | -（渲染进程监听） |

### RAG 文档（ipc/rag.ts）← P16

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `rag:list` | → | - | `RagDocument[]` |
| `rag:ingest` | → | -（弹出文件选择） | `RagDocument[]` |
| `rag:delete` | → | `docId` | `void` |

### 自动更新（main/index.ts）← P15

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `updater:check` | → | - | `{ available, version? }` |
| `updater:download` | → | - | `void` |
| `updater:install` | → | - | `void`（退出并安装） |
| `updater:available` | ← | `{ version, releaseNotes? }` | - |
| `updater:progress` | ← | `{ percent }` | - |
| `updater:downloaded` | ← | `{ version }` | - |

## Agent Loop ↔ LLM Adapter

```typescript
// streamChat 接口（P15 扩展）
interface StreamChatOptions {
  config: LLMConfig
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  signal?: AbortSignal
  responseFormat?: ResponseFormat       // ← P15 Structured Output
  enablePromptCache?: boolean           // ← P15 Anthropic Cache
}

// 返回：AsyncGenerator<AgentStreamEvent, StreamChatResult>
interface StreamChatResult {
  content: string | null
  toolCalls: ToolCall[]
  usage: {
    promptTokens: number
    completionTokens: number
    cacheReadTokens?: number            // ← P15 Anthropic Cache
    cacheCreationTokens?: number        // ← P15 Anthropic Cache
  } | null
}

// ← P13 多 Provider 路由
// detectProvider(config) → 'openai' | 'anthropic' | 'gemini'
// Anthropic → streamChatAnthropic（Messages API + SSE 流）
// Gemini → buildGeminiBody（systemInstruction + functionDeclarations）
// OpenAI 兼容 → 原有 streamChat
```

## Tool Middleware Pipeline ← P12

```typescript
interface ToolMiddlewareContext {
  toolName: string
  args: Record<string, unknown>
  metadata: ToolMetadata
}

type ToolMiddlewareFn = (
  ctx: ToolMiddlewareContext,
  next: () => Promise<string>,
) => Promise<string>

class ToolMiddlewarePipeline {
  use(fn: ToolMiddlewareFn): void
  execute(ctx: ToolMiddlewareContext, core: () => Promise<string>): Promise<string>
}

// 内置中间件：
// - errorFormattingMiddleware  — 捕获异常格式化为 [ERROR] 消息
// - loggingMiddleware          — 记录工具调用耗时
// - resultTruncationMiddleware — 截断超过 50K 字符的结果
```

## Token Budget ← P12

```typescript
function checkBudget(sessionId: string, settings: AppSettings): { ok: boolean; reason?: string }
function recordDailyUsage(tokens: number): void
function getDailyUsage(): { used: number; limit: number; date: string }
```

## Permission Engine ← P13

```typescript
interface PermissionRule {
  type: 'command' | 'tool' | 'path'
  pattern: string   // 正则表达式
  action: 'allow' | 'deny' | 'ask'
  reason?: string
}

interface PermissionCheckResult {
  action: 'allow' | 'deny' | 'ask'
  source: 'custom-rule' | 'approval' | 'exec-policy' | 'sandbox' | 'default'
  reason?: string
}

function checkCommandPermission(command: string, sessionId: string): PermissionCheckResult
function checkToolPermission(toolName: string): PermissionCheckResult
```

## Project Memory ← P13

```typescript
function readProjectMemory(): string | null
function writeProjectMemory(content: string): void
function appendProjectSection(heading: string, content: string): void
function buildProjectMemoryPrompt(): string  // 截断 4000 字，注入 L3 Prompt
```

## MCP Bridge ↔ ToolRegistry

```typescript
// MCP 工具命名规则：mcp:{serverId}:{toolName}
function mcpToolFullName(serverId: string, toolName: string): string
function isMcpTool(name: string): boolean
function parseMcpToolName(fullName: string): { serverId: string; toolName: string } | null

// 同步 MCP 工具到 Registry（先移除旧工具，再注册新工具）
function syncMcpToolsToRegistry(registry: ToolRegistry, serverId: string): number
function removeMcpToolsFromRegistry(registry: ToolRegistry, serverId: string): void
```

## 向量记忆接口

```typescript
// 写入
function addToVectorStore(entry: VectorMemoryEntry, config: LLMConfig): Promise<void>

// 查询（语义检索）
function searchVectorStore(
  query: string,
  config: LLMConfig,
  options?: { topK?: number; minScore?: number; category?: string }
): Promise<VectorSearchResult[]>

interface VectorMemoryEntry {
  id: string
  text: string
  category: 'conversation' | 'fact' | 'preference' | 'identity' | 'workflow' | 'voice'
  sessionId?: string
  timestamp: number
}
```

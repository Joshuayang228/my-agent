# 模块间接口契约

> 模块间的接口定义。改一端时 AI 知道另一端要配合。

## 约定

- 接口变更时**必须同步更新此文档**
- 改接口前先检查这里，确认影响范围
- 所有接口使用 TypeScript 类型定义（源码在 `src/shared/types.ts`）

---

## 核心类型（src/shared/types.ts）

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
  toolCallId?: string
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

interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
}

type AgentStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_start'; callId: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_end'; callId: string; name: string; result: string; isError?: boolean }
  | { type: 'tool_confirm'; callId: string; name: string; args: Record<string, unknown> }
  | { type: 'usage'; promptTokens: number; completionTokens: number }
  | { type: 'error'; message: string }
  | { type: 'done' }
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

### 聊天（ipc/chat.ts）

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `chat:send` | → | `sessionId, messages[]` | `void`（通过 `chat:event` 推送事件流） |
| `chat:abort` | → | - | `void` |
| `chat:event` | ← | `AgentStreamEvent` | -（渲染进程监听） |
| `tool:confirm-request` | ← | `{ requestId, name, args }` | - |
| `tool:confirm-response:{id}` | → | `approved: boolean` | - |

### 设置（ipc/settings.ts）

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `settings:get` | → | - | `AppSettings` |
| `settings:set` | → | `key, value` | `void` |

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

## Agent Loop ↔ LLM Adapter

```typescript
// streamChat 接口
interface StreamChatOptions {
  config: LLMConfig
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  signal?: AbortSignal
}

// 返回：AsyncGenerator<AgentStreamEvent, StreamChatResult>
interface StreamChatResult {
  content: string | null
  toolCalls: ToolCall[]
  usage: { promptTokens: number; completionTokens: number } | null
}
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

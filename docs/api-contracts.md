# 模块间接口契约

> 模块间的接口定义。改一端时 AI 知道另一端要配合。

## 约定

- 接口变更时**必须同步更新此文档**
- 改接口前先检查这里，确认影响范围
- 所有接口使用 TypeScript 类型定义

---

## Agent Loop ↔ 工具系统

<!-- TODO: 等实际编码时填入具体类型定义 -->

```typescript
// Agent Loop 调用工具
interface ToolCallRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  callId: string;
}

// 工具返回结果
interface ToolCallResult {
  callId: string;
  success: boolean;
  output: unknown;
  error?: string;
}
```

## Agent Loop ↔ LLM 路由

```typescript
// 发送给 LLM 的请求
interface LLMRequest {
  messages: Message[];
  model: string;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  caller: 'main' | 'compact' | 'memory' | 'permission';
}

// LLM 返回的事件流
type AgentStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolName: string; arguments: Record<string, unknown>; callId: string }
  | { type: 'tool_result'; callId: string; output: unknown }
  | { type: 'done'; usage: TokenUsage }
  | { type: 'error'; message: string };
```

## 主进程 ↔ 渲染进程 (IPC)

```typescript
// 渲染进程 → 主进程
interface IPCRequest {
  type: 'send_message' | 'cancel' | 'approve_tool' | 'reject_tool' | 'update_settings';
  payload: unknown;
}

// 主进程 → 渲染进程
interface IPCEvent {
  type: 'stream_event' | 'permission_request' | 'settings_updated' | 'error';
  payload: unknown;
}
```

## 记忆系统接口

```typescript
interface MemoryStore {
  // 存储对话
  saveConversation(messages: Message[]): Promise<void>;
  // 语义检索
  searchSimilar(query: string, limit: number): Promise<MemoryResult[]>;
  // 获取最近对话
  getRecentConversations(limit: number): Promise<Conversation[]>;
}
```

## 工具注册接口

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  metadata: ToolMetadata;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

interface ToolMetadata {
  isReadOnly: boolean;
  isDestructive: boolean;
  isConcurrencySafe: boolean;
}
```

<!-- 后续模块开发时在此追加新的接口契约 -->

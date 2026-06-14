# API 文档

> 对外/对内 API 文档。

## 说明

本项目是桌面应用（Electron），主要 API 分为两类：

1. **内部 API（IPC）** — 渲染进程与主进程之间的通信接口
2. **外部 API（LLM Provider）** — 调用 LLM 服务的接口

本项目**不提供 HTTP REST API**（纯本地应用）。如未来有远程访问需求再另行设计。

---

## 内部 API（IPC 通道）

### 渲染进程 → 主进程

| 通道 | 用途 | 参数 | 返回 |
|------|------|------|------|
| `agent:send` | 发送用户消息 | `{ message: string }` | void（结果通过事件流返回） |
| `agent:cancel` | 取消当前生成 | void | void |
| `tool:approve` | 用户确认执行工具 | `{ callId: string }` | void |
| `tool:reject` | 用户拒绝执行工具 | `{ callId: string }` | void |
| `settings:get` | 获取设置 | void | `Settings` |
| `settings:update` | 更新设置 | `Partial<Settings>` | void |

### 主进程 → 渲染进程（事件流）

| 事件 | 用途 | 数据 |
|------|------|------|
| `stream:text` | AI 文本输出 | `{ content: string }` |
| `stream:tool_call` | 工具调用开始 | `{ toolName, arguments, callId }` |
| `stream:tool_result` | 工具调用结果 | `{ callId, output }` |
| `stream:done` | 生成完成 | `{ usage: TokenUsage }` |
| `stream:error` | 错误 | `{ message: string }` |
| `permission:request` | 请求用户确认 | `{ callId, toolName, description }` |

## 外部 API（LLM Provider 适配器）

<!-- TODO: 等集成具体 Provider 时填入 API 文档 -->

### Provider 适配器接口

每个 Provider 实现统一接口：

```typescript
interface LLMProviderAdapter {
  name: string;
  sendMessage(params: LLMRequest): AsyncGenerator<AgentStreamEvent>;
  listModels(): Promise<ModelInfo[]>;
  validateApiKey(): Promise<boolean>;
}
```

### 已适配 Provider

| Provider | 状态 | 备注 |
|----------|------|------|
| 待定 | 未开始 | 项目初始化后逐步集成 |

<!-- 后续集成 Provider 时在此追加文档 -->

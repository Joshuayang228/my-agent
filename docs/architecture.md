# 系统架构

> 架构变更时由 AI 更新此文件。

## 项目愿景

**构建一个人格化桌面 AI Agent。**

不只是一个工具，而是一个有性格、有记忆、能成长的数字伙伴：
- **人格化交互** — 有一致的性格特征和交流风格，不是冰冷的 Q&A 机器
- **持久记忆** — 记住用户的偏好、项目上下文、历史对话，越用越懂你
- **主动协作** — 不仅被动回答，还能主动提醒、建议、推进任务
- **本地优先** — 数据存储在用户本地，隐私可控
- **可扩展** — 通过 MCP 协议连接外部能力，用户可自由添加工具

## 技术栈

| 层级 | 技术选择 |
|------|---------|
| 外壳 | Electron（主进程 Node.js + 渲染进程 Chromium） |
| 语言 | TypeScript 全栈，主进程与渲染进程共享类型定义 |
| 前端 | React + TailwindCSS + Lucide Icons |
| 存储 | SQLite（结构化，sql.js WASM）+ Vectra（向量检索）|
| LLM | OpenAI 兼容 API（支持 OpenAI / DeepSeek 等） |
| 扩展 | MCP 协议（Model Context Protocol） |
| 测试 | vitest（单元）+ Playwright（E2E） |
| 打包 | 待定（electron-builder / electron-forge） |

## 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                      Electron App                        │
│                                                          │
│  ┌──────────────┐        IPC         ┌────────────────┐  │
│  │   渲染进程    │◄─────────────────►│    主进程       │  │
│  │   (React)     │   AgentStreamEvent │   (Node.js)    │  │
│  │               │                    │                │  │
│  │ - App.tsx     │                    │ ┌────────────┐ │  │
│  │ - Settings    │                    │ │ IPC 路由层  │ │  │
│  │ - Markdown    │                    │ │ (6 模块)   │ │  │
│  │ - MCP 管理    │                    │ └──────┬─────┘ │  │
│  └──────────────┘                    │        │       │  │
│                                      │ ┌──────▼─────┐ │  │
│                                      │ │ Agent Loop  │ │  │
│                                      │ │ (核心循环)  │ │  │
│                                      │ └──────┬─────┘ │  │
│                                      │        │       │  │
│                     ┌────────────────┼────────┼───────┤  │
│                     │                │        │       │  │
│              ┌──────▼──────┐  ┌──────▼─────┐  │       │  │
│              │ Tool System │  │ LLM Adapter│  │       │  │
│              │ (Registry)  │  │ (流式API)  │  │       │  │
│              └──────┬──────┘  └────────────┘  │       │  │
│                     │                         │       │  │
│              ┌──────▼──────┐           ┌──────▼─────┐ │  │
│              │ MCP Bridge  │           │ Memory     │ │  │
│              │ (动态工具)  │           │ System     │ │  │
│              └──────┬──────┘           │ - SQLite   │ │  │
│                     │                  │ - Vectra   │ │  │
│              ┌──────▼──────┐           │ - Profile  │ │  │
│              │ MCP Client  │           └────────────┘ │  │
│              │ (stdio)     │                          │  │
│              └─────────────┘                          │  │
└──────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. Agent Loop（核心循环）

```
think → act → observe → think → ...
```

- 事件流使用 AsyncGenerator 模式
- 输出纯数据事件（AgentStreamEvent），不含 UI 逻辑
- 支持 AbortSignal 取消（用户停止按钮）
- 最大迭代次数保护（默认 25 轮）
- 每轮迭代前自动检查上下文压缩

### 2. IPC 模块化

主进程 IPC 拆分为 6 个独立模块：

| 模块 | 职责 |
|------|------|
| `ipc/session.ts` | 会话 CRUD |
| `ipc/chat.ts` | 聊天发送 + 中断 + 向量检索注入 |
| `ipc/settings.ts` | 设置读写 |
| `ipc/memory.ts` | 记忆 CRUD |
| `ipc/persona.ts` | 人格模板查询 |
| `ipc/mcp.ts` | MCP 服务器连接/断开/状态 |

### 3. 工具系统

- 声明式注册（ToolDefinition + ToolMetadata）
- 并发安全分流：`isConcurrencySafe` → Promise.all，否则串行
- 动态注册/注销：支持 MCP 工具运行时加入和移除
- 破坏性操作前用户确认（IPC 双向通信弹窗）
- 5 个内置工具 + MCP 动态工具

### 4. 记忆系统

两层记忆架构：

| 层级 | 存储 | 用途 |
|------|------|------|
| 结构化记忆 | SQLite memory 表 | 用户画像（identity/workflow/voice）、偏好、事实 |
| 向量记忆 | Vectra LocalIndex | 历史对话语义检索，按相关性召回 |

- 自动提取用户画像（异步 LLM 分析，每 5 分钟 + 3 条消息触发）
- 对话自动索引（用户消息 + 助手回复写入向量库）
- 语义检索注入 System Prompt L3 层（top-5，score > 0.6）

### 5. Prompt 分层系统

4 层 System Prompt 注入，稳定内容在前（利于 KV Cache）：

| 层级 | 内容 | 稳定性 |
|------|------|--------|
| L1 人格定义 | [PROTECTED] 核心身份 + [MUTABLE] 行为规范 | 最稳定 |
| L2 能力边界 | 工具列表、行为规范、aside 格式 | 稳定 |
| L3 上下文 | 用户画像、记忆、向量检索结果、自定义指令 | 每次重建 |
| L4 动态 | 当前时间 | 每次变化 |

### 6. MCP 协议

- MCP Client Manager：管理多个 MCP Server 的生命周期
- StdioClientTransport：通过 stdio 子进程通信
- Bridge 层：自动将 MCP 工具转换为 ToolDefinition 并注册
- 命名空间隔离：`mcp:{serverId}:{toolName}` 避免冲突
- 配置持久化：MCP 服务器列表存入 settings
- 启动时自动恢复已启用的连接

### 7. LLM 路由

- 统一适配器模式，OpenAI 兼容 API
- 流式 SSE 解析（text / reasoning / tool_calls delta）
- 模型快切（顶栏 UI + 4 个预设）
- 复用 API 进行 Embedding 调用

### 8. 上下文压缩

三层分级压缩策略：

| 层级 | 触发阈值 | 策略 |
|------|----------|------|
| L1 Snip | 60% | 删除最早的工具调用轮次 |
| L2 MicroCompact | 75% | 去重相同工具调用 |
| L3 Collapse | 90% | 保留首尾，中间替换为结构化摘要 |

## 目录结构

```
my-agent/
├── electron/
│   ├── main/
│   │   ├── index.ts          # App 生命周期 + 窗口管理（131 行）
│   │   ├── ipc/              # IPC 处理器（6 个模块）
│   │   ├── agent/            # Agent Loop + Prompt Builder + 上下文压缩 + 画像提取
│   │   ├── tools/            # ToolRegistry + 5 个内置工具
│   │   ├── mcp/              # MCP Client + Bridge
│   │   ├── memory/           # 向量存储 + Embedding 适配器
│   │   ├── llm/              # LLM 流式适配器
│   │   ├── storage/          # SQLite + Session/Settings/Memory Store
│   │   └── utils/            # Logger
│   └── preload/              # contextBridge 暴露 API
├── src/
│   ├── App.tsx               # 主 UI
│   ├── components/           # SettingsPanel / MarkdownRenderer
│   └── shared/types.ts       # 共享类型定义
├── __tests__/
│   ├── unit/                 # vitest 单元测试（33 个）
│   └── e2e/                  # Playwright E2E 测试（4 个）
├── methodology/              # 设计哲学沉淀
└── docs/                     # 项目文档
```

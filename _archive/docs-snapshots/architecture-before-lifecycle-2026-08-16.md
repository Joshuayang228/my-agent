# 系统架构

> **归档快照**：文档生命周期收口前的完整 Architecture。当前内容以 `docs/` 活跃文件和代码为准。

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
| LLM | 多 Provider（OpenAI 兼容 / Anthropic / Gemini，自动检测路由） |
| 扩展 | MCP 协议（Model Context Protocol） |
| 测试 | vitest（单元）+ Playwright（E2E） |
| 打包 | electron-builder（NSIS / DMG） |

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
│  │ - Markdown    │                    │ │ (12 模块)  │ │  │
│  │ - FileBrowser │                    │ └──────┬─────┘ │  │
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
- 每轮迭代前自动检查上下文压缩（四层分级）
- **消息管道**：sanitizeToolCallPairs 修复孤儿消息，防止 LLM API 400
- **Runtime 编排**：AgentRuntime 单例管理生命周期，后台任务队列串行执行
- **LLM 调用重试**：网络错误/429/5xx 自动重试，最多 2 次，指数退避
- **工具并发执行**：按 LLM 原始顺序分批 — concurrencySafe 连续工具并行，遇到非安全工具刷新批次串行，保持 LLM 指定的执行语义
- **ToolContext 依赖注入**：工具通过 `ctx: ToolContext` 获取 workdir / sessionId / AbortSignal，不再依赖全局 import

### 2. IPC 模块化

主进程 IPC 拆分为 12 个独立模块：

| 模块 | 职责 |
|------|------|
| `ipc/session.ts` | 会话 CRUD + Fork 分支 + 标题重新生成 |
| `ipc/chat.ts` | 聊天发送 + 中断 + 向量检索注入 |
| `ipc/settings.ts` | 设置读写 |
| `ipc/memory.ts` | 记忆 CRUD |
| `ipc/persona.ts` | 人格模板查询 |
| `ipc/mcp.ts` | MCP 服务器连接/断开/状态 |
| `ipc/debug.ts` | DevPanel 调试数据（Prompt/工具/系统状态/Traces） |
| `ipc/data-export.ts` | 数据导出/导入（会话+记忆+设置备份恢复） |
| `ipc/skills.ts` | Skill 校验 / CRUD / 版本历史 / 回滚 / 隔离试跑 / 重新加载 |
| `ipc/scheduler.ts` | 定时任务 CRUD |
| `ipc/rag.ts` | RAG 文档导入/列表/删除 |
| `ipc/project.ts` | 项目工作区（browse/list/set/get + listFiles/readFile） |

### 3. 工具系统

- 声明式注册（ToolDefinition + ToolMetadata）
- **buildTool() 工厂**：统一 fail-closed 默认值（isReadOnly/isDestructive/isConcurrencySafe 默认 false，maxResultSizeChars 默认 50,000），工具只声明偏离默认的字段
- 并发安全分流：`isConcurrencySafe` → Promise.all，否则串行
- 动态注册/注销：支持 MCP 工具运行时加入和移除
- 破坏性操作前用户确认（IPC 双向通信弹窗）
- **超时保护**：每个工具 30s 超时，超时自动返回错误
- 13 个内置工具 + MCP 动态工具
- **子 Agent 系统**：delegate_task 工具，独立上下文 + 受限工具集 + 权限只降不升 + 工具黑名单（禁止 delegate_task 递归 / remember / forget / task_plan）
- **中间件管道**：ToolMiddlewarePipeline 洋葱模型（error-formatting → logging → verify → result-persistence）
- **大结果落盘**：工具结果超过 maxResultSizeChars（默认 50,000）时写临时文件返回路径，防止上下文爆炸；file_read 设 Infinity 避免循环
- **Token 预算**：会话级 + 日级限额，超限自动终止
- **沙箱系统**：参考 Codex 四层纵深防御，三级沙箱模式（read-only / workspace-write / full-access）
- **命令安全分级**：ExecPolicy 白名单/黑名单 + CommandGuard 路径边界检查 + ApprovalStore 审批记录
- **权限规则引擎**：不可绕过硬边界（危险命令、Shell 控制符、越界路径 / cwd）先执行，再进入五层业务责任链（自定义规则 → 审批记录 → ask 规则 → 命令分级 / 沙箱 → 默认）；已接入 Agent Loop 主流程
- **工作区管理**：workspaceRoot 维护；文件工具与子 Agent 优先使用 `ToolContext.workdir`，写入前解析 realpath 防 symlink 越界
- **工具 vs 服务边界**：工具（ToolDefinition）仅暴露给 LLM 的薄壳，内部逻辑下沉为独立服务（如 task-plan-service.ts），运行时/中间件/其他工具可直接调用服务而不经 LLM

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

Prompt 资产由 `electron/main/prompts/registry.ts` 统一登记；核心 key 由 `prompts/keys.ts` 类型化，Role Pack key 只能通过工厂生成。每项记录用途、角色、真实来源、人工版本、自动内容/结构指纹、当前 locale、静态 / 动态模式和动态插槽。每次 `streamChat` / `chatComplete` 必须声明非空资产 key，或显式给出 `promptlessReason`；统一入口把解析结果写入 `requestExtra.promptAssets`，未知 key 进入 `unknownPromptAssetKeys`。静态正文集中在 `prompts/texts.ts`，Eval Judge 模板集中在 `prompts/eval-judge.ts`，生产调用与目录共同引用。Debug 通过 `debug:model-context-assets` 在 IPC 高层聚合 Prompt、伙伴与人格资产、记忆策略、权限与沙箱策略、Tool schema、Skill、Eval Case / Grader、Eval Judge 和当前 MCP 工具；含用户状态的最终动态内容仍只认真实调用的 System / Messages / Tools。Playground 只接收显式实验副本，不维护第二份生产目录。

未来扩展英文时，在同一资产 key 下维护独立语言版本，由运行时按 locale 单选；当前不实现英文或韩文版本。

Skill 资产由 `electron/main/skills/loader.ts` 读取和保存；Frontmatter 只允许标准 YAML，使用 `js-yaml` `JSON_SCHEMA`，禁止 JavaScript / 可执行语言引擎。`registry.ts` 负责生成 Skill 激活工具、维护当前激活状态并产生不含正文的激活指纹。`SkillsPanel` 是用户资产编辑入口：保存前由主进程校验 Frontmatter、正文和工具引用，历史内容保存在用户目录 `.versions/`，隔离试跑复用 `debug:playground-run` 但不写设置或真实会话。Debug 统一目录只读展示 Skill 正文、来源、版本和指纹；真实 LLM 调用通过 `requestExtra.skillActivations` 记录激活工具、来源、版本、原因和指纹。

### 5.1 伙伴与生活世界（Companion）

人格化伙伴的**产品终局**（多主角同团、单活跃、生活世界、朋友圈/衣柜）挂在现有 Loop / Memory / IPC 之上，**不另起进程模型**。

| 要点 | 说明 |
|------|------|
| 运行时 | 唯一 `activeRoleId`；会话中禁止换角；完整切换 + 非活跃暂停 |
| Catch-up | 切换时细补最近 ≤7 日生活剧本/事件 |
| 契约索引 | [`requirements/README.md`](./requirements/README.md) |
| 产品模块 | [`modules/companion.md`](./modules/companion.md) |
| 能力表 | [`modules/companion.md`](./modules/companion.md)「已落地能力」；运行时见 [`modules/agent-runtime.md`](./modules/agent-runtime.md) |

目录落点：`electron/main/companion/`（identity / growth / life / cast / orchestrator）；`prompt-builder` 为组装器。
已落地：**W0–W6** + 三槽 + 召唤子会话/忙闲 + 自动反思 MUTABLE。后续：Pack 内容打磨、methodology M21–M31 深啃。

### 6. MCP 协议

- MCP Client Manager：管理多个 MCP Server 的生命周期
- **双传输层**：StdioClientTransport（本地子进程）+ SSEClientTransport（远程 HTTP/SSE）
- Bridge 层：自动将 MCP 工具转换为 ToolDefinition 并注册
- 命名空间隔离：`mcp:{serverId}:{toolName}` 避免冲突
- 配置持久化：MCP 服务器列表存入 settings
- 启动时自动恢复已启用的连接

### 7. LLM 路由

- **多 Provider 路由**：显式 Provider 优先；否则按共享 Base URL 规则检测 OpenAI / Anthropic / Gemini，未知端点回退 OpenAI Compatible
- OpenAI Compatible 请求由 `request-builders.ts` 纯构造器生成，真实调用与 Provider 资产目录共用同一请求事实（覆盖 DeepSeek / Groq / OpenRouter / Together 等）
- Anthropic Messages API 适配（SSE 流解析 + content_block_delta + tool_use 映射）
- Gemini API 请求构建器（systemInstruction + functionDeclarations）
- 流式 SSE 解析（text / reasoning / tool_calls delta）
- **Streaming Tool Calls**：工具参数边流式边 yield `tool_call_delta` 事件
- **Model Failover**：主模型失败按 `fallbackModels` 顺序降级；备用配置继承采样参数并清除递归 fallback
- **Vision 降级**：OpenAI Compatible 图片先乐观尝试，识别能力错误后进程内记忆拒绝并去图重试一次
- **Prompt Cache**：Anthropic `cache_control` 标记 System Prompt + Tools
- **Structured Output**：OpenAI Compatible `ResponseFormat` 支持 json_object / json_schema
- 内置模型预设统一来自 `src/shared/provider-presets.ts`：Settings 展示 9 个，Chat 快切展示其中 4 个
- 复用 API 进行 Embedding 调用

### 8. 上下文压缩

四层分级压缩策略（Alice 方法论 Ch.5）：

| 层级 | 触发阈值 | 策略 | 成本 |
|------|----------|------|------|
| L1 Snip | 60% | 删除最早的工具调用轮次 | 零 |
| L2 MicroCompact | 75% | 去重相同工具调用 | 零 |
| L3 Collapse | 90% | LLM 生成摘要（降级：规则占位符） | LLM 调用 |
| L4 AutoCompact | 95% | 全量重写（仅主循环触发） | LLM 调用 |

- querySource 互斥守卫：compact/memory/title 来源自动跳过 LLM 摘要，防递归

### 9. Eval 与 Debug 证据链

- Eval CLI 是判定与报告的事实源；Debug 只通过受控 IPC 读取报告、启动固定白名单脚本，不在渲染层重新评分。
- Skill Eval 为每个 Case 创建独立临时目录和 ToolRegistry，复用生产 Skill 激活工具、Skill 摘要与 Agent Loop；Mock / Real 共用触发、指南注入、工具边界和回复约束 Grader。
- 报告写入 `eval-reports/` 的 JSON / Markdown，只保存输入快照、Skill 元数据与指纹、激活 Trace、工具调用和 Agent 可见回复，不保存 API Key、隐藏 reasoning 或 Skill 正文。
- `debug:skill-eval-reports` / `debug:skill-eval-report-get` 对文件名与最小结构做校验，拒绝目录穿越和损坏报告；`DebugEvalRunner` 仅映射 `eval:run`、`eval:skill`、`eval:persona`。

### 10. Agent 生产资产目录

- Prompt 注册表仍负责模型可见 Prompt 的稳定 key、locale、模板和运行时追踪；伙伴注册表不复制 Prompt 正文。
- `companion/asset-registry.ts` 读取真实 Role Pack loader、场景 loader 和生活 starter 工厂，生成 manifest、人物档案、默认世界、伙伴场景与生活内容资产。
- Debug 高层聚合 Prompt、伙伴资产、记忆策略、权限与沙箱策略、Tool schema、Skill、Eval Case / Grader、Eval Judge、模型 Provider 与 MCP，统一展示来源、所有权、版本、指纹、状态、派生关系和依赖。
- 用户记忆、当前世界状态和运行后 `companion_assets` 属于运行时数据，不进入静态生产资产目录；分别由记忆 / 世界态 / 请求记录查看。
- `memory/strategy-registry.ts` 只登记记忆提取、去重、反馈分桶、向量召回、向量生命周期和引用纠错策略；策略参数由原生产模块导出，注册表不反向驱动算法。
- `sandbox/asset-registry.ts` 从沙箱档位、命令分级、权限责任链、路径守卫、审批生命周期和有效沙箱映射生成只读资产；不读取用户规则、审批记录或当前执行模式。
- `evals/scenario-registry.ts` 是普通 Eval Scenario 唯一列表，CLI、Vitest 与 `evals/asset-registry.ts` 共同消费；Case / Grader 资产来自真实场景和结构化判据，不读取运行报告、环境凭据或 Judge 隐藏推理。
- `llm/provider-asset-registry.ts` 从真实请求构造器、路由规则、Thinking / Context / Vision / Failover 生产事实和共享预设生成协议能力、跨 Provider 策略与内置预设资产；只保存脱敏结构，不读取用户配置或能力缓存。
- Playground 不直接写生产资产；只有文本类资产可显式载入为实验副本，伙伴、记忆、权限与沙箱、Eval Case / Grader、Provider 等结构化资产保持只读。

### 10.1 生产资产运行证据层

- `utils/asset-usage.ts` 是业务层唯一证据分发入口：调用方只上报稳定 key、关系、状态和扁平 allowlist 元数据，不依赖 Storage 或 Debug IPC。
- 主进程用 `createModelContextAssetResolver` 校验 key，并把运行时 version / fingerprint 快照写入 `agent_asset_usage`；未知 key、解析失败和写盘失败只告警，不阻断 Agent 主链路。
- `agent_asset_usage` 只是关联索引：LLM 正文仍在 `llm_debug_logs`，Trace 仍由 tracer 管理，资产正文仍在各生产注册表；索引按 20,000 行与约 32 MB 双上限裁剪。
- LLM 记录 Prompt、Provider 路由 / 策略、Tool availability 与 Skill；Agent / Tool 记录执行、审批、命令责任链、有效沙箱和真实路径守卫；Memory 记录召回、画像、去重、反馈分桶、向量生命周期与引用纠错。
- Tool Registry 为每个 call 注入实际 tool span，使 `shell_exec` 和文件工具内部守卫证据精确挂到执行节点；不记录 command、路径、reason、args 或结果正文。
- Debug 通过单一 `debug:asset-usage-query` 按 span / asset / session 查询；LLM JSON 与 JSONL 导出都附带证据，清空 LLM Debug 时同步清理对应会话关联。

## 目录结构

```
my-agent/
├── electron/
│   ├── main/
│   │   ├── index.ts          # App 生命周期 + 窗口管理 + Tray + Auto Update
│   │   ├── ipc/              # IPC 处理器（12 个模块）
│   │   ├── agent/            # Agent Loop + Runtime + Prompt + Context + Pipeline + Subagent
│   │   ├── tools/            # ToolRegistry + 20 个内置工具 + Middleware
│   │   ├── services/         # 内部服务（task-plan-service 等，工具调用的底层逻辑）
│   │   ├── sandbox/          # 沙箱系统 + 权限引擎
│   │   ├── mcp/              # MCP Client（stdio + SSE）+ Bridge
│   │   ├── memory/           # 向量存储 + Embedding 适配器
│   │   ├── llm/              # LLM 流式适配器 + Provider 路由 + Failover + Cache
│   │   ├── rag/              # RAG 文档管道（导入 + 分块 + 向量化 + 检索）
│   │   ├── scheduler/        # 定时任务调度器（interval + cron + SQLite 持久化）
│   │   ├── storage/          # SQLite + Session/Settings/Memory Store
│   │   └── utils/            # Logger + 错误脱敏 + Tracer
│   └── preload/              # contextBridge 暴露 API
├── src/
│   ├── App.tsx               # 主 UI
│   ├── components/           # SettingsPanel / MarkdownRenderer / DevPanel / MemoryPanel / SkillsPanel / FileBrowser / Toast
│   └── shared/types.ts       # 共享类型定义
├── __tests__/
│   ├── unit/                 # vitest 单元测试
│   └── e2e/                  # Playwright E2E 测试
├── methodology/              # 设计哲学沉淀
└── docs/                     # 项目文档
```

## 核心数据流

### 用户输入 → AI 响应（主链路）

```
用户输入 → 渲染进程(React) → IPC chat:send
    → 主进程 AgentRuntime.chat()
        ├─ 记忆检索（向量 + SQLite）
        ├─ 上下文组装（System Prompt 4 层 + 消息管道清洗）
        ├─ Token 预算检查
        └─ Agent Loop（AsyncGenerator）
            ├─ streamChat → LLM API（Provider Router 自动选择协议）
            ├─ yield text/thinking/tool_calls 事件
            ├─ 工具调用 → Middleware Pipeline → 权限检查 → 执行
            └─ yield done → 后台任务（画像/向量索引/标题）
    → IPC chat:event → 渲染进程流式显示
```

### 工具调用链路

```
LLM 返回 tool_calls（可能多个）
    → Agent Loop 按 LLM 原始顺序分批
        ├─ 连续 concurrencySafe 工具 → 并行批次（Promise.all）
        └─ 非安全工具 → 刷新批次，串行执行
    → 每个工具：
        → PermissionEngine 权限检查（五层责任链）
            ├─ allow → 继续
            ├─ needs_approval → IPC tool:confirm-request → 用户确认/拒绝
            └─ deny → 返回拒绝结果
        → ToolRegistry.executeSingle(toolCall, toolContext)
            → MiddlewarePipeline（error-formatting → logging → truncation）
                → toolDef.execute(args, ctx)  ← ToolContext 注入 workdir/sessionId/signal
    → yield tool_end → 继续 loop
```

### 数据持久化流

```
对话完成
    ├─ SQLite：保存消息（含 toolCalls + tool results）+ 累加 token 用量
    ├─ 向量数据库：嵌入并索引对话内容
    └─ 日 Token 计数器：recordDailyUsage
```

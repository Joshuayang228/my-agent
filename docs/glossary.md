# 术语表

> 统一项目概念命名，避免同一概念多种叫法导致混乱。

| 术语 | 英文 | 定义 | 备注 |
|------|------|------|------|
| Agent Loop | Agent Loop | AI 的核心 think → act → observe 循环 | 不叫"主循环""推理循环" |
| 工具 (Tool) | Tool | AI 可见、可调用的能力单元 | 与"服务"区分 |
| 服务 (Service) | Service | AI 不可见的后台支撑模块 | 与"工具"区分 |
| 事件流 | Event Stream | Agent Loop 通过 AsyncGenerator 输出的事件序列 | |
| AgentStreamEvent | AgentStreamEvent | 事件流中的单个事件（文本/工具调用/完成/错误） | |
| 上下文 | Context | 发送给 LLM 的全部信息（System Prompt + 记忆 + 对话 + 临时） | |
| 上下文压缩 | Context Compression | token 接近上限时，压缩早期对话保留关键信息 | 四层压缩 |
| 记忆 | Memory | 跨会话持久化的信息（长期记忆、项目记忆等） | 五层记忆体系 |
| 主进程 | Main Process | Electron 的 Node.js 进程，运行核心逻辑 | |
| 渲染进程 | Renderer Process | Electron 的 Chromium 进程，运行 UI | |
| IPC | IPC | Inter-Process Communication，主进程与渲染进程的通信 | |
| Provider | Provider | LLM 服务提供商（如 OpenAI、Anthropic 等） | |
| Adapter | Adapter | 适配某个 Provider 的接口实现 | 统一适配器模式 |
| 声明式工具 | Declarative Tool | 带元数据的工具定义（isReadOnly / isDestructive 等） | |
| 破坏性操作 | Destructive Operation | 需要用户确认才能执行的操作（删除、发送等） | isDestructive: true |
| Developer Panel | Developer Panel | Agent 可观测性调试面板（Ctrl+Shift+D 开关），查看 Prompt/工具/系统状态/事件流 | 受 Alice 启发但独立设计 |
| HARD-GATE | HARD-GATE | 规则中的硬性门控，不可绕过 | 用 XML 标签包裹 |

| safeStorage | safeStorage | Electron 内置加密模块，用系统级密钥链加解密字符串 | 用于 API Key 加密存储 |
| 错误脱敏 | Error Sanitization | 从错误信息中过滤 API Key、URL 等敏感内容后再传给前端 | sanitize-error.ts |
| 指数退避 | Exponential Backoff | 重试间隔按 2^n 指数增长的策略 | LLM 调用重试 |
| 分层约束 | Layer Constraint | 模块间 import 方向的单向依赖规则 | core.mdc HARD-GATE |

| 沙箱 (Sandbox) | Sandbox | 命令执行安全防护，三级模式（read-only / workspace-write / full-access） | 参考 Codex |
| 沙箱策略 | SandboxPolicy | 定义文件系统/网络/命令的访问边界 | sandbox/policy.ts |
| 命令分级 | ExecPolicy | 命令安全等级评估（safe / dangerous / unknown） | sandbox/exec-policy.ts |
| 路径守卫 | CommandGuard | 检查命令目标路径是否越界 | sandbox/command-guard.ts |
| 审批记录 | ApprovalStore | 用户对敏感操作的审批历史 | 会话级 + 持久级 |
| 消息管道 | Message Pipeline | 对话历史清洗（孤儿修复 / 去重 / 合并）| message-pipeline.ts |
| 运行时编排 | AgentRuntime | 会话生命周期 + 后台任务队列的单例管理器 | runtime.ts |
| 子 Agent | Subagent | 被主 Agent 委托的独立 Agent 实例，受限工具集 + 权限只降不升 | delegate_task 工具 |
| 中间件管道 | Middleware Pipeline | 工具执行的洋葱模型拦截链 | tools/middleware.ts |
| Token 预算 | Token Budget | 会话级 + 日级 Token 消耗限额 | token-budget.ts |
| 结构化 Tracing | Structured Tracing | 轻量 Span 追踪系统（caller 分类 + 嵌套 + 时长） | utils/tracer.ts |
| 辅助模型 | Aux Model | 后台任务专用的低成本 LLM 模型配置 | auxModel 设置项 |
| 权限规则引擎 | Permission Engine | 五层责任链决策（自定义规则 → 审批 → 分级 → 沙箱 → 默认） | permission-engine.ts |
| 项目记忆 | Project Memory | 工作区根目录 PROJECT.md，注入 L3 Prompt | project-memory.ts |
| Provider 路由 | Provider Router | 根据 baseUrl / provider 字段自动选择 LLM API 协议 | provider-router.ts |
| 执行模式 | Execution Mode | Agent 工具审批策略：auto / confirm-all / plan-first | AgentLoopOptions |
| 多模态 | Multimodal | 消息携带图片附件，通过 Vision API 发送 | ImageAttachment |
| SSE 传输 | SSE Transport | MCP 客户端的远程 HTTP/SSE 传输方式（对比本地 stdio） | mcp/client.ts |

| activeView | activeView | 主内容区视图状态（chat / skills / memory / settings） | App.tsx 状态 |
| 项目选择器 | Project Selector | 输入区下方项目/工作区切换器，联动 workspaceRoot + cwd + sandbox | 类 Codex 风格 |
| 工作区根 | Workspace Root | 当前激活项目的根目录路径，shell_exec 的 cwd + 沙箱边界 | project-memory.ts |
| 文件浏览器 | File Browser | 右侧面板递归展示项目目录树 + 文件预览 | FileBrowser.tsx |
| 命名主题 | Named Theme | 7 个预定义主题（dark/light/mist/night-feast/green-garden/golden/blue-pool） | data-theme 属性 |
| PrismLight | PrismLight | react-syntax-highlighter 按需语言注册模式（对比全量 Prism） | Bundle 优化 |
| manualChunks | manualChunks | Vite/Rolldown 手动代码拆分配置 | vite.config.ts |
| 置顶会话 | Pinned Session | 用户手动置顶的对话，独立分组显示在列表顶部 | pinnedIds + localStorage |

| MentionPopup | MentionPopup | 输入框 `@` 触发的文件搜索弹窗组件 | MentionPopup.tsx |
| @file 上下文 | @file Context | 用户通过 `@文件名` 引用项目文件，发送时内容注入消息 | `<context><file>` 标签 |
| visionDenyCache | Vision Deny Cache | 内存级缓存，记录不支持 Vision 的 model+baseUrl 组合 | llm/index.ts |

| ToolContext | ToolContext | 工具执行时注入的运行时上下文（workdir / sessionId / signal），取代全局 import | shared/types.ts |
| 工具并发分批 | Batched Execution | 按 LLM 原始顺序分批执行：连续安全工具并行 → 遇非安全工具刷新批次串行 | tools/registry.ts executeAll |
| 子 Agent 黑名单 | Subagent Tool Blacklist | 禁止子 Agent 使用的工具列表（delegate_task / remember / forget / task_plan） | agent/subagent.ts |
| 工具/服务边界 | Tool vs Service | 工具 = LLM 可见薄壳；服务 = 内部逻辑（Runtime/中间件/其他工具可直接调用） | DEC-029 |
| task-plan-service | Task Plan Service | 任务规划的内部服务（状态管理 + SQLite 持久化），从 task_plan 工具中拆分 | services/task-plan-service.ts |

<!-- 后续开发中遇到新概念在此追加 -->

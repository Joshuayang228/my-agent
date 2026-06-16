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
| PlayGround | PlayGround | 组件沙箱页面，用于验证 UI 组件效果 | |
| HARD-GATE | HARD-GATE | 规则中的硬性门控，不可绕过 | 用 XML 标签包裹 |

| safeStorage | safeStorage | Electron 内置加密模块，用系统级密钥链加解密字符串 | 用于 API Key 加密存储 |
| 错误脱敏 | Error Sanitization | 从错误信息中过滤 API Key、URL 等敏感内容后再传给前端 | sanitize-error.ts |
| 指数退避 | Exponential Backoff | 重试间隔按 2^n 指数增长的策略 | LLM 调用重试 |
| 分层约束 | Layer Constraint | 模块间 import 方向的单向依赖规则 | core.mdc HARD-GATE |

<!-- 后续开发中遇到新概念在此追加 -->

# 功能清单

> 功能完成时由 AI 更新此文件。

## 核心功能

- [x] Agent Loop（think → act → observe 核心循环 + LLM 重试 + 工具超时保护）
- [x] 工具系统基础（声明式注册 + 真并发执行 + 动态注销 + 30s 超时）
- [x] 工具权限控制（破坏性操作前弹窗确认，IPC 双向通信）
- [x] 记忆系统 v1（用户画像 + 偏好 + 事实，注入 System Prompt）
- [x] 记忆系统 v2（Vectra 向量数据库 + Embedding API 语义检索 + 自动索引对话）
- [x] LLM 适配器（OpenAI 兼容流式 API + function calling）
- [x] LLM 路由（顶栏模型快切 + 多 Provider 预设）
- [x] 上下文压缩（三层分级：Snip / MicroCompact / Collapse，参照 Alice 方法论）
- [x] System Prompt 分层注入（4 层架构：人格定义 / 能力边界 / 上下文 / 动态，[PROTECTED]/[MUTABLE] 分区）
- [x] 用户画像三维化（identity / workflow / voice，自动提取写入记忆）
- [x] 人格模板系统（3 个内置人格：温暖伙伴 / 严谨顾问 / 技术极客，一键切换）
- [x] 转场白语 / 内心独白（`<aside>` 标签人格化小剧场 + 紫色气泡 UI）
- [x] MCP 协议支持（MCP Client + StdioClientTransport + 动态工具注册/注销）
- [x] 流式中断（AbortController + chat:abort IPC + 停止按钮）

## 桌面应用

- [x] Electron 主窗口
- [x] 对话界面（流式输出）
- [x] IPC 通信（统一 AgentStreamEvent 事件流，拆分 6 模块）
- [x] 会话管理（多会话 / 切换 / 删除 / 侧边栏）
- [x] 对话历史持久化（SQLite via sql.js）
- [x] 设置页面（模型配置 / API Key / Base URL / System Prompt / 人格选择 / MCP 管理）

## UI 组件

- [x] 消息气泡（用户 / AI 区分样式 + 入场动画）
- [x] 消息时间戳 + 一键复制
- [x] 工具调用可视化（执行中动画 / 结果展示）
- [x] 输入框（IME 兼容 + 自动高度调整）
- [x] 欢迎页（图标 + 快捷操作卡片 × 4）
- [x] Thinking 可视化（可折叠思考过程区域）
- [x] Token 消耗可视化（输入/输出/合计）
- [x] 流式打字光标
- [x] 会话侧边栏按日期分组（今天/昨天/更早）
- [x] Markdown 渲染（react-markdown + remark-gfm）
- [x] 代码高亮（react-syntax-highlighter / Prism / oneDark 主题）
- [x] MCP 服务器管理面板（连接状态 / 添加 / 删除 / 启用禁用）

## 内置工具

- [x] get_current_time（获取当前时间）
- [x] 网页搜索（Tavily keyless，零配置即可用）
- [x] 文件读写（file_read + file_write，支持行范围 / 追加模式）
- [x] 终端命令执行（shell_exec，30s 超时 + 输出截断）
- [ ] 代码搜索

## 数据与存储

- [x] SQLite 数据库初始化（sql.js WASM）
- [x] 对话历史持久化
- [x] 用户设置持久化（SQLite settings 表）
- [x] 向量数据库集成（Vectra LocalIndex，文件存储于 userData）
- [ ] 数据导出/导入

## 开发基础设施

- [x] 日志系统（彩色分级 Logger）
- [x] Electron remote debugging（port 9222）
- [x] Playwright E2E 测试（5 个 UI + Electron 真实对话框架）
- [x] vitest 单元测试覆盖（33 个测试：ToolRegistry / PromptBuilder / ContextManager / AgentLoop）
- [x] 主进程 IPC 模块化拆分（session / chat / settings / memory / persona / mcp）
- [x] 架构分层 import 方向约束（HARD-GATE 规则）

## 安全

- [x] API Key 通过 .env 环境变量管理
- [x] API Key 加密存储（Electron safeStorage）
- [x] 错误信息脱敏（过滤 API Key / URL）
- [x] 工具元数据声明（isReadOnly / isDestructive / isConcurrencySafe）
- [x] 用户确认弹窗（破坏性操作前 IPC 弹窗）

---

**图例**：
- `[x]` 已完成
- `[~]` 进行中
- `[ ]` 计划中

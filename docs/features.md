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
- [x] 上下文压缩（三层分级：Snip / MicroCompact / Collapse，优先使用 API 实际 token 数）
- [x] System Prompt 分层注入（4 层架构：人格定义 / 能力边界 / 上下文 / 动态，[PROTECTED]/[MUTABLE] 分区）
- [x] 用户画像三维化（identity / workflow / voice，自动提取写入记忆）
- [x] 人格模板系统（3 个内置人格：温暖伙伴 / 严谨顾问 / 技术极客，一键切换）
- [x] 转场白语 / 内心独白（`<aside>` 标签人格化小剧场 + 紫色气泡 UI）
- [x] MCP 协议支持（MCP Client + StdioClientTransport + 动态工具注册/注销）
- [x] 流式中断（AbortController + chat:abort IPC + 停止按钮 + per-session 锁）
- [x] 工具消息持久化（assistant+toolCalls 和 tool results 完整保存到 SQLite，多轮工具对话不再"失忆"）
- [x] 任务规划（task_plan 工具：创建/更新/追踪结构化计划）
- [x] 自我评估（L2 Prompt 指令：完成复杂任务后自检）
- [x] Agent 记忆工具（remember/recall/forget，AI 主动管理长期记忆）
- [x] Skill 系统（Markdown 操作手册，YAML frontmatter 元数据，按需激活注入）
  - Skill 加载器（userData/skills/ 用户目录 + 内置 skills-builtin/）
  - 自动注册 skill_invoke_xxx 工具（模型可主动调用）
  - Skill 列表注入 System Prompt L2（模型知道有哪些 Skill 可用）
  - 工具白名单（allowed_tools 激活后真正限制 LLM 可见工具集）
  - SkillsPanel 可视化管理 UI（Ctrl+Shift+K）
  - 2 个内置 Skill（代码审查 + 内容创作）

## 桌面应用

- [x] Electron 主窗口
- [x] 对话界面（流式输出）
- [x] IPC 通信（统一 AgentStreamEvent 事件流，拆分 8 模块）
- [x] 会话管理（多会话 / 切换 / 删除 / 重命名 / 侧边栏）
- [x] 切换会话后台继续流式（事件按 sessionId 隔离，完成后持久化，切回可见完整结果）
- [x] 首次运行引导（无 API Key 时自动打开设置 + Toast 提示）
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
- [x] 记忆管理面板 MemoryPanel（分类筛选 / 添加 / 编辑 / 删除）
- [x] 全局 Toast 通知系统（替代 alert()，4 种类型 + 动画 + 自动消失）
- [x] 会话双击重命名
- [x] 消息搜索（Ctrl+F，匹配高亮 + 不匹配降透明度 + 匹配计数）
- [x] 会话列表搜索（侧边栏按标题过滤）
- [x] LLM 智能标题（对话完成后异步生成 4-10 字摘要标题）
- [x] 后台流式指示器（侧边栏脉冲圆点）
- [x] 消息重新生成（重新生成最后一条 AI 回复）
- [x] 消息编辑（编辑已发送的用户消息 + 重新生成后续对话）
- [x] 单条消息删除（前端 + SQLite 持久化同步）
- [x] 回到底部浮动按钮（滚动距离 > 200px 时显示）
- [x] Mermaid 图表渲染（流程图/序列图/甘特图等，暗色主题适配）
- [x] 深色/浅色主题切换（CSS 变量 + localStorage 持久化）
- [x] 文件附件（拖拽/粘贴文件到聊天，1MB 限制，附件预览 + 移除）
- [x] OS 系统通知（窗口失焦时任务完成弹出系统通知，点击回到窗口）
- [x] MCP 环境变量配置 UI（KEY=VALUE 格式输入）
- [x] LLM 参数设置（Temperature / Top P / Max Tokens，设置页 + API 传参）

## 内置工具

- [x] get_current_time（获取当前时间）
- [x] 网页搜索（Tavily keyless，零配置即可用）
- [x] URL 内容抓取（url_fetch：获取网页文本，自动去 HTML 标签，15s 超时）
- [x] 文件读写（file_read + file_write，支持行范围 / 追加模式）
- [x] 终端命令执行（shell_exec，30s 超时 + 输出截断）
- [x] remember（写入长期记忆，自动去重 + 向量同步）
- [x] recall（检索长期记忆，按类别筛选）
- [x] forget（删除指定记忆，含向量库同步，需用户确认）
- [x] task_plan（结构化任务规划，创建/更新/追踪/清除）
- [x] 代码搜索（code_search：文本/正则搜索 + 文件类型过滤 + 上下文行）

## 数据与存储

- [x] SQLite 数据库初始化（sql.js WASM）
- [x] 对话历史持久化
- [x] 用户设置持久化（SQLite settings 表）
- [x] 向量数据库集成（Vectra LocalIndex，文件存储于 userData）
- [x] 数据导出/导入（JSON 格式，含会话+记忆+设置）

## 开发基础设施

- [x] 日志系统（彩色分级 Logger）
- [x] Electron remote debugging（port 9222）
- [x] Playwright E2E 测试（5 个 UI + Electron 真实对话框架）
- [x] vitest 单元测试覆盖（46 个测试 / 5 文件：ToolRegistry / PromptBuilder / ContextManager / AgentLoop / MemoryTools）
- [x] 主进程 IPC 模块化拆分（session / chat / settings / memory / persona / mcp / debug / data-export）
- [x] 架构分层 import 方向约束（HARD-GATE 规则）
- [x] Developer Panel 调试面板（Ctrl+Shift+D，4 Tab：Prompt/工具/系统/事件）
- [x] 快捷键体系（Ctrl+N 新建 / Ctrl+, 设置 / Ctrl+Shift+M 记忆 / Esc 关闭面板）
- [x] 数据导出/导入（JSON 格式，含会话+记忆+设置，自动脱敏，导入去重）

## 安全

- [x] API Key 通过 .env 环境变量管理
- [x] API Key 加密存储（Electron safeStorage）
- [x] 错误信息脱敏（过滤 API Key / URL）
- [x] 工具元数据声明（isReadOnly / isDestructive / isConcurrencySafe）
- [x] 用户确认弹窗（破坏性操作前 IPC 弹窗）
- [x] 沙箱系统（参考 Codex，三级策略 read-only / workspace-write / full-access）
  - 命令安全分级（ExecPolicy：安全命令白名单 + 危险模式黑名单）
  - 命令守卫（CommandGuard：路径边界检查 + 受保护路径 .git/.env）
  - 审批记录（session/persistent 级，防重复审批）
  - 进程加固（非 full-access 模式剥离 LD_PRELOAD/DYLD_INSERT_LIBRARIES）
  - 设置页 UI 沙箱模式选择
- [x] 执行模式（三种策略 auto / confirm-all / plan-first）
  - auto：仅破坏性工具需用户确认（默认）
  - confirm-all：每次工具调用都需审批
  - plan-first：System Prompt 强制 AI 先计划再执行
  - 设置页 UI 执行模式选择
- [x] Per-session 并发锁（防止同一会话并行 chat:send）
- [x] 累积 Token 预算追踪（session 级别 prompt/completion 分别累加）

## 框架能力（P11）

- [x] 消息管道（sanitizeToolCallPairs：修复孤儿 tool_call + 移除孤儿 tool result + 合并连续同 role）
- [x] 四层上下文压缩（L1 Snip → L2 MicroCompact → L3 Collapse LLM 摘要 → L4 AutoCompact 全量重写）
  - querySource 互斥守卫（防止压缩/记忆系统递归触发 LLM）
  - L3/L4 降级机制（非主循环调用自动回退到规则摘要）
- [x] Runtime 编排层（AgentRuntime 单例，统一管理会话生命周期、后台任务队列、优雅关闭）
  - 后台任务串行队列（画像提取 / 向量索引 / 智能标题）
  - IPC 层精简为事件转发（chat.ts 从 259 行精简到 41 行）
- [x] Multi-Agent 子 Agent 系统
  - delegate_task 内置工具（父 Agent 可委派任务给子 Agent）
  - 子 Agent 独立上下文（不污染父 Agent 消息历史）
  - 受限工具集（只读子 Agent / 白名单工具 / 权限只降不升）
  - 并发安全（只读子 Agent isConcurrencySafe=true）
- [x] 代码级修复
  - abort 精确传递 sessionId（前端 + preload + IPC 全链路）
  - session:tokenUsage preload 暴露（前端可获取 Token 用量）
  - 应用退出优雅关闭（Runtime shutdown + MCP 断连 + DB 关闭）

---

**图例**：
- `[x]` 已完成
- `[~]` 进行中
- `[ ]` 计划中

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
- [x] IPC 通信（统一 AgentStreamEvent 事件流，拆分 9 模块）
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
- [x] 文件精确编辑（file_edit：search_replace 模式，支持计数 / 插入 / 全部替换）
- [x] 补丁应用（apply_patch：unified diff 格式，fuzzy ±3 行匹配）
- [x] 终端命令执行（shell_exec，30s 超时 + 输出截断）
- [x] Git 工具链（git_status / git_diff / git_log / git_commit / git_branch）
- [x] remember（写入长期记忆，自动去重 + 向量同步）
- [x] recall（检索长期记忆，按类别筛选）
- [x] forget（删除指定记忆，含向量库同步，需用户确认）
- [x] task_plan（结构化任务规划，SQLite 持久化，跨重启可恢复）
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
- [x] vitest 单元测试覆盖（88 个测试 / 10 文件）
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

## 效率与可观测（P12）

- [x] 分场景 modelId（辅助模型配置，标题/画像/摘要可用便宜模型）
  - Settings 新增 auxModel 字段（留空沿用主模型）
  - Runtime 区分 getLLMConfig / getAuxLLMConfig
  - 设置页辅助模型 UI 输入框
- [x] Tool 中间件管道（可组合 middleware pipeline）
  - ToolMiddlewarePipeline 洋葱模型（注册 → 构建执行链）
  - 3 个内置中间件：error-formatting / logging / result-truncation（50K 字符截断）
  - ToolRegistry 集成中间件（可外部添加自定义中间件）
- [x] Token 限流 / 预算控制
  - 会话级限额（通过 SQLite 累积 token 检查）
  - 每日级限额（内存计数器，每日自动重置）
  - 超限自动终止并返回友好提示
  - 设置页会话/日级预算 UI
- [x] 结构化 Tracing / 可观测性增强
  - 轻量 Span 追踪系统（兼容 OTel 模型）
  - caller 分类（main/compact/memory/title/subagent/tool/system）
  - 嵌套 Span + 耗时统计 + 按 caller 聚合
  - debug:traces IPC 端点（暴露 Span 列表 + caller 统计 + 日 Token 用量）

## 高级框架能力（P13）

- [x] 权限规则引擎升级
  - 五层责任链：自定义规则 → 审批记录 → 命令分级 → 沙箱策略 → 默认行为
  - PermissionRule 支持 command/tool/path 三种类型 + allow/deny/ask 三种动作
  - 正则匹配 + 可编辑规则列表
- [x] ~~项目记忆 PROJECT.md~~ **已移除** — 与记忆系统功能重叠，伙伴产品不需要文件级项目知识
  - 读/写/追加接口，Agent 可通过工具更新
- [x] 多 Provider 路由
  - Provider 自动检测（根据 baseUrl 正则匹配）
  - OpenAI 兼容格式（覆盖 DeepSeek/Groq/OpenRouter/Together）
  - Anthropic Messages API 适配（SSE 流解析 + tool_use 映射）
  - Gemini API 请求体构建器
  - 预设新增 Claude Sonnet

## 测试扩充 + 多模态 + MCP SSE（P14）

- [x] 单元测试扩充（46 → 88 个）
  - Tool 中间件管道测试（洋葱模型 / 短路 / 截断 / 错误捕获 / 默认管道）
  - Token 预算控制测试（会话限额 / 日级限额 / 无限制放行）
  - 消息管道测试（孤儿 toolCall 修复 / 孤儿 tool 移除 / 连续角色合并 / 完整管道）
  - 权限引擎测试（自定义规则 / allow/deny/ask / disabled / 沙箱集成 / tool 规则）
  - Provider 路由测试（auto 检测 / 显式指定 / Anthropic 请求体 / Gemini 请求体）
- [x] 多模态支持
  - ImageAttachment 类型（dataUrl + mimeType + fileName）
  - LLM 适配器支持 image_url content parts（OpenAI Vision API 格式）
  - 前端粘贴图片自动添加到 pendingImages
  - 输入区图片预览条（缩略图 + 删除按钮）
  - 消息气泡内渲染用户附带的图片
- [x] MCP SSE/HTTP 传输层
  - McpServerConfig 新增 transport 字段（'stdio' | 'sse'）和 url 字段
  - 根据 transport 类型自动选择 StdioClientTransport 或 SSEClientTransport
  - 兼容远程 MCP 服务器（HTTP + SSE 长连接）

## 框架能力补齐（P15）

- [x] System Tray + 全局快捷键 + 后台运行
  - 系统托盘图标（关闭窗口最小化到托盘，不退出进程）
  - 托盘右键菜单（显示窗口 / 退出）
  - 托盘双击唤起窗口
  - 全局快捷键 Ctrl+Shift+A 唤起窗口
  - `isQuitting` 标志区分关闭和退出
- [x] Structured Output / JSON Mode
  - `ResponseFormat` 类型（text / json_object / json_schema）
  - `StreamChatOptions.responseFormat` 参数
  - OpenAI 请求体自动注入 `response_format`
- [x] Model Failover 自动降级
  - `FallbackModelConfig` 类型 + `LLMConfig.fallbackModels` 配置
  - 主模型失败后按序尝试备用模型
  - 降级时自动通知前端（显示切换提示）
  - 所有模型失败才抛错
- [x] Prompt Cache 支持（Anthropic）
  - System Prompt 标记 `cache_control: { type: 'ephemeral' }`
  - Tools 列表末位标记缓存
  - `anthropic-beta: prompt-caching-2024-07-31` 请求头
  - Usage 解析 `cache_read_input_tokens` / `cache_creation_input_tokens`
  - Agent Loop 默认启用 `enablePromptCache: true`
- [x] Streaming Tool Calls 流式工具参数
  - `AgentStreamEvent` 新增 `tool_call_delta` 事件类型
  - OpenAI + Anthropic 双适配器实时 yield 工具参数增量
  - 前端 `ToolStatus` 新增 `pending` 状态 + `streamingArgs` 字段
  - 工具卡片实时显示参数解析过程（青色脉冲指示器）
- [x] UI 修复
  - 小声蛐蛐（aside）移到消息下方 + 标签不泄漏（支持多个 aside）

## 高级功能扩展（P16）

- [x] Auto Update 自动更新
  - electron-updater 集成（autoDownload=false，用户确认后下载）
  - 启动 3s 后自动检查更新（生产环境）
  - IPC 端点：check / download / install
  - 前端事件：update-available / download-progress / update-downloaded
- [x] 会话分支/Fork
  - `session:fork` IPC 端点 + `forkSession` DB 层
  - 从任意消息分叉，复制该消息及之前所有历史到新会话
  - 新会话标题自动加"(分支)"后缀
  - 前端消息操作栏"⑂ 分支"按钮
- [x] Scheduled Tasks 定时任务
  - `scheduler/index.ts` 调度器模块（interval + 简易 cron）
  - SQLite `scheduled_tasks` 表持久化
  - CRUD IPC 端点 + preload API
  - 任务触发时发送 `scheduler:triggered` 事件到前端
  - 启动时自动恢复活跃任务，退出时清理定时器
- [x] RAG 文档管道
  - `rag/index.ts` 文档导入 + 分块 + Embedding 管道
  - 段落感知分块（800 字符块 + 100 字符重叠）
  - 独立 RAG 向量索引（与记忆索引分离）
  - SQLite `rag_documents` 表管理文档元数据
  - `rag_search` 内置工具（Agent 可语义检索知识库）
  - 文件选择对话框导入（支持 txt/md/json/csv/py/js/ts 等）
  - 内置工具增至 13 个
- [x] Voice I/O 语音交互
  - 语音输入（Web Speech API / SpeechRecognition，中文）
  - 语音输出（SpeechSynthesis TTS 朗读）
  - 输入区 🎤 语音按钮（录音时红色脉冲动画）
  - AI 消息 🔊 朗读按钮
  - 支持连续语音识别 + 实时转写到输入框

## UI V2 改版（Codex 风格）

- [x] 对话样式重设计
  - 用户消息右对齐圆角气泡（`--msg-user-bg` 背景 + 边框）
  - AI 消息左对齐纯 Markdown（去掉 You/Agent 角色标签）
  - 消息操作栏（复制/编辑/分支/删除）hover 显示于消息下方
  - 消息间距加大（`space-y-6`）
- [x] 输入区卡片化
  - 居中卡片式布局（`max-w-2xl mx-auto`）
  - 工具栏集成：附件 + 审批模式 + 模型快切 + 语音 + 发送/停止
  - 圆形发送按钮 + 输入占位符"随心输入"
- [x] 审批模式内联
  - 三级下拉选择器（请求批准 / 替我审批 / 完全访问）
  - 嵌入输入区工具栏，一键切换
  - 选项同步写回 Settings
- [x] 底部状态栏移除
  - 原状态栏完全移除
  - Token 用量移到输入框下方显示
  - 模型选择移入输入区工具栏
- [x] 侧边栏重组
  - 顶部功能区：新对话 / 搜索 / 技能快捷按钮
  - 对话列表保持不变
  - "设置"按钮支持 `activeView` 联动
- [x] 顶栏精简
  - 高度 `h-10` → `h-12`
  - 仅显示会话标题 + 当前人格名称
  - 汉堡菜单仅在侧边栏关闭时可见
- [x] 设置页独立全屏
  - 独占整个窗口（替换侧边栏 + 主内容区）
  - 左侧导航栏（人格 / 模型 / 安全 / 高级 / MCP / 数据）
  - "← 返回应用"按钮退出设置
  - 各区块 `id` 属性支持导航滚动定位
- [x] 技能/记忆 Tab 视图
  - `activeView` 状态管理（chat / skills / memory / settings）
  - 技能/记忆在主内容区全屏渲染（不再使用侧推面板）
  - 侧边栏/全局快捷键触发 Tab 切换
- [x] 代码渲染主题跟随
  - `SyntaxHighlighter` 动态切换 `oneDark` / `oneLight`
  - `MutationObserver` + `useSyncExternalStore` 监听 `data-theme`
  - Mermaid 图表跟随主题（`dark` / `default`）
- [x] 整体视觉优化
  - 内容宽度收窄（`max-w-4xl` → `max-w-3xl`）
  - 欢迎屏简化居中（"我们应该构建什么？"）
  - Electron 菜单栏隐藏（`autoHideMenuBar: true`）
  - CSS 变量新增：`--msg-user-bg` / `--msg-ai-bg` / `--sidebar-active` / `--card-bg` / `--hover-overlay` 等
  - 新增动画：`slide-in-right` / `slide-in-left`
- [x] 项目/沙箱目录选择器
  - 输入框下方 `📁 [项目名] ▾` 下拉菜单
  - 最近项目列表（最多 10 个，自动过滤已删除目录）
  - "添加新项目"（系统文件夹选择器）/ "不使用项目"
  - 后端 IPC 4 个（browse / list / set / get）+ SQLite 持久化
  - 联动 workspaceRoot / process.cwd / 沙箱策略

## UI V2 增强（Alice 风格）

- [x] 设置页左侧导航重构
  - 两栏布局：左侧分类导航 + 右侧滚动内容区
  - 基础/高级两组分区（通用/模型/安全 + MCP/数据/开发者/关于）
  - SectionTitle + FieldGroup 统一布局组件
- [x] 会话右键菜单增强
  - 重命名 / 置顶 & 取消置顶 / 重新生成标题 / 删除
  - 置顶会话独立分组显示 + localStorage 持久化
- [x] 多主题支持（7 个命名主题）
  - dark / light / mist / night-feast / green-garden / golden / blue-pool
  - 设置页主题选择器（色板预览 + 描述）
  - 侧边栏快切按钮智能识别明暗
- [x] 项目文件浏览器面板
  - 顶栏「项目文件」按钮打开右侧面板
  - 递归目录树（深度 3，忽略 node_modules/.git 等）
  - 文件搜索过滤 + 点击预览内容（256KB 限制）
  - IPC: project:listFiles / project:readFile
- [x] Provider 分组管理
  - 设置页模型预设按"海外直连 / 国内服务商 / 本地自定义"分组
- [x] 关于页面
  - 设置页"关于"板块（版本/技术栈/致谢）
- [x] Lucide 图标统一
  - 全部 Emoji/原始 SVG 替换为 lucide-react 组件
  - 页面过渡动画（view-transition / sidebar-transition）
  - 用户消息气泡去边框 + Token 用量 hover 显示

## @file 上下文选择器

- [x] 输入框 `@` 触发文件搜索弹窗（MentionPopup 组件）
  - 工作区文件树扁平化 + 模糊搜索（深度 3 层）
  - 键盘导航（↑↓Enter Esc）+ 点击选择
  - 选中后输入框显示 `@文件路径` + 文件标签栏
- [x] 发送时自动读取引用文件内容，以 `<context>` 标签注入消息
  - 单文件 50KB 截断保护
  - 支持多文件引用
- [x] 无后端改动（复用 `project:listFiles` + `project:readFile` IPC）

## Bundle 优化 + 打包

- [x] PrismLight 按需加载（16 种语言，syntax-hl 93KB，全量版 ~400KB+）
- [x] Vite manualChunks 拆分（react-vendor / markdown / syntax-hl 独立 chunk）
- [x] 首次 Windows NSIS 安装包构建（electron-builder，147.6MB）

## 框架能力补齐（P17）

- [x] Vision 动态兼容：乐观发送 → 错误驱动降级 → 缓存（image_url → 文字占位符，零配置）
- [x] 结构化编辑工具（file_edit 精确替换 + apply_patch unified diff）
- [x] Git 原生工具链（5 个工具：status/diff/log/commit/branch）
- [x] ~~项目级 Rules 注入~~ **已移除** — 不符合伙伴产品定位，用户通过记忆系统定制 Agent 行为
- [x] task_plan SQLite 持久化（会话绑定，跨重启恢复，内存 fallback）
- [x] Headless Agent Runtime（runHeadless 无 UI 执行 + Scheduler 直接触发 Agent Loop）
- [x] Headless 审批策略（只读工具放行 / shell_exec 拒绝 / 非破坏性放行）
- [x] Gemini 流式适配器（streamChatGemini SSE 解析 + functionCall 映射）
- [x] Verify 自愈中间件（file_write/edit/patch 后自动语法检查，错误注入结果）
- [x] 内置工具 13 → 20 个（file_edit/apply_patch/git_status/diff/log/commit/branch）

## 框架正确性修复（P0 方法论对齐）

- [x] 工具并发顺序修复 — executeAll 按 LLM 原始顺序分批（连续安全工具并行 / 遇非安全工具刷新批次串行）
- [x] ToolContext 依赖注入 — 工具通过 `ctx: ToolContext` 获取 workdir / sessionId / AbortSignal，取代全局 import
- [x] permission-engine 接入主流程 — Agent Loop 统一调用 `checkToolPermission`，替代散落的 `isDestructive` 判断
- [x] 子 Agent 工具黑名单 — 禁止 delegate_task 递归 + 排除 remember / forget / task_plan 修改父状态
- [x] 工具/服务边界分离 — task_plan 拆分为 service（状态管理/SQLite）+ tool（LLM 薄壳），对齐 CC 的 Tool vs 内部服务设计

## Agent Loop 深度重构（M1 模块化改进）

- [x] LoopState 状态结构体 — 集中管理 turnCount / messages / lastPromptTokens / deniedTools / transition，消灭散落局部变量
- [x] 循环重构为 while 状态机 — `for` → `while(state.turnCount < maxIterations)` + `ContinueReason` 控制跳转
- [x] done 事件携带 TerminalReason — completed / max_turns / aborted / prompt_too_long / model_error 五种终止原因
- [x] maxIterations 提升至 50 — 对齐 Claude Code 允许复杂任务多轮执行
- [x] 413 紧急压缩 + 重试 — 检测 prompt_too_long / context_length_exceeded 触发 reactive compact，一次机会
- [x] max_output_tokens 截断恢复 — 检测 stopReason=max_tokens/length，注入 continuation prompt 最多恢复 2 次
- [x] abort 后合成 synthetic tool_result — 取消时为未执行的 tool_calls 补充 `[Tool execution cancelled by user]` 保持消息配对
- [x] 权限拒绝累积追踪 — deniedTools 数组记录被拒绝工具，去重后注入 System Prompt 尾部避免模型反复尝试
- [x] LLM stopReason 提取 — OpenAI finish_reason / Anthropic stop_reason / Gemini finishReason 三端统一为 StreamChatResult.stopReason

---

**图例**：
- `[x]` 已完成
- `[~]` 进行中
- `[ ]` 计划中

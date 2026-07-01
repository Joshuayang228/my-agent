# 变更日志

> 每次发版或修 Bug 时由 AI 更新此文件。
> 格式遵循 [Keep a Changelog](https://keepachangelog.com/)。

## [未发布]

### Changed — M3 LLM 路由层深啃（2026-07-01）
- **G1 辅助调用统一走路由层**：新增 `chatComplete()` 非流式便捷入口（消费 `streamChat` 到结束取终态），摘要（context-manager）/ 画像（profile-extractor）/ 标题（session-store）三处改走它
  - 连带收益：三个辅助功能自动获得多 Provider（Anthropic/Gemini）+ failover + Vision 降级，删除三份重复 fetch 样板
  - 之前手拼 OpenAI 请求，切非 OpenAI 模型会静默失效
- **G2 usage 流式累积正确性**：改为合并更新 + `>0` guard
  - 修复 Anthropic `message_delta` 重建 usage 对象时丢失 `message_start` 设的 cache tokens
  - OpenAI 分支加 `>0` guard，防代理在中间 chunk 塞 0 值覆盖真实统计
- **G3 遵从服务端 retry-after**：新增 `LLMError` 类（携带 `status` + `retryAfterMs`）+ `parseRetryAfterMs`（支持秒数/HTTP 日期），四处抛错点改用它；loop 重试等待优先遵从服务端 retry-after，否则退回指数退避
- **G5 caller 归因**：`StreamChatOptions` 加 `caller` 字段，streamChat 入口打日志，loop 主对话标 `'main'`，chatComplete 透传调用来源
- **G4 评估后关闭**：对照 CC 源码确认「重试职责下沉到 LLM 层」是错误方向——413 压缩必须在能看到 state 的循环层，failover 才在 LLM 层，当前分层与 CC 同构
- 单元测试 106 → 113（新增 chatComplete 4 个 + G2/G3 3 个）
- 沉淀 `methodology/m03-llm-routing.md` + `m03-llm-routing-code.md`

### Added — @file 上下文选择器（2026-06-19）
- 输入框输入 `@` 触发文件搜索弹窗（MentionPopup 组件）
- 工作区文件树扁平化 + 模糊搜索（深度 3 层，排除 node_modules/.git 等）
- 键盘导航（↑↓Enter Esc）+ 点击选择 + 点击外部关闭
- 选中后输入框显示 `@文件路径`，上方出现引用文件标签栏（可单独删除）
- 发送消息时自动通过 IPC 读取引用文件内容，以 `<context><file>` 格式注入消息
- 50KB 截断保护，支持多文件引用
- 无后端改动，复用 `project:listFiles` + `project:readFile` IPC

### Removed — 项目级 Rules + PROJECT.md（2026-06-19）
- 移除 `loadProjectRules()`、`buildProjectRulesPrompt()` 及相关搜索路径常量
- 移除 `PROJECT.md` 读写机制（`readProjectMemory`/`writeProjectMemory`/`appendProjectSection`/`buildProjectMemoryPrompt`）
- 移除 `prompt-builder.ts` 中 `projectRules` 和 `projectMemory` 字段及注入逻辑
- `project-memory.ts` 精简为纯 `workspaceRoot` 管理（`setWorkspaceRoot`/`getWorkspaceRoot`）
- 原因：自动加载 `.cursor/rules`、`AGENTS.md` 等文件是开发工具的做法，`PROJECT.md` 与记忆系统功能重叠。AI 伙伴产品中用户通过**记忆系统**定制 Agent 行为已足够

### Changed — Vision 动态兼容（2026-06-19）
- 将硬编码的 `checkVisionSupport` 模型白名单替换为基于缓存的乐观策略
  - 默认乐观发送图片，首次 API 返回 Vision 相关错误时标记为不支持
  - `visionDenyCache`（model+baseUrl）缓存，后续同模型直接走无图模式
  - `isVisionRelatedError()` 匹配 `image_url`/`vision`/`multimodal` 等关键词
  - OpenAI 路径完整重试闭环，Anthropic/Gemini 路径基于缓存决策
- 零配置零维护，新模型无需手动更新代码

### Added — 项目选择器（2026-06-19）
- 输入框下方项目/沙箱目录选择器（类 Codex 风格）
  - 📁 下拉菜单：最近项目（最多 10 个）+ 添加新项目 + 不使用项目
  - 后端 `project:browse` / `project:list` / `project:set` / `project:get` IPC
  - SQLite 持久化 `currentProject` + `recentProjects`
  - 选择项目后联动 `workspaceRoot` / `process.cwd()` / 沙箱策略
- IPC 模块 11 → 12 个（新增 `project.ts`）

### Fixed — 流式状态不结束（2026-06-19）
- AI 完成回复后输入框仍显示停止按钮无法输入
  - 根因：Electron IPC `invoke` 响应可能先于 `send` 事件到达渲染进程
  - `finally` 块提前移除了事件监听器，导致 `done` 事件丢失
  - 修复：`sendMessage` 的 `finally` 中加入安全兜底 `setIsStreaming(false)`

### Changed — UI V2 Codex 风格改版（2026-06-19）
- 对话样式重设计
  - 用户消息右对齐圆角气泡（`--msg-user-bg` 背景 + 边框）
  - AI 消息左对齐纯 Markdown（去掉 You/Agent 角色标签）
  - 消息操作栏移到消息下方 hover 显示
  - 消息间距加大（`space-y-6`）
- 输入区卡片化（`max-w-2xl mx-auto`，集成审批/模型/附件/语音/发送）
- 审批模式内联（三级下拉：请求批准 / 替我审批 / 完全访问）
- 底部状态栏移除（Token 用量移到输入框下方，模型选择移入工具栏）
- 侧边栏重组（顶部功能区：新对话/搜索/技能 + 对话列表）
- 顶栏精简（`h-12`，仅标题 + 人格名称）
- 设置页独立全屏（独占窗口 + 左侧导航栏 + 返回应用按钮）
- 技能/记忆改为主区域 Tab 视图（`activeView` 状态管理）
- 代码渲染主题跟随（`oneDark`/`oneLight` 动态切换 + MutationObserver）
- Mermaid 图表跟随主题（`dark` / `default`）
- 内容宽度收窄（`max-w-4xl` → `max-w-3xl`）
- 欢迎屏简化居中（"我们应该构建什么？"）
- Electron 菜单栏隐藏（`autoHideMenuBar: true`）
- CSS 变量扩充（`--msg-user-bg` / `--sidebar-active` / `--card-bg` / `--hover-overlay` 等）
- 前端规则 `code-frontend.mdc` 全面重写（三列布局 / 设计原则 / 快捷键体系）

### Fixed — UI V2 Bug 修复（2026-06-19）
- Shell 命令输出中文乱码（Windows `chcp 65001` + UTF-8 编码）
- 浅色模式代码块样式异常（硬编码颜色改 CSS 变量 + 动态切换 highlighter 主题）
- 输入区下拉菜单被截断（移除 `overflow-hidden` + 添加 `relative` 定位）

### Added — P16 高级功能扩展（2026-06-18）
- Auto Update（`electron-updater` 集成）
  - `autoDownload=false`，用户确认后下载安装
  - 启动 3s 后自动检查更新（生产环境）
  - IPC 端点：`updater:check` / `updater:download` / `updater:install`
- 会话分支/Fork
  - `session:fork` IPC + `forkSession` DB 层（克隆消息到新会话）
  - 前端消息操作栏 "⑂ 分支" 按钮
- Scheduled Tasks 定时任务
  - `scheduler/index.ts` 调度器模块（interval + 简易 cron）
  - SQLite `scheduled_tasks` 表 + CRUD IPC
  - 启动自动恢复 + 退出清理定时器
- RAG 文档管道
  - `rag/index.ts` 文档导入 + 段落感知分块（800 字符/100 重叠）
  - 独立 RAG 向量索引（与记忆分离）
  - `rag_search` 内置工具（第 13 个）
  - `rag:ingest` 文件选择对话框导入
- Voice I/O 语音交互
  - Web Speech API 语音输入（中文，连续识别）
  - SpeechSynthesis TTS 朗读
  - 输入区 🎤 按钮 + AI 消息 🔊 朗读按钮
- 新增依赖：`electron-updater`
- IPC 模块 9 → 11 个（新增 `scheduler.ts` / `rag.ts`）

### Added — P15 框架能力补齐（2026-06-18）
- System Tray + 全局快捷键
  - 关闭窗口最小化到托盘 + 托盘右键菜单 + 双击唤起
  - `Ctrl+Shift+A` 全局快捷键唤起窗口
- Structured Output / JSON Mode
  - `ResponseFormat` 类型（text / json_object / json_schema）
  - OpenAI 请求体自动注入 `response_format`
- Model Failover 自动降级
  - `FallbackModelConfig` + `LLMConfig.fallbackModels`
  - 主模型失败按序降级 + 前端切换提示
- Prompt Cache（Anthropic）
  - System Prompt + Tools 末位标记 `cache_control: ephemeral`
  - Usage 解析 `cache_read_input_tokens` / `cache_creation_input_tokens`
- Streaming Tool Calls
  - `tool_call_delta` 事件（OpenAI + Anthropic 双适配）
  - 前端工具卡片实时显示参数解析过程

### Fixed — P15 UI 修复（2026-06-18）
- 小声蛐蛐（aside）移到消息下方 + 标签不泄漏（支持多个 aside）

### Changed — 规则体系精简（2026-06-17）
- **Phase 6 自审**：从"读外部 Skill 文件"改为内联 10 项检查清单
- **Phase 8 Bug 修复**：内联 7 步调试流程 + 常见陷阱（原 debug-guide.md）
- **Phase 1 接需求**：区分"新需求五步确认"和"已批准子任务简化执行"
- **Phase 11 收尾**：必查项从 8 个精简为 3 个必查 + 5 个按需
- **Skill 路由表**：从 7 项精简为 5 项"参考表"
- **commit message**：统一改为英文（git-workflow.md）
- 回填 model-config.md（Provider 路由/双模型/调用规范）
- 回填 security-checklist.md（沙箱系统/权限引擎/加密存储）
- 删除过时的 playground-guide.md
- 补齐 P10-P14 全部文档债务（changelog/decisions/api-contracts/architecture/glossary）
- 文档结构精简 12→10 个（删除过时 api.md，合并 data-flow.md 到 architecture.md）
- 重写 testing.md（用 88 个测试的实际覆盖替换过时模板）
- Git pre-commit hook（代码变更时强制要求同步更新 progress.md + changelog.md）
- 编辑纪律新增：IPC 接口三处同步检查 + 测试文件查重

### Added — P14 测试扩充 + 多模态 + MCP SSE（2026-06-17）
- 单元测试 46 → 88 个，新增 5 个测试文件
  - middleware.test.ts（洋葱模型 / 短路 / 截断 / 错误捕获）
  - token-budget.test.ts（会话限额 / 日级限额 / 无限制放行）
  - message-pipeline.test.ts（孤儿修复 / 连续角色合并）
  - permission-engine.test.ts（自定义规则 / 沙箱集成）
  - provider-router.test.ts（自动检测 / Anthropic/Gemini 请求体）
- 多模态图片支持
  - `ImageAttachment` 类型（dataUrl + mimeType + fileName）
  - LLM 适配器支持 `image_url` content parts（OpenAI Vision API）
  - 前端粘贴图片 → pendingImages 预览条 → 消息气泡渲染
- MCP SSE/HTTP 传输层
  - `McpServerConfig` 新增 `transport` 字段（`'stdio' | 'sse'`）和 `url` 字段
  - `SSEClientTransport` 支持远程 MCP 服务器

### Added — P13 高级框架能力（2026-06-17）
- 权限规则引擎升级（`permission-engine.ts`）
  - 五层责任链：自定义规则 → 审批记录 → 命令分级 → 沙箱策略 → 默认
  - `PermissionRule` 支持 command/tool/path 类型 × allow/deny/ask 动作
- 项目记忆 PROJECT.md（`project-memory.ts`）
  - 工作区 PROJECT.md 自动检测 → L3 Prompt 注入（4000 字截断）
  - 读/写/追加接口
- 多 Provider 路由（`provider-router.ts`）
  - `detectProvider()` 根据 baseUrl 正则自动匹配
  - Anthropic Messages API 适配（SSE 流 + content_block_delta + tool_use 映射）
  - Gemini API 请求构建器（systemInstruction + functionDeclarations）
  - 预设新增 Claude Sonnet

### Added — P12 效率与可观测（2026-06-17）
- 分场景 modelId
  - `auxModel` 辅助模型设置（标题/画像/摘要用便宜模型）
  - Runtime 区分 `getLLMConfig()` / `getAuxLLMConfig()`
- Tool 中间件管道（`middleware.ts`）
  - `ToolMiddlewarePipeline` 洋葱模型
  - 3 个内置中间件：error-formatting / logging / result-truncation（50K 字符截断）
  - `ToolRegistry` 集成中间件，支持 `rebuildPipeline()`
- Token 限流/预算控制（`token-budget.ts`）
  - 会话级限额（SQLite 累积 token 检查）
  - 日级限额（内存计数器，每日自动重置）
  - 超限自动终止 + 友好提示
- 结构化 Tracing（`tracer.ts`）
  - 轻量 Span 追踪（兼容 OTel 模型）
  - caller 分类（main/compact/memory/title/subagent/tool/system）
  - `debug:traces` IPC 端点

### Changed — P12 设置页扩展（2026-06-17）
- 设置页新增辅助模型输入框
- 设置页新增会话/日级 Token 预算配置

### Added — P11 框架进阶（2026-06-17）
- 消息管道（`message-pipeline.ts`）
  - `sanitizeToolCallPairs`：补全孤儿 toolCall 的占位 tool 消息
  - `removeOrphanToolResults`：移除无对应 toolCall 的 tool 消息
  - `mergeConsecutiveRoles`：合并连续同角色消息
- 四层上下文压缩升级
  - L3 Collapse 使用 LLM 生成摘要（降级：规则占位符）
  - L4 AutoCompact 紧急全量重写
  - `querySource` 互斥守卫防递归
- Runtime 编排层（`runtime.ts`）
  - `AgentRuntime` 单例：会话生命周期 + 后台任务队列 + 优雅关闭
  - `ipc/chat.ts` 大幅精简（259 → 41 行）
- Multi-Agent 子 Agent 系统
  - `delegate_task` 工具（第 12 个内置工具）
  - `subagent.ts`：独立上下文 + 受限工具集 + 权限只降不升

### Fixed — P11 代码修复（2026-06-17）
- `chat:abort` 全链路传递 sessionId（preload + App.tsx）
- `session:tokenUsage` IPC 暴露到渲染进程
- `window-all-closed` 集成 `runtime.shutdown()` 优雅关闭

### Added — P10 框架补强（2026-06-17）
- 工具消息持久化（assistant toolCalls + tool result 存入 SQLite）
- Per-session 并发锁（`Map<sessionId, AbortController>`）
- 沙箱系统
  - `SandboxPolicy`（read-only / workspace-write / full-access）
  - `ExecPolicy`（命令安全分级：safe / dangerous / unknown）
  - `CommandGuard`（路径边界检查 + 受保护路径检测）
  - `ApprovalStore`（会话级 + 持久级审批记录）
- Skill `allowed_tools` 执行（filterTools 回调）
- 精确 Token 计数（优先使用 API 返回的 `usage.promptTokens`）
- 累积 Token 使用追踪（`addTokenUsage` / `getTokenUsage`）
- 执行模式（auto / confirm-all / plan-first）

### Added — P9 Skill 系统（2026-06-17）
- Skill 系统完整实现（结合 Cursor + Alice 方法论设计）
  - `SkillFrontmatter` 类型：name / description / when_to_use / allowed_tools / disable_model_invocation / version
  - `SkillDefinition` 类型：meta + body + filePath + source
- Skill 加载器（gray-matter YAML frontmatter 解析，双目录扫描：内置 + 用户）
- Skill 注册器（自动生成 `skill_invoke_xxx` 工具，激活后正文注入上下文）
- Skill IPC 模块 9 个端点（list / get / save / delete / reload）
- SkillsPanel UI（左右分栏列表+编辑，新建模板预填，来源标签，触发条件展示）
- Skill 摘要注入 System Prompt L2.5（模型知道可用 Skill 列表和调用方式）
- 2 个内置 Skill 示例（code-review：代码审查流程，content-creator：内容创作流程）
- 快捷键 Ctrl+Shift+K 开关 Skill 面板
- 对话结束自动清除激活的 Skill（clearActiveSkill）
- 新增依赖：gray-matter（YAML frontmatter 解析）

### Added — P8 交互增强（2026-06-17）
- 消息重新生成（最后一条 AI 回复下方 ↻ 按钮，移除旧回复后重新请求 LLM）
- 消息编辑（用户消息 ✎ 按钮，内联 textarea 编辑 + 截断后续对话重新生成）
- 单条消息删除（所有消息 hover 显示删除按钮，前端 + SQLite 同步）
- LLM 参数设置（Temperature / Top P / Max Tokens 三个控件，设置页 grid 布局 + API body 传参）
- URL 内容抓取工具 url_fetch（GET 请求 + HTML 标签剥离 + 50KB 截断 + 15s 超时）
- 回到底部浮动按钮（滚动距离 > 200px 时显示圆形按钮 + 向下箭头图标）
- OS 系统通知（Electron Notification API，窗口失焦 + 任务完成时弹出，点击回到窗口聚焦）
- Mermaid 图表渲染（集成 mermaid 库，code block 自动检测 ```mermaid 语言，暗色主题适配，错误降级为 pre）
- 深色/浅色主题切换（CSS 变量 data-theme + localStorage 持久化，侧边栏 ☀️/🌙 按钮）
- 文件附件（拖拽/粘贴文件到聊天区域，1MB 限制，附件预览条 📎 + 移除 ×，内容拼接进用户消息）
- MCP 环境变量配置 UI（添加 MCP 时可填 KEY=VALUE 格式的 env textarea）
- 内置工具增至 11 个（新增 url_fetch）

### Added — P7 体验完善 + 新工具（2026-06-17）
- code_search 内置工具（文本/正则搜索 + 文件类型过滤 + 上下文行 + 忽略 node_modules/.git 等）
- 全局 Toast 通知系统（success/error/warning/info 4 种类型，右下角动画弹出，3.5s 自动消失）
- 首次运行引导（无 API Key 时自动打开设置面板 + Toast 提示）
- 会话双击重命名（侧边栏双击进入编辑，Enter 确认 / Esc 取消 / 失焦自动保存）
- 切换会话后台继续流式（不中止 AI 响应，事件通过 sessionId 过滤，完成后保存到数据库，切回可见完整结果）
- 替换所有 alert() 为 Toast（SettingsPanel 中 MCP/导出/导入操作反馈）
- 消息搜索（Ctrl+F 搜索当前会话，匹配高亮 + 不匹配降透明度 + 匹配数统计）
- 会话列表搜索（>3 个会话时显示搜索框，按标题过滤）
- LLM 智能标题（对话完成后异步调用 LLM 生成 4-10 字摘要标题，替代前 30 字截断）
- 后台流式指示器（侧边栏中正在生成的非当前会话显示青色脉冲圆点）

### Added — P6 续：框架补齐（2026-06-17）
- 新工具单元测试 13 个（remember/recall/forget/task_plan），总测试数 33→46
- 数据导出/导入（JSON 格式，含会话+记忆+设置，导出自动脱敏 API Key，导入去重合并）
- 快捷键体系（Ctrl+N 新建会话 / Ctrl+, 设置 / Ctrl+Shift+M 记忆管理 / Esc 关闭面板 / Ctrl+Shift+D 调试面板）
- DevPanel Prompt 预览修复（使用与 chat 一致的 buildUserProfile，含 5 分类完整画像）

### Added — P6 记忆系统重构 + Agent 认知能力（2026-06-16）
- 记忆管理 UI（MemoryPanel：5 分类筛选 / 添加 / 编辑 / 删除 / 日期显示）
- Agent 记忆工具（remember / recall / forget，AI 可主动管理用户长期记忆）
- 任务规划工具（task_plan：创建结构化计划 / 追踪进度 / 自动提示下一步）
- 自我评估机制（L2 Prompt 指令：复杂任务后自检完整性/正确性）
- Profile 提取增强（加入本轮 assistant 回复 / 节流 5→2 分钟 / 扩展 5 类别）
- 记忆类型（MemoryCategory / MemoryEntry）移入 shared/types.ts

### Fixed — P6 记忆系统 Bug（2026-06-16）
- Prompt 双重注入（userProfile + buildMemoryContext 数据完全重复，浪费 token）
- SQLite ↔ 向量库不同步（增/删/改记忆现自动联动向量库）
- Profile 提取节流在 API 失败时也锁定（改为仅成功时更新计时器）
- Profile 提取缺本轮 assistant 回复（补传 latestAssistantContent）

### Added — Developer Panel 可观测性调试面板（2026-06-16）
- Ctrl+Shift+D 快捷键开关 Developer Panel
- System Prompt 可视化（4 层分层查看 + 当前人格 + 字符/token 估算）
- 工具注册表总览（所有已注册工具 + 元数据标签：只读/破坏性/并发安全）
- 系统状态面板（Electron/Node 版本、内存使用、LLM 配置、MCP 连接状态）
- 实时事件日志（订阅 AgentStreamEvent 流，按类型彩色标记，最近 500 条）
- Debug IPC 模块新增 3 个端点（debug:system-prompt / debug:tools / debug:system-info）

### Added — P5 UI 打磨 + Agent 能力 + 安全加固（2026-06-16）
- API Key 加密存储（Electron safeStorage，透明加解密）
- 错误信息脱敏（过滤 API Key / URL 后传渲染进程）
- 欢迎页增强（图标 + 4 个快捷操作卡片：聊天/工具/设置/搜索）
- 消息时间戳 + 助手消息一键复制
- Thinking 可视化（可折叠思考过程区域）
- 会话侧边栏按日期分组（今天/昨天/更早）
- Token 消耗可视化（底栏：输入/输出/合计 tokens）
- 消息入场动画 + 流式打字光标
- 工具真并发执行（concurrencySafe 的工具走 Promise.all）
- LLM 调用重试（最多 2 次，指数退避，网络/429/5xx 可重试）
- 工具超时保护（30s，超时自动返回错误）
- 架构分层 import 方向约束（core.mdc HARD-GATE）

### Fixed（2026-06-16）
- .env 变量不加载到设置默认值（DEFAULTS 改为惰性 getDefaults()）
- SQLite 空字符串覆盖 .env 默认值（跳过空值 fallback）
- Embedding API 404 重复报错（embeddingUnavailable 标记）

### Added — P4 框架搭建（2026-06-16）
- 主进程 IPC 模块化拆分（index.ts 281→131 行，6 个独立 IPC 模块）
- vitest 单元测试覆盖（33 个测试：ToolRegistry / PromptBuilder / ContextManager / AgentLoop）
- MCP 协议支持（MCP Client + StdioClientTransport + 动态工具注册/注销）
- MCP 服务器管理 UI（设置页内：连接/断开/启用/禁用/状态显示）
- 长期记忆向量检索（Vectra 本地向量数据库 + OpenAI 兼容 Embedding API）
- 对话自动向量索引（用户消息 + 助手回复异步写入向量库）
- 语义召回注入 System Prompt（每次对话前 top-5 向量检索结果注入 L3 层）
- ToolRegistry.unregister() 支持动态工具移除
- Playwright webServer 自动启动（修复 E2E 需手动启 dev server 的问题）
- @types/react-syntax-highlighter 类型声明（修复历史 TS 报错）

### Added — P3 人格引擎（2026-06-14）
- System Prompt 分层注入（4 层架构 + [PROTECTED]/[MUTABLE] 分区）
- 用户画像三维化（identity / workflow / voice，自动 LLM 提取）
- 3 个内置人格模板（温暖伙伴 / 严谨顾问 / 技术极客）
- 内心独白 `<aside>` 标签渲染（紫色气泡 UI）

### Fixed（2026-06-14）
- 流式响应后 UI 卡在"思考中"状态（兜底 done 事件 + finally 块）
- 新增停止按钮（AbortController + chat:abort IPC）

### Added — P0~P2 基础框架（2026-06-14）
- Electron + React + TypeScript + TailwindCSS 脚手架
- LLM 流式对话（OpenAI 兼容 API）
- Agent Loop 核心循环（AsyncGenerator 事件流）
- 工具系统（ToolRegistry + 5 个内置工具）
- SQLite 持久化（sql.js WASM）
- 会话管理 UI + 设置页面
- Markdown 渲染 + 代码高亮
- LLM 路由 + 模型快切
- 上下文压缩（三层分级）
- 记忆系统 v1（用户画像 + 偏好 + 事实）
- 工具权限确认弹窗
- Playwright E2E 测试
- 日志系统 + remote debugging

# 项目进度

> 每次对话结束时由 AI 更新此文件，记录当前进展。

## 当前状态

**阶段**：P0 ~ P16 全部完成（P16 = 高级功能扩展）

**已完成全部功能**：
- 规则体系 + 技能文件设计
- 开源基础设施（.gitignore / README / LICENSE / GitHub 仓库）
- Electron + React + TypeScript + TailwindCSS 脚手架
- LLM 流式对话（OpenAI 兼容 API，已验证 DeepSeek）
- Agent Loop 核心实现（AsyncGenerator 事件流 + LLM 重试 + 工具超时保护）
- 工具系统框架（ToolRegistry + 真并发执行 + 动态注销 + 30s 超时保护）
- LLM 适配器（function calling / tool_calls 流式解析）
- 内置工具：get_current_time / web_search / file_read / file_write / shell_exec
- 工具权限确认（破坏性操作前弹窗，IPC 双向通信）
- 日志系统（彩色分级 Logger，全路径日志）
- Electron remote debugging（port 9222）
- SQLite 持久化（sql.js WASM，对话历史 + 会话管理 + 设置 + 记忆）
- 会话管理 UI（侧边栏按日期分组 + 新建/切换/删除会话）
- Markdown 渲染 + 代码高亮（react-markdown + react-syntax-highlighter）
- 设置页面（API Key / Base URL / 模型 / System Prompt / 人格选择 / MCP 管理）
- LLM 路由（顶栏模型快切 + 多 Provider 预设）
- 上下文压缩（三层分级：Snip / MicroCompact / Collapse）
- 记忆系统 v1（用户画像 + 偏好 + 事实，注入 System Prompt）
- 流式中断（AbortController + 停止按钮）
- **P3 人格引擎**：
  - System Prompt 分层注入（L1 人格定义 → L2 能力边界 → L3 上下文 → L4 动态，[PROTECTED]/[MUTABLE] 分区）
  - 用户画像三维化（identity / workflow / voice，自动提取）
  - 3 个内置人格模板（温暖伙伴 / 严谨顾问 / 技术极客），设置页一键切换
  - 转场白语 / 内心独白（`<aside>` 标签渲染，人格化小剧场）
- **P4 框架搭建**：
  - 主进程架构重构（IPC 拆分为 6 个独立模块，index.ts 从 281 行精简到 131 行）
  - 单元测试覆盖（33 个测试 / 4 文件：ToolRegistry / PromptBuilder / ContextManager / AgentLoop）
  - MCP 协议支持（MCP Client + StdioClientTransport + 动态工具注册/注销 + 设置页 UI 管理）
  - 长期记忆 + 向量检索（Vectra 本地向量数据库 + OpenAI 兼容 Embedding API + 语义召回注入 Prompt）
- **P5 UI 打磨 + Agent 能力 + 安全加固**：
  - API Key 加密存储（Electron safeStorage）
  - 错误信息脱敏（过滤 API Key / URL 后传渲染进程）
  - 欢迎页增强（图标 + 4 个快捷操作卡片）
  - 消息体验提升（时间戳 + 一键复制 + 入场动画 + 流式打字光标）
  - Thinking 可视化（可折叠思考过程区域）
  - 会话侧边栏按日期分组（今天/昨天/更早）
  - Token 消耗可视化（输入/输出/合计）
  - 工具并发执行真正生效（concurrencySafe → Promise.all）
  - LLM 调用重试（最多 2 次，指数退避，网络/429/5xx 错误）
  - 工具超时保护（30s）
  - 架构分层 import 方向约束（core.mdc HARD-GATE）
- **Developer Panel（可观测性调试面板）**：
  - Ctrl+Shift+D 快捷键开关
  - System Prompt 可视化（4 层分层查看 + 字符/token 估算）
  - 工具注册表总览（元数据标签：只读/破坏性/并发安全）
  - 系统状态面板（运行环境 / 内存 / LLM 配置 / MCP 连接）
  - 实时事件日志（订阅 AgentStreamEvent 流，彩色分类）
  - Debug IPC 模块（ipc/debug.ts，3 个端点）
- **P6 记忆系统重构 + Agent 认知能力**：
  - 修复 Prompt 双重注入 bug（userProfile + memoryContext 数据重复）
  - 记忆类型（MemoryCategory/MemoryEntry）移入 shared/types.ts
  - SQLite ↔ 向量库双写同步（增/删/改自动联动）
  - Profile 提取增强（加入 assistant 回复 + 节流降至 2 分钟 + 扩展到 5 个类别）
  - 记忆管理 UI（MemoryPanel：分类筛选/添加/编辑/删除/日期显示）
  - Agent 记忆工具（remember/recall/forget，AI 可主动管理记忆）
  - 任务规划工具（task_plan：创建/查看/更新/清除结构化计划）
  - 自我评估机制（L2 Prompt 指令：复杂任务后自检、主动记忆用户信息）
- **方法论体系**：
  - methodology/ 文件夹 + README（每个观点需用户对齐后才写入）
  - methodology.mdc 规则（禁止搬运外部资料，写作流程规范化）
- **E2E 测试升级**：
  - UI 测试扩展到 5 个（含设置面板开关测试）
  - Electron 真实对话测试框架
  - E2E 测试规范写入 dev-workflow.mdc（HARD-GATE）
- Bug 修复：.env 默认值加载 / 空字符串覆盖 / Embedding 404 抑制

- **P6 续：框架补齐**：
  - 新工具单元测试 13 个（remember/recall/forget/task_plan），总测试数 33→46
  - 数据导出/导入（JSON 格式，含会话+记忆+设置，导出自动脱敏 API Key，导入去重合并）
  - 快捷键体系（Ctrl+N 新建会话 / Ctrl+, 设置 / Ctrl+Shift+M 记忆管理 / Esc 关闭面板 / Ctrl+Shift+D 调试面板）
  - DevPanel Prompt 预览修复（使用与 chat 一致的 buildUserProfile，含 5 分类完整画像）
- **P7 体验完善 + 新工具**：
  - code_search 内置工具（文本/正则搜索 + 文件类型过滤 + 上下文行，内置工具增至 10 个）
  - 全局 Toast 通知系统（替代所有 alert()，4 种类型 + 动画 + 自动消失）
  - 首次运行引导（无 API Key 时自动打开设置面板 + Toast 提示）
  - 会话双击重命名（侧边栏双击编辑 + Enter/Esc/失焦处理）
  - 切换会话后台继续流式（事件按 sessionId 隔离，切回可见完整结果）
  - 消息搜索 Ctrl+F（匹配高亮 + 不匹配降透明度 + 匹配计数）
  - 会话列表搜索（侧边栏标题过滤）
  - LLM 智能标题（对话完成后异步生成 4-10 字摘要标题，替代截断）
  - 后台流式指示器（侧边栏脉冲圆点标识正在生成的会话）

- **P9 Skill 系统**：
  - Skill 类型定义（SkillFrontmatter + SkillDefinition，shared/types.ts）
  - Skill 加载器（gray-matter 解析 YAML frontmatter，扫描目录/子目录 SKILL.md 文件）
  - Skill 注册器（自动生成 skill_invoke_xxx 工具，激活后注入正文为上下文）
  - Skill IPC 模块（CRUD + reload，9 个模块）
  - SkillsPanel UI（左右分栏，列表+详情/编辑/新建，模板预填）
  - Skill 摘要注入 System Prompt L2.5（模型知道有哪些 Skill 可调用）
  - 2 个内置示例 Skill（code-review + content-creator）
  - 快捷键 Ctrl+Shift+K 开关 Skill 面板
  - 用户 Skill 覆盖内置同名 Skill（优先级设计）
- **P10 框架补强**：
  - 工具消息持久化（assistant+toolCalls 和 tool results 完整保存 SQLite，修复多轮工具失忆）
  - tool_calls 事件流（AgentStreamEvent 新增 tool_calls 类型）
  - Per-session 并发锁（Map<sessionId, AbortController>，同一会话拒绝并行 send）
  - 后台流式 Session 隔离修复（切换会话时清除 streamingSessionRef）
  - 沙箱系统（参考 Codex：SandboxPolicy 三级模式 + ExecPolicy 命令分级 + CommandGuard 路径边界 + ApprovalStore 审批记录）
  - Skill allowed_tools 真正执行（filterTools 回调，loop 动态过滤可用工具集）
  - Token 精确计数（优先使用 API 返回的 usage.promptTokens，回退启发式估算）
  - 累积 Token 预算追踪（sessions 表新增 total_prompt_tokens / total_completion_tokens 列）
  - 执行模式系统（auto / confirm-all / plan-first，影响 loop 确认逻辑 + prompt 注入）
  - 设置页新增沙箱模式 + 执行模式 UI 选择器
- **P11 框架进阶**：
  - 消息管道（sanitizeToolCallPairs 修复孤儿 tool_call + removeOrphanToolResults + mergeConsecutiveRoles）
  - 四层上下文压缩（L3 升级为 LLM 摘要 + 新增 L4 AutoCompact 全量重写 + querySource 互斥守卫）
  - Runtime 编排层（AgentRuntime 单例：会话生命周期 / 后台任务队列 / 优雅关闭；chat.ts 精简到 41 行）
  - Multi-Agent 子 Agent 系统（delegate_task 工具 + 独立上下文 + 受限工具集 + 权限只降不升）
  - 内置工具增至 12 个（新增 delegate_task）
  - 代码修复：abort sessionId 全链路传递、tokenUsage preload 暴露、优雅关闭流程
- **P12 效率与可观测**：
  - 分场景 modelId（auxModel 辅助模型配置，后台任务用便宜模型）
  - Tool 中间件管道（ToolMiddlewarePipeline 洋葱模型 + 3 个内置中间件 + ToolRegistry 集成）
  - Token 限流/预算控制（会话级 + 日级限额，超限自动终止）
  - 结构化 Tracing（Span 追踪 + caller 分类 + 耗时统计 + debug:traces 端点）
  - 设置页新增辅助模型 + Token 预算 UI
- **P13 高级框架能力**：
  - 权限规则引擎升级（五层责任链 + 自定义规则 command/tool/path × allow/deny/ask）
  - ~~项目记忆 PROJECT.md~~ **已移除** — 与记忆系统功能重叠
  - 多 Provider 路由（OpenAI 兼容 / Anthropic Messages API / Gemini 请求构建器）
  - 预设新增 Claude Sonnet，baseUrl 自动检测 Provider
- **P14 测试扩充 + 多模态 + MCP SSE**：
  - 单元测试 46 → 88 个（新增中间件/Token预算/消息管道/权限引擎/Provider路由测试）
  - 多模态支持（ImageAttachment 类型、Vision API image_url、前端粘贴图片+预览+渲染）
  - MCP SSE/HTTP 传输层（transport 字段、SSEClientTransport、远程服务器支持）
- **P8 交互增强**：
  - 消息重新生成（↻ 按钮，重新生成最后一条 AI 回复）
  - 消息编辑（✎ 按钮，编辑已发用户消息并重跑后续对话）
  - 单条消息删除（前端 + SQLite 同步）
  - LLM 参数设置（Temperature / Top P / Max Tokens，UI 控件 + API 传参）
  - URL 内容抓取工具 url_fetch（自动去 HTML 标签，50KB 截断，15s 超时）
  - 回到底部浮动按钮（scroll 距离检测）
  - OS 系统通知（Electron Notification API，窗口失焦时弹出，点击回到窗口）
  - Mermaid 图表渲染（mermaid 库集成，暗色主题，错误降级显示）
  - 深色/浅色主题切换（CSS 变量 + localStorage 持久化，侧边栏 ☀️/🌙 按钮）
  - 文件附件（拖拽/粘贴文件到聊天，1MB 限制，附件预览条，拼接进消息内容）
  - MCP 环境变量配置 UI（KEY=VALUE textarea，解析注入 env 对象）
  - 内置工具增至 11 个（新增 url_fetch）

**测试统计**：
- 单元测试：140 个 / 15 文件（全过）
- UI E2E：5 个（全过）
- Electron E2E：4 个（需 TEST_LLM_API_KEY 环境变量）

**规则体系精简**（2026-06-17）：
- 系统性审查发现规则"设计完美但执行为零"
- Phase 6 自审 / Phase 8 调试流程内联到规则文件（消除读外部文件依赖）
- Phase 1 区分新需求/子任务、Phase 11 必查 8→3 项
- Skill 文件 8→7（删 playground-guide），路由表 7→5
- model-config / security-checklist 回填实际知识
- 方法论沉淀：`methodology/rule-system-evolution.md`

- **P15 框架能力补齐**：
  - System Tray + 全局快捷键（Ctrl+Shift+A 唤起 / 关闭最小化到托盘 / 托盘菜单）
  - Structured Output / JSON Mode（ResponseFormat 类型 / response_format 请求参数）
  - Model Failover 自动降级（fallbackModels 配置 / 主模型失败按序降级备用）
  - Prompt Cache（Anthropic cache_control / System Prompt + Tools 缓存 / usage 统计）
  - Streaming Tool Calls（tool_call_delta 事件 / OpenAI+Anthropic 双适配 / 前端实时参数显示）
  - 小声蛐蛐修复（aside 移到消息下方 + 标签不泄漏 + 支持多个）

- **P16 高级功能扩展**：
  - Auto Update（electron-updater 集成 / 自动检查 / 用户确认下载安装）
  - 会话分支/Fork（从任意消息分叉新对话 / DB 层消息复制 / 前端分支按钮）
  - Scheduled Tasks（调度器模块 / SQLite 持久化 / interval+cron / 触发事件通知前端）
  - RAG 文档管道（文档导入分块 / Embedding 入库 / rag_search 内置工具 / 独立向量索引）
  - Voice I/O（Web Speech API 语音输入 / SpeechSynthesis 朗读 / 前端麦克风+朗读按钮）
  - 内置工具 12 → 13 个（新增 rag_search）

- **UI V2 改版（Codex 风格）**（2026-06-19）：
  - 对话样式：用户消息右对齐圆角气泡 + AI 消息左对齐纯 Markdown（去掉 You/Agent 标签）
  - 输入区：居中卡片式（max-w-2xl），工具栏集成审批模式三级下拉 + 模型快切 + 附件 + 语音 + 圆形发送按钮
  - 审批模式内联化（请求批准 / 替我审批 / 完全访问，输入框工具栏一键切换）
  - 底部状态栏完全移除，Token 用量移到输入框下方
  - 侧边栏重组：顶部功能区（新对话/搜索/技能）+ 对话列表
  - 顶栏精简（h-12，只显示标题 + 人格名称）
  - 设置页独立全屏（独占整个窗口 + 左侧导航栏 + ← 返回应用按钮）
  - 技能/记忆改为主区域 tab 视图（不再使用侧推面板）
  - 代码渲染浅色/深色主题自动切换（oneLight / oneDark + MutationObserver）
  - Mermaid 图表跟随主题（dark / default）
  - 整体留白优化（消息间距加大、内容宽度收窄）
  - 欢迎屏简化居中（「我们应该构建什么？」）
  - Electron 菜单栏隐藏（autoHideMenuBar: true）

- **项目选择器**（2026-06-19）：
  - 输入框下方项目/沙箱目录选择器（类 Codex 风格）
  - 后端 4 个 IPC（browse/list/set/get）+ SQLite 持久化
  - 最近 10 个项目 + 联动 workspaceRoot/sandbox/cwd

- **Bug 修复**（2026-06-19）：
  - 修复流式状态不结束（IPC invoke/send 竞态条件，finally 块安全兜底）

- **UI V2 增强 — Alice 风格**（2026-06-19）：
  - 设置页左侧导航重构（两栏布局 + 基础/高级分区 + SectionTitle/FieldGroup 组件）
  - 会话右键菜单增强（置顶/重命名/重新生成标题/删除）
  - 多主题支持 7 个命名主题（dark/light/mist/night-feast/green-garden/golden/blue-pool）
  - 项目文件浏览器面板（递归目录树 + 搜索 + 文件预览）
  - Provider 分组管理（海外/国内/本地 三组预设）
  - 关于页面（版本/技术栈/致谢）
  - Lucide 图标统一 + 页面过渡动画 + Token 用量 hover 显示

- **UI 细节打磨 + Bundle 优化 + 首次打包**（2026-06-19）：
  - 残留 Emoji 全部替换为 Lucide SVG（📌→Pin / ✕→X / ▶→ChevronRight / 原始 SVG→Search）
  - PrismLight 按需语言注册（16 种常用语言，syntax-hl 从 ~400KB 降至 93KB）
  - Vite manualChunks 拆分（react-vendor / markdown / syntax-hl 独立 chunk）
  - 主入口 JS 从 1,202KB 降至 220KB（-82%）
  - 首次 Windows NSIS 安装包构建成功（My Agent_0.1.0.exe，147.6MB）

- **文档与规则迭代**（2026-06-19）：
  - README.md 全面重写（对齐当前功能/技术栈/架构）
  - code-frontend.mdc 重写（对齐 UI V2 规范）
  - architecture.md 同步（IPC 12 模块/打包方案/目录结构）
  - api-contracts.md 补充（项目工作区 IPC + 会话增强 IPC）
  - testing.md 刷新（105 个 / 13 文件）
  - glossary.md 补充（activeView/项目选择器/命名主题/PrismLight 等 8 个新术语）
  - decisions.md 新增 4 条 ADR（DEC-018~021：UI V2 / electron-builder / 项目选择器 / Bundle 优化）
  - Git 代理端口已统一为 7897，无冲突

- **P17 框架能力补齐**（2026-06-19）：
  - Bug Fix：Vision 动态兼容（乐观发送 → 错误驱动降级 → visionDenyCache 缓存，零配置零维护）
  - 结构化编辑工具 file_edit + apply_patch（替代全文件覆写）
  - Git 原生工具链 5 个（status/diff/log/commit/branch）
  - ~~项目级 Rules 注入~~ **已移除** — 不符合伙伴产品定位，记忆系统已足够
  - task_plan SQLite 持久化（会话绑定 + 跨重启恢复）
  - Headless Agent Runtime（runHeadless + Scheduler 直接触发 Agent Loop）
  - Headless 审批策略（只读放行 / shell 拒绝）
  - Gemini 流式适配器完成（streamChatGemini SSE + functionCall）
  - Verify 自愈中间件（文件编辑后自动语法检查）
  - 内置工具 13 → 20 个

- **@file 上下文选择器**（2026-06-19）：
  - MentionPopup 组件（@ 触发、文件模糊搜索、键盘导航）
  - 输入框文件标签栏 + 发送时 `<context>` 标签注入文件内容
  - 50KB 截断保护、多文件引用支持
  - 无后端改动（复用已有 IPC）

- **Bug Fix**（2026-06-20）：
  - 消息列表文本不可选中 → 加 `select-text` 覆盖根容器 `select-none`
  - @mention 弹窗定位偏移 + "未选择项目目录"误判 → 动态定位 + hasProject 状态区分

- **架构原则确立**（2026-06-20）：
  - Claude Code 2.1.88 源码（1884 个 TS 文件）加入参考资料
  - DEC-024：基础设施对齐 Claude Code，差异化在人格层
  - 工具 ≠ 内部服务的区分原则写入 core.mdc
  - 调研搜索路径更新：CC 源码 > Alice 方法论 > Alice 编码规范 > GitHub > npm

- **Alice 方法论全面审计**（2026-06-20）：
  - 对照 21 章方法论审计当前实现，识别 20 个 Gap

**已完成（方法论审计 P0）** ✅：
> 1. ✅ 工具并发顺序修复 — `executeAll` 按 LLM 原始顺序分批
> 2. ✅ ToolContext 依赖注入 — 工具通过 ctx 获取 workdir/sessionId/abortSignal
> 3. ✅ permission-engine 接入主流程 — 替代散落的 isDestructive 判断
> 4. ✅ 子 Agent 工具黑名单 — 禁止递归 + 排除 remember/forget/task_plan
> 5. ✅ 工具/内部服务边界重划 — task_plan 下沉为 service

- **M3 LLM 层深啃完成**（2026-07-01）：
  - **第一批（G1 吸收任务）**：三处辅助调用（摘要/画像/标题）统一收进路由层
    - 新增 `chatComplete()` 非流式便捷入口（消费 streamChat 到结束取终态，对照 CC queryModelWithoutStreaming）
    - 改造 context-manager / profile-extractor / session-store 走 chatComplete
    - **连带收益**：这三个辅助功能自动获得 Anthropic/Gemini 支持（之前只会拼 OpenAI body，切非 OpenAI 模型会静默失效）+ failover + Vision 降级，删掉三份重复 fetch 样板
    - 埋 `caller` 字段（'summary'/'profile'/'title'），为后续 token 归因铺路
    - 补 4 个单测（流式收敛/空结果抛错/temperature 覆盖/failover 复用）
  - **第二批（G2/G3 正确性修复）**：
    - **G2 流式 usage `>0` guard**：OpenAI/Anthropic 两处改为只在拿到正数时更新，防止 delta 的 0 值覆盖 start 真实统计；Anthropic message_delta 改为合并更新（不再冲掉 cache tokens）
    - **G3 loop 重试遵从 retry-after**：新增 LLMError 类（携带 status + retryAfterMs）+ parseRetryAfterMs 解析器，四处抛错点改用它；loop 重试等待优先遵从服务端 retry-after，否则退回指数退避
    - 补 3 个单测（usage guard 防 0 覆盖 / parseRetryAfterMs 双格式 / LLMError 携带 retry-after）
  - **G5 caller 归因**：StreamChatOptions 加 `caller` 字段，streamChat 入口打日志（含 caller/model/messageCount），loop 主对话标 `'main'`，chatComplete 透传 `'summary'/'profile'/'title'`——所有 LLM 调用可按来源归因，为 per-caller 成本统计铺路
  - **G4 评估后关闭（不做）**：派 subagent 审计 CC 的 413/重试职责分层，确认「把 413 重试下沉到 LLM 层」是错误方向。CC 的 queryModel 同样是纯函数、不持有对话状态；413 输入压缩也在 Agent 循环层（query.ts），用「LLM 层降级成结构化 error message + 上层 withhold 识别」而非回调钩子。判据：**能在不改对话内容下完成的重试下沉到 LLM 层（failover/max_output），需要重写 messages 的重试上浮到能看到 state 的循环层（413 压缩）**。当前分层与 CC 同构，`hasAttemptedReactiveCompact` 单发闸也与 CC 同名标志一致——现状即正解，关闭 G4
  - **对照 CC/Alice 审计**：派 subagent 并行读 CC `services/api/` 和 Alice Ch.11，确认两家都是"单一流式管线 + 外层 drain"，不为非流式写第二套逻辑
  - **验证**：tsc 零错误，113 个测试全过（13 文件，原 106 + 新 7）

**下一步** → 📋 框架模块深啃路线图，详见 [`docs/module-roadmap.md`](module-roadmap.md)

- **M4 上下文压缩深啃 · Phase A 正确性修复完成**（2026-07-02）：
  - **学**：三 subagent 并行读 Alice Ch.05 + CC compact/ 源码（compact.ts/microCompact.ts/autoCompact.ts）+ 审计当前实现
  - **审**：13 项 Gap 清单（P0 正确性 3 / P1 体验 6 / P2 优化 4），详见 [`methodology/m04-context-compression.md`](../methodology/m04-context-compression.md)
  - **设计**：分 Phase A/B/C 三批落地
  - **改（Phase A）**：
    - A1（G1）保护任务说明 — `getPreambleEndIndex` 统一 L1/L3/L4，对齐 CC group 0 语义
    - A2（G4）压缩后文件恢复 — 入口快照 file_read 结果（避开 L1 Snip 提前删除），限 5 文件/50K token 注入
    - A3（G11）熔断降级截断 — `emergencyTruncate` 纯规则硬截断 + 移除孤儿 tool 消息
    - 过程发现两个真实 bug：① L1 Snip 先删 file_read 导致无内容可恢复 → 改入口快照；② collapse/autoCompact 只保护 system 导致任务说明被摘要 → 改保护整个 preamble
  - **验证**：tsc 零错误，119 测试全过（原 113 + 新 6）
  - **待续**：Phase B（结构化摘要 + boundary marker）、Phase C（PTL 重试 + 动态阈值）

- **M4 上下文压缩深啃 · Phase B 体验增强完成**（2026-07-02）：
  - **改（Phase B）**：
    - B1（G3）结构化摘要 — L3/L4 摘要指令改为「当前任务/已完成/状态/下一步/关键上下文」框架
    - B3（G12）boundary marker — ChatMessage 加 compactMetadata 字段，摘要消息携带压缩元数据（层级/前后 token/触发源/是否用 LLM）
    - B2（L4 独立会话）按方案跳过 — querySource 防护已够，成本高
  - **验证**：tsc 零错误，122 测试全过（Phase A 119 + B1×1 + B3×2）
  - **待续**：Phase C（PTL 重试 + 动态阈值）、DevPanel 展示 compactMetadata（可观测性 UI，独立小任务）

- **M4 上下文压缩深啃 · Phase C 边界完善完成**（2026-07-02）：
  - **改（Phase C）**：
    - C1（G7）PTL 逃生舱 — 413 reactive compact 未缩小时回退 emergencyTruncate 硬截断重试
    - C2（G10）动态阈值 — getEffectiveContextWindow 按模型推断窗口，压缩阈值自适应；只写跨代际稳定家族（Claude 200K/Gemini 1M），GPT/o/DeepSeek/Qwen 迭代快回退默认（下限 16K）
  - **验证**：tsc 零错误，127 测试全过（Phase B 122 + C2×5）
  - **M4 五步收尾**：学/审/设计/改（A+B+C）已完成，待沉淀 methodology
  - **待续**：DevPanel 展示 compactMetadata（可观测性 UI，独立小任务）

- **M5 记忆系统深啃完成**（2026-07-03）：
  - **学**：三 subagent 并行读 Alice Ch.05 记忆部分 + CC memdir/SessionMemory/extractMemories + 审计当前实现
  - **审**：8 项 Gap（P0 自我强化循环/老化防漂移 · P1 生命周期/提取判据/双重注入 · P2 语义去重/recall一致/死代码）
  - **设计**：4 项落地，不动存储架构（SQLite+向量双层）；架构决策不照搬 CC memdir，只吸收原则
  - **改**：
    - G1 自我强化循环 — 删 assistant 回复写向量库分支，只索引用户消息
    - G2 老化告警 — formatMemoryAge + formatRecallForInjection，召回带时间感，>7天加陈旧提示
    - G4 提取判据 — EXTRACTION_PROMPT 吸收 CC "该存/不该存"清单
    - G5 双重注入去重 — 召回排除 mem- 前缀 SQLite 镜像
  - **验证**：tsc 零错误，139 测试全过（M4 后 127 + G2×6 + G5×6）
  - **沉淀**：methodology/m05-memory-system.md + m05-memory-system-code.md
  - **暂缓**：G3 生命周期（TTL/衰减）/ G6 语义去重 / G7 recall 一致性 / G8 死代码清理

- **M6 权限与安全深啃完成**（2026-07-04）：
  - **学**：对照 Alice Ch.07(权限模式) + Ch.12(沙箱边界) + CC utils/permissions/ 五层责任链
  - **审**：识别 4 项 Gap（G1 bypass-immune / G4 DecisionType / G2 deniedCommands / G3 persistent 审批）
  - **设计**：保持五层责任链架构，修正安全缺口 + 增强可观测性
  - **改**：
    - G1 bypass-immune — command-guard.ts 危险命令检测提前到 full-access 判断前（1 行前移）
    - G4 DecisionType — permission-engine.ts 新增 `DecisionType` 枚举 + `PermissionCheckResult.decisionType` 字段（5 处返回点）
    - G2 deniedCommands — loop.ts 新增 `state.deniedCommands` + `extractBlockedCommand()` + Observe 检测 `[SANDBOX BLOCKED]` + `buildDeniedToolsPromptSuffix` 扩展
    - G3 persistent 审批 — approval-store.ts 接入 SQLite（`persistent_approvals` 表 + 内存缓存镜像 + 异步落盘 + app.whenReady 预加载）
  - **验证**：tsc 零错误，140 测试全过（M5 后 139 + 1 旧测试改 + 2 新测试）
  - **沉淀**：methodology/m06-permission-security.md（第一性原理：可配置的平衡点 → 三组推论）
  - **架构决策**：不照搬 Alice 五模式，保持三级沙箱+三级执行模式（更适合桌面应用），吸收责任链/bypass-immune/拒绝追踪原则

> 📦 其他
> - 应用图标设计 + 安装包体积优化

## 进度时间线

| 日期 | 里程碑 | 状态 |
|------|--------|------|
| 2026-06-14 | 规则体系设计完成 | ✅ |
| 2026-06-14 | 项目代码初始化（Electron + TS + React） | ✅ |
| 2026-06-14 | LLM 流式对话集成 | ✅ |
| 2026-06-14 | Agent Loop + 工具系统 + 工具调用 UI | ✅ |
| 2026-06-14 | 日志系统 + remote debugging + E2E 测试 | ✅ |
| 2026-06-14 | SQLite 持久化 + 多会话管理 | ✅ |
| 2026-06-14 | Markdown 渲染 + 代码高亮 + 设置页面 + 持久化 | ✅ |
| 2026-06-14 | 网页搜索工具 + 上下文压缩 | ✅ |
| 2026-06-14 | P2 完成：LLM 路由 + 工具扩展 + 权限确认 + 记忆系统 | ✅ |
| 2026-06-14 | P3 完成：人格引擎（分层 Prompt / 三维画像 / 人格模板 / 内心独白） | ✅ |
| 2026-06-16 | P4 完成：架构重构 + 单元测试 + MCP 协议 + 向量记忆 | ✅ |
| 2026-06-16 | 方法论体系 + E2E 升级 + 文档全面更新 | ✅ |
| 2026-06-16 | P5 完成：UI 打磨 + Agent 能力 + 安全加固 | ✅ |
| 2026-06-16 | Developer Panel 可观测性调试面板 | ✅ |
| 2026-06-16 | P6 完成：记忆系统重构 + Agent 认知能力 | ✅ |
| 2026-06-17 | P6 续：框架补齐（测试+导出+快捷键+调试修复） | ✅ |
| 2026-06-17 | P7 完成：体验完善（Toast/引导/重命名/code_search/abort） | ✅ |
| 2026-06-17 | P8 完成：交互增强（重新生成/编辑/删除/主题/附件/Mermaid/url_fetch） | ✅ |
| 2026-06-17 | P9 完成：Skill 系统（加载/注册/IPC/UI/Prompt 注入/内置 Skill） | ✅ |
| 2026-06-17 | P10 完成：框架补强（工具持久化/并发锁/沙箱/allowed_tools/Token计数/执行模式） | ✅ |
| 2026-06-17 | P11 完成：框架进阶（消息管道/四层压缩/Runtime/Multi-Agent/代码修复） | ✅ |
| 2026-06-17 | P12 完成：效率与可观测（分场景模型/中间件/Token限流/Tracing） | ✅ |
| 2026-06-17 | P13 完成：高级框架（权限引擎/多Provider路由） | ✅ |
| 2026-06-17 | P14 完成：测试扩充+多模态+MCP SSE | ✅ |
| 2026-06-18 | P15 完成：框架能力补齐（Tray/Failover/Cache/Streaming Tools） | ✅ |
| 2026-06-18 | P16 完成：高级功能扩展（AutoUpdate/Fork/Scheduler/RAG/Voice） | ✅ |
| 2026-06-19 | UI V2 Codex 风格改版（对话/输入/审批/设置/主题） | ✅ |
| 2026-06-19 | 项目选择器 + 流式状态竞态修复 | ✅ |
| 2026-06-19 | UI V2 增强：Alice 风格（设置重构/多主题/文件浏览器/右键菜单/关于页） | ✅ |
| 2026-06-19 | UI 打磨 + Bundle 优化（PrismLight/-82% 主包）+ 首次打包（Win NSIS） | ✅ |
| 2026-06-19 | 文档与规则迭代（README/规则/架构/API/测试/术语/决策） | ✅ |
| 2026-06-19 | P17：框架补齐（编辑工具/Git/Rules/Headless/Gemini/Verify，工具 13→20） | ✅ |
| 2026-06-19 | @file 上下文选择器（MentionPopup + 文件标签 + context 注入） | ✅ |
| 2026-06-20 | P0 框架正确性修复（并发顺序/DI/权限/黑名单/服务边界） | ✅ |
| 2026-06-20 | 架构原则确立 + Alice 方法论审计 + 模块化深啃路线重组 | ✅ |
| 2026-06-20 | M1 Agent Loop 深啃完成（LoopState/413/max_output/abort/权限追踪/done reason） | ✅ |
| 2026-06-20 | M1 沉淀（methodology/m01-agent-loop.md + m01-agent-loop-code.md） | ✅ |
| 2026-06-26 | M2 工具系统深啃完成（description 四要素 / 大结果落盘 / buildTool 工厂迁移 20 工具） | ✅ |
| 2026-06-26 | M2 沉淀（methodology/m02-tool-system.md） | ✅ |
| 2026-06-26 | 规则补充（冗余搜索策略 / 注释五要素 / 需求文档规范） | ✅ |
| 2026-06-26 | 方法论文件迁移至根目录 + 统一 mNN- 命名 | ✅ |
| 2026-07-01 | M3 LLM 层深啃完成（chatComplete 统一辅助调用 / usage guard / retry-after / caller 归因 / G4 评估关闭 / 对照 CC-Alice 审计） | ✅ |
| 2026-07-01 | M3 沉淀（methodology/m03-llm-routing.md + m03-llm-routing-code.md） | ✅ |
| 2026-07-02 | M4 上下文压缩 Phase A（保护任务说明/文件恢复/熔断降级截断，119 测试全过） | ✅ |
| 2026-07-02 | M4 上下文压缩 Phase B（结构化摘要/boundary marker，122 测试） | ✅ |
| 2026-07-02 | M4 上下文压缩 Phase C（PTL 逃生舱/动态阈值，127 测试） | ✅ |
| 2026-07-02 | M4 沉淀（methodology/m04-context-compression.md + -code.md） | ✅ |
| 2026-07-03 | M5 记忆系统深啃（自我强化/老化/提取/去重，139 测试） | ✅ |
| 2026-07-03 | M5 沉淀（methodology/m05-memory-system.md） | ✅ |
| 2026-07-04 | M6 权限与安全深啃（bypass-immune/DecisionType/deniedCommands/persistent审批，140测试） | ✅ |
| 2026-07-04 | M6 沉淀（methodology/m06-permission-security.md） | ✅ |
| 2026-07-04 | M7 可观测性深啃（接上 interactionSpanId 调用链断点，tracer duration=0 修复，161 测试） | ✅ |
| 2026-07-04 | M7 沉淀（methodology/m07-observability.md + m07-observability-code.md） | ✅ |
| 2026-07-04 | M8 多 Agent 协作深啃（修复 P0 delegate_task 破损 + parentSpanId 调用链嵌套 + auxModel 优先 + description 加判据，161 测试） | ✅ |
| 2026-07-04 | M8 沉淀（methodology/m08-multi-agent.md：信息积累型 vs 并发执行型判据 + 三种模式 + 隔离机制 + 信息流） | ✅ |
| 2026-07-05 | M9 人格引擎深啃（G1 结尾人格锚点 + G2 防注入声明，163 测试；G3 MUTABLE 演化 / G5 具名角色占位待做）+ 沉淀 m09 | 🟡 |
| 2026-07-05 | 命名冲突修复：m09-rule-system-evolution.md → rule-system-evolution.md，让出 m09 给人格引擎 | ✅ |
| 2026-07-05 | M10 自进化与 Skill 深啃（G1 版本备份/回滚，171 测试；G2 自动改进 / G3 代码生成 / G4 提案 / G5 撤销栈占位待做）+ 沉淀 m10 | 🟡 |
| 2026-07-03 | Harness 重构：CLAUDE.md 升为唯一权威（硬约束常驻 + 场景索引），删 agent-harness.md，AGENTS/.cursor 改重定向入口，.cursor 旧规则归档 | ✅ |
| 2026-07-03 | M5 记忆系统深啃（自我强化循环/老化告警/提取判据/双重注入去重，139 测试）+ 沉淀 m05 | ✅ |
| - | 应用图标设计 + 安装包体积优化 | ⏳ |

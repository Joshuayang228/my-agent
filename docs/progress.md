# 项目进度

> 每次对话结束时由 AI 更新此文件，记录当前进展。

## 当前状态

**阶段**：P0 ~ P14 全部完成（P14 = 测试扩充+多模态+MCP SSE）

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
  - 项目记忆 PROJECT.md（工作区文件 → L3 Prompt 注入 → Agent 可读写更新）
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
- 单元测试：88 个 / 10 文件（全过）
- UI E2E：5 个（全过）
- Electron E2E：4 个（需 TEST_LLM_API_KEY 环境变量）

**下一步**：
- 沉淀方法论文档（用户触发后逐条对齐写入）
- Streaming UI 优化（逐字渲染 + 骨架屏）
- 热键系统 / 全局搜索
- bundle 体积优化（vectra external 处理）
- 首个可用版本打包发布
- 多模态支持（图片消息 + Vision API）
- MCP SSE/HTTP 传输层

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
| 2026-06-17 | P13 完成：高级框架（权限引擎/项目记忆/多Provider路由） | ✅ |
| 2026-06-17 | P14 完成：测试扩充+多模态+MCP SSE | ✅ |
| - | 首个可用版本 | ⏳ |

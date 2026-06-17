# 变更日志

> 每次发版或修 Bug 时由 AI 更新此文件。
> 格式遵循 [Keep a Changelog](https://keepachangelog.com/)。

## [未发布]

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

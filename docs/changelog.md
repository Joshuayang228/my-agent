# 变更日志

> 每次发版或修 Bug 时由 AI 更新此文件。
> 格式遵循 [Keep a Changelog](https://keepachangelog.com/)。

## [未发布]

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

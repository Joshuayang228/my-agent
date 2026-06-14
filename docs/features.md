# 功能清单

> 功能完成时由 AI 更新此文件。

## 核心功能

- [x] Agent Loop（think → act → observe 核心循环）
- [x] 工具系统基础（声明式注册 + 并发安全分批执行）
- [x] 工具权限控制（破坏性操作前弹窗确认，IPC 双向通信）
- [x] 记忆系统 v1（用户画像 + 偏好 + 事实，注入 System Prompt）
- [x] LLM 适配器（OpenAI 兼容流式 API + function calling）
- [x] LLM 路由（顶栏模型快切 + 多 Provider 预设）
- [x] 上下文压缩（三层分级：Snip / MicroCompact / Collapse，参照 Alice 方法论）
- [x] System Prompt 分层注入（4 层架构：人格定义 / 能力边界 / 上下文 / 动态，[PROTECTED]/[MUTABLE] 分区）
- [x] 用户画像三维化（identity / workflow / voice，自动提取写入记忆）
- [x] 人格模板系统（3 个内置人格：温暖伙伴 / 严谨顾问 / 技术极客，一键切换）
- [x] 转场白语 / 内心独白（`<aside>` 标签人格化小剧场 + 紫色气泡 UI）

## 桌面应用

- [x] Electron 主窗口
- [x] 对话界面（流式输出）
- [x] IPC 通信（统一 AgentStreamEvent 事件流）
- [x] 会话管理（多会话 / 切换 / 删除 / 侧边栏）
- [x] 对话历史持久化（SQLite via sql.js）
- [x] 设置页面（模型配置 / API Key / Base URL / System Prompt）

## UI 组件

- [x] 消息气泡（用户 / AI 区分样式）
- [x] 工具调用可视化（执行中动画 / 结果展示）
- [x] 输入框（IME 兼容 + 自动高度调整）
- [x] Markdown 渲染（react-markdown + remark-gfm）
- [x] 代码高亮（react-syntax-highlighter / Prism / oneDark 主题）
- [ ] 流式打字光标

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
- [ ] 向量数据库集成
- [ ] 数据导出/导入

## 开发基础设施

- [x] 日志系统（彩色分级 Logger）
- [x] Electron remote debugging（port 9222）
- [x] Playwright E2E 测试
- [ ] 单元测试覆盖（Agent Loop / Tool Registry）

## 安全

- [x] API Key 通过 .env 环境变量管理
- [x] 工具元数据声明（isReadOnly / isDestructive / isConcurrencySafe）
- [ ] API Key 加密存储
- [x] 用户确认弹窗（破坏性操作前 IPC 弹窗）

---

**图例**：
- `[x]` 已完成
- `[~]` 进行中
- `[ ]` 计划中

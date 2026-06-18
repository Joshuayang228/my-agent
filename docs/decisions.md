# 技术决策记录

> 关键技术决策记录（为什么用 X 不用 Y），供 AI 和团队理解历史背景。

## 格式

```
### DEC-序号：决策标题

- **日期**：YYYY-MM-DD
- **状态**：已决定 / 讨论中 / 已废弃
- **背景**：为什么需要做这个决策
- **选项**：
  - A：方案描述 — 优点/缺点
  - B：方案描述 — 优点/缺点
- **决定**：选了哪个，为什么
- **影响**：这个决策影响了哪些模块/文件
```

---

### DEC-001：桌面应用框架选择 Electron

- **日期**：2026-06-14
- **状态**：已决定
- **背景**：需要一个跨平台桌面应用框架
- **选项**：
  - A：Electron — 生态成熟，TypeScript 全栈，Alice 验证过
  - B：Tauri — 更轻量，但 Rust 学习成本高
  - C：Flutter Desktop — Dart 语言，生态偏移动端
- **决定**：Electron。理由：复刻 Alice 技术栈，TypeScript 全栈共享类型，社区资源丰富
- **影响**：整个项目架构（主进程 + 渲染进程模式）

### DEC-002：全栈使用 TypeScript

- **日期**：2026-06-14
- **状态**：已决定
- **背景**：需要选择编程语言
- **选项**：
  - A：TypeScript 全栈 — 主进程和渲染进程共享类型定义
  - B：主进程 Python + 渲染进程 TypeScript — 需要跨语言类型同步
- **决定**：TypeScript 全栈。理由：Alice 方案验证过，类型共享减少接口不一致
- **影响**：所有代码文件、构建工具链、测试框架选择

### DEC-003：前端框架选择 React + TailwindCSS

- **日期**：2026-06-14
- **状态**：已决定
- **背景**：渲染进程的 UI 框架选择
- **选项**：
  - A：React + TailwindCSS — Alice 验证过，生态丰富
  - B：Vue + Tailwind — 也成熟，但 Alice 用的 React
  - C：Svelte — 更新，但社区较小
- **决定**：React + TailwindCSS + Lucide Icons
- **影响**：前端所有组件、样式方案

### DEC-004：存储方案选择 SQLite + 向量数据库

- **日期**：2026-06-14
- **状态**：已决定
- **背景**：需要本地存储对话历史、设置、语义检索
- **选项**：
  - A：SQLite + 向量数据库 — 结构化数据 + 语义检索分离
  - B：纯文件系统 — 简单但查询能力弱
  - C：IndexedDB（渲染进程）— 受限于浏览器环境
- **决定**：SQLite（结构化）+ 向量数据库（语义检索）+ 本地文件系统（项目记忆/用户画像）
- **影响**：数据访问层、记忆系统实现

### DEC-005：Agent 事件流使用 AsyncGenerator

- **日期**：2026-06-14
- **状态**：已决定
- **背景**：Agent Loop 需要流式输出事件
- **选项**：
  - A：AsyncGenerator — 自然的异步流，Alice 验证过
  - B：EventEmitter — Node.js 原生，但类型安全较弱
  - C：RxJS Observable — 功能强大但学习曲线陡
- **决定**：AsyncGenerator。理由：Alice 验证过，TypeScript 原生支持，代码直观
- **影响**：Agent Loop 核心实现、LLM 调用接口、IPC 事件传输

### DEC-006：产品定位为人格化 Agent

- **日期**：2026-06-14
- **状态**：已决定
- **背景**：需要明确项目的核心差异化定位，是做一个通用工具还是有特色的产品
- **选项**：
  - A：通用 AI 助手 — 功能全面但无差异化，市场同质化严重
  - B：人格化 AI Agent（类似 Alice）— 有性格、有记忆、能成长的数字伙伴
  - C：垂直领域工具 — 只聚焦某一场景（如编程助手）
- **决定**：人格化 AI Agent。理由：Alice 方法论已验证该方向可行，人格化是 Agent 与普通 ChatBot 的核心区分点，持久记忆 + 主动协作能带来真正的用户粘性
- **影响**：记忆系统设计（五层记忆）、系统提示设计（需包含人格设定）、交互风格（不是纯工具调用）、UI 设计（需传达"伙伴感"）

### DEC-007：向量数据库选择 Vectra

- **日期**：2026-06-16
- **状态**：已决定
- **背景**：长期记忆需要语义检索能力，需要选择向量存储方案
- **选项**：
  - A：Vectra — 本地文件存储，支持 Electron，MIT 开源
  - B：ChromaDB — 功能强大但需要独立服务
  - C：自研余弦相似度 — 无依赖但缺乏索引优化
  - D：纯 SQLite FTS5 — 只支持关键词匹配，无语义能力
- **决定**：Vectra。理由：文件存储无需独立服务，内存加载查询快，支持 Electron 环境，API 简洁
- **影响**：memory/ 模块、Embedding 适配器、chat IPC 中的向量检索注入

### DEC-008：MCP 协议集成方案

- **日期**：2026-06-16
- **状态**：已决定
- **背景**：Agent 需要可扩展的外部能力连接机制
- **选项**：
  - A：MCP 协议（官方 SDK）— 标准化、生态丰富
  - B：自定义插件系统 — 灵活但需自己定义协议
  - C：直接内置更多工具 — 简单但不可扩展
- **决定**：MCP 协议。理由：行业标准，SDK 成熟（v1.29.0），用户可连接现有 MCP Server 生态
- **影响**：mcp/ 模块、ToolRegistry（新增 unregister）、设置页 MCP 管理 UI

### DEC-009：Embedding 复用 LLM API 而非本地模型

- **日期**：2026-06-16
- **状态**：已决定
- **背景**：向量检索需要文本嵌入，需选择嵌入方式
- **选项**：
  - A：复用用户已配置的 OpenAI 兼容 API — 零额外依赖，质量好
  - B：本地 HuggingFace 模型（@huggingface/transformers）— 无网络依赖但包体大（~100MB）
  - C：两者都支持，用户可选 — 灵活但复杂
- **决定**：先 A，后续可加 B 作为可选。理由：用户已有 API Key，额外 token 成本极低，避免增大包体积
- **影响**：memory/embeddings.ts、向量存储功能依赖 API 可用性

### DEC-010：主进程架构分层 + import 方向约束

- **日期**：2026-06-16
- **状态**：已决定
- **背景**：项目模块越来越多，需要防止依赖混乱。受同事唐荦彦的实战经验启发——清晰的分层边界是 AI 写代码的"坐标系"
- **选项**：
  - A：仅文档约定 — 写在 architecture.md，靠人工 review
  - B：Rule 硬约束 + 文档 — 写入 core.mdc HARD-GATE，AI 自动遵守
  - C：TypeScript path alias + ESLint import rule 强制 — 编译时阻断
- **决定**：先 B，后续可加 C。理由：Rule 约束零成本立即生效，AI 编码时自动遵守分层规则
- **影响**：core.mdc 新增架构分层约束、所有新增模块必须先明确层级

### DEC-011：沙箱系统参考 Codex 而非自研

- **日期**：2026-06-17
- **状态**：已决定
- **背景**：Agent 需要命令执行安全防护，需选择沙箱方案
- **选项**：
  - A：参考 Codex 的四层纵深防御 — 三级模式 + 命令分级 + 路径守卫 + 审批记录
  - B：Docker 容器隔离 — 最安全但部署复杂
  - C：简单黑名单 — 实现简单但覆盖不全
- **决定**：A。理由：Codex 方案经过验证，不需要额外依赖，三级模式给用户灵活选择
- **影响**：sandbox/ 模块（policy + exec-policy + command-guard + approval-store）

### DEC-012：Tool 中间件选择洋葱模型

- **日期**：2026-06-17
- **状态**：已决定
- **背景**：工具执行需要可扩展的拦截机制（日志、截断、错误格式化等）
- **选项**：
  - A：洋葱模型中间件管道 — 注册顺序执行，每层可修改 ctx 和 result
  - B：事件钩子（before/after）— 简单但无法短路
  - C：装饰器模式 — 类型安全但不够灵活
- **决定**：A。理由：洋葱模型既能前置拦截也能后置修改，支持短路，Express/Koa 验证过的模式
- **影响**：tools/middleware.ts、ToolRegistry 集成中间件

### DEC-013：多 Provider 路由策略

- **日期**：2026-06-17
- **状态**：已决定
- **背景**：用户可能使用不同 LLM 提供商（OpenAI/Anthropic/Gemini），需要统一适配
- **选项**：
  - A：baseUrl 自动检测 + 显式 provider 字段 — 零配置体验 + 兜底手动指定
  - B：每个 Provider 独立配置页 — 用户操作复杂
  - C：只支持 OpenAI 兼容格式 — 无法覆盖 Anthropic
- **决定**：A。理由：大部分 Provider 的 baseUrl 有明显特征可自动检测，同时保留 provider 字段给特殊场景
- **影响**：llm/provider-router.ts、llm/index.ts（streamChatAnthropic）、shared/types.ts（LLMProvider）

### DEC-014：辅助任务使用独立模型配置

- **日期**：2026-06-17
- **状态**：已决定
- **背景**：后台任务（标题生成/画像提取/摘要压缩）消耗 token 但质量要求较低
- **选项**：
  - A：auxModel 字段 — 后台任务用便宜模型，留空沿用主模型
  - B：所有任务统一模型 — 简单但浪费成本
  - C：每个任务独立配置 — 灵活但设置项过多
- **决定**：A。理由：一个 auxModel 覆盖所有辅助场景，用户只需配一次，不配就自动沿用主模型
- **影响**：settings-store（新增 auxModel）、runtime.ts（getAuxLLMConfig）、SettingsPanel UI

### DEC-015：Token 预算采用会话级 + 日级双层限额

- **日期**：2026-06-17
- **状态**：已决定
- **背景**：需要防止 Token 消耗失控
- **选项**：
  - A：双层限额（会话级 SQLite 检查 + 日级内存计数器）— 细粒度控制
  - B：仅日级限额 — 无法防止单个会话暴走
  - C：按金额预算 — 需要价格表，维护成本高
- **决定**：A。理由：会话级防止单次失控，日级防止累积超支，两者互补
- **影响**：token-budget.ts、runtime.ts（预算检查 + 日级累加）

### DEC-016：多模态采用 base64 dataUrl 内联方案

- **日期**：2026-06-17
- **状态**：已决定
- **背景**：支持图片消息需要选择图片传输方式
- **选项**：
  - A：base64 dataUrl 内联 — 简单，前后端一致，无需文件服务器
  - B：保存到本地文件 + file:// URL — 需要管理文件生命周期
  - C：上传到云存储 — 违背本地优先原则
- **决定**：A。理由：Electron 环境下 base64 足够，5MB 限制防止过大，OpenAI Vision API 直接支持 dataUrl
- **影响**：shared/types.ts（ImageAttachment）、llm/index.ts（image_url content）、App.tsx（粘贴/预览/渲染）

### DEC-017：规则体系精简——高频内联 + 80/20 瘦身

- **日期**：2026-06-17
- **状态**：已决定
- **背景**：系统性审查发现规则体系"设计完美但执行为零"——8 个 Skill 文件从未被触发，自审 HARD-GATE 被跳过，文档更新规则大量遗漏。根本原因：规则总量超过 AI 上下文记忆容量，依赖"主动读外部文件"的机制不可靠
- **选项**：
  - A：保持现有结构，加强提示 — 治标不治本
  - B：高频规则内联 + 低频保留参考 + 精简 HARD-GATE — 减少读文件依赖，提升执行概率
  - C：全部删除 Skill 文件，只保留 .mdc — 过于激进，失去深度参考
- **决定**：B。具体措施：
  1. code-review 清单（10 项）内联进 dev-workflow.mdc Phase 6
  2. debug-guide 流程（7 步 + 陷阱）内联进 dev-workflow.mdc Phase 8
  3. Phase 1 区分"新需求五步确认"和"已批准子任务简化执行"
  4. Phase 11 必查从 8 项精简为 3 必查 + 5 按需
  5. model-config / security-checklist 用实际代码知识回填 TODO
  6. 删除过时的 playground-guide
  7. commit message 从中文改为英文
  8. Skill 路由表从 7 项精简为 5 项参考表
- **影响**：dev-workflow.mdc、core.mdc、7 个 Skill 文件、rules-feedback.md

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

### DEC-018：UI V2 采用 Codex + Alice 混合风格

- **日期**：2026-06-19
- **状态**：已决定
- **背景**：UI V1 功能堆砌、视觉层级不清晰，需要统一设计语言
- **选项**：
  - A：Codex 极简风 — 纯终端感，输入居中，功能通过命令/快捷键触发
  - B：Alice 伙伴风 — 侧栏导航，多面板，拟人化强
  - C：融合方案 — Codex 的输入布局 + Alice 的侧栏/面板/多主题
- **决定**：C。理由：Codex 的居中输入卡 + 底部输入框 体验简洁；Alice 的侧栏 + 全屏 activeView 管理复杂功能不侵占聊天区
- **影响**：App.tsx 整体布局、SettingsPanel 全屏化、7 个命名主题、Lucide 图标统一、code-frontend.mdc 重写

### DEC-019：打包工具选择 electron-builder

- **日期**：2026-06-19
- **状态**：已决定
- **背景**：需要将应用打包为 Windows 安装包，供用户安装使用
- **选项**：
  - A：electron-builder — 社区主流，配置灵活，支持 NSIS/DMG/AppImage
  - B：electron-forge — 官方推荐，但 ESM + Vite 配置兼容性有坑
  - C：手动 zip 分发 — 无安装体验，不适合普通用户
- **决定**：A。理由：配置声明式（electron-builder.json），NSIS 安装包体验好，社区文档丰富
- **影响**：electron-builder.json、package.json scripts、release/ 输出目录

### DEC-020：项目选择器采用输入区内联模式

- **日期**：2026-06-19
- **状态**：已决定
- **背景**：用户需要切换工作区/项目，确定 shell_exec 的 cwd 和沙箱边界
- **选项**：
  - A：输入区下方内联选择器 — 类 Codex，紧凑直觉
  - B：设置页配置 — 统一管理但切换不便
  - C：独立窗口弹窗 — 打断工作流
- **决定**：A。理由：Codex 验证过该模式，用户在聊天输入时即可看到/切换当前项目，无需跳转
- **影响**：App.tsx 输入区组件、project IPC 模块（6 个 handler）、sandbox policy 联动

### DEC-021：Bundle 优化选择 PrismLight + manualChunks

- **日期**：2026-06-19
- **状态**：已决定
- **背景**：首次打包发现主 bundle 过大（~1.2MB），主要因 react-syntax-highlighter 全量加载 300+ 语言
- **选项**：
  - A：PrismLight 按需注册 + Vite manualChunks — 减体积 + 拆包缓存
  - B：换用轻量高亮库（如 shiki）— 需要重写渲染逻辑
  - C：不优化，压缩兜底 — gzip 后尚可但首屏解析慢
- **决定**：A。理由：零迁移成本，仅改 import + 注册 16 个语言，主 bundle 减少 82%
- **影响**：MarkdownRenderer.tsx（PrismLight 导入）、vite.config.ts（manualChunks 函数）

---

### DEC-022: 移除项目级 Rules 和 PROJECT.md

- **日期**：2026-06-19
- **状态**：已决定
- **背景**：P17 实现了 `.cursor/rules`/`AGENTS.md`/`CLAUDE.md` 自动加载注入 Prompt，以及 `PROJECT.md` 文件级项目知识库
- **问题**：
  - 自动加载 `.cursor/rules` 是开发工具的做法，不符合 AI 伙伴产品定位
  - `PROJECT.md` 与已有记忆系统（remember/recall/forget + 用户画像 + 向量检索）功能重叠
  - 用户不需要"规则文件"这种开发者概念
- **决定**：全部移除。用户通过对话自然积累记忆来定制 Agent 行为
- **影响**：`project-memory.ts` 精简为纯 workspaceRoot 管理、`prompt-builder.ts` 和 `runtime.ts` 清理注入逻辑

---

### DEC-023: Vision 支持检测采用动态乐观策略

- **日期**：2026-06-19
- **状态**：已决定
- **背景**：模型是否支持 Vision（image_url）无法静态判断，初始方案用硬编码模型名白名单，但模型更新快、名称不稳定
- **选项**：
  - A：硬编码白名单 — 需手动维护，过时快
  - B：动态检测（乐观发送 → 错误驱动降级 → 缓存）— 零维护，自动适应
  - C：设置页让用户手动标记 — 增加用户认知负担
- **决定**：B。理由：零维护、对用户无感知、缓存避免重复失败
- **影响**：`electron/main/llm/index.ts`（visionDenyCache + isVisionRelatedError + 三路径统一）

---

### DEC-024: 架构原则 — 基础设施对齐 Claude Code，差异化在人格层

- **日期**：2026-06-19
- **状态**：已决定
- **背景**：获取 Claude Code 2.1.88 源码还原版（1884 个 TS 文件），同时学习 Alice 方法论
- **原则**：
  1. 基础设施层（Agent Loop、上下文压缩、工具系统）对齐 Claude Code 的生产验证方案
  2. 差异化放在人格化伙伴体验（关系型 AI、情感记忆、人设系统）
  3. 严格区分"工具"（AI 可见可调用）和"内部服务"（框架使用，AI 不可见）
- **理由**：CC 经过 Anthropic 团队生产验证，基础架构层复用比原创更可靠；精力聚焦在真正差异化的地方能加速产品成型
- **影响**：`core.mdc` 新增架构原则章节、`dev-workflow.mdc` 调研搜索路径优先级调整

---

### DEC-025: 工具并发顺序保持 LLM 原始语义

- **日期**：2026-06-20
- **状态**：已决定
- **背景**：LLM 返回的 tool_calls 数组有隐含的执行顺序语义（如先创建文件再写入），原实现按 concurrencySafe 分两组批量执行，可能打破这个顺序
- **选项**：
  - A：保持原有分组方式 — 简单但可能导致顺序错误
  - B：按 LLM 原始顺序分批（连续安全工具并行，遇到非安全工具刷新批次串行）— 保持语义正确性
  - C：全部串行 — 最安全但效率低
- **决定**：B。理由：既保持了 concurrencySafe 工具的并行效率，又确保了非安全工具按 LLM 指定的顺序执行
- **影响**：`tools/registry.ts` executeAll 方法重构

---

### DEC-026: ToolContext 依赖注入取代全局 import

- **日期**：2026-06-20
- **状态**：已决定
- **背景**：工具需要 workdir/sessionId/AbortSignal 等运行时信息，原实现通过全局 import（如 `getWorkspaceRoot()`）获取，导致耦合和测试困难
- **选项**：
  - A：继续全局 import — 简单但高耦合
  - B：ToolContext 依赖注入 — 由 Runtime 构造并通过参数传递
  - C：工具自行从 IPC 查询 — 不必要的复杂性
- **决定**：B。理由：对齐 Claude Code 的 ToolUseContext 设计，降低耦合，便于测试
- **影响**：`shared/types.ts`（ToolContext 接口）、`tools/registry.ts`（传递 ctx）、`agent/runtime.ts`（构造 ctx）

---

### DEC-027: permission-engine 接入 Agent Loop 主流程

- **日期**：2026-06-20
- **状态**：已决定
- **背景**：权限检查散落在 loop.ts（`isDestructive` 判断）、沙箱、命令守卫等多处，逻辑重复且不一致
- **选项**：
  - A：保持散落 — 简单但容易遗漏
  - B：统一收归到 PermissionEngine 五层链，loop.ts 只调用 `checkToolPermission`
- **决定**：B。理由：单一入口，权限逻辑集中管理，新增工具时不需要到处加判断
- **影响**：`agent/loop.ts`（移除 isDestructive 判断，改用 checkToolPermission）

---

### DEC-028: 子 Agent 工具黑名单

- **日期**：2026-06-20
- **状态**：已决定
- **背景**：子 Agent 如果持有 delegate_task 工具会无限递归；持有 remember/forget/task_plan 会修改父 Agent 的状态
- **选项**：
  - A：不限制 — 依赖 LLM 自律（不可靠）
  - B：硬编码黑名单（delegate_task / remember / forget / task_plan）— 代码级保障
  - C：配置化黑名单 — 灵活但当前没有多样化需求
- **决定**：B。理由：这 4 个工具的排除理由明确且通用，不需要配置化的灵活性
- **影响**：`agent/subagent.ts`（SUBAGENT_TOOL_BLACKLIST + buildChildRegistry 过滤）

---

### DEC-029: 工具/服务边界分离（task_plan 示范）

- **日期**：2026-06-20
- **状态**：已决定
- **背景**：task_plan 工具文件同时包含业务逻辑（SQLite 持久化 / 状态管理）和 LLM 工具定义，导致 Runtime 需要调用"工具"来设置 sessionId，模糊了内部服务和 AI 工具的边界
- **选项**：
  - A：保持在工具文件里 — 简单但边界模糊
  - B：拆分为 service（状态/持久化）+ tool（薄壳包装）— 对齐 CC 的 Tool vs 内部模块设计
- **决定**：B。理由：Runtime/中间件/其他工具可直接 import service 而不经 LLM 调用路径，测试也更容易隔离
- **影响**：新增 `services/task-plan-service.ts`、`tools/builtins/task-plan.ts` 精简为薄壳

---

### DEC-030: Agent Loop 重构为 LoopState 状态机

- **日期**：2026-06-20
- **状态**：已决定
- **背景**：原 loop.ts 使用 for 循环 + 散落局部变量，无法支持 reactive compact 重试、max_output 恢复等跨迭代的控制流跳转
- **选项**：
  - A：保持 for 循环，用 flag 变量控制 — 简单但随着逻辑增加会变成意大利面
  - B：while + LoopState + ContinueReason 状态机 — 对齐 CC 的 while(true) 模式
- **决定**：B。理由：集中状态管理让错误恢复、权限追踪等功能可以自然叠加，不引入深层嵌套
- **影响**：`agent/loop.ts` 全面重写

---

### DEC-031: done 事件携带 TerminalReason

- **日期**：2026-06-20
- **状态**：已决定
- **背景**：原 `{ type: 'done' }` 事件无法区分正常完成、超限、中断、错误等终止原因，前端和 Runtime 无法做差异化处理
- **决定**：扩展为 `{ type: 'done', reason: TerminalReason }`，定义 5 种终止原因
- **影响**：`types.ts` 新增 `TerminalReason` 类型；`loop.ts` / `runtime.ts` / `ipc/chat.ts` 所有 done 事件需携带 reason

---

### DEC-032: 413 紧急压缩策略（一次机会）

- **日期**：2026-06-20
- **状态**：已决定
- **背景**：长对话场景下 LLM 可能返回 413/context_length_exceeded，需要在不中断循环的前提下恢复
- **选项**：
  - A：直接报错终止 — 用户体验差
  - B：触发一次 reactive compact + 重试 — 平衡恢复能力和无限循环风险
  - C：无限重试压缩 — 可能死循环
- **决定**：B。`hasAttemptedReactiveCompact` flag 保证只触发一次，压缩后仍超限则报 `prompt_too_long` 终止
- **影响**：`agent/loop.ts` 新增 413 检测 + reactive compact 逻辑

---

### DEC-033: max_output_tokens 截断恢复（最多 2 次）

- **日期**：2026-06-20
- **状态**：已决定
- **背景**：模型响应可能因输出 token 限制被截断（stopReason=max_tokens/length），Alice 和 CC 都有续写机制
- **决定**：检测到截断后注入 `[System] continue from where you left off` 续写提示，最多恢复 2 次
- **影响**：`agent/loop.ts` 新增 max_output_recovery 逻辑；`llm/index.ts` 三个适配器新增 stopReason 提取

### DEC-034: 伙伴生活世界 — 单活跃角色与文档分工

- **日期**：2026-08-01
- **状态**：已决定
- **背景**：终局要做同团多主角 + 朋友圈/衣柜等生活世界；需避免会话跳戏、双真相文档、以及与 Electron 底层分层冲突
- **选项**：
  - A：共享时间线 + 视角滤镜，允许会话中换角 — 灵活但易跳戏、Prompt 难控
  - B：同宇宙多 Role Pack，同时只启用一个角色；会话中禁止换角；完整切换；非活跃暂停；Catch-up 细补 ≤7 天 — 更清晰
- **决定**：B。人设推倒重来（废旧三模板）。文档：契约+W 批次 → `requirements/companion-world-framework.md`；模块详设 → `requirements/companion-architecture.md`；施工合同 → `requirements/companion-tech-spec.md`；`architecture.md` 只留指针；modules 卡待有代码边界再开；methodology Part VI（M21–M31）随 W 沉淀
- **影响**：后续 W0–W6；Orchestrator 门控；LifeEngine 分桶；Eval 带 protagonistId

### DEC-035: 主角交付节奏与破坏性重置

- **日期**：2026-08-01
- **状态**：已决定
- **背景**：tech-spec §8 拍板
- **决定**：
  1. 架构按 3 主角位（`plannedProtagonistSlots`）；**内容先做 1 个** Role Pack，再逐个追加
  2. 开发期可清空 sessions；不为旧会话做无 `role_id` 兼容
  3. 设置字段直接用 `activeRoleId`，删除 `personaId`，不做迁移映射；`persona:*` IPC 直接换成 `companion:*`
- **影响**：W0 范围缩小为单 Pack + 可扩容目录；设置/IPC/单测破坏性一次改完

### DEC-036: 角色档案、默认世界与表达状态分层

- **日期**：2026-08-11
- **状态**：已决定
- **背景**：现有 Role Pack 能表达核心人格和 voice，但人物履历、居住细节与“热度”缺少结构化归属；Alice 源码使用静态人设、character state、home profile、world facts 和时间线分层。
- **选项**：
  - A：继续把年龄、职业、住所和表达强度写进 `protected.md` / `voice.md` — 简单，但 Prompt 膨胀且稳定事实与动态状态混杂
  - B：增加 `profile.json` 与 `world.default.json`，运行时状态继续由 `world_json` 持有 — 多一层资产，但真相边界清晰
- **决定**：选择 B。表达不采用单一热度参数，而使用五维人格基线 + 本轮 tone-control + 关系阶段；LLM `temperature` 只负责采样随机性。
- **补充决定**：当前只施工主角候选小航；平台支持可选 `profile/world` 资产，但不扩写其他角色。先确认行为人格，再设计人物故事；姓名不得自动推导主题、职业或世界观。旧三字段 `world_json` 全局不兼容、不迁移，读取时按各角色当前默认值重置；这不代表扩写其他角色内容。
- **影响**：小航 Role Pack、Playground 人格验收、Persona Eval、identity loader、Prompt L1、世界初始化、日剧本与 Debug 世界态；其他角色保持原状。参考审计在 `_reference/alice-persona-world-source-analysis.md`。

---

### DEC-037: 当前威胁模型不引入 OS 级 Shell 强隔离

- **日期**：2026-08-16
- **状态**：已决定（当前明确不做）
- **背景**：安全审计确认应用层命令守卫、PermissionEngine、有效沙箱、工作区 realpath、`ToolContext.workdir`、主进程确认、安全子进程环境、超时和输出上限已覆盖当前个人桌面 Agent 的主要风险。继续引入 Windows Job Object / AppContainer、容器、低权限账户或嵌入 Python 沙箱，会显著破坏 Git、Node/Python、编译器、代理、证书、SSH 和跨平台兼容性，并容易制造“有 OS 沙箱就绝对安全”的错觉。
- **选项**：
  - A：现在建设 OS 级强隔离 — 防御更深，但跨平台成本高、产品能力损失大，且与当前单用户本机威胁模型不匹配
  - B：维持应用层 fail-closed 安全模型，把低层剩余风险作为明确接受边界 — 与当前产品定位匹配
  - C：继续放在 wishlist，未来不设触发条件地反复评估 — 会让后续 Agent 把已决策事项误报成安全欠债
- **决定**：选择 B。当前明确不做 OS 级 Shell 强隔离，也不做 Python 嵌入沙箱；这不是“以后有空补”的待办，而是当前威胁模型下的非目标。
- **重新立项触发条件**：产品转为多租户/云端执行、无人值守远程执行、默认无确认运行任意 Shell、自动执行第三方未知二进制、企业客户提出强合规要求，或威胁模型开始对抗本机恶意用户。届时应优先设计独立受限 Runner，而不是继续向现有 `shell_exec` 堆条件。
- **影响**：`docs/modules/permission.md` 明确接受 Shell 解释器语义和 symlink TOCTOU 的剩余风险；`docs/wishlist.md` 勾掉 Shell OS 隔离与 Python 嵌入沙箱；Code Review 不得在触发条件未变化时反复把它们列为未完成漏洞。

---

### DEC-038: 生产资产采用“自动发现 + 显式语义注册 + fail-closed 门禁”

- **日期**：2026-08-17
- **状态**：已决定
- **背景**：Tool / Skill / MCP 等运行时能力可以由 loader 自动发现；Prompt、Provider、SubAgent 角色、Theme 等静态资产若只靠目录扫描无法可靠推导稳定语义 key，容易出现 Debug 漏登和第二事实源。
- **决定**：动态家族明确标记 runtime auto-discovered；静态家族必须由生产注册表登记；`scripts/asset-governance.mjs` 维护治理元数据，`npm run assets:check` 校验来源、类型覆盖、单一来源和 staged 同步，失败即阻断。机器报告只做 dated snapshot，不参与产品运行。
- **影响**：新增静态资产必须同步注册表和测试；主题只在 `design-asset-registry.ts` 登记；SubAgent 执行器与 Debug 共享 `subagent-asset-registry.ts`；图标 / UI / Design 不进入 ModelContext 或 Agent 运行证据。
### DEC-039: Provider 预设按 Alice 入口分组，协议能力仍由本项目路由事实决定

- **日期**：2026-08-29
- **状态**：已决定
- **背景**：Alice 当前 Provider 清单覆盖官方直连、国内服务商、聚合入口、Coding Plan 和本地服务；若全部平铺，用户会把不同计费和协议入口误认为同一种模型。
- **选项**：
  - A：只保留少数手写模型 — 页面简单，但与 Alice 支持范围脱节，且设置 / Chat 容易再次分叉
  - B：复制 Alice 全部 Provider 定义 — 覆盖广，但会把 TTS、订阅代理和厂商声明直接伪装成 My Agent 的真实能力
  - C：映射 Alice 的可用聊天入口到共享预设，按入口类型分组，协议能力继续由本项目 router 决定 — 覆盖广且不越过本项目真实边界
- **决定**：C。共享 `src/shared/provider-presets.ts` 纳入 24 个 Provider 入口，分为海外直连、国内服务商、编程套餐、聚合与代理、本地 / 自定义；模型 ID 不属于入口预设，Settings 由用户按账户实际可用列表填写；ListenHub（TTS）和 CLIProxy（本地订阅代理）不作为普通聊天入口。
- **影响**：Settings、Chat 快切、Debug Provider 资产统一读取共享预设；Anthropic / Gemini 请求 builder 归一化版本路径，未知自定义端点仍回退 OpenAI Compatible。

---

### DEC-040：Debug 统一为全局全页诊断工作区

- **日期**：2026-08-29
- **状态**：已决定
- **背景**：当前同时存在全页 `DevPanel` 和 Chat 内 `conversationDebugMode` 两套调试入口。后者把调用链盖在 Chat 右坞半屏上，打断产品对话层级，也让“Debug 到底在哪里看”变得不清晰。
- **选项**：
  - A：保留对话内 Debug，只把右坞做得更宽 — 改善空间但继续保留两套心智模型
  - B：让对话内开关跳转到全页 Debug，同时移除半屏覆盖和 Chat 专属持久化状态 — 入口可保留，诊断职责统一
  - C：保留两套入口但共享更多状态 — 实现复杂，仍会让产品态混入开发信息
- **决定**：选择 B。全局 Debug 以 `activeView === 'debug'` 和 `DevPanel` 为唯一诊断工作区；Chat 只保留产品对话，ChatRightDock 只负责文件 / 预览 / 审阅 / 终端。旧 `conversationDebugMode` 设置键暂时保留在存储层以兼容既有数据，但不再驱动 UI 或运行时行为。
- **影响**：`src/App.tsx`、`src/components/DevPanel.tsx`、`src/components/SettingsPanel.tsx`、`src/components/chat/right-dock/ChatRightDock.tsx`、Debug 系统快照类型与文档；历史施工合同中关于 Debug 覆盖的内容保留为冻结快照，不作为当前行为事实源。

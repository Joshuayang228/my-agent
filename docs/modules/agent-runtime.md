# Agent 运行时

## 一句话

对话主循环、Prompt 组装、上下文压缩、任务队列与可观测——聊天能跑起来的横切骨架。

## 边界

**做**：Agent Loop（流式事件 / 工具超时 / 重试）、会话 Runtime 中心化、System Prompt 四层组装、上下文压缩、后台任务队列、子 Agent、MCP Client、多 Provider LLM、Headless、Observer/DevPanel。  
**不做**：伙伴生活世界语义（见 companion）；结构化记忆库本身（见 memory）；权限策略语义（见 permission）。

## 短 Why

产品横切叠在运行时之上；没有稳定 Loop / Prompt / 压缩，伙伴与记忆无处挂载。

## 主入口

| 类型 | 位置 |
|------|------|
| 运行时 | `agent/runtime.ts` · `agent/loop.ts` |
| Prompt | `agent/prompt-builder.ts` · `prompts/registry.ts` · `prompts/texts.ts` |
| 压缩 | `agent/context-manager.ts` |
| 队列 | `services/task-queue.ts` |
| UI 调试 | DevPanel（Debug）· PlaygroundPage · `ConversationDebugAside` |
| 分层说明 | [`../architecture.md`](../architecture.md) |

## 依赖

- **依赖**：llm、tools、storage、sandbox（执行前）、companion/memory（组装时注入）  
- **被依赖**：Chat IPC、召唤/反思后台任务、Eval 框架场景

## 不变量

- `chat:send` 只传本轮用户消息；历史由 session-store 加载  
- 工具执行前走权限引擎（见 permission）  
- 主 Assemble 只在 `prompt-builder`；辅助 Prompt 不得再走一套平行组装器冒充主路径

## 必读文件

- `electron/main/agent/runtime.ts`
- `electron/main/agent/loop.ts`
- `electron/main/agent/prompt-builder.ts`
- `electron/main/agent/context-manager.ts`
- `electron/main/services/task-queue.ts`
- `docs/architecture.md`

## 必测点

- Loop 流式事件与工具超时  
- Runtime 中心化（乐观 UI + done 后 session 对齐）  
- 相关单测：`agent-loop`、`task-queue`、`observer` 等

## 已落地能力

状态：`已落地` · `部分` · `缺口`。能力增删或行为变了 → **同轮改本表**。

| 能力 | 状态 | 入口 / 落点 |
|------|------|-------------|
| Agent Loop（流式事件 · 工具超时 · 重试） | 已落地 | `agent/loop.ts` |
| 会话 Runtime 中心化（chat:send 只传本轮） | 已落地 | `agent/runtime.ts` · `ipc/chat` |
| System Prompt 四层组装 | 已落地 | `prompt-builder.ts` |
| 自有模型提示词统一中文 + 自动语言门禁 | 已落地 | 主 Assemble / 压缩 / 画像 / 子 Agent / 内置工具 schema；`prompt-language.test.ts` |
| 上下文压缩 L1–L4 | 已落地 | `context-manager` |
| 任务队列（后处理 / 反思等） | 已落地 | `services/task-queue` 等 |
| 子 Agent | 部分 | `subagent`；召唤下任务工边界（M26-G2）；Swarm 见 wishlist |
| MCP Client（stdio + SSE） | 已落地 | `mcp/` · 设置页 |
| 多 Provider LLM + Failover | 已落地 | `llm/`；配置唯一经 `loadMainLLMConfig` / `loadAuxLLMConfig` |
| 首次模型配置旅程 | 已落地 | 无 Key 自动进入设置「模型」；Provider / Key / Base URL / 模型 → 当前配置连接测试 → 保存并开始对话；字段变化会使验证失效，测试复用统一配置工厂且不写盘 |
| Headless 运行（定时/后台） | 已落地 | `runtime.runHeadless` |
| Observer / DevPanel 可观测 | 已落地 | tracer / observer / DevPanel |
| LLM Debug 调用持久化 | 已落地 | tracer sink · `llm_debug_logs` · Debug IPC；复用 `my-agent.db` |
| Chat Callback 三通道 UI | 已落地 | `src/components/chat/callbacks/` |
| 工具卡行内附着 assistant（Alice Phase B） | 已落地 | `resolve-tools-for-message.ts` · 历史 `toolCalls`+`role=tool`；进行中挂 live host |
| Dev Playground（无 Assemble 试跑） | 已落地 | PlaygroundPage · `debug:playground-run` |
| Debug / Playground 独立全页 | 已落地 | 侧栏纵向分列入口 + 各自页面壳；非双 tab / 非抽屉 |
| 工具手测（权限门闸） | 已落地 | `debug:tool-run` · confirmRisk |
| Prompt 会话覆盖（不写 settings） | 已落地 | 载入实装 → playgroundRun |
| 设计 token 场 | 已落地 | Playground「设计 → Token 与主题」 |
| Playground 组件展厅（左侧活目录 + 故事矩阵） | 已落地 | `src/components/playground/` · M32-G9 · 左右栏 |
| Playground UI 矩阵加厚（确认/芯片/状态条/反馈/独白） | 已落地 | M32-G9 Phase 1 · Toast / MarkdownRenderer 等正式组件故事格 |
| Playground 已采用标记与主题对照 | 已落地 | `AdoptionMark` · 壳层开关统一显隐并持久化 · 七主题同页审计；无图标不附加实验状态 |
| 对话 Debug 右侧栏 | 已落地 | Chat 右坞 · `ConversationDebugAside`；可盖在能力坞之上（Alice 式）；持久化 LLM 调用链 |
| 项目文件预览 | 已落地 | `FileBrowser` · text/image/unsupported；图/文本/md；html 沙箱 iframe；pdf·Office 外开 |
| Chat 右侧能力坞 | 已落地 | `ChatRightDock` · Tab 文件/审阅/终端；会话写文件变更账本；命令控制台（非 PTY）；可拖宽 + 内部分界 |
| Prompt 资产目录与调用级追踪 | 已落地 | Debug「提示词管理器」+ LLM 调用详情「Prompt 资产」；调用点传稳定 key，`llm/index.ts` 统一解析来源 / 版本 / locale / 插槽并写入 `requestExtra` |
| Prompt 受控编辑 | 已落地 | 生产资产只读；实验副本可隔离试跑；二次确认后复用 `settings.systemPrompt` 保存为 L3 自定义补充指令 |
| Playground 多轮隔离对话 | 已落地 | `playgroundRun.history` · PromptLab transcript |
| Playground 模型测试（烟测 + thinking.disabled 探测） | 已落地 | `设计 → Token 与主题`、`Agent 实验 → 模型能力` 等分组入口 · `debug:model-smoke` / `model-probe-thinking`；能力缓存供辅助调用 |
| Debug 世界态透视 | 已落地 | `debug:world-snapshot` · DevPanel 伙伴状态域 |
| Debug 诊断闭环 | 已落地 | 提示词管理器 / 请求与运行 / 伙伴状态 / 质量·Eval / 系统；LLM 调用、Span 与实时事件收进请求与运行内部视图 |
| Debug 真实请求上下文 | 已落地 | `LLMCallsPanel` 在请求与运行域读取持久化 `requestMessages` / `requestTools`，并合并 System / Messages / Tools / 参数 / 响应 / JSON；装配预览不声明为实发内容 |
| Debug 全量 LLM 调用浏览 | 已落地 | 请求与运行域提供元数据筛选、分页、详情、JSONL 导出、两步清空；查询与导出共用过滤语义 |
| Debug Persona Eval 验收台 | 已落地 | 报告读取 + `debug:eval-run-*` · `PersonaEvalPanel`；逐 Trial 展示实际 messages / System Prompt / 工具 / 配置、一次性 Judge checks、回复与 evidence；兼容旧报告 |
| Persona Eval 真人格人工审阅 | 已落地 | `persona_eval_human_reviews` · `debug:persona-eval-human-review-*`；独立保存正向体验、风险信号、结论与备注，不改自动 Eval |

## 现状 / 缺口

**现状**：Loop / Runtime / Prompt / 压缩 / 队列 / MCP / 可观测主线已落地；Prompt 由生产注册表统一登记稳定 key、用途 / 角色、来源、版本、`zh-CN` locale 和动态插槽；Debug 提示词管理器可查看目录与当前装配，真实 LLM 调用详情则逐次展示该次请求实际声明的 Prompt 资产，未知 key 不静默丢失；LLM Debug 正文通过现有 observer → tracer Span sink 持久化，侧栏可跨重启恢复；全页 Debug 已按开发者诊断任务收口：提示词管理器 / 请求与运行 / 伙伴状态 / 质量·Eval / 系统；请求与运行域直接读取真实请求快照并保留调用链 / 事件，质量域读取 Persona Eval 报告，并在独立本地审阅层保存真人格人工判断；原始报告和自动判定保持只读。Playground 已按设计 / Agent 实验两组收口，设计组件边缘态合并展示，旧人格验收与体验夹具源码保留但不再作为 active 入口。
**缺口**：Swarm（wishlist）；更完整的子 Agent 产品化。

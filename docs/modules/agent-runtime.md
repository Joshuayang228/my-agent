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
| Prompt | `agent/prompt-builder.ts` |
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
| 上下文压缩 L1–L4 | 已落地 | `context-manager` |
| 任务队列（后处理 / 反思等） | 已落地 | `services/task-queue` 等 |
| 子 Agent | 部分 | `subagent`；召唤下任务工边界（M26-G2）；Swarm 见 wishlist |
| MCP Client（stdio + SSE） | 已落地 | `mcp/` · 设置页 |
| 多 Provider LLM + Failover | 已落地 | `llm/`；配置唯一经 `loadMainLLMConfig` / `loadAuxLLMConfig` |
| Headless 运行（定时/后台） | 已落地 | `runtime.runHeadless` |
| Observer / DevPanel 可观测 | 已落地 | tracer / observer / DevPanel |
| LLM Debug 调用持久化 | 已落地 | tracer sink · `llm_debug_logs` · Debug IPC；复用 `my-agent.db` |
| Chat Callback 三通道 UI | 已落地 | `src/components/chat/callbacks/` |
| 工具卡行内附着 assistant（Alice Phase B） | 已落地 | `resolve-tools-for-message.ts` · 历史 `toolCalls`+`role=tool`；进行中挂 live host |
| Dev Playground（无 Assemble 试跑） | 已落地 | PlaygroundPage · `debug:playground-run` |
| Debug / Playground 独立全页 | 已落地 | 侧栏纵向分列入口 + 各自页面壳；非双 tab / 非抽屉 |
| 工具手测（权限门闸） | 已落地 | `debug:tool-run` · confirmRisk |
| Prompt 会话覆盖（不写 settings） | 已落地 | 载入实装 → playgroundRun |
| 设计 token 场 | 已落地 | Playground「设计系统」 |
| Playground 组件展厅（左侧活目录 + 故事矩阵） | 已落地 | `src/components/playground/` · M32-G9 · 左右栏 |
| Playground UI 矩阵加厚（确认/芯片/状态条/反馈/独白） | 已落地 | M32-G9 Phase 1 · Toast / MarkdownRenderer 等正式组件故事格 |
| Playground 已采用标记与主题对照 | 已落地 | `AdoptionMark` · 壳层开关统一显隐并持久化 · 七主题同页审计；无图标不附加实验状态 |
| 对话 Debug 右侧栏 | 已落地 | Chat 右坞 · `ConversationDebugAside`；可盖在能力坞之上（Alice 式）；持久化 LLM 调用链 |
| 项目文件预览 | 已落地 | `FileBrowser` · text/image/unsupported；图/文本/md；html 沙箱 iframe；pdf·Office 外开 |
| Chat 右侧能力坞 | 已落地 | `ChatRightDock` · Tab 文件/审阅/终端；会话写文件变更账本；命令控制台（非 PTY）；可拖宽 + 内部分界 |
| Prompt 资产目录 | 已落地 | Debug「提示词管理器」· `debug:prompt-assets` · `electron/main/agent/prompt-assets.ts`（生产代码唯一来源） |
| Playground 多轮隔离对话 | 已落地 | `playgroundRun.history` · PromptLab transcript |
| Playground 模型测试（烟测 + thinking.disabled 探测） | 已落地 | `model-test` tab · `debug:model-smoke` / `model-probe-thinking`；能力缓存供辅助调用 |
| Debug 世界态透视 | 已落地 | `debug:world-snapshot` · DevPanel 世界态 tab |
| Debug 诊断闭环 | 已落地 | 提示词管理器 / 上下文 / 世界态 / 运行记录 / Eval / 系统；Span 与实时事件收进运行记录内部视图 |
| Debug 真实请求上下文 | 已落地 | `ContextInspectorPanel` 读取持久化 `requestMessages` / `requestTools`；装配预览不声明为实发内容 |
| Debug 全量 LLM 调用浏览 | 已落地 | 元数据筛选、分页、详情、JSONL 导出、两步清空；查询与导出共用过滤语义 |
| Debug Persona Eval 验收台 | 已落地 | 报告读取 + `debug:eval-run-*` · `PersonaEvalPanel`；白名单 Mock/Real Runner、确认、实时进度、停止与历史 evidence |

## 现状 / 缺口

**现状**：Loop / Runtime / Prompt / 压缩 / 队列 / MCP / 可观测主线已落地；LLM Debug 正文通过现有 observer → tracer Span sink 持久化，侧栏可跨重启恢复；全页 Debug 已按生产真相域收口，直接读取真实请求快照和 Persona Eval 报告。
**缺口**：Swarm（wishlist）；更完整的子 Agent 产品化。

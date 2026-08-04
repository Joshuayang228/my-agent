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
| UI 调试 | DevPanel · Playground |
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
| 多 Provider LLM + Failover | 已落地 | `llm/` |
| Headless 运行（定时/后台） | 已落地 | `runtime.runHeadless` |
| Observer / DevPanel 可观测 | 已落地 | tracer / observer / DevPanel |
| Chat Callback 三通道 UI | 已落地 | `src/components/chat/callbacks/` |
| Dev Playground（无 Assemble 试跑） | 已落地 | DevPanel · `debug:playground-run` |
| Debug / Playground 独立全页 | 已落地 | 侧栏双入口 + `activeView`；非右侧抽屉 |
| 工具手测（权限门闸） | 已落地 | `debug:tool-run` · confirmRisk |
| Prompt 会话覆盖（不写 settings） | 已落地 | 载入实装 → playgroundRun |
| 设计 token 场 | 已落地 | Playground「设计 token」tab |
| Debug 世界态透视 | 已落地 | `debug:world-snapshot` · DevPanel 世界态 tab |

## 现状 / 缺口

**现状**：Loop / Runtime / Prompt / 压缩 / 队列 / MCP / 可观测主线已落地。  
**缺口**：Swarm（wishlist）；更完整的子 Agent 产品化。

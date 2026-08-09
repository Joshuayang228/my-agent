# 施工合同：对话 Debug 的 LLM 调用记录存储

> **状态**：已落地 · 2026-08-08
> **范围**：M32-G10 · 只补 Debug 数据存储与其读写链路，不重做完整聊天数据系统

## 需求背景（Why）

当前对话 Debug 右侧栏已经把内存中的 `AgentStreamEvent` 聚合成 LLM 调用链，但这些数据只存在渲染进程当前会话的 React state 中：

- 切换会话或重启应用后，调用链消失；
- 侧栏无法恢复历史 LLM 调用；
- 只有事件摘要，没有 Alice Debug 中可按需展开的完整请求、工具、响应和错误；
- 全页 Debug Console 的事件流与对话侧栏的调用记录没有持久化边界。

Alice 的做法不是把聊天消息存储整体重做，而是单独维护一层 LLM Debug Logger：主进程将每次真实 LLM 请求写入 `llm_logs`，通过 `startRequest` / `endRequest` 记录生命周期，再通过 IPC 将实时事件和历史查询结果同步到 renderer。

## 功能目标（What）

### 必须实现

1. 每个现有 `llm_request` Span 生成一条独立 Debug 记录，至少包含；Provider failover / Agent retry 仍保留在同一 Span 的 Debug extra 与调用链语义中：
   - `id`、时间、`sessionId`、`provider`、`model`、`caller`；
   - 请求 messages、tools、extra 参数；
   - 响应 content、reasoning、tool calls、error；
   - prompt / completion / total / cached tokens；
   - duration 与 `pending` / `success` / `error` 状态。
2. Span 首次挂载请求快照时立即写入 `pending` 记录，Span 结束或失败时更新同一条记录。
3. Debug 数据在应用重启后仍可按会话查询。
4. 记录通过 IPC 实时同步到 renderer，历史记录在切换会话时恢复，并按 `logId` 去重合并。
5. 对话 Debug 侧栏改为消费持久化的 LLM 调用记录：
   - 列表只显示调用摘要；
   - 展开时显示元数据；
   - 用户显式操作时再读取完整请求 / 响应；
   - 支持复制单条 JSON、导出当前会话 Debug JSONL、清空 Debug 记录。
6. 支持 Alice 的子 Agent Debug 关系：子 Agent 的 LLM 记录独立归属子会话，同时能按主会话查询出来。
7. Debug 存储失败不得阻断正常 LLM 请求；错误只进入主进程日志并让本条记录降级。

### 明确不做

- 不迁移或重做 `sessions`、`messages`、memory 等完整业务数据存储；
- 不把 `text`、`thinking` 等高频流式事件永久写入 Debug 数据库；
- 不把 Debug 记录当作产品聊天消息；
- 不新增 Token 价格计算或计费展示；
- 不在 Debug 记录中保存 API Key、Authorization header 等凭据。

## 技术方案（How）

### 1. 接入现有日志 / 可观测层

不新增与现有日志平行的 `LLMLogger` 生命周期。职责保持不变：

- `electron/main/utils/logger.ts`：继续负责可读的运行日志、文件轮转和凭据脱敏；只记录 Debug 存储失败等诊断信息，不承载完整 Prompt / Response；
- `electron/main/utils/observer.ts`：继续作为 LLM 生命周期抽象，主 Agent 现有 `onLLMStart` / `onLLMEnd` 不改语义；
- `electron/main/utils/tracer.ts`：继续拥有 `llm_request` Span、caller 归因、Token 统计和父子调用链；新增一个 LLM Debug sink 钩子，使用现有 Span ID 作为 Debug `logId`；
- `electron/main/storage/llm-debug-store.ts`：只实现 sink 和 Debug 数据查询，不自行创建第二套 LLM 调用边界。

Debug 记录落在现有 `my-agent.db` 中的专用表，而不是独立数据库文件：

- `llm_debug_logs`：一行对应一个现有 `llm_request` Span；
- `llm_debug_subagent_sessions`：记录 `subagentSessionId → mainSessionId` 关系，支持主会话聚合查询。

这样既保留 Alice 的「Debug 记录可持久化、可单独清空」语义，又遵守项目当前 `database.ts` 的单库、schema migration、`sql.js` 和原子写盘约束。

请求和响应正文等敏感字段沿用项目 `safeStorage` 能力：可用时加密存储与解密读取；不记录请求头和凭据。

### 2. LLM Debug 数据挂接到现有 Span

在 `electron/main/llm/index.ts` 的统一 `streamChat` 入口补齐请求 / 响应快照，但生命周期仍由现有 `observer → tracer` 链路控制：

```text
现有 observer.onLLMStart
  └─ tracer SpanHandle + Debug request snapshot → llm_debug_logs.pending
      ├─ 流式收集 content / reasoning / tool calls / usage
      └─ 现有 observer.onLLMEnd → Debug response snapshot 更新同一 logId
```

主 Agent 继续复用当前 loop 创建的 `llm_request` Span；`chatComplete` 等当前没有显式 Span 的辅助调用，在统一 LLM 入口补建同样的 observer Span。这样不会在 renderer 根据 `text` / `thinking` 事件猜测调用次数，也不会把一轮调用重复记录成两层无关日志。

请求快照记录进入实际调用时可获得的 messages、tools、provider、model、caller、sessionId、parentSpanId 和调用参数；响应快照记录 content、reasoning、tool calls、usage、duration、错误与状态。Provider failover 和 Agent retry 仍挂在现有 Span 语义下，作为同一调用链中的尝试信息，不另造第二个状态机。

调用上下文只补充现有链路缺少的 `sessionId` / 原始 `caller` / `parentSpanId`，不改变 `ToolContext` 和业务会话模型。主 Agent 使用当前 TraceContext 的 session；子 Agent 复用现有 `subagent` Span 和 `ToolContext`，只额外注册 Debug 查询所需的父子 session 关系。

### 3. 主进程 IPC：作为现有 Debug IPC 的扩展

在现有 Debug IPC 体系中补齐 Alice 对应能力：

- 查询会话 / 子会话 / 单条 `logId`；
- 订阅实时 `start` / `end` call event；
- 清空 Debug 记录；
- 导出当前会话 JSONL；
- 导出单条完整 JSON。

IPC 接口同步四处：

1. `src/shared/types.ts`
2. `electron/preload/index.ts`
3. `electron/main/ipc/debug.ts`（或独立 Debug Logger handler）
4. `src/vite-env.d.ts`

### 4. Renderer 状态与侧栏

在 renderer 维护按主会话分桶的 `llmCallLogs`，其数据源改为现有 tracer 的持久化 sink：

1. 监听主进程实时 `start` / `end`；
2. 切换会话时先找出子会话，再查询历史 Debug 记录；
3. 用 `logId` 合并实时与历史数据，避免重复；
4. `ConversationDebugAside` 只接收持久化调用记录，不再依赖 `eventLog` 聚合；
5. 完整 `requestMessages` / `responseContent` 默认不进入列表渲染，只在展开预览、复制或导出时读取。

现有全页 Debug Console 的 `eventLog` 保留为进程内事件观察；`debug:traces` 继续读取 tracer Span。两者不互相替代：前者适合事件排障，后者适合 LLM 调用持久化与侧栏恢复。

### 5. 保留策略

- 默认最多保留最近 3000 条 LLM Debug 记录；
- 复用主库时额外限制 Debug 正文列约 256 MB，优先删除最旧记录，避免 sql.js 全量导出被大 Prompt 拖垮；
- 超出上限时按时间删除最旧记录；
- `clear` 只清空 Debug 表及其 renderer 缓存，不影响聊天消息、会话、记忆；
- 完整请求 / 响应只在 Debug 模式下落库，不能通过普通聊天 UI 直接展示。

## 影响范围评估

### 预计改动文件

- `electron/main/utils/tracer.ts`
- `electron/main/utils/observer.ts`（仅在需要补齐生命周期载荷类型时）
- `electron/main/llm/index.ts`
- `electron/main/storage/llm-debug-store.ts`
- `electron/main/storage/database.ts`
- `electron/main/index.ts`（注册 tracer sink）
- `electron/main/ipc/debug.ts` 或新增 Debug Logger IPC 文件
- `electron/preload/index.ts`
- `src/shared/types.ts`
- `src/vite-env.d.ts`
- `src/App.tsx`
- `src/components/chat/ConversationDebugAside.tsx`
- `src/components/chat/conversation-debug.ts`
- `electron/main/agent/subagent.ts`、`electron/main/agent/subagent-registry.ts`
- `__tests__/unit/` 下的 logger / IPC / sidebar 测试
- `docs/modules/agent-runtime.md`、`docs/progress.md`、`docs/changelog.md`

### 破坏性评估

- 不改变聊天消息 schema；
- 不改变现有会话数据库；
- 新增 IPC 能力，需要四处同步；
- 新增 tracer sink，但不改变现有 `SpanType`、caller 统计和 `debug:traces` 返回结构；
- `ConversationDebugAside` 的数据输入从临时事件摘要切换为持久化记录，属于组件内部接口调整；
- 现有 `eventLog` Debug Console 行为继续保留。

### 必测

- `startRequest` / `endRequest` 成功、失败、异常中断；
- 重启后历史记录可查询；
- 切换会话与子会话聚合、实时 / 历史去重；
- 清空只影响 Debug 数据；
- retention 删除最旧记录；
- `safeStorage` 可用 / 不可用时的序列化；
- logger 写盘失败时 LLM 仍可正常返回；
- `tsc`、单元测试、`vite build`；
- Debug 侧栏浅色 / 深色主题、长模型名、长错误、完整内容展开。

## 实施步骤

1. **在现有 database schema 中建立 Debug 表**
   - 增加 migration，复用 `getDatabase()` / `persist()`；
   - 实现 sink 的序列化 / 解密、查询、清空、导出、retention；
   - 先补 store 单元测试，可独立验证。
2. **接入 LLM 请求生命周期**
   - 在现有 observer/tracer Span 上挂 request / response snapshot；
   - 覆盖 failover、tool calls、usage、error；
   - 验证 logger 失败不影响请求。
3. **补齐子 Agent 归属**
   - 为子 Agent 分配 Debug session；
   - 写入主会话映射；
   - 验证主会话查询能看到子 Agent 调用。
4. **接入 IPC 四处同步**
   - 增加查询、实时事件、清空、导出接口；
   - 运行类型检查与 IPC 单测。
5. **改造 renderer 与对话侧栏**
   - 增加按会话缓存、历史加载、实时合并；
   - 侧栏改用持久化调用记录；
   - 增加完整内容的显式预览 / 复制。
6. **验收与文档收工**
   - 按项目质量闸门完成自审、测试、build、lint；
   - 更新运行时模块卡、progress、changelog；
   - 用户可见行为与实现边界确认后，再标记本合同为「已落地」。

## 风险与权衡

### Alice 独立日志库 vs. 我们的现有 database

Alice 使用独立 `better-sqlite3` + WAL；本项目已经有统一 `database.ts`，并通过 schema migration、`sql.js`、脏标记 coalesce 和原子写盘保证本地数据安全。若再建一套数据库初始化和生命周期，会把 Debug 变成与现有 log/tracer 不匹配的平行基础设施。因此本次只新增专用 Debug 表和 tracer sink，物理库不同不是目标，行为语义对齐才是目标。

### 完整 Prompt / 响应的隐私风险

Debug 记录可能包含用户私密内容。实现中不保存凭据，并使用 `safeStorage` 保护正文；UI 仅在用户主动展开、复制或导出时读取完整内容。若后续需要更严格的隐私控制，应增加 Debug 记录开关与清理策略，而不是把完整内容转入普通会话存储。

### 实时缓存与持久化查询的竞态

实时 `start` 可能先于历史查询返回，必须以 `logId` 去重并以实时终态覆盖历史旧值；不能简单用历史结果覆盖当前 state。

### 子 Agent 会话聚合

若只记录主会话 ID，会丢失 Alice 的调用链归属。实现需要给子 Agent 分配独立 Debug session，并维护父子映射；这会触及子 Agent 生命周期，但不改变子 Agent 的业务会话消息模型。

## 验收结论

当一次真实对话完成后，用户重启应用、重新打开该会话并打开 Debug 侧栏，仍能看到按调用顺序恢复的 LLM 调用链；展开某条记录可以查看该次调用的请求 / 响应详情，失败调用保留错误信息，子 Agent 调用能归入主会话；清空 Debug 不影响正常聊天记录。

# M15 状态机设计 — 代码走读

> 对照 [`m15-state-machine-design.md`](m15-state-machine-design.md)。
> 本轮**无新模块**——展示已有几台状态机如何体现「可命名 / 可转移 / 可解释 / 存活边界」。
> Alice 侧主要是哲学（Ch.01），无独立 FSM 源码可逐行对照；CC 的 query while-loop 已在 M01 code 章深入，此处只点交点。

---

## §二 选型 — 隐式 LoopState vs 显式 TaskStatus

### 我们的实现：隐式（单次 Loop）

```typescript
// electron/main/agent/loop.ts

/** ① 跳转信号：不是用户可见终态，只指导 while 控制流 */
type ContinueReason = 'next_turn' | 'reactive_compact_retry' | 'max_output_recovery'

/**
 * ② 隐式状态机的「状态袋」——所有跨迭代字段集中在此
 * ③ 函数结束即销毁 → 符合「单次调用生命周期」选型（→ m15 §二）
 */
interface LoopState {
  messages: ChatMessage[]
  turnCount: number
  hasAttemptedReactiveCompact: boolean  // ↑ 一次性机会 flag，不必升成联合类型
  maxOutputRecoveryCount: number
  consecutiveDenials: number            // ↑ 熔断计数：故意不落盘（→ m15 §五）
  totalDenials: number
  transition?: { reason: ContinueReason }
  interactionSpanId?: string
}
```

### 我们的实现：显式（跨重启任务）

```typescript
// src/shared/types.ts

/** 后台任务五态 — 命名联合类型 = 显式 FSM 的最小形态 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface BackgroundTaskInfo {
  id: string
  name: TaskType
  sessionId: string
  status: TaskStatus
  notified: boolean   // ↑ 幂等标志，与状态正交（完成了也可能未通知）
  error?: string      // ↑ 失败相的 reason 等价物
  retryCount?: number
  // ...
}
```

| 维度 | LoopState | TaskStatus |
|------|-----------|------------|
| 存活 | 单次 `agentLoop()` | 跨崩溃（SQLite） |
| 形态 | interface 字段袋 | 联合类型五态 |
| 用户可见终态 | 经 `TerminalReason` 出门 | 直接就是 status |
| Eval | 断言 `done.reason` | 可断言 task 事件 |

**发现**：同一仓库里「隐式袋」和「显式联合」并存——选型跟**存活边界**走，不是跟「看起来专不专业」走。  
**方法论对照** → m15 §二、§三。

---

## §三 图鉴落点 — 文件索引

| 状态机 | 类型定义 | 转移逻辑 | 持久化 |
|--------|----------|----------|--------|
| Loop / 终止 | `TerminalReason` @ `types.ts` | `loop.ts` `terminateLoop` / max_turns 等 | 否（消息另存） |
| Loop 跳转 | `ContinueReason` @ `loop.ts`（未导出） | `state.transition` | 否 |
| 执行模式 | `ExecutionMode` @ `types.ts` | `maybeDowngradeExecutionMode` | settings |
| 后台任务 | `TaskStatus` @ `types.ts` | `task-queue.ts` processNext | `background_tasks` 表 |
| MCP 连接 | `status` 字面量 @ `mcp/client.ts` | connect / disconnect | 配置落盘；瞬时态内存 |
| Span | `status: running\|ok\|error` @ `tracer.ts` | `span.end()` | 内存（DevPanel） |
| task-plan | `pending\|in_progress\|done\|skipped` | `task-plan-service.ts` | 随计划存储 |

> **消歧**：`task-plan` 的 status ≠ `TaskStatus`。前者是对话内待办清单；后者是后台队列生命周期。

---

## §四 转移必带 reason

### TerminalReason 出门

```typescript
// src/shared/types.ts

export type TerminalReason =
  | 'completed'
  | 'max_turns'
  | 'aborted'
  | 'prompt_too_long'
  | 'model_error'
  | 'too_many_denials'  // ↑ Deny-and-Continue 熔断；Eval F06 会断言

// AgentStreamEvent 联合成员之一：
// | { type: 'done'; reason: TerminalReason }
```

```typescript
// electron/main/agent/loop.ts

async function* terminateLoop(
  state: LoopState,
  reason: TerminalReason,  // ① 调用方必须显式传入，禁止无 reason 的 done
): AsyncGenerator<AgentStreamEvent> {
  if (reason === 'aborted') {
    yield { type: 'error', message: 'Agent loop was cancelled', code: AgentErrorCode.ABORTED }
  }
  yield { type: 'done', reason }  // ② 契约出门 → Runtime / UI / Eval
}
```

### ExecutionMode 降级带 reason

```typescript
// electron/main/agent/loop.ts（结构示意）

const maybeDowngradeExecutionMode = (): AgentStreamEvent | null => {
  // ... 连续拒绝达阈值 ...
  effectiveExecutionMode = 'confirm-all'
  return {
    type: 'execution_mode_changed',
    mode: effectiveExecutionMode,
    reason: '...',  // ↑ 字符串 reason：解释「为何只降不升」
  }
}
```

### Eval 把状态当契约

```typescript
// evals/graders/index.ts

export function makeTerminalReasonGrader(expected: string): EvalGrader {
  return {
    name: `TerminalReason=${expected}`,
    // 从事件流里找 type==='done'，比对 reason
    // ↑ 改枚举却不改场景 = 静默漂移（→ m15 §六）
  }
}
```

**发现**：`ContinueReason` 故意不出事件——避免把内部控制流当成用户可观测 API；`TerminalReason` 与 `execution_mode_changed.reason` 则必须出门。分层本身就是纪律。  
**方法论对照** → m15 §四、§六。

---

## §五 持久化边界 — 任务元数据 vs 执行闭包

```typescript
// electron/main/services/task-queue.ts

/**
 * ① 内存：fn 闭包（不可序列化）
 * ② SQLite：status / notified / retryCount（崩溃恢复依据）
 * → m15 §五「执行函数不能序列化」
 */
interface InternalTask extends BackgroundTaskInfo {
  fn?: () => Promise<void>  // 恢复的任务没有 fn，等 reRegister
}

function dbUpsertTask(task: BackgroundTaskInfo): void {
  // INSERT OR REPLACE ... status, notified, retryCount ...
}

async recoverPendingTasks(): Promise<BackgroundTaskInfo[]> {
  // status IN ('pending','running') → 重置为 pending 入队
  // ↑ running 崩溃 = 未完成，不能假装 completed
}
```

| 字段 | 内存 | SQLite | 原因 |
|------|------|--------|------|
| `fn` | ✅ | ❌ | 闭包 |
| `status` | ✅ | ✅ | 恢复依据 |
| `notified` | ✅ | ✅ | 防重启重发 Toast |
| `consecutiveDenials`（Loop） | ✅ | ❌ | 单次对话语义 |

**发现**：持久化边界写在注释和表结构里，比「全部 cache」或「全部不存」都清晰——这正是状态契约的「存活边界」一面。  
**方法论对照** → m15 §五；细节 → m09。

---

## §三 补充 — MCP 连接四态

```typescript
// electron/main/mcp/client.ts

interface McpConnection {
  // ...
  status: 'connecting' | 'connected' | 'error' | 'disconnected'
  error?: string  // ↑ error 相的 reason
}

// connect: connecting → connected | error
// disconnect: → disconnected，随即从 Map delete（瞬态几乎不可观测）
```

**发现**：配置持久、连接瞬态——和「MCP 服务器列表」vs「当前是否连上」是两层状态。协议深啃归 M13。  
**方法论对照** → m15 §三、§七。

---

## Alice / CC 对照（概念层）

| 来源 | 贡献 | 我们怎么用 |
|------|------|------------|
| Alice Ch.01 状态优先 | 先问状态住哪、谁读写 | 写成第一性原理 + 检查清单 |
| Alice 可观测（决策带 reason） | 与 M14 合流 | `TerminalReason` / mode changed reason |
| CC query while + stopReason | Loop 隐式状态机样板 | 已在 M01 落地；本章不重复走读 |

**发现**：Alice 给的是**提问顺序**（状态 → 再功能），不是 FSM 库选型。我们用 TypeScript 联合类型就够表达契约。

---

## 与理念章检查清单的代码映射

| 清单问题 | 代码里怎么答 |
|----------|--------------|
| 能画转移图吗？ | TaskStatus / TerminalReason / MCP status 均可画 |
| 内存还是 SQLite？ | `dbUpsertTask` vs `LoopState` 字段 |
| 有 reason 吗？ | `done.reason` / `error` / `execution_mode_changed.reason` |
| UI 是投影吗？ | `App.tsx` 订事件；wishlist 仍有会话权威问题 |
| Eval 同步了吗？ | `makeTerminalReasonGrader` 等 |

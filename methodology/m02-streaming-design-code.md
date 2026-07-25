# M02 Streaming 设计范式 — 代码走读

> 对照 `m02-streaming-design.md` 的各章节，展示 CC（Claude Code）和我们的真实实现。
>
> CC 版本：`2.1.88`，源码路径：`_reference/.../claude-code-sourcemap-main/.../restored-src/src/`
> 我们的实现：`electron/main/agent/loop.ts`

---

## §2 对照：AsyncGenerator 函数签名

### CC 的实现（query.ts）

```typescript
// CC: query.ts L219-228

// ① export async function* = 异步生成器函数
//    async → 函数内可以用 await 等待异步操作
//    function* → 生成器，可以用 yield 一个一个"吐"值
//    两者结合 = 既能 await 又能 yield，是流式 AI 响应的天然表达
export async function* query(
  params: QueryParams,         // ② 输入：所有参数打包为一个对象（而不是多个参数）
): AsyncGenerator<
  | StreamEvent              // ③ yield 出的类型（流式文字片段）
  | RequestStartEvent        // ③ "开始请求"信号
  | Message                  // ③ 完整消息
  | ToolUseSummaryMessage,   // ③ 工具使用摘要
  Terminal                   // ④ return 类型：循环终止原因
> {
  // ⑤ yield* = 把 queryLoop 产出的所有事件透传出去
  //    就像中间人：queryLoop yield 什么，query 就 yield 什么
  const terminal = yield* queryLoop(params, consumedCommandUuids)
  return terminal  // ⑥ 循环结束后返回终止原因给调用者
}
```

CC 把入口 `query()` 和内部循环 `queryLoop()` 分成两个函数。`query()` 是薄薄的壳，只负责转发事件和收尾，真正的循环逻辑在 `queryLoop()` 里。

### 我们的实现

```typescript
// electron/main/agent/loop.ts L131-134

// ① export async function* = 和 CC 完全相同的函数形态
//    这不是风格选择，是"流是系统边界"这条第一性原理的自然表达
export async function* agentLoop(
  options: AgentLoopOptions,  // ② 选项对象（同 CC 的 params 风格）
  registry: ToolRegistry,     // ③ 工具注册表（CC 通过 toolUseContext 传入）
): AsyncGenerator<AgentStreamEvent> {  // ④ yield 类型：统一的 AgentStreamEvent
  // ...
}
```

**发现**：两者都用 `async function*` + 参数对象的形式，函数签名高度一致。差异在于 CC 把循环 `queryLoop` 独立出来，我们把所有逻辑放在一个函数里（通过内部 while 循环）——两种方式都合理，我们的版本在单文件里更容易追踪状态流转。

**方法论对照**：→ `m02-streaming-design.md` §2（AsyncGenerator 是事件流的自然形态）

---

## §3 对照：事件类型设计

### 我们的 AgentStreamEvent

```typescript
// src/shared/types.ts

// AgentStreamEvent 是一个联合类型（union type）——
// 每种事件是一个独立的对象，共享 `type` 字段作为鉴别器（discriminated union）
export type AgentStreamEvent =
  | { type: 'text'; content: string }           // ① LLM 吐出的文字片段（实时透传）
  | { type: 'thinking'; content: string }       // ② 模型思考过程（extended thinking）
  | { type: 'tool_calls'; calls: ToolCall[] }   // ③ LLM 决定调用哪些工具
  | { type: 'tool_call_delta'; index: number; id?: string; name?: string; argumentsDelta: string }
  // ↑ 工具参数的流式片段（在工具参数完整前，每个 token 一个 delta 事件）
  | { type: 'tool_start'; callId: string; name: string; args: Record<string, unknown> }
  // ↑ 工具开始执行（callId 是这次调用的唯一 ID，消费方用它匹配后续事件）
  | { type: 'tool_end'; callId: string; name: string; result: string; isError?: boolean }
  // ↑ 工具执行完成（isError 决定是否在 UI 里显示错误样式）
  | { type: 'tool_confirm'; callId: string; name: string; args: Record<string, unknown> }
  // ↑ 工具需要用户确认（阻塞点：loop 在这里等待 IPC 回调）
  | { type: 'usage'; promptTokens: number; completionTokens: number }
  // ↑ 本轮 LLM 调用的 token 消耗（渲染进程用来更新 token 计数显示）
  | { type: 'error'; message: string; code?: string }
  // ↑ 不可恢复错误（code 是 AgentErrorCode 的字符串值，渲染进程按码分派 UI）
  | { type: 'execution_mode_changed'; mode: ExecutionMode; reason: string }
  // ↑ 连续拒绝后权限模式自动降级
  | { type: 'compact'; level: ...; preTokens: number; postTokens: number; ... }
  // ↑ 上下文压缩完成（含压缩前后 token 数）
  | { type: 'done'; reason: TerminalReason }
  // ↑ 流结束（reason 说明为什么结束，消费方按 reason 决定后续行为）
```

### 事件与 yield 时机对照

| 事件类型 | yield 时机 | 来源 |
|---|---|---|
| `text` / `thinking` | LLM 内层流每个 token | 实时透传（见 §4） |
| `tool_call_delta` | LLM 流式返回工具参数时 | 实时透传 |
| `tool_calls` | LLM 调用完成、检测到 toolCalls 时 | Loop 判断后发 |
| `tool_confirm` | 权限检查需要用户确认时 | 阻塞点 |
| `tool_start` | 每个工具实际执行前 | Loop 发 |
| `tool_end` | 每个工具执行完成后 | Loop 发 |
| `usage` | LLM 调用完成返回用量时 | Loop 发 |
| `compact` | compressContext 成功压缩后 | Loop 发 |
| `execution_mode_changed` | 连续拒绝达到降级阈值时 | Loop 发 |
| `error` + `done` | 任何终止路径（见 §5） | terminateLoop 发 |

**发现**：CC 的事件类型更多（有 RequestStartEvent、ToolUseSummaryMessage 等），我们的更精简。差异反映了产品定位：CC 是代码编辑器需要丰富的工具执行摘要，我们是对话产品更关注消息流。

**方法论对照**：→ `m02-streaming-design.md` §3（事件类型设计：yield 什么，什么时候 yield）

---

## §4 对照：透传模式

### CC 的实现（query.ts 内层流透传）

```typescript
// CC: query.ts（内层流透传的典型模式）

// ① for await...of 消费内层 LLM 流的每个 chunk
for await (const chunk of innerStream) {
  // ② yield 直接把 chunk 转发出去——不缓冲、不修改
  //    消费 query() 的外层代码立刻收到这个 chunk
  yield chunk
}
// ③ 内层流结束后，for await 自然退出，外层继续运行
```

### 我们的实现

```typescript
// loop.ts（LLM 调用和透传片段）

// ① 调用 LLM，返回一个 AsyncGenerator
const stream = streamChat({ config, messages: state.messages, tools: effectiveTools, signal })

// ② 用 .next() 手动迭代（而不是 for await...of），是为了在循环结束后拿到 return 值
let streamResult = await stream.next()

while (!streamResult.done) {
  // ③ 把 LLM 的每个 delta 事件直接透传给外层消费方
  //    yield 之后立刻返回，不等消费方处理完就继续调 .next()
  yield streamResult.value
  streamResult = await stream.next()
}

// ④ .done === true 时，.value 是 return 值（包含 content、toolCalls、stopReason 等）
const result = streamResult.value
```

**为什么用 `.next()` 而不是 `for await...of`**：`for await...of` 可以读取每次 `yield` 的值，但拿不到最终的 `return` 值（循环结束时 `.value` 会被丢弃）。我们需要 LLM 流结束后的 `result`（包含完整 toolCalls、stopReason），所以用 `.next()` 手动迭代。

**发现**：透传模式是两者共同的选择——不缓冲，不在 loop 层做任何 token 级处理。这保证了最低延迟和最小的 loop 与 LLM 适配层之间的耦合。

**方法论对照**：→ `m02-streaming-design.md` §4（透传模式：为什么不缓冲）

---

## §5 对照：done 是合约（terminateLoop）

### 我们的 terminateLoop 实现

```typescript
// loop.ts L650-657

// ① async function* = 终止函数本身也是生成器，这样可以用 yield* 直接转发
async function* terminateLoop(
  state: LoopState,
  reason: TerminalReason,  // ② 终止原因：每个终止路径都必须传入一个明确的原因
): AsyncGenerator<AgentStreamEvent> {
  // ③ 如果是 abort，先发一个 error 事件告知消费方"是被取消的"
  if (reason === 'aborted') {
    yield { type: 'error', message: 'Agent loop was cancelled', code: AgentErrorCode.ABORTED }
  }
  // ④ 任何路径都必须发这个 done 事件——这是合约的强制执行点
  //    消费方（UI/Eval runner/父Agent）依赖这个事件知道流结束了
  yield { type: 'done', reason }
}
```

### terminateLoop 的调用点

```typescript
// loop.ts 中所有退出路径（展示 done 合约如何在代码层面强制）

// 正常完成：LLM 返回纯文本，没有发起工具调用
yield { type: 'done', reason: 'completed' }     // ⑤ 直接 yield，不经 terminateLoop
                                                  //   （历史原因，可以统一改用 terminateLoop）

// abort 信号：每轮循环开头的显式检查
yield* terminateLoop(state, 'aborted')           // ⑥ yield* 把 terminateLoop 的输出转发出去
return                                           // ⑦ return 让 agentLoop 退出

// 413 上下文过长压缩也救不了
yield { type: 'error', message: '...', code: AgentErrorCode.CONTEXT_TOO_LONG }
yield { type: 'done', reason: 'prompt_too_long' }

// LLM 不可恢复错误
yield { type: 'error', ...agentErr.toEventPayload() }
yield { type: 'done', reason: 'model_error' }

// 拒绝熔断
yield { type: 'done', reason: 'too_many_denials' }

// 达到最大迭代次数
yield { type: 'done', reason: 'max_turns' }     // ⑧ while 循环退出后的兜底
```

**发现**：我们把大多数终止路径统一到了 `terminateLoop`，但 `completed` 和部分错误路径还是直接 yield——这是历史遗留，应该统一。CC 的 `queryLoop` 用 return 值（Terminal 类型）来结束，没有"每条路径都 yield done"的强制机制，依赖调用方在循环结束后处理 Terminal。我们的方式把合约内嵌进 agentLoop 本身，消费方不需要"记得"检查 Terminal。

**方法论对照**：→ `m02-streaming-design.md` §5（done 是合约，不是实现）

---

## §6 对照：配对完整性（abort 后合成 tool_result）

### 我们的实现

```typescript
// loop.ts L535-549（工具执行前的 abort 检查 + 合成结果）

// ① abort 检查放在工具真正执行之前
if (signal?.aborted) {
  // ② 找出所有状态还是 pending 的 tool_call（已被 LLM 发起但还没执行）
  for (const call of pendingCalls) {
    // ③ 合成一个"取消"的工具结果
    //    注意：这个结果不是真实执行的，但它满足了 LLM 消息历史的配对约束
    const syntheticResult = '[Tool execution cancelled by user]'

    // ④ 把合成结果加入消息历史（保证 tool_call 有对应的 tool_result）
    state.messages.push({
      id: `tool-${call.id}`,
      role: 'tool',
      content: syntheticResult,
      toolCallId: call.id,
    })

    // ⑤ yield tool_end 事件告知消费方这个工具"完成了"（带 isError: true）
    yield { type: 'tool_end', callId: call.id, name: call.name, result: syntheticResult, isError: true }
  }
  // ⑥ 补完所有 tool_result 后才能终止循环
  yield* terminateLoop(state, 'aborted')
  return
}
```

**为什么要补 tool_result 再 abort**：LLM 消息历史是一个有状态的协议——每个 assistant 消息里的 tool_call，都必须有对应的 tool_result（role=tool），否则下次把这段历史发给 LLM 时会报"tool_call_id not found"错误。即使用户中途取消，消息历史也必须保持配对完整，才能让用户继续对话而不会看到奇怪的报错。

**CC 的对应设计**：CC 的 query.ts 也有类似的"补全 synthetic tool_result"逻辑，这是 LLM API 的通用约束，不是我们特有的。

**方法论对照**：→ `m02-streaming-design.md` §6（配对完整性比正确性更重要）

---

## §7 对照：AbortSignal 显式路径

### 我们的两个检查点

```typescript
// 检查点 1：每轮 while 循环开头（loop.ts L209-213）

while (state.turnCount < maxIterations) {
  // ① 在进入新一轮推理之前检查 abort
  //    这覆盖了"LLM 调用期间被取消"的场景
  if (signal?.aborted) {
    log.warn('Loop cancelled by signal', { turn: state.turnCount })
    yield* terminateLoop(state, 'aborted')  // ② 调用统一终止函数
    return  // ③ return 让生成器函数退出
  }
  // ...继续这一轮推理
}
```

```typescript
// 检查点 2：工具执行之前（loop.ts L535-549，见 §6）

// ④ 在工具真正执行前检查 abort
//    这覆盖了"工具执行期间被取消"的场景
if (signal?.aborted) {
  // 补合成 tool_result 后再终止（见 §6 详细说明）
}
```

**为什么不在 LLM 调用处 throw AbortError**：LLM 的 `streamChat` 也接受了 `signal`，可以在网络层面中断请求。但这会通过 try/catch 进入错误处理路径，混淆"取消"和"错误"两种语义。显式检查点在"安全换手点"介入，行为更可预测：第一个检查点确保在 LLM 调用完成后、下一轮开始前检查；第二个确保在工具执行前检查，并补齐配对。

**发现**：CC 用了更多的 abort 检查点（几乎在每个 async 操作前后），我们简化为两个关键点。这是有意识的取舍：更少的检查点意味着更简单的代码，代价是有几个时间窗口内的 abort 响应会稍慢（比如工具已经开始执行后才 abort）。

**方法论对照**：→ `m02-streaming-design.md` §7（AbortSignal 走显式路径，不走异常）

---

## 关键设计总结

| 设计决策 | 我们的选择 | CC 的选择 | 差异说明 |
|---|---|---|---|
| 函数形态 | `async function*` 单函数 | `async function*` 入口 + 内部 `queryLoop` | CC 分离更清晰，我们更简洁 |
| 事件联合类型 | `AgentStreamEvent`（13 种） | 多种独立类型（更多） | CC 功能更丰富，我们按需设计 |
| 透传内层流 | `.next()` 手动迭代 | `for await...of` / `yield*` | 都是透传，我们要拿 return 值 |
| 终止合约 | `terminateLoop` helper | Terminal 返回值 | 我们把合约内嵌，CC 依赖调用方 |
| 配对完整性 | abort 前合成 synthetic tool_result | 相同机制 | 共同的 API 约束 |
| AbortSignal | 2 个显式检查点 | 更多检查点 | 我们简化，响应稍慢但代码清晰 |

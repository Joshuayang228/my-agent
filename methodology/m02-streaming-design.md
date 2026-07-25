# M02 Streaming 设计范式

> **所属**：Part I 核心运行时
> **参考源**：CC sourcemap agentLoop / streamChat · Alice ch15 范式二

---

## 一、第一性原理

**流不是实现方式，是系统边界——Agent Loop 只管生产事件，不负责消费。**

这听起来像技术细节，但它决定了整个系统的可扩展性。

大多数人第一次实现流式 AI 响应时，会写成这样：流式 token 出来，直接塞进 UI 变量。没有错——在单一消费者时工作得很好。问题出在第一次需要"除了 UI 还有别人也想看这个流"的时候：日志系统、父 Agent、测试框架……它们想看同一个流，但框架已经把流和 UI 耦合在了一起。

**把"流是系统边界"作为第一性原理**，意味着从一开始就把 Agent Loop 的职责限定在"生产结构化事件"，把"谁来消费、怎么消费"完全推到边界之外。

推论地图：

```
根认知：流是系统边界，Loop 只管生产，不管消费
    │
    ├─ ① 产出事件最自然的语言形态？→ AsyncGenerator（§2）
    ├─ ② 生产什么事件，何时生产？  → 事件类型设计（§3）
    ├─ ③ LLM delta 如何透传外层？  → 透传模式（§4）
    ├─ ④ 消费者如何可靠感知流结束？→ done 是合约（§5）
    ├─ ⑤ 中断时历史消息如何完整？  → 配对完整性（§6）
    ├─ ⑥ 取消如何不污染错误路径？  → AbortSignal 显式路径（§7）
    └─ ⑦ "只管生产"的架构收益？   → 消费者解耦（§8）
```

---

## 二、AsyncGenerator 是事件流的自然形态

在 TypeScript 里，`yield` 就是"发布一个事件"，`return` 就是"流结束"。AsyncGenerator 不需要额外抽象层就能表达事件流的完整语义：

- `yield event` → 发布，消费方收到后立即处理
- `return result` → 流结束，`for await...of` 循环自然退出
- `throw error` → 流异常（我们实际上不走这条路径，见 §7）

对比其他选择：

| 方案 | 问题 |
|---|---|
| 回调（callback） | 嵌套地狱，没有内建的"结束"语义 |
| EventEmitter | 类型不安全，`on('done')` 是约定不是合约 |
| RxJS Observable | 引入大型依赖，和原生 async/await 集成不自然 |
| AsyncGenerator | 语言原生，类型安全，`for await...of` 天然支持 async |

`agentLoop` 是一个 `async function*`，外部用 `for await...of` 消费——这不是风格选择，是"流是边界"这条第一性原理在 TypeScript 里最直接的表达。

---

## 三、事件类型设计：yield 什么，什么时候 yield

事件类型的设计直接决定消费方能"看到多少"。太少则调试困难，太多则消费方处理负担重。

当前的 `AgentStreamEvent` 类型集合，按 yield 时机分组：

**实时透传（内层 LLM 流边产边发）**
- `text` / `thinking` — 每个 token 一个事件，驱动 UI 逐字效果
- `tool_call_delta` — 工具参数流式解析（驱动"参数正在解析中"的 UI 状态）

**决策点（Loop 做完判断后 yield）**
- `tool_calls` — LLM 决定要调用工具
- `tool_confirm` — 权限检查需要用户确认（阻塞点）
- `tool_start` / `tool_end` — 工具开始/完成执行

**系统事件（框架内部状态变化）**
- `compact` — 上下文压缩完成（含前后 token 数、触发方式）
- `execution_mode_changed` — 权限模式自动降级
- `usage` — 本轮 LLM 调用的 token 消耗

**终止**
- `error` — 不可恢复错误（含错误码）
- `done` — 流结束（含终止原因 `TerminalReason`）

**一个设计决策值得记**：`error` 和 `done` 是独立事件，不是同一个。出错时先 yield `error`，再 yield `done`。消费方只需监听 `done` 就能确定流结束，从 `done.reason` 判断是正常结束还是出错退出。

---

## 四、透传模式：为什么不缓冲

内层 LLM 流的 token，被 agentLoop 直接透传出去，不做任何缓冲：

```typescript
let chunk = await innerStream.next()
while (!chunk.done) {
  yield chunk.value   // 直接透传，不存、不改
  chunk = await innerStream.next()
}
```

**为什么不缓冲**？缓冲带来的代价是延迟：每个 token 必须等缓冲区满或超时才发出，UI 看到的是"一段一段出现"而不是"逐字流出"。对于 AI 伙伴产品，逐字流出是活人感的核心——用户感知到的是"对面在说话"，而不是"在等机器打印输出"。

透传的另一个好处：agentLoop 不需要知道内层流的格式细节。内层流可以是 OpenAI 兼容格式、Anthropic 格式、本地模型格式——只要 `streamChat` 适配层统一输出 `AgentStreamEvent`，Loop 层完全不感知差异。这正是"边界"的价值。

---

## 五、done 是合约，不是实现

**任何能让 agentLoop 终止的路径，都必须 yield `done` 事件。**

这是一条不能被优化掉的规则。消费方依赖 `done` 来解除 loading 状态、释放资源、进入下一个任务。如果某条路径"忘了" yield `done`，消费方会永远等待——没有报错，只是什么都不发生。这是最难调试的 bug 之一。

我们的终止原因（`TerminalReason`）：

| 原因 | 触发条件 |
|---|---|
| `completed` | LLM 返回纯文本，正常结束 |
| `max_turns` | 达到最大迭代次数 |
| `aborted` | AbortSignal 取消 |
| `prompt_too_long` | 413 压缩后仍超限 |
| `model_error` | LLM 不可恢复错误 |
| `too_many_denials` | 拒绝熔断 |

**"done 是合约"的工程落地**：所有终止路径都通过同一个 helper 函数 `terminateLoop(state, reason)` 处理，而不允许在 Loop 里直接 `return`——必须先 yield done，再 return。这是用代码结构强制合约，而不是靠约定。

---

## 六、配对完整性比正确性更重要

这条规则来自 LLM 消息历史的一个硬约束：**每个 `tool_call` 必须有对应的 `tool_result`**。

当用户在工具执行过程中触发 AbortSignal，"正确"的行为是立即停止。但如果已经有 `tool_call` 进入了消息历史，而没有对应的 `tool_result`，下次把这段历史发给 LLM 时会报错——破坏了对话的可续接性。

所以我们的做法是：abort 发生时，为所有未完成的 `tool_call` 合成一条 `tool_result`：

```typescript
const syntheticResult = '[Tool execution cancelled by user]'
```

这不是"正确"的工具结果，但它满足了消息配对的合约。用"合成"替代"丢弃"，保证历史消息完整，用户之后还能继续对话。

**延伸的设计原则**：Agent 系统的"正确性"不只是"结果是否正确"，还包括"状态是否可续接"。单次操作的正确性服从于整体状态一致性。

---

## 七、AbortSignal 走显式路径，不走异常

取消是正常控制流，不是错误。这个判断决定了 AbortSignal 的处理方式。

**如果走异常路径**：AbortSignal 触发 → 某处 `throw new AbortError()` → 被 try/catch 捕获。问题是异常会跳过中间的状态清理，也很容易和真正的错误混在一起——"这是用户取消还是出错了？"

**我们的选择**：两个显式检查点，每处都是 `if (signal?.aborted)` → 调用 `terminateLoop` → `return`：

1. **每轮 while 循环开头**：进入新的推理轮次前检查，已取消则优雅退出。
2. **工具执行前**：确认还在运行才执行工具，否则补合成 tool_result 后退出（见 §6）。

两个检查点的选择不是随机的：第一个覆盖"LLM 调用期间被取消"，第二个覆盖"工具执行期间被取消"——这是用户取消最常见的两个时间点。

**检查点 vs 中断信号的区别**：虽然也把 signal 传给了内层 `streamChat`，但不依赖它直接中断 LLM 调用——内层流的清理语义不明确。显式检查点在"安全的换手点"介入，行为更可预测。

---

## 八、消费者解耦是架构收益

"Loop 只管生产事件"带来的架构收益是：同一个 agentLoop 实例，可以同时被多个消费方订阅，各自独立演进。

当前的三类消费方：

- **UI 层（renderer）**：通过 IPC 转发事件给前端，驱动消息渲染、工具状态、token 计数
- **Eval runner**：`for await...of` 直接消费，收集 `AgentStreamEvent[]` 作为 transcript
- **父 Agent（M19 多 Agent）**：子 Agent 的流被 merge 进父 Agent 的流

三者对 agentLoop 的接口没有任何差异要求——它们看到的是同一个 AsyncGenerator 接口。这让 agentLoop 的内部实现可以大胆演进，而不担心"改了什么会破坏 UI"。

**中间件天然成立**：日志记录、重放、Mock LLM 注入（`_streamChatOverride`）——都是在事件流上包一层 wrapper，不需要修改 agentLoop 本身。"流是边界"让 wrapper 模式自然可组合。

---

## 九、暂缓的边界问题

这些问题存在，我们知道，暂时接受现状：

**背压（Backpressure）缺失**

`yield` 是同步的——Loop 发出事件后不等消费方处理完就继续生产下一个。如果消费方处理慢，内存中会积压未处理事件。

当前选择接受：UI 渲染和 Eval runner 都处理很快，实际中没有观察到积压。如果未来接入慢速消费方（如写磁盘 transcript），需要在 Loop 和消费方之间加有界缓冲队列。

**并发工具的 tool_end 顺序**

`registry.executeAll` 并发执行多个工具，`tool_end` 的到达顺序由执行完成顺序决定，不是调用顺序。

当前选择接受：消费方通过 `callId` 匹配 `tool_end` 到具体工具，不依赖顺序。

**compact 后消费方消息列表失效**

agentLoop 内部压缩后 messages 数组已被替换，但 yield 的 `compact` 事件没有携带新的完整消息列表。UI 层维护的本地消息列表和 Loop 内部的此时已不一致。

当前选择接受：等 M07（上下文压缩）和 IPC 层一起设计时再处理，作为已知的可观测性不完整。

---

## 实战记录

### 踩过的坑

**`tool_call_delta` 和 `tool_start` 的竞态**

流式工具调用时，delta 事件比 start 事件先到——delta 是 LLM 在实时说话，start 是工具真正开始执行时才 yield。UI 需要处理"先收到 delta、还没有对应 tool_start"的状态，否则 delta 渲染到哪个卡片是个问题。解法是 `tool_call_delta` 携带 `index` 字段，UI 按 index 维护临时卡片，`tool_start` 到来后用 `callId` 合并。

**abort 之后的 IPC 竞态**

用户点停止后，agentLoop yield done 并退出，IPC 的 `invoke` resolve，cleanup 函数释放监听器。但如果 done 事件和 IPC resolve 之间还有最后一个事件（比如 usage）在途，事件会到达一个已经没有监听器的通道，被静默丢弃。添加了 50ms 兜底 `setIsStreaming(false)` 确保 UI 状态正确，作为竞态的兜底。

**`_streamChatOverride` 的 DI 设计**

最初用 `vi.mock()` 替换 LLM 调用，但这在 Eval runner 非测试运行时不可用。改为在 `AgentLoopOptions` 里加 `_streamChatOverride` 注入点——测试和 Eval 都走注入，生产代码走默认路径。`_` 前缀是明确的"非生产代码专用"信号，避免被正常调用路径误用。

### 设计检查清单

- [ ] 新增终止路径时：必须经过 `terminateLoop`，不允许直接 `return`
- [ ] 新增工具执行时：执行前检查 `signal.aborted`，abort 时补合成 tool_result
- [ ] 消费方处理事件时：不依赖 `tool_end` 到达顺序，用 `callId` 匹配
- [ ] 添加新 `AgentStreamEvent` 类型时：在 `handleEvent`（App.tsx）和 DevPanel EventsTab 里同步处理
- [ ] 需要 Mock LLM 时：走 `_streamChatOverride` 注入，不用 `vi.mock()`

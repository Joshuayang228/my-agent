# M1：Agent Loop — 代码走读

> 对照 `m01-agent-loop.md` 的每个章节，展示 CC（Claude Code）和 Alice 的真实代码实现。
> 
> CC 版本：`2.1.88`，源码路径：`_reference/.../claude-code-sourcemap-main/.../restored-src/src/`
> Alice 版本：解包格式化 JS

---

## §1 对照：函数签名与入口

### CC 的入口

```typescript
// CC: query.ts L219-228

// ① export        → 这个函数会被外部调用（是模块的公开接口）
// ② async         → 函数内部可以用 await（等待异步操作完成）
// ③ function*     → 生成器函数，可以用 yield 一个一个地往外"吐"值
// ④ async function* = 异步生成器 = 既能 await 又能 yield
export async function* query(
  params: QueryParams,       // 输入：所有需要的参数打包成一个对象

// ⑤ AsyncGenerator<产出类型, 返回类型>
// 这个函数会不断 yield 出以下类型的事件：
): AsyncGenerator<
  | StreamEvent              // 流式文字片段（LLM 吐出的每一小块文字）
  | RequestStartEvent        // "开始请求了"的信号
  | Message                  // 完整的消息（assistant 说的话、tool 的结果等）
  | TombstoneMessage         // "墓碑"消息：标记某条消息已被删除/作废
  | ToolUseSummaryMessage,   // 工具使用摘要（给用户看的简短说明）
  Terminal                   // 最终返回值：循环为什么停下来的原因
> {
  // ⑥ yield* 的意思：把 queryLoop 产出的所有事件原封不动地转发出去
  //    就像一个中间人，queryLoop yield 什么，query 就 yield 什么
  const terminal = yield* queryLoop(params, consumedCommandUuids)

  // ⑦ 循环结束后，把终止原因返回给调用者
  return terminal
}
```

**结构解读**：CC 把入口 `query()` 和内部循环 `queryLoop()` 分成了两个函数。`query()` 是一个薄薄的壳——它只负责转发事件和做收尾通知，真正的循环逻辑全在 `queryLoop()` 里。

**方法论对照**：→ `m01-agent-loop.md` §2.1（为什么是 AsyncGenerator）、§3.5（函数还是类）

---

## §3 对照：状态管理

### CC 的 State 类型

```typescript
// CC: query.ts L201-217

// type = 定义一个类型（像一张表单模板，规定了有哪些字段、每个字段是什么类型）
// State = 这个类型的名字，就是"循环状态"
type State = {
  messages: Message[]
  // ↑ 对话历史。Message[] 表示"Message 类型的数组"（一堆消息）

  toolUseContext: ToolUseContext
  // ↑ 工具执行时需要的上下文信息（权限、配置、当前应用状态等）

  autoCompactTracking: AutoCompactTrackingState | undefined
  // ↑ 自动压缩的追踪信息（压缩了几次、连续失败几次等）
  //   "| undefined" 表示这个字段可以没有值

  maxOutputTokensRecoveryCount: number
  // ↑ "输出被截断后恢复了几次"的计数器
  //    LLM 输出太长被截断时，会自动续写，这里记录续写了几次

  hasAttemptedReactiveCompact: boolean
  // ↑ "413 紧急压缩是否已经试过了"（true/false）
  //    413 = 上下文太长，API 拒绝处理

  maxOutputTokensOverride: number | undefined
  // ↑ 临时覆盖 LLM 的最大输出 token 数（续写恢复时可能调大）

  pendingToolUseSummary: Promise<ToolUseSummaryMessage | null> | undefined
  // ↑ 正在后台生成的"工具使用摘要"（Promise = 一个还没完成的异步操作）

  stopHookActive: boolean | undefined
  // ↑ "停止钩子是否激活"——CC 有一种机制可以在 LLM 想停的时候拦住它

  turnCount: number
  // ↑ 当前是第几轮迭代

  transition: Continue | undefined
  // ↑ "上一轮为什么决定继续"——Continue 类型记录了继续的原因
  //    第一轮时是 undefined（没有"上一轮"）
}
```

**发现**：CC 也把状态集中到了一个 `State` 类型里！跟我们的 `LoopState` 思路一致。之前认为 CC 用散落变量，其实不是——CC 在 v2.1.88 已经重构为集中管理。

### CC 的状态初始化

```typescript
// CC: query.ts L268-279
// 创建循环状态的初始值（let 表示后续可以修改）
let state: State = {
  messages: params.messages,               // 用调用者传进来的对话历史
  toolUseContext: params.toolUseContext,    // 用调用者传进来的工具上下文
  maxOutputTokensOverride: params.maxOutputTokensOverride,  // 可能有自定义输出上限
  autoCompactTracking: undefined,          // 还没做过压缩，所以没有追踪信息
  stopHookActive: undefined,               // 停止钩子未激活
  maxOutputTokensRecoveryCount: 0,         // 截断恢复次数 = 0（还没恢复过）
  hasAttemptedReactiveCompact: false,      // 413 紧急压缩还没试过
  turnCount: 1,                            // 从第 1 轮开始
  pendingToolUseSummary: undefined,        // 没有正在生成的摘要
  transition: undefined,                   // 第一轮，没有"上一轮继续的原因"
}
```

### 字段对比

| CC State | 我们的 LoopState | 说明 |
|----------|-----------------|------|
| `messages` | `messages` | 相同 |
| `turnCount` | `turnCount` | CC 从 1 开始 |
| `maxOutputTokensRecoveryCount` | `maxOutputRecoveryCount` | 相同功能 |
| `hasAttemptedReactiveCompact` | `hasAttemptedReactiveCompact` | 相同 |
| `transition` | `transition` | CC 用 `Continue` 类型，我们用 `ContinueReason` |
| `toolUseContext` | — | CC 把 DI 上下文也放状态里 |
| `autoCompactTracking` | — | CC 跟踪压缩的连续失败次数 |
| `pendingToolUseSummary` | — | CC 有工具使用摘要功能 |
| `stopHookActive` | — | CC 有停止钩子 |
| — | `deniedTools` | CC 的权限拒绝不在 State 里（在 ToolUseContext 里） |
| — | `lastPromptTokens` | CC 不在 State 里跟踪 token |

**方法论对照**：→ `m01-agent-loop.md` §3.2（LoopState 设计）

---

## §3.3 对照：ContinueReason / Transition

### CC 的 Continue 和 Terminal 类型

```typescript
// CC: query/transitions.ts（推断自 query.ts 的导入和使用）

// CC 用两个类型来表达循环的去向：
//   Continue = "这轮结束了，但循环要继续"
//   Terminal = "整个循环到此为止"

// ——— Continue（继续）的使用场景 ———
// 场景 1: LLM 输出被截断（max_output_tokens），续写后继续
// 场景 2: 上下文太长触发 413，压缩后继续
// 场景 3: LLM 调用了工具，执行完工具后继续下一轮
// 场景 4: 停止钩子拦住了 LLM 的"我不干了"，强制再跑一轮

// ——— Terminal（终止）的使用场景 ———
return { reason: 'blocking_limit' }
// ↑ 上下文太长，压缩也救不回来，直接终止

return { reason: 'end_turn' }
// ↑ LLM 自己说"我说完了"（没有发起工具调用），正常终止

return { reason: 'max_turns' }
// ↑ 跑到了最大轮数上限，强制终止

return { reason: '...' }
// ↑ 还有其他终止原因（错误、用户取消等）
```

### 我们的 ContinueReason

```typescript
// 我们的实现
type ContinueReason =
  | 'next_turn'                 // 正常继续：工具执行完了，进入下一轮
  | 'reactive_compact_retry'    // 紧急压缩后重试：遇到 413，压缩完再试
  | 'max_output_recovery'       // 截断恢复：LLM 输出被截断，让它继续写
```

**差异**：CC 把 Continue 和 Terminal 分成了两个独立类型，语义更明确。我们也分开了（ContinueReason 和 TerminalReason），但我们的 ContinueReason 覆盖的场景更少——CC 还有 stop hook 重试等。

**方法论对照**：→ `m01-agent-loop.md` §3.3（ContinueReason）、§7.1（TerminalReason）

---

## 循环结构对照

### CC 的 while(true)

```typescript
// CC: query.ts L307

// while (true) = 无限循环，永远不会因为条件不满足而停止
// 唯一的退出方式是循环体内的 return 语句
while (true) {

  // ——— 第 0 步：从 state 对象里取出各个字段 ———
  // "解构赋值"：把 state.toolUseContext 取出来放到局部变量 toolUseContext 里
  // let 表示后面可能修改（toolUseContext 可能会被替换）
  let { toolUseContext } = state

  // const 表示取出来后不会修改这些变量（但 messages 数组的内容可以改）
  const {
    messages,                        // 对话历史
    autoCompactTracking,             // 压缩追踪信息
    maxOutputTokensRecoveryCount,    // 截断恢复计数
    hasAttemptedReactiveCompact,     // 是否试过紧急压缩
    maxOutputTokensOverride,         // 输出 token 上限覆盖值
    pendingToolUseSummary,           // 后台摘要任务
    stopHookActive,                  // 停止钩子状态
    turnCount,                       // 当前轮次
  } = state

  // ——— 第 1 步：上下文管理（压缩管道）———
  // 按顺序执行 4 层压缩，每层的输出是下层的输入：
  // 1a. Snip — 删掉旧的工具调用和结果（最轻量，直接删）
  // 1b. MicroCompact — 去掉重复的内容（中等强度）
  // 1c. Context Collapse — 细粒度压缩（实验中，可能未启用）
  // 1d. AutoCompact — 让 LLM 总结历史（最重，消耗 API 调用）

  // ——— 第 2 步：调用 LLM ———
  // for await ... 表示逐条接收 LLM 流式返回的消息
  // 每收到一条就处理一条（显示给用户、记录到历史等）

  // ——— 第 3 步：根据结果决定下一步 ———
  // 分支 A: LLM 发起了工具调用 → 执行工具 → continue（继续下一轮）
  // 分支 B: LLM 没调工具，说完了 → return Terminal（正常结束循环）
  // 分支 C: API 返回 413（上下文太长）→ 紧急压缩 → continue（重试）
  // 分支 D: 输出被截断 → 调大输出上限 → continue（让 LLM 续写）
}
```

### 我们的 while(state.turnCount < max)

```typescript
// 我们的实现

// 条件循环：当 turnCount 小于最大迭代次数时，继续循环
// 比如 maxIterations = 25，那么 turnCount 从 0 跑到 24，共 25 轮
while (state.turnCount < maxIterations) {

  // ... 循环体（调 LLM、执行工具、判断是否结束）...

  state.turnCount++   // 每轮结束后，轮次 +1
}
// 循环条件不满足时自动退出（相当于 "达到上限" 的终止路径）
```

**关键差异**：

| | CC | 我们 |
|---|---|---|
| 循环条件 | `while (true)` — 永远循环 | `while (turnCount < max)` — 有上限 |
| 终止方式 | 靠 `return Terminal` 退出 | 靠条件判断 + break |
| maxTurns 检查 | 在循环体内部检查 | 在循环条件里 |

CC 的 `while(true)` 把所有终止逻辑都放在循环体内的 `return` 语句里，而不是循环条件。这让终止路径更显式——每个 `return` 都有一个明确的 `Terminal` 原因。

**方法论对照**：→ `m01-agent-loop.md` §3.4（while 还是 for）

---

## §5 对照：上下文压缩管道

### CC 的压缩执行顺序

```typescript
// CC: query.ts L396-527（每轮迭代开头）
// 这是压缩管道——在调 LLM 之前，先把对话历史压到能塞进上下文窗口的大小

// ——— 第 1 步：Snip（剪枝）———
// feature('HISTORY_SNIP') 检查这个功能是否启用（功能开关/feature flag）
if (feature('HISTORY_SNIP')) {
  // snipCompactIfNeeded = "如果需要的话就剪枝"
  // 做什么：把旧的工具调用和工具结果直接删掉（不是总结，是直接删）
  // 为什么最先做：删除是最便宜的操作，零 API 开销
  const snipResult = snipModule!.snipCompactIfNeeded(messagesForQuery)
  messagesForQuery = snipResult.messages       // 用剪枝后的消息替换原来的
  snipTokensFreed = snipResult.tokensFreed     // 记录释放了多少 token
}

// ——— 第 2 步：MicroCompact（微压缩）———
// await = 等这个异步操作完成再往下走
// 做什么：找到重复的内容（比如同一个文件被读了两次），去掉重复部分
const microcompactResult = await deps.microcompact(
  messagesForQuery,    // 输入：上一步处理后的消息
  toolUseContext,      // 工具上下文（知道哪些工具被用过）
  querySource,         // 请求来源（防止压缩系统自己触发自己）
)
messagesForQuery = microcompactResult.messages   // 用去重后的消息替换

// ——— 第 3 步：Context Collapse（上下文折叠，实验中）———
// 两个条件都满足才执行：功能开关开了 && 折叠模块存在
if (feature('CONTEXT_COLLAPSE') && contextCollapse) {
  // 做什么：更细粒度地折叠上下文（比如把长输出折叠成摘要）
  const collapseResult = await contextCollapse.applyCollapsesIfNeeded(
    messagesForQuery,    // 输入：上一步处理后的消息
    toolUseContext,
    querySource,
  )
  messagesForQuery = collapseResult.messages     // 用折叠后的消息替换
}

// ——— 第 4 步：AutoCompact（自动压缩，最重量级）———
// 做什么：让 LLM 来总结对话历史（消耗一次 API 调用）
// 先尝试 SessionMemory 方式，失败了再 fallback 到传统摘要
const { compactionResult, consecutiveFailures } = await deps.autocompact(
  messagesForQuery,      // 输入：经过前三步处理的消息
  toolUseContext,        // 工具上下文
  cacheSafeParams,       // 缓存安全的请求参数
  querySource,           // 请求来源
  tracking,              // 压缩追踪信息（连续失败次数等）
  snipTokensFreed,       // 第 1 步释放了多少 token（AutoCompact 用来判断是否还需要压缩）
)
```

**执行顺序**：Snip → MicroCompact → Collapse → AutoCompact。**每一步的输出是下一步的输入**。设计成这样的原因：轻量操作先做，重量级操作后做。如果 Snip 就释放了足够空间，后面的步骤检测到"不需要了"就会跳过，省去 API 调用开销。

**方法论对照**：→ `m01-agent-loop.md` §5.2（413 紧急压缩）。压缩的详细设计将在 M4 中展开。

---

## §4 对照：依赖注入

### CC 的 QueryDeps

```typescript
// CC: query/deps.ts（推断自 query.ts 的使用）

// 定义一个类型：QueryDeps = "查询所需要的依赖项"
// 把所有外部依赖（LLM、压缩、工具函数）都声明在这里
type QueryDeps = {
  callModel: (params: CallModelParams) => AsyncGenerator<StreamEvent>
  // ↑ 调用 LLM 的函数。输入参数，输出一个异步生成器（流式返回结果）

  microcompact: (messages, context, source) => Promise<MicrocompactResult>
  // ↑ 微压缩函数。输入消息列表，返回压缩后的结果

  autocompact: (messages, context, params, source, tracking, freed) => Promise<AutocompactResult>
  // ↑ 自动压缩函数。参数最多——需要追踪信息和释放量来决定是否触发

  uuid: () => string
  // ↑ 生成唯一 ID 的函数。每条消息、每次工具调用都需要一个唯一标识
}

// 生产环境的真实实现（调用真实的 API、真实的压缩逻辑）
function productionDeps(): QueryDeps { ... }

// 使用方式：
// ?? 是"空值合并"运算符：如果 params.deps 有值就用它，没有就用默认的
// 测试时：传入 mock 的 deps（假的 LLM、假的压缩）
// 生产时：不传 deps，自动用 productionDeps()
const deps = params.deps ?? productionDeps()
```

**核心思想**：这就是"依赖注入"——不在函数内部直接 `import` 真实模块，而是通过参数传进来。好处是测试时可以传入假的实现（mock），不需要真的调 LLM API。

### 我们的 AgentLoopOptions

```typescript
// 我们的实现

// interface = 定义接口（跟 type 类似，规定对象的形状）
interface AgentLoopOptions {
  llmClient: LLMClient           // 调用 LLM 的客户端对象
  registry: ToolRegistry          // 工具注册表——知道有哪些工具可用
  maxIterations: number           // 最多跑几轮（防止无限循环）
  executionMode: ExecutionMode    // 执行模式（自动/需确认/只读等）
  abortSignal?: AbortSignal       // 取消信号（用户按"停止"时触发）
  //           ↑ 问号表示可选——不传也行
}
```

**差异**：CC 的依赖注入更细粒度——把 `microcompact` 和 `autocompact` 也单独注入了，这样测试时可以只 mock 压缩、不 mock LLM。我们的粒度是模块级（LLM 客户端、工具注册表），压缩逻辑耦合在内部，没有单独注入。

**方法论对照**：→ `m01-agent-loop.md` §4（依赖注入）

---

## §6 对照：消息配对

### CC 的合成 tool_result

```typescript
// CC: query.ts L123-149

// function* = 同步生成器（注意没有 async，因为这里不需要等异步操作）
// 作用：为所有"没有收到结果"的工具调用，生成假的错误结果
// 什么时候用：用户中途取消 / 出错了 / 工具还没执行完就要结束循环
function* yieldMissingToolResultBlocks(
  assistantMessages: AssistantMessage[],   // LLM 发出的消息列表（里面可能包含工具调用）
  errorMessage: string,                     // 要填入假结果的错误信息
) {
  // 遍历每条 assistant 消息
  for (const assistantMessage of assistantMessages) {

    // .filter() = 过滤数组，只保留满足条件的元素
    // 条件：content.type === 'tool_use'（只要工具调用块，不要文字块）
    // as ToolUseBlock[] = 告诉 TypeScript "我确定过滤出来的都是 ToolUseBlock 类型"
    const toolUseBlocks = assistantMessage.message.content.filter(
      content => content.type === 'tool_use',
    ) as ToolUseBlock[]

    // 遍历这条消息里的每个工具调用
    for (const toolUse of toolUseBlocks) {

      // yield = 往外"吐"一个值（合成的 tool_result 消息）
      yield createUserMessage({
        content: [
          {
            type: 'tool_result',          // 消息类型：工具结果
            content: errorMessage,         // 内容：错误信息（如 "操作被取消"）
            is_error: true,                // 标记为错误（不是正常结果）
            tool_use_id: toolUse.id,       // 关键！把这个结果跟对应的工具调用配对
            // API 要求每个 tool_use 必须有一个对应的 tool_result
            // 如果不配对，下次调 API 会报错
          },
        ],
        toolUseResult: errorMessage,                        // 冗余存一份，方便 UI 显示
        sourceToolAssistantUUID: assistantMessage.uuid,     // 记录是哪条 assistant 消息的
      })
    }
  }
}
```

**为什么需要这个**：Claude API 要求严格的 `tool_use` ↔ `tool_result` 配对。如果 LLM 说了"调用工具 A"但我们没给它"工具 A 的结果"，下一次 API 调用就会报错。所以即使工具没真的执行，也要生成一条"假的"错误结果来满足配对要求。

**方法论对照**：→ `m01-agent-loop.md` §6.2（为什么 abort 后要合成 tool_result）

---

## §7 对照：终止条件

### CC 的 Terminal 使用

```typescript
// CC: query.ts（从代码中提取的所有 return 语句）
// 每个 return 都是一个终止路径——循环从这里退出

// 终止路径 1：上下文太长，压缩也无法解决
return { reason: 'blocking_limit' }
// ↑ 消息总 token 超过模型的上下文窗口极限，且所有压缩手段都用完了

// 终止路径 2：LLM 正常说完了
// CC 在循环末尾检查：如果 LLM 返回的消息里没有 tool_use 块
// toolUseBlocks.length === 0 → LLM 认为任务做完了，不需要再调工具
// → return { reason: 'end_turn' }

// 终止路径 3：达到迭代上限
// CC 在循环开头检查 turnCount 是否超过 maxTurns
// → return { reason: 'max_turns' }

// 终止路径 4：413 不可恢复
// API 返回 413（请求体太大），尝试 reactive compact（紧急压缩）
// 如果紧急压缩也失败了（或者已经试过一次了）
// → return { reason: ... }（不可恢复的错误）
```

### 我们的 TerminalReason

```typescript
type TerminalReason =
  | 'completed'        // LLM 说完了，任务完成（= CC 的 end_turn）
  | 'max_turns'        // 跑到轮数上限，强制停止（= CC 的 maxTurns 检查）
  | 'aborted'          // 用户点了"停止"按钮（= CC 的 AbortSignal 触发）
  | 'prompt_too_long'  // 上下文超长，压缩也救不回来（= CC 的 blocking_limit）
  | 'model_error'      // LLM API 返回了不可恢复的错误（CC 没有统一的名字）
```

**方法论对照**：→ `m01-agent-loop.md` §7.1（五条终止路径）

---

## §8 对照：伴随文字丢弃

### Alice 方法论 Ch.03 的说法

> *步骤 4：写入 assistant 消息*
> 
> 有一个微妙的设计：如果这轮有工具调用，**丢弃伴随的文字内容**，只保留工具调用。
> 
> 原因：某些模型在发起工具调用时会附带"我来看一下…"这样的说明文字，但这段文字在后续对话中没有用，还会浪费 token。

CC 的实现需要在 query.ts 的流式处理部分寻找，具体逻辑在 assistant 消息写入时过滤 text content blocks（当 tool_use blocks 存在时）。

**方法论对照**：→ `m01-agent-loop.md` §8.1（伴随文字丢弃）

---

## 附加发现：CC 比方法论多的东西

在阅读 CC 源码过程中，发现几个方法论没覆盖到的工程细节：

### 1. AutoCompact 熔断器

```typescript
// CC: autoCompact.ts L68-70

// 常量：最多容忍连续 3 次压缩失败
// 为什么是 3？CC 团队发现每天有 25 万次无效 API 调用来自"反复失败的压缩"
const MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3

// L260-265
// 熔断器逻辑：如果连续失败次数达到上限，直接跳过压缩
if (
  tracking?.consecutiveFailures !== undefined &&
  // ↑ tracking?.  = 安全访问，如果 tracking 是 undefined 就不往下取
  tracking.consecutiveFailures >= MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES
  // ↑ 连续失败次数 >= 3 吗？
) {
  return { wasCompacted: false }
  // ↑ 返回"没有压缩"——放弃这次压缩尝试
  // 这就是"熔断器"：反复失败说明压缩本身有问题，再试只会浪费 API 调用
}
```

**教训**：不仅 LLM 重试需要上限，**压缩重试也需要上限**。没有熔断器的话，每次循环迭代都会尝试压缩 → 失败 → 下次又试 → 又失败……无限浪费 API 调用。

> **✅ 已采纳**：在 `loop.ts` 的 `LoopState` 中新增 `consecutiveCompactFailures` 字段 + 熔断检查逻辑。常量 `MAX_CONSECUTIVE_COMPACT_FAILURES = 3`。方法论 §5.2.1 已补充说明。

### 2. querySource 互斥守卫

```typescript
// CC: autoCompact.ts L171-173

// querySource 记录"这次请求是谁发起的"
// 如果发起者本身就是压缩系统（session_memory 或 compact），就不要再压缩了
// 否则会出现：压缩 → 触发压缩 → 又触发压缩 → 无限递归
if (querySource === 'session_memory' || querySource === 'compact') {
  return false   // 返回 false = "不需要压缩"，打断递归
}
```

> **✅ 已有实现**：`context-manager.ts` 中通过 `setQuerySource('compact')` / `getQuerySource()` 机制实现了同等防护。L3/L4 在调 LLM 前设为 `'compact'`，`compressContext` 入口检查 `querySource !== 'main'` 时跳过 LLM 摘要。

### 3. Token 预算追踪

```typescript
// CC: query.ts L280-291

// 问题：压缩会把旧消息替换成摘要，服务端看到的是"新的短历史"
// 服务端不知道之前已经花了多少 token，可能以为还有很多预算
// 解决：客户端自己追踪"还剩多少预算"，告诉服务端
let taskBudgetRemaining: number | undefined = undefined
// ↑ undefined 表示还不知道预算（第一次调用前）
//   后续每次压缩后会更新这个值：总预算 - 已消耗 = 剩余
```

> **📋 待定**：等分层压缩管道成熟后再加。当前我们的压缩不涉及服务端预算协商。

---

## 更新记录

| 日期 | 变更 |
|------|------|
| 2026-06-21 | 初始创建，覆盖 §1/§3/§4/§5/§6/§7/§8 的 CC 代码对照 |
| 2026-06-22 | 全部代码块添加逐行中文注释，解释每一步在做什么 |
| 2026-06-22 | 标注 CC 特性采纳状态：熔断器 ✅已实现、递归防护 ✅已有、Token 预算 📋待定 |

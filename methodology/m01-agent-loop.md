# M1：Agent Loop 工程化方法论

> 这份文档系统讲解 Agent Loop 的工程化设计：从核心概念到每个难点的解法，再到我们的实践经验。
> 前半部分是**知识框架**——Agent Loop 该怎么写。
> 后半部分是**实战记录**——我们碰到了什么坑。

---

# 第一部分：知识框架

## 一、什么是 Agent Loop

### 1.1 定义

Agent Loop 是让 LLM "做事"的核心循环。它的本质是 **ReAct（Reasoning + Acting）** 模式：

```
Think → Act → Observe → Think → Act → Observe → ... → Done
```

- **Think**：把当前上下文发给 LLM，获取文本回复或工具调用请求
- **Act**：执行 LLM 请求的工具
- **Observe**：将工具结果写回上下文，供下一轮 Think 使用

LLM 不再调用工具 = 任务完成。

### 1.2 最简骨架

```python
while True:
    response = llm.call(messages)
    if not response.tool_calls:
        break
    results = execute_tools(response.tool_calls)
    messages.append(response)
    messages.append(tool_results(results))
```

Anthropic 的定义：*"LLMs using tools based on environmental feedback in a loop."* 这六行就是核心。

### 1.3 从骨架到生产级：9 个问题域

六行代码能跑，但经不起真实使用。按严重程度分为四类：

**跑不起来的问题** — 骨架缺失

| 问题域 | 具体问题 | 如果不解决 |
|--------|---------|-----------|
| **状态管理** | 循环中的变量越来越多，散落在各处 | 难以维护，无法一眼看清全局 |
| **终止控制** | 正常结束和异常结束的善后逻辑不同 | 混淆终止原因，漏掉边界情况 |

**会崩掉的问题** — 缺乏韧性

| 问题域 | 具体问题 | 如果不解决 |
|--------|---------|-----------|
| **错误恢复** | 网络闪断、上下文超限、输出截断 | 一个错误整个循环崩掉 |
| **取消机制** | 用户想停止但循环正在等工具执行 | 无法中断，只能杀进程 |
| **消息完整性** | 取消后 tool_call 和 tool_result 不配对 | 恢复对话时 API 报 400 |
| **上下文管理** | 对话太长，超过模型限制 | 413 错误，对话被迫中断 |

**会出事的问题** — 安全缺口

| 问题域 | 具体问题 | 如果不解决 |
|--------|---------|-----------|
| **权限安全** | LLM 调了不该调的工具 | 执行危险操作，拒绝后还反复尝试 |
| **可观测性** | 出了问题不知道循环在哪一步，错误信息可能泄露敏感数据 | 无法调试 + 信息泄露 |

**能跑但很贵的问题** — 效率低下

| 问题域 | 具体问题 | 如果不解决 |
|--------|---------|-----------|
| **Token 效率** | 无用文字浪费上下文空间 | 长任务多花 30%+ 费用 |

### 1.4 本文覆盖范围

本文只讲 **Agent Loop 的循环控制流**——从启动到终止，Loop 自身需要解决的问题：

```
┌──────────────────────────────────────────────┐
│  §8 优化与防护                                │
│  伴随文字丢弃 · 错误脱敏 · 常量集中定义        │
├──────────────────────────────────────────────┤
│  §5 错误恢复  §6 取消机制  §7 终止条件         │
├──────────────────────────────────────────────┤
│  §1 定义  §2 事件流  §3 状态管理  §4 DI        │
└──────────────────────────────────────────────┘
```

工具系统、上下文管理、权限引擎等主题有独立的设计复杂度，在各自的模块文档中详写。模块之间的关系见 [模块路线图](../module-roadmap.md)。

### 1.5 章节路线图

```
§1 定义
 ├──→ §2 事件流 → §7 终止条件（done 事件的语义）
 │                → §6 取消机制（中断事件流）
 ├──→ §3 状态管理 → §5 错误恢复（重试计数器在状态里）
 │                  → §6 取消（abort 后的状态清理）
 ├──→ §4 依赖注入
 └──→ §8 优化与防护
```

| 阅读场景 | 路径 |
|---------|------|
| **首次阅读** | 按 §1→§8 顺序通读 |
| **写代码** | §1-§4 先跑通骨架 → §5-§7 逐步加韧性 → §8 优化 |
| **查特定问题** | 按 1.3 的问题域表跳转 |

### 1.6 每轮迭代：6 个步骤

在深入各章节之前，先看一轮完整迭代从头到尾经过哪些步骤：

```
while (state.turnCount < maxIterations) {

  ① 上下文检查    检查 token 用量，按需触发压缩（→ M4）
       ↓
  ② 消息整形      修复孤立 tool_call/tool_result，注入动态内容
       ↓
  ③ 调用 LLM      流式发送请求，yield 文字/工具调用事件
       ↓          如果 413 → 紧急压缩 + 重试（§5.2）
       ↓          如果输出截断 → 续写（§5.3）
       ↓
  ④ 写入 assistant 消息
       ↓          有 tool_calls 时丢弃伴随文字（§8.1）
       ↓
  ⑤ 无 tool_calls → 正常结束（§7: completed）
       ↓
  ⑥ 执行工具      权限检查 → 分批执行 → 写入 tool_result
       ↓          拒绝 → 记入 deniedTools
       ↓          取消 → 合成 synthetic result（§6.2）
       ↓
  state.turnCount++
  continue → 下一轮
}

循环结束 → yield done 事件 + 触发后台任务
```

后续章节分别展开每个步骤的设计细节。

---

## 二、输出设计：事件流

### 2.1 为什么是 AsyncGenerator

Agent Loop 不是一个"稍后返回结果"的函数，而是一个**持续产出事件的过程**。这决定了它的输出形式。

```typescript
async function* agentLoop(options, registry): AsyncGenerator<AgentStreamEvent>
```

可选方案对比：

| 方案 | 背压 | 取消 | 类型安全 | 多流合并 |
|------|------|------|---------|---------|
| **AsyncGenerator** | ✅ 消费者控制节奏 | ✅ gen.return() | ✅ | ❌ 繁琐 |
| EventEmitter | ❌ 快速发射时积压 | ❌ 需手动清理 | ❌ | ✅ 广播 |
| RxJS Observable | ✅ | ✅ | ✅ | ✅ 操作符丰富 | 
| 回调 | ❌ | ❌ | ❌ | ❌ |

**背压**是关键：如果 LLM 快速输出 token，但 UI 来不及渲染，AsyncGenerator 自然暂停生产者。EventEmitter 则会把事件堆在内存里。

**代价**：子 Agent 的事件流要 merge 进父流时，AsyncGenerator 比 EventEmitter 的广播模式更复杂。但对于"UI 是主要消费者"的桌面应用场景，背压比广播灵活性更重要。

### 2.2 事件类型清单

一个成熟的 Agent Loop 应该产出以下事件：

| 事件类型 | 阶段 | 含义 |
|---------|------|------|
| `text` | Think | LLM 流式输出的文本片段 |
| `thinking` | Think | 推理/思考内容（CoT 模型） |
| `tool_call_delta` | Think | LLM 流式输出的工具参数片段 |
| `tool_calls` | Think | 一轮的工具调用汇总 |
| `tool_confirm` | Act 前 | 需要用户确认执行 |
| `tool_start` | Act | 工具开始执行 |
| `tool_end` | Act | 工具执行完成（结果/错误） |
| `usage` | Think 后 | Token 用量统计 |
| `error` | 任何时候 | 发生错误 |
| `done` | 终止 | 循环结束 + 终止原因 |

**为什么需要 `tool_call_delta`**：LLM 返回工具调用时，参数是逐 chunk 发送的。如果等完整 JSON 再通知前端，用户看到的是"AI 停了不动"。流式参数事件让前端能显示"正在解析参数…"。

**为什么 `done` 需要携带终止原因**：不同的终止方式需要不同的善后——正常结束触发后台任务，超限提示用户拆分，取消静默退出。一个空的 `{ type: 'done' }` 区分不了。

---

## 三、状态管理

### 3.1 问题：散落的变量

最简骨架只有一个变量 `messages`。但生产级循环需要记住的远不止这个：

| 要记住的东西 | 为什么要记 |
|-------------|-----------|
| `messages` | 对话历史，每轮都在增长 |
| `turnCount` | 当前第几轮，判断是否超过上限 |
| `lastPromptTokens` | 上一轮 API 返回的实际 token 数，指导压缩决策 |
| `hasAttemptedReactiveCompact` | 413 紧急压缩是否用过，防止无限重试 |
| `maxOutputRecoveryCount` | 截断恢复了几次，防止续写循环 |
| `deniedTools` | 哪些工具被拒绝过，告诉 LLM 别再试 |

如果没有状态管理，这些就是散落的 `let` 变量：

```typescript
// ❌ 散落变量 — 要翻遍整个函数才能知道"循环现在是什么状态"
let turnCount = 0
let lastPromptTokens = undefined
let hasAttemptedReactiveCompact = false
let maxOutputRecoveryCount = 0
let deniedTools = []
// ... 随着功能增长还会越来越多
```

两个问题：
1. **看不清全局状态**：要看 8 个不同位置的 `let` 才知道"循环现在在什么状态"
2. **控制流 hack**：需要"重试同一轮"时，`for` 循环的迭代变量无法优雅回退

### 3.2 解决方案：LoopState 集中管理

把所有状态收拢到一个对象里：

```typescript
// ✅ 集中管理 — 一个 LoopState 看清全局
interface LoopState {
  messages: ChatMessage[]                              // 对话历史
  turnCount: number                                    // 当前迭代轮次
  lastPromptTokens?: number                            // API 返回的实际 token 数
  hasAttemptedReactiveCompact: boolean                 // 413 紧急压缩是否已用过
  maxOutputRecoveryCount: number                       // 截断恢复次数
  deniedTools: Array<{ name: string; reason: string }> // 被拒绝的工具记录
  transition?: { reason: ContinueReason }              // 跳转信号
}
```

新增状态只需扩展 interface，不需要到处加 `let`。循环的任何时刻，看一眼 `state` 就知道全局状态。

### 3.3 ContinueReason：非标准跳转的"转向信号"

```typescript
type ContinueReason = 'next_turn' | 'reactive_compact_retry' | 'max_output_recovery'
```

普通迭代不需要 ContinueReason。但两种场景需要特殊跳转：

- **reactive_compact_retry**：413 压缩后重试同一轮 → `turnCount--` + `continue`
- **max_output_recovery**：截断后续写 → 注入续写 prompt + `continue`

ContinueReason 把**跳转意图编码在类型里**，而不是靠注释或 hack。

### 3.4 while 还是 for

| 结构 | 适用场景 | 不适用场景 |
|------|---------|-----------|
| `for (let i = 0; i < max; i++)` | 迭代次数固定递增 | 需要回退计数器 |
| `while (state.turnCount < max)` | 完全控制计数器 | 需要手动递增 |

**需要 413 重试（回退计数器）的场景下，while 是唯一合理的选择。**

### 3.5 函数还是类

Agent Loop 写成一个函数还是一个类？

```typescript
// 方案 A：函数（我们选的）— 调一次跑一次，用完就扔
async function* agentLoop(options, registry): AsyncGenerator<AgentStreamEvent>

// 方案 B：类 — 先 new 对象，再调 run
class AgentLoopRunner {
  private state: LoopState
  async *run(): AsyncGenerator<AgentStreamEvent>
}
```

选函数的三个理由：

**1. Agent Loop 是一次性的。** 它的生命周期是"启动 → 跑若干轮 → 结束"，用完就扔。类适合长期存活的对象（如数据库连接池），函数适合"调一次做一件事"的场景。

**2. 函数体内 `yield` 更自然。** 类里也能写 `async *run() { yield ... }`，但多套了一层壳，没有带来任何好处。

**3. 函数天然没有"残留状态"问题。** 每次调用都是全新的，测试时不用担心上一次的状态影响这一次：

```typescript
// 函数 — 传不同参数测不同场景，互不干扰
const result1 = agentLoop({ maxIterations: 1, ... })
const result2 = agentLoop({ maxIterations: 50, ... })

// 类 — 要操心 runner.state 里是否残留上次的状态
const runner = new AgentLoopRunner(...)
```

---

## 四、依赖注入

### 4.1 为什么所有依赖通过参数传入

```typescript
interface AgentLoopOptions {
  config: LLMConfig           // LLM 配置
  messages: ChatMessage[]     // 用户消息 + 历史
  tools: ToolDefinition[]     // 可用工具
  systemPrompt?: string       // System Prompt
  maxIterations?: number      // 最大迭代
  signal?: AbortSignal        // 取消信号
  confirmTool?: Function      // 确认回调
  filterTools?: Function      // 工具过滤器
  executionMode?: ExecutionMode  // 执行模式
  toolContext?: ToolContext    // 工具运行时上下文
}
```

Agent Loop 应该是**纯函数式的**——不 import 全局状态，不持有生命周期。

好处：
- **可测试**：mock 一个 options 就能测试整个循环
- **可组合**：子 Agent 用不同的 options 启动新循环
- **可调试**：所有输入都在 options 里，可序列化/重放

### 4.2 ToolContext：工具的运行时上下文

```typescript
interface ToolContext {
  workdir: string       // 工作区根目录
  sessionId: string     // 会话 ID
  signal?: AbortSignal  // 取消信号
}
```

工具不应该通过 `import { getWorkspaceRoot } from '...'` 获取全局状态。原因：子 Agent 的工作目录可能和父 Agent 不同，全局变量无法区分。通过 ToolContext 注入，每次调用传不同的上下文。

---

## 五、错误恢复

Agent Loop 的错误分为三类，恢复策略完全不同。

### 5.1 网络错误 → 指数退避重试

**可重试**：网络瞬断（fetch failed, ECONNRESET, timeout）、限流（429）、服务端过载（502, 503）。

**不可重试**：认证失败（401）、请求格式错误（400）——重试不会改变结果。

**退避策略**：`1s → 2s → 4s`，最多 2 次。

为什么不加 jitter？Jitter 减少"雷暴"——多客户端同时重试的冲突。桌面应用通常只有一个客户端，jitter 没实际价值。

### 5.2 上下文超限（413） → 紧急压缩 + 一次重试

#### 场景

长对话中，工具返回超大结果（如读取大文件），上下文突然膨胀超限。常规的 per-turn 压缩来不及。

#### 恢复流程

1. LLM 返回 413 / `context_length_exceeded`
2. 检查 `hasAttemptedReactiveCompact`
3. 若未用过：触发紧急压缩 → 压缩成功则 `turnCount--` + `continue` 重试
4. 若已用过或压缩失败：终止，reason = `prompt_too_long`

#### 为什么只一次机会

**无限重试 = 死循环。** 如果压缩后仍超限（可能 System Prompt 本身很大），重试只会再次 413。一次机会是安全边界。

#### 为什么不降级到小模型

上下文超限和模型不可用是不同的问题。小模型可能不理解之前的工具调用上下文，且降级语义与 Failover（模型不可用）冲突。两条恢复路径应该分开。

### 5.2.1 压缩熔断器

即便不是 413 紧急压缩，常规的 per-turn 压缩也可能连续失败——比如消息都在保护范围内无法删减，或 LLM 摘要接口本身故障。

**熔断策略**：连续 `N` 次压缩未能减少消息数量时，**停止尝试**，直到有新的成功压缩重置计数器。CC 的经验值是 `N = 3`（他们发现每天有 25 万次无效 API 调用来自反复失败的压缩尝试）。

```
压缩成功 → consecutiveCompactFailures = 0
压缩失败 → consecutiveCompactFailures++
连续 ≥ 3 次失败 → 跳过压缩（熔断）
```

**为什么需要熔断**：压缩本身可能消耗 API 调用（L3/L4 要调 LLM 生成摘要）。如果压缩反复失败但每轮仍然尝试，每一轮迭代都白白多一次 API 调用。

### 5.3 输出截断 → 续写 prompt + 最多 2 次

#### 场景

模型单次输出有 token 限制（如 4096/8192）。生成长回复时输出被截断，`stopReason = 'max_tokens'` 或 `'length'`。

#### 恢复流程

1. 检测到截断
2. 把截断的 assistant 消息写入上下文
3. 注入续写提示：`"[System] Your previous response was truncated. Please continue from where you left off."`
4. `recoveryCount++`，`continue` 下一轮
5. 超过 2 次：不再恢复，使用截断内容

#### 为什么最多 2 次

- 1 次太少——大文件生成可能需要 2 次续写
- 3 次以上有风险——模型可能进入"续写循环"（每次都输出最大 token 然后被截断）
- 2 次覆盖 95%+ 的正常截断场景

### 5.4 stopReason 的统一提取

三个 Provider 对停止原因的表达不同：

| Provider | 字段 | 截断值 | 正常 | 工具 |
|----------|------|--------|------|------|
| OpenAI | `finish_reason` | `"length"` | `"stop"` | `"tool_calls"` |
| Anthropic | `stop_reason` | `"max_tokens"` | `"end_turn"` | `"tool_use"` |
| Gemini | `finishReason` | `"MAX_TOKENS"` | `"STOP"` | — |

在各自的流式适配器中提取，统一为 `stopReason: string`。循环只需检查 `=== 'max_tokens' || === 'length'`。

---

## 六、取消机制

### 6.1 AbortSignal 贯穿全链路

```
用户点击取消 → AbortController.abort()
                  ↓
              AbortSignal
    ↓                ↓                ↓
 循环入口检查    LLM fetch 中断    工具执行中断
```

**检查时机**：
1. 每轮迭代开始前（最早位置，避免浪费 API 调用）
2. 传入 LLM 的 fetch 请求（signal 参数）
3. 工具执行前（合成 synthetic tool_result）

### 6.2 为什么 abort 后要合成 tool_result

假设 LLM 返回了 3 个 tool_calls，用户在确认阶段取消。此时 assistant 消息已写入（含 3 个 tool_calls），但 0 个 tool_result。

如果直接 return，下次恢复对话时 **tool_call / tool_result 不配对**，某些模型返回 400。

解决方案：为所有未执行的 tool_calls 生成 `[Tool execution cancelled by user]`。

### 6.3 为什么不删掉最后一条 assistant 消息

删掉能解决配对问题。但丢失了模型的思考结果——用户取消可能是因为"某个工具太慢"而不是"整个回复不要了"。保留 assistant + synthetic result 让模型在恢复时知道"之前想做什么、哪些被取消"。

---

## 七、终止条件

### 7.1 五条终止路径

```typescript
type TerminalReason =
  | 'completed'       // LLM 返回纯文本 → 正常结束
  | 'max_turns'       // 达到迭代上限 → 防死循环
  | 'aborted'         // AbortSignal → 用户取消
  | 'prompt_too_long' // 413 压缩后仍超限 → 建议新对话
  | 'model_error'     // 不可恢复 LLM 错误 → 展示错误
```

### 7.2 为什么不能少于 5 条

| 如果去掉 | 后果 |
|---------|------|
| `max_turns` | LLM 可能进入工具调用死循环，永不停止 |
| `aborted` | 用户点取消后循环继续执行，无法中断 |
| `prompt_too_long` | 413 后报"未知错误"，用户不知道该怎么办 |
| `model_error` | 与 `prompt_too_long` 混淆，无法区分"网络问题"和"上下文太长" |

每条路径对应不同的善后逻辑——简化会漏掉边界情况。

### 7.3 迭代上限选多少

- **25 太低**：复杂编码任务（多文件修改+测试+修复）需要 30+ 轮
- **100 太高**：失控循环烧大量 token 才被发现
- **50 是实践平衡点**

### 7.4 收尾：后台任务

循环结束不是故事的终点。`done` 事件触发后，Runtime 根据 `TerminalReason` 决定是否启动后台任务：

```
done(reason: TerminalReason)
  ↓
  reason === 'completed' || reason === 'max_turns'?
  ├── 是 → 异步触发后台任务
  │     ├── 记忆提取（从对话中提取值得记住的信息 → 写入项目记忆）
  │     ├── 画像更新（更新用户偏好/风格/工作流）
  │     └── 会话标题生成（用 LLM 为本次对话生成简短标题）
  │
  └── 否（aborted / prompt_too_long / model_error）
        → 静默退出，不触发后台任务
```

**关键设计**：

1. **fire-and-forget** — 后台任务不阻塞用户下一次操作，不等待它们完成
2. **按终止原因决定** — 用户取消或出错时不提取记忆，因为对话可能不完整
3. **独立的 LLM 调用** — 后台任务自己调 LLM，不共享主循环的上下文（防止压缩互斥问题）

这就是为什么 `done` 事件必须携带 `TerminalReason`——不同的终止方式需要不同的善后策略。一个空的 `{ type: 'done' }` 做不到这一点。

---

## 八、Loop 层的优化与防护

### 8.1 伴随文字丢弃

LLM 返回 tool_calls 时附带的说明文字（"让我来看看…""我来修改…"），对下一轮推理贡献极小。50 轮长任务中这些文字浪费 30%+ token。

**策略**：tool_calls 存在时丢弃伴随文字，只保留 tool_calls 本身。伴随文字写入日志（Debug Panel），不写入消息历史。

> Anthropic 建议保留 planning steps 以提高透明度。我们的折中：**日志记录 + 消息不保留**。

### 8.2 错误信息脱敏

所有暴露给前端的错误经过 `sanitizeError()` 处理，过滤 API Key（`sk-...`）、内部路径、完整 stack trace。这是安全红线。

### 8.3 常量集中定义

```typescript
const DEFAULT_MAX_ITERATIONS = 50     // 最大迭代
const MAX_LLM_RETRIES = 2            // 网络重试
const MAX_OUTPUT_RECOVERY_LIMIT = 2   // 截断恢复
const TOOL_TIMEOUT_MS = 30_000       // 工具超时
```

> Token 效率的完整讨论（四层压缩策略、Prompt Cache 感知等）见 [M3 上下文管理](m03-context-management.md)。

---

# 第二部分：实战记录

## 九、我们碰到的坑

### 坑 1：for 循环无法回退迭代变量

**症状**：需要实现 413 重试时，`for` 的 `i++` 是自动的，用 `i--` + `continue` 能 hack 但代码越来越脏。

**解决**：改用 `while(state.turnCount < max)` + LoopState。

### 坑 2：估算 token 数和实际值偏差大

**症状**：中英文混合场景下，我们的估算公式 `ceil(len/2.5) + 4` 误差达 20-30%。导致有时压缩不够（413），有时过度压缩（丢信息）。

**解决**：优先使用 API 返回的 `promptTokens`（`state.lastPromptTokens`），估算值只作为 fallback。

### 坑 3：取消后恢复对话报 400

**症状**：用户取消后，下次发消息时 Anthropic API 返回 400。

**原因**：assistant 消息有 3 个 tool_calls 但 0 个 tool_result。Anthropic 严格要求配对。

**解决**：abort 时为未执行的 tool_calls 生成 synthetic `[Tool execution cancelled by user]`。

### 坑 4：LLM 反复调用被拒绝的工具

**症状**：`shell_exec` 被沙箱拒绝后，LLM 下一轮又调，又被拒，消耗迭代次数直到 maxIterations。

**原因**：LLM 只看到 tool_result 中的 `[Permission Denied]`，没有推断出"不要再试"。

**解决**：累积拒绝列表 + 注入 System Prompt 明确告知"不要再尝试"。

### 坑 5：maxIterations=25 导致复杂任务被截断

**症状**：多文件重构（修改 + 测试 + 修复 + 再测试）需要 30+ 轮，被 25 的上限截断。

**解决**：提升到 50。

### 坑 6：伴随文字浪费 30% token

**症状**：50 轮对话后上下文中充满了"让我看看…""我来修改…"之类的规划文字。

**解决**：tool_calls 存在时丢弃伴随文字，只保留 tool_calls 本身。日志记录伴随文字用于调试。

### 坑 7：done 事件不带原因，Runtime 无法区分终止类型

**症状**：Runtime 在循环结束后要决定是否触发后台任务（画像/记忆/标题），但 `{ type: 'done' }` 无法区分正常完成和用户取消。

**解决**：扩展为 `{ type: 'done', reason: TerminalReason }`。

---

## 十、参考源及其价值

| 来源 | 给了我们什么 | 局限性 |
|------|-------------|--------|
| **Alice 方法论 Ch.03** | 设计哲学——丢弃伴随文字、四个终止条件、AsyncGenerator 选择 | 精心提炼的事后总结，不是实时开发记录 |
| **Claude Code query.ts** | 实现参考——while(true) 状态机、ContinueReason、stopReason 恢复 | 代码量大，适合查特定功能而非通读 |
| **Alice 源码** | 特定功能验证——搜索关键字定位实现 | minified JS，变量名丢失，不适合系统学习 |

### 我们自己的设计（不来自参考源）

| 设计 | 原创原因 |
|------|---------|
| LoopState 集中管理（CC 用散落变量） | 一处看清全局状态比散落 let 好维护 |
| 5 种 TerminalReason | 从真实使用场景反推，每种需要不同善后 |
| ContinueReason 类型化跳转 | 把重试/恢复意图编码在类型里，不靠注释 |

> 工具检查流程、权限拒绝追踪、Prompt Cache 感知等设计决策，在各自模块的文档中记录。

---

## 十一、经验总结

1. **每个改动应该有真实问题驱动**。不是"别人这么做"，而是"我们遇到了什么问题"。
2. **恢复策略必须有上限**。无限重试 = Agent 系统最危险的反模式。
3. **消息配对是硬约束**。不是"可能出问题"而是"一定出问题"。
4. **状态集中管理**。一个 LoopState 比 8 个 let 好维护。
5. **先学知识再审差距**。方法论给方向，源码给细节，交叉验证最有效。
6. **记录"为什么不"**。下次遇到不同场景时，可能做出不同的选择。

---

## 附录 A：变更清单

| 文件 | 变更 | 说明 |
|------|------|------|
| `src/shared/types.ts` | 修改 | 新增 `TerminalReason`，`done` 事件扩展 |
| `electron/main/agent/loop.ts` | 全面重写 | LoopState + while + 6 项恢复能力 |
| `electron/main/llm/index.ts` | 修改 | `stopReason` 三端提取 |
| `electron/main/agent/runtime.ts` | 修改 | `done` 事件 + reason |
| `electron/main/ipc/chat.ts` | 修改 | `done` 事件 + reason |
| `__tests__/unit/agent-loop.test.ts` | 修改 | 断言更新 + reason 验证 |

---

*下一个模块：[M2 工具系统](m02-tool-system.md) · 完整路线图见 [module-roadmap](../module-roadmap.md)*

# M3：LLM 路由层 — 代码走读

> 配套 `m03-llm-routing.md` 的认知框架，这里是代码层面的对照与实现细节。
> 对照对象：CC（Claude Code 2.1.88 源码）与 Alice（方法论 Ch.11 LLM 层）。
> 我们的实现文件：`electron/main/llm/index.ts` 与 `electron/main/agent/loop.ts`。

---

## §1 对照：统一管线 vs 手拼请求

### 我们改造前的问题

三个辅助功能各自手拼 OpenAI 请求，绕过了 `streamChat` 管线：

```ts
// context-manager.ts（改造前）—— 摘要
const resp = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llmConfig.apiKey}` },
  body: JSON.stringify({
    model: llmConfig.model,
    max_tokens: comprehensive ? 800 : 400,
    temperature: 0.2,
    messages: [/* ... */],
  }),
})
const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
const summary = data.choices?.[0]?.message?.content?.trim()
```

`profile-extractor.ts`、`session-store.ts` 三处几乎一模一样的样板。问题不是重复，是**这段代码写死了 OpenAI 的请求体和响应结构**——`chat/completions` 端点、`choices[0].message.content` 解析。用户把模型切成 Anthropic Messages API，这段就静默失效。

### 改造后：收进 chatComplete

```ts
// context-manager.ts（改造后）
const summary = await chatComplete({
  config: llmConfig,
  messages: [
    { role: 'system', content: instruction },
    { role: 'user', content: conversationText },
  ],
  temperature: 0.2,
  maxTokens: comprehensive ? 800 : 400,
  caller: 'summary',
})
```

Provider 分发、解析、failover 全在管线内部，调用方只关心"给什么消息、要什么参数"。

### CC 的对照

CC 的 `queryModel`（`claude.ts:1017`）签名 `(messages, systemPrompt, thinkingConfig, tools, signal, options)` 同样是**接收 messages 但不持有对话状态**的纯函数。所有 Provider 差异在管线内吸收，上层拿到的是统一事件流。CC 没有"某个功能自己拼请求绕过管线"的情况——这正是我们要对齐的。

---

## §2 对照：非流式是流式的收敛

### 我们的 chatComplete 实现

核心就是把流式生成器消费到底、取终态：

```ts
export async function chatComplete(options: ChatCompleteOptions): Promise<string> {
  const { config, messages, temperature, maxTokens, caller, timeoutMs = 120_000, signal } = options

  // 合并「外部中断」和「超时」两个信号
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal

  // ... 组装 callConfig / chatMessages ...

  // 消费整个流式生成器，只取最终结果（方案 A：流式收敛）
  const gen = streamChat({ config: callConfig, messages: chatMessages, signal: combinedSignal, caller })
  let result: StreamChatResult
  while (true) {
    const next = await gen.next()
    if (next.done) { result = next.value; break }
    // 流式事件对辅助调用无用，直接丢弃
  }

  const content = result.content?.trim()
  if (!content) throw new Error(`chatComplete returned empty content (caller=${caller ?? 'unknown'})`)
  return content
}
```

两个细节值得记：

1. **独立超时**：非流式没有 token 心跳（不像流式那样每个 chunk 都在"证明还活着"），所以给了独立的 120s 默认超时，用 `AbortSignal.timeout` + `AbortSignal.any` 和外部中断信号合并。
2. **空结果抛错**：辅助调用返回空是异常，直接抛给调用方兜底（调用方各有 try/catch，画像/标题失败不影响主流程）。

### CC 的对照：非流式只是 fallback

subagent 审计结论：CC 的 `queryModelWithoutStreaming` 并不是辅助调用的一等路径，而是**流式失败后的降级 fallback**（`claude.ts:2551`）。也就是说 CC 比我们更极端——它默认所有调用都流式，非流式只在流式挂了时才走。Alice 同理，单一流式接口。

**共识**：三方（我们 / CC / Alice）都不为"只要结果"的场景单独发非流式请求。输出形态用消费方式区分，请求路径只有一条。

---

## §3 对照：重试分层（G4 的核心证据）

这是 M3 最关键的一次源码审计。我们想确认"要不要把重试统一下沉到 LLM 层"，subagent 给出了 CC 的完整分层。

### CC 的三类重试，分两层

| 重试类型 | CC 的位置 | 是否需要对话状态 |
|---------|----------|----------------|
| failover 换模型 | LLM 层 `withRetry`（`withRetry.ts:160` `FallbackTriggeredError`）| 否 |
| max_output 恢复 | LLM 层无状态 override（`claude.ts:1592`）+ 循环层递增重试（`query.ts:1188`）| 否 |
| 413 输入压缩 | **Agent 循环层**（`query.ts:1085-1183`）| **是** |

### CC 的 413 处理：降级成数据，不回调

关键发现——CC **没有** `onContextTooLong` 之类的回调钩子。它的机制是：

```
LLM 层（errors.ts:562-574）：
  getAssistantMessageFromError 把 413 转成一条 assistant message
  content = PROMPT_TOO_LONG_ERROR_MESSAGE
  errorDetails = 带 token 数的原始错误（供上层解析压缩目标）
  就地 yield，不抛异常、不回调

Agent 层（query.ts:799-813）：
  流式循环用 isPromptTooLongMessage 判定，withhold（扣留不给 UI）
  本轮 drain 完，query.ts:1070 识别 isWithheld413
  → contextCollapse.recoverFromOverflow（query.ts:1094）
  → reactiveCompact.tryReactiveCompact（query.ts:1120）
  重建后 state = next; continue 重跑循环（query.ts:1164-1165）
```

数据向上流（error message + errorDetails），控制权始终在循环层。这比"回调钩子"干净——LLM 层不需要知道上层会怎么处理，它只负责把异常表达成一条结构化数据。

### 我们的对应实现（loop.ts）

我们的 413 处理与 CC 同构，同样在循环层：

```ts
// loop.ts —— 413 紧急压缩 + 重试
if (is413Error(err) && !state.hasAttemptedReactiveCompact) {
  state.hasAttemptedReactiveCompact = true   // 单发闸：只尝试一次，防死循环
  const emergencyCompressed = await compressContext(state.messages, {
    llmConfig: config, querySource: 'main',
  })
  if (emergencyCompressed.length < state.messages.length) {
    state.messages.length = 0
    state.messages.push(...emergencyCompressed)
    state.transition = { reason: 'reactive_compact_retry' }
    break  // 跳回循环头重试
  }
  // 压缩后仍超限 → surface 给用户，不再重试
  yield { type: 'error', message: '对话上下文过长，压缩后仍超限。请开始新对话。' }
  yield { type: 'done', reason: 'prompt_too_long' }
  return
}
```

`hasAttemptedReactiveCompact` 单发闸与 CC 的同名标志（`query.ts:1121`）思路完全一致——**都是为了防止"error → 压缩 → 还是超 → 再压缩"的死循环**。CC 在 `query.ts:1168-1172` 注释里特别说明：413 恢复失败时不能往下走 stop hooks，否则 hook 注入更多 token 会形成 death spiral。

**G4 结论**：我们的分层和 CC 逐点同构，是正确的架构边界。不下沉。

---

## §4 对照：usage 流式累积

### 改造前的 bug（Anthropic 分支）

```ts
// index.ts —— message_delta 分支（改造前）
if (eventType === 'message_delta') {
  const u = (parsed as Record<string, unknown>).usage as Record<string, number> | undefined
  if (u) {
    usage = {
      promptTokens: usage?.promptTokens || 0,   // 从旧值取，勉强保住
      completionTokens: u.output_tokens ?? 0,
    }
    // ↑ 整个重建 → message_start 设的 cacheReadTokens / cacheCreationTokens 全丢
  }
}
```

`message_start`（先到）设好了 cache tokens，`message_delta`（后到）重建对象时没带 cache 字段，于是 cache 统计归零。

### 改造后：合并更新 + guard

```ts
// index.ts —— message_delta 分支（改造后）
if (u) {
  // 合并更新而非重建：message_delta 只带 output_tokens，
  // input_tokens / cache tokens 来自更早的 message_start，必须保留。
  // 且用 >0 guard 防止 delta 的 0 值覆盖 start 的真实值。
  usage = {
    ...(usage ?? { promptTokens: 0, completionTokens: 0 }),
    completionTokens: u.output_tokens > 0 ? u.output_tokens : (usage?.completionTokens ?? 0),
  }
}
```

OpenAI 分支同样加了 `>0` guard（防代理在中间 chunk 塞 0 值）：

```ts
usage = {
  promptTokens: (u.prompt_tokens ?? 0) > 0 ? u.prompt_tokens : (usage?.promptTokens ?? 0),
  completionTokens: (u.completion_tokens ?? 0) > 0 ? u.completion_tokens : (usage?.completionTokens ?? 0),
}
```

---

## §5 对照：retry-after 的传递

### 改造前：纯字符串 Error 丢信息

```ts
// index.ts（改造前）—— 四处抛错点都是纯字符串
throw new Error(`LLM API error (${response.status}): ${error}`)
// ↑ 429/503 响应头里的 retry-after 全丢了，上层只能盲目指数退避
```

loop 的 `isRetryableError` 只能靠字符串匹配 `msg.includes('429')` 判断，拿不到服务端指定的等待时间。

### 改造后：LLMError 携带结构化信息

```ts
// index.ts —— 新增错误类
export class LLMError extends Error {
  status: number
  retryAfterMs?: number   // 来自 retry-after header
  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message)
    this.name = 'LLMError'
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

// 解析 retry-after（支持整数秒 / HTTP 日期两种格式）
export function parseRetryAfterMs(response: Response): number | undefined {
  const raw = response.headers.get('retry-after')
  if (!raw) return undefined
  const asSeconds = Number(raw)
  if (Number.isFinite(asSeconds)) return asSeconds * 1000
  const asDate = Date.parse(raw)
  if (Number.isFinite(asDate)) {
    const delta = asDate - Date.now()
    return delta > 0 ? delta : undefined
  }
  return undefined
}

// 四处抛错点改用
throw new LLMError(`LLM API error (${response.status}): ${error}`, response.status, parseRetryAfterMs(response))
```

### loop 的对应消费

```ts
// loop.ts —— 重试等待优先遵从服务端 retry-after
let nextRetryAfterMs: number | undefined

for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
  if (attempt > 0) {
    // 优先遵从服务端 retry-after，否则退回指数退避
    const backoff = nextRetryAfterMs ?? 1000 * Math.pow(2, attempt - 1)
    await sleep(backoff)
  }
  try { /* ... streamChat ... */ }
  catch (err) {
    if (!isRetryableError(err) || attempt === MAX_LLM_RETRIES) break
    nextRetryAfterMs = err instanceof LLMError ? err.retryAfterMs : undefined
  }
}
```

### CC 的对照

CC 的 `withRetry`（`withRetry.ts:530`）同样从响应头读 retry-after 并优先遵从。差别是 CC 的 retry-after 处理在 LLM 层（因为它的 failover/退避重试整个在 `withRetry` 内），我们的在 loop 层——但这符合各自的分层：我们的网络重试本来就在 loop（见 §3）。信息通过 `LLMError` 从 LLM 层传到 loop 层，边界不破。

---

## §6 caller 归因

```ts
// index.ts —— StreamChatOptions 加字段
export interface StreamChatOptions {
  // ...
  /** 调用方标识（用于日志归因和成本统计），如 'main' / 'summary' / 'profile' */
  caller?: string
}

// streamChat 入口打日志
llmLog.info('streamChat start', {
  caller: options.caller ?? 'unknown',
  model: config.model,
  messageCount: options.messages.length,
  toolCount: options.tools?.length ?? 0,
})
```

调用点：loop 主对话传 `caller: 'main'`，chatComplete 透传 `'summary'/'profile'/'title'`。目前子 Agent 也走 loop，caller 会是 `'main'`——后续可细分。

---

## 更新记录

- 2026-07-01：首次撰写。M3 深啃完成（G1 统一辅助调用 / G2 usage guard / G3 retry-after / G5 caller / G4 评估关闭）。CC 分层证据来自两次 subagent 审计（services/api 管线 + 413 职责分层）。

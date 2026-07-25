# M4：上下文压缩 — 代码走读

> 配套 `m04-context-compression.md` 的认知框架，这里是代码层面的对照与实现细节。
> 对照对象：CC（Claude Code 2.1.88 源码 `services/compact/`）与 Alice（方法论 Ch.5）。
> 我们的实现文件：`electron/main/agent/context-manager.ts` 与 `electron/main/agent/loop.ts`。

---

## §1 preamble 保护：从"保护第一条"到"保护 group 0"

### 改造前：只保护 messages[0]

```ts
// snip（改造前）
function snip(messages: ChatMessage[]): ChatMessage[] {
  const recentStart = Math.max(1, messages.length - RECENT_KEEP_COUNT)
  for (let i = 0; i < messages.length; i++) {
    if (i === 0 || i >= recentStart /* ... */) { result.push(msg); continue }
    // snip
  }
}
// collapse / autoCompact 同样只 messages.slice(1, ...) 保护 messages[0]
```

`i === 0` 只保护 system prompt。用户的初始任务说明在 `messages[1]`（或更后），落在被压缩区间。

### 改造后：统一的 getPreambleEndIndex

```ts
function getPreambleEndIndex(messages: ChatMessage[]): number {
  if (messages.length === 0) return -1
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'assistant') {
      return i - 1 // preamble 到第一条 assistant 之前为止
    }
  }
  return messages.length - 1 // 没有 assistant，全是 preamble
}
```

三层统一用它：
- `snip`：`i <= preambleEnd` 时保护
- `collapse`：`preamble = messages.slice(0, preambleEnd + 1)`
- `autoCompact`：同 collapse

对照 CC `grouping.ts` 的 `groupMessagesByApiRound`——第一条 assistant 开启 group 1，group 0 是 preamble，压缩时 `slice` 掉 group 0 之外的部分。

**注意语义**：`getPreambleEndIndex` 返回的是"最后一条 preamble 消息的下标"，assistant 在 index 0 时返回 -1（无 preamble 保护，符合预期——纯 assistant 开头的历史没有任务说明）。这个边界在测试 `L1 Snip 删除早期工具调用轮次` 里被覆盖（system → assistant 直连结构）。

---

## §2 文件恢复：入口快照 + 限量注入

### 快照时序（关键）

```ts
export async function compressContext(messages, options) {
  // ...
  // A2: 必须在 L1 Snip 之前捕获——Snip 会删掉早期 file_read 轮次
  const preCompactFileReads = extractRecentFileReads(messages)

  if (tokens > maxTokens * L1_THRESHOLD) current = snip(current)      // 删 file_read
  if (tokens > maxTokens * L2_THRESHOLD) current = microCompact(current)
  if (tokens > maxTokens * L3_THRESHOLD)
    current = await collapse(current, maxTokens, llmConfig, preCompactFileReads) // 用快照
  // ...
}
```

对照 CC `compact.ts` 的 `preCompactReadFileState`——CC 有独立的 `readFileState` 全局，在 compact 前 `cacheToObject` 快照。我们没有独立全局状态，改为**从原始消息历史直接提取**（纯函数，无副作用）。

### 提取：tool 消息不含路径，要从 assistant toolCall 关联

```ts
function extractRecentFileReads(summarizedMessages: ChatMessage[]): RestoredFile[] {
  // toolCallId → 路径（从 assistant 的 toolCall arguments 解析）
  const toolCallPaths = new Map<string, string>()
  for (const msg of summarizedMessages) {
    if (msg.role === 'assistant' && msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        if (!FILE_READ_TOOL_NAMES.has(tc.name)) continue
        try {
          const args = JSON.parse(tc.arguments || '{}') as { path?: string }
          if (args.path) toolCallPaths.set(tc.id, args.path)
        } catch { /* 参数损坏跳过 */ }
      }
    }
  }
  // path → 最近一次结果（后覆盖前，天然去重）
  const byPath = new Map<string, RestoredFile>()
  for (let i = 0; i < summarizedMessages.length; i++) {
    const msg = summarizedMessages[i]
    if (msg.role !== 'tool' || !msg.toolCallId) continue
    const filePath = toolCallPaths.get(msg.toolCallId)
    if (!filePath) continue
    if (msg.content.startsWith('Error')) continue  // 错误结果不恢复
    byPath.set(filePath, { path: filePath, content: msg.content, order: i })
  }
  return Array.from(byPath.values())
    .sort((a, b) => b.order - a.order)  // 最近的在前
    .slice(0, MAX_RESTORED_FILES)       // 限 5 个
}
```

设计要点：ChatMessage 的 `tool` 消息只有 `content` + `toolCallId`，**没有路径**。路径在对应 assistant 的 `toolCall.arguments`（JSON 字符串）里。所以要先建 `toolCallId → path` 映射，再回填。

### 注入：三重 token 限制

```ts
const MAX_RESTORED_FILES = 5
const MAX_RESTORED_TOKENS_PER_FILE = 5_000
const MAX_RESTORED_TOTAL_TOKENS = 50_000

function buildFileRestoreMessage(files: RestoredFile[]): ChatMessage | null {
  // 单文件超限截断到 5K token（chars ≈ token * 2.5）
  // 总量超 50K 就停止追加
  // 全部超限则返回 null（不注入空壳）
}
```

对照 CC `POST_COMPACT_MAX_FILES_TO_RESTORE = 5` / `POST_COMPACT_TOKEN_BUDGET = 50_000` / `POST_COMPACT_MAX_TOKENS_PER_FILE = 5_000`——数值完全一致，这是 CC 生产验证过的预算。

---

## §3 emergencyTruncate：熔断降级的纯规则兜底

```ts
export function emergencyTruncate(messages: ChatMessage[], targetTokens: number): ChatMessage[] {
  if (messages.length === 0) return messages
  const preambleEnd = getPreambleEndIndex(messages)
  const preamble = messages.slice(0, preambleEnd + 1)
  const rest = messages.slice(preambleEnd + 1)

  let tokens = estimateTokens(preamble)
  const kept: ChatMessage[] = []
  for (let i = rest.length - 1; i >= 0; i--) {  // 从最近往前保留
    const msgTokens = estimateTokens([rest[i]])
    if (tokens + msgTokens > targetTokens && kept.length > 0) break
    kept.unshift(rest[i])
    tokens += msgTokens
  }
  return [...preamble, ...removeOrphanToolMessages(kept)]
}
```

`removeOrphanToolMessages` 处理截断产生的孤儿 tool 消息（对应 assistant toolCall 被截在删除段，只剩 tool 结果 → LLM API 400）：

```ts
function removeOrphanToolMessages(messages: ChatMessage[]): ChatMessage[] {
  const validToolCallIds = new Set<string>()
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.toolCalls) {
      for (const tc of msg.toolCalls) validToolCallIds.add(tc.id)
    }
  }
  return messages.filter(
    m => m.role !== 'tool' || (m.toolCallId != null && validToolCallIds.has(m.toolCallId)),
  )
}
```

对照 CC `truncateHeadForPTLRetry` —— CC 按 API round group 整组删，删完用 `ensureToolResultPairing` 修孤儿。我们粒度更细（按单消息 + token），但孤儿处理思路一致。

---

## §4 loop 层：熔断降级 + 413 逃生舱

### 熔断降级（A3）

```ts
// loop.ts —— 每轮迭代前的压缩检查
if (state.consecutiveCompactFailures >= MAX_CONSECUTIVE_COMPACT_FAILURES) {
  const tokens = state.lastPromptTokens ?? estimateTokens(state.messages)
  if (tokens > DEFAULT_MAX_TOKENS * 0.9) {
    const truncated = emergencyTruncate(state.messages, DEFAULT_MAX_TOKENS * 0.5)
    state.messages.length = 0
    state.messages.push(...truncated)
    state.consecutiveCompactFailures = 0  // 截断后重置，给压缩重新尝试的机会
  }
  // 否则只跳过压缩（tokens 没超阈值，不需要截断）
}
```

### 413 逃生舱（C1）

```ts
// loop.ts —— LLM 调用 catch 块
if (is413Error(err) && !state.hasAttemptedReactiveCompact) {
  state.hasAttemptedReactiveCompact = true
  const emergencyCompressed = await compressContext(state.messages, { llmConfig: config, querySource: 'main' })
  if (emergencyCompressed.length < state.messages.length) {
    // 压缩成功缩小 → 重试
    state.messages = emergencyCompressed; state.transition = { reason: 'reactive_compact_retry' }; break
  }
  // C1: 压缩没缩小 → emergencyTruncate 硬截断再重试，而非直接放弃
  const truncated = emergencyTruncate(state.messages, DEFAULT_MAX_TOKENS * 0.5)
  if (truncated.length < state.messages.length) {
    state.messages = truncated; state.transition = { reason: 'reactive_compact_retry' }; break
  }
  // 压缩 + 截断都无效 → 才放弃
  yield { type: 'error', message: '对话上下文过长，压缩后仍超限。请开始新对话。' }
  yield { type: 'done', reason: 'prompt_too_long' }
  return
}
```

对照 CC：`hasAttemptedReactiveCompact` 单发闸门与 CC **同名**（M1 阶段确认的同构）。CC 的 `MAX_PTL_RETRIES = 3` 是多次渐进删除，我们是"compress 一次 → truncate 一次"两级兜底——层数少但逃生路径完整。桌面伙伴产品的取舍：CC 最终抛 `ERROR_MESSAGE_PROMPT_TOO_LONG`，我们尽量自动截断续命（认知框架第八节）。

---

## §5 结构化摘要 prompt（B1）

```ts
// generateLLMSummary
const instruction = `你正在为一个持续进行的对话生成压缩摘要。摘要将替换早期对话历史，供 AI 继续任务时参考。

请严格按以下结构化格式输出（每节简明扼要，缺失的节写「无」）：

## 当前任务
[用一句话说明用户的核心目标]
## 已完成步骤
[按顺序列出已完成的关键操作，无则写「无」]
## 当前状态
[进展到哪一步，遇到什么问题，无则写「无」]
## 下一步计划
[接下来应该做什么，无则写「无」]
## 关键上下文
[必须记住的信息：文件路径、变量名、配置值、用户偏好等，无则写「无」]

用中文回答，总字数控制在 ${wordLimit} 字以内。只输出上述结构，不要额外说明。`
```

对照 CC `compact/prompt.ts` 的 `getCompactPrompt`——CC 用一个更长的 8 段结构化模板（含 "Primary Request and Intent" / "Key Technical Concepts" / "Pending Tasks" 等）。我们取其精髓的 5 节，适配中文伙伴场景。核心一致：**结构化 > 自由文本**（认知框架第七节）。

---

## §6 boundary marker（B3）

类型扩展（`src/shared/types.ts`）：

```ts
export interface ChatMessage {
  // ...
  compactMetadata?: CompactMetadata
}
export interface CompactMetadata {
  level: 'L3_Collapse' | 'L4_AutoCompact'
  preCompactTokens: number
  postCompactTokens: number
  trigger: 'proactive' | 'reactive_413'
  compactedAt: number
  usedLLM: boolean
}
```

写入（collapse 示例）：

```ts
const summaryMsg: ChatMessage = {
  id: 'context-summary', role: 'system', content: summaryContent, timestamp: Date.now(),
  compactMetadata: { level: 'L3_Collapse', preCompactTokens, postCompactTokens: 0, trigger: 'proactive', compactedAt: Date.now(), usedLLM },
}
// 组装完成后回填（此时才知道最终 token）
summaryMsg.compactMetadata!.postCompactTokens = estimateTokens(result)
```

**不泄漏 API 的保证**：LLM 层 `llm/index.ts` 序列化消息时显式只取 `{ role, content }`（及 toolCalls/images 等已知字段），`compactMetadata` 是新增的可选字段，不在序列化白名单内，天然不会发给 Provider。对照 CC 的 `SystemCompactBoundaryMessage`——CC 用独立消息类型承载 `compactMetadata`（含 `preservedSegment` 等更多字段），我们轻量化为摘要消息上的一个可选字段。

对照 CC 未做的 B2（L4 独立 forked agent）：CC 用 `runForkedAgent` 复用主会话 prompt cache prefix 跑 L4，我们暂缓（认知框架第二部分"暂缓项"）。

---

## §7 动态阈值（C2）

```ts
const MODEL_CONTEXT_WINDOWS: Array<{ prefix: string; window: number }> = [
  // 只写跨代际稳定的家族
  { prefix: 'claude-', window: 200_000 },
  { prefix: 'gemini-', window: 1_000_000 },
  // GPT/o/DeepSeek/Qwen 迭代快或跨度大，不写——回退 DEFAULT_MAX_TOKENS
]

export function getEffectiveContextWindow(model?: string): number {
  if (!model) return DEFAULT_MAX_TOKENS
  const normalized = model.toLowerCase()
  for (const { prefix, window } of MODEL_CONTEXT_WINDOWS) {
    if (normalized.includes(prefix)) {
      // 下限 16K 只防极端配置，不能用 DEFAULT_MAX_TOKENS 兜高（否则小窗口压缩不及时）
      return Math.max(window - OUTPUT_RESERVE_TOKENS, 16_000)
    }
  }
  return DEFAULT_MAX_TOKENS
}

// compressContext 入口
const maxTokens = options.maxTokens ?? getEffectiveContextWindow(options.llmConfig?.model)
```

**只写稳定家族**（认知框架第九节 + 坑 3）：第一版按前缀写死了 6 个模型，DeepSeek 凭记忆写成 64K（实际 128K）、Qwen 跨 32K~10M 无法区分。收敛为只保留 Claude(200K)/Gemini(1M) 两个多代稳定家族，其余回退保守默认 + 靠 API 的 413 反压兜底。**参数变化频率 > 代码维护频率时，回退比硬编码稳。**

**下限方向陷阱**：`Math.max(window - reserve, floor)` 的 `floor` 若取 `DEFAULT_MAX_TOKENS` 会把真实小窗口兜高，压缩不及时。取 16K 小值只防极端配置。

---

## 测试清单（M4 新增 14 个）

| 测试 | 覆盖 | 文件 |
|------|------|------|
| A1 保护任务说明 | preamble 不被 snip/collapse 删 | context-manager.test.ts |
| A2 文件恢复 ×2 | 恢复最近文件 / 错误结果不恢复 | context-manager.test.ts |
| A3 emergencyTruncate ×3 | 保护 preamble+最近 / 移除孤儿 tool / 空列表 | context-manager.test.ts |
| B1 结构化摘要 | 指令含 5 节框架 + usedLLM 标记 | context-structured-summary.test.ts |
| B3 boundary marker ×2 | metadata 字段正确 / 不泄漏 role/content | context-manager.test.ts |
| C2 动态阈值 ×5 | Claude/Gemini/迭代快家族回退/未知/大小写 | context-manager.test.ts |

单测 113 → 127。全程 tsc 零错误。

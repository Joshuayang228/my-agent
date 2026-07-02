# 上下文压缩实现 Gap 分析

**分析日期**: 2026-07-02  
**对照标准**: Alice Ch.05 四层压缩策略 + Claude Code compact.ts 实现

---

## 一、当前实现总结

### 我们的架构
**文件**: `electron/main/agent/context-manager.ts` + `loop.ts:142-166`

**四层压缩结构**（已实现）:
1. **L1 Snip** (60% 阈值) — 删除最早的工具调用轮次（assistant+tool 对）
2. **L2 MicroCompact** (75% 阈值) — 去重相同工具调用，只保留最后一次
3. **L3 Collapse** (90% 阈值) — LLM 摘要中间消息，保留首尾
4. **L4 AutoCompact** (95% 阈值) — 紧急全量重写

**触发位置**: 
- 主循环每轮迭代前主动检查（`loop.ts:142-166`）
- 413 错误后紧急压缩（`loop.ts:220-238`）

**防护措施**:
- `querySource` 机制防止递归（L3/L4 时设置 `querySource='compact'`）
- 连续失败熔断器（`MAX_CONSECUTIVE_COMPACT_FAILURES = 3`）

---

## 二、Gap 清单

### G1: L1 Snip 缺少"保护第一条消息"的逻辑
**位置**: `context-manager.ts:133-163`

**当前代码**:
```typescript
function snip(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = []
  const recentStart = Math.max(1, messages.length - RECENT_KEEP_COUNT)
  let snipped = 0
  const MAX_SNIP = 5

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    if (i === 0 || i >= recentStart || snipped >= MAX_SNIP) {
      result.push(msg)
      continue
    }
    // ... snip assistant+tool pairs
  }
}
```

**问题**: 
- 虽然 `i === 0` 保护了第一条消息（system prompt），但没有明确保护"用户任务说明"
- Alice 强调："对话早期的探索性工具调用...但如果任务说明本身在早期消息里，Snip 一定不能碰它——这是实现时需要特别保护的边界"
- CC 的 `snip` 在分组时会把 preamble（包括用户首消息）放在 group 0，永远不删除

**对照 CC**: `compact.ts:242-291` 的 `truncateHeadForPTLRetry` 和 grouping 逻辑明确保护 preamble

**优先级**: **P0 正确性** — 长任务中可能误删用户初始任务说明

---

### G2: L2 MicroCompact 去重逻辑过于简单
**位置**: `context-manager.ts:169-229`

**当前实现**: 按 `${tc.name}:${tc.arguments}` 完全匹配去重

**问题**:
- 没有处理参数微小变化的场景（如 `Read("file.ts", {limit: 100})` vs `Read("file.ts", {limit: 200})`）
- CC 使用 `groupMessagesByApiRound` 做结构化分组，按"API 调用轮次"而非单个工具维度去重
- Alice 提到："多次读取同一文件、多次执行相同命令、多次搜索相似关键词"，我们只覆盖了完全相同的情况

**对照 CC**: `grouping.ts` + `compact.ts:211-223` 的 `stripReinjectedAttachments`

**优先级**: **P1 体验** — 不影响正确性，但压缩效果次优

---

### G3: L3 Collapse 摘要不是结构化的
**位置**: `context-manager.ts:326-361`

**当前实现**:
```typescript
const instruction = comprehensive
  ? '请详细总结以下对话的完整内容，包括：讨论的主题、做出的决策、完成的任务、关键代码变更、未完成的工作。确保不丢失重要信息。用中文回答，控制在 500 字以内。'
  : '请简洁总结以下对话的要点：主要话题、关键结论、执行了什么操作。用中文回答，控制在 200 字以内。'
```

**问题**:
- 返回自由文本摘要，而非结构化格式
- Alice 强调："摘要的输出应该是结构化的——不是自由文本，而是'当前任务、已完成步骤、当前状态、下一步'这样的框架。原因是：结构化摘要在下一轮 LLM 推理时，比自由文本摘要更容易被正确解读。"
- CC 的 `prompt.ts` 中 `getCompactPrompt` 明确要求结构化输出

**对照 CC**: `compact/prompt.ts:getCompactPrompt` 输出格式要求

**优先级**: **P1 体验** — 自由文本摘要会导致模型理解偏差

---

### G4: 缺少 post-compact 文件恢复机制
**位置**: 无对应实现

**问题**:
- 压缩后，`context.readFileState.clear()` 清空了文件读取缓存
- CC 在压缩后会：
  1. 从 `preCompactReadFileState` 筛选最近读取的文件
  2. 重新调用 `FileReadTool` 生成 attachment
  3. 注入到压缩后的上下文（`compact.ts:1414-1464`）
- 我们的实现中，压缩后模型会"忘记"之前读过的文件，可能重复调用 Read

**对照 CC**: `compact.ts:createPostCompactFileAttachments`

**优先级**: **P0 正确性** — 导致压缩后重复工具调用，token 浪费 + 体验劣化

---

### G5: 缺少 image/document 剥离逻辑
**位置**: 无对应实现

**问题**:
- 当前 `collapse()` 和 `autoCompact()` 直接把完整消息发给摘要 LLM
- CC 在发送前会剥离 image/document blocks (`compact.ts:145-199` `stripImagesFromMessages`)
- 原因："Images are not needed for generating a conversation summary and can cause the compaction API call itself to hit the prompt-too-long limit"
- 我们当前不支持 multimodal，但架构上应预留

**对照 CC**: `compact.ts:stripImagesFromMessages`

**优先级**: **P2 优化** — 当前无 multimodal 支持，未来需要

---

### G6: L4 AutoCompact 没有独立会话实现
**位置**: `context-manager.ts:294-323`

**当前实现**: 和 L3 相同，都是直接调用 `generateLLMSummary`

**问题**:
- Alice 强调："最重量级，用**独立的 LLM 会话**对全量历史做完整摘要。这一层有一个必须处理的递归陷阱：...必须在调用这个摘要会话时明确禁用工具，并标记当前处于压缩状态。"
- CC 使用 `runForkedAgent` 实现完全隔离的压缩会话（`compact.ts:1179-1247`）
- 我们的 `querySource='compact'` 只能防止再次触发压缩，但摘要 LLM 仍可能调用工具

**对照 CC**: `compact.ts:streamCompactSummary` 的 forked agent 路径

**优先级**: **P1 体验** — L4 触发时应该是"最后的救命稻草"，必须彻底隔离

---

### G7: 缺少 PTL (Prompt Too Long) 重试循环
**位置**: `loop.ts:220-238` 只在 413 时触发一次

**问题**:
- 当前只在主循环遇到 413 时做一次 reactive compact，失败即放弃
- CC 在压缩调用本身遇到 PTL 时会进入重试循环：
  1. 调用 `truncateHeadForPTLRetry` 删除最旧的 API round groups
  2. 重试最多 `MAX_PTL_RETRIES` 次（`compact.ts:450-491`）
- 我们的实现中，如果 `compressContext` 本身返回的消息仍超限，loop 会直接失败

**对照 CC**: `compact.ts:450-491` + `truncateHeadForPTLRetry`

**优先级**: **P1 体验** — 极长会话中压缩本身可能失败

---

### G8: 缺少 prompt cache 复用优化
**位置**: 无对应实现

**问题**:
- CC 的压缩会话使用 `runForkedAgent` 复用主会话的 prompt cache prefix
- 通过 `cacheSafeParams.forkContextMessages` 传递上下文，cache key 保持一致
- 节省大量 token（"98% cache hit" 根据 CC 注释）
- 我们的 L3/L4 每次都是全新的 LLM 调用，无法复用 cache

**对照 CC**: `compact.ts:1179-1229` 的 forked agent 实现

**优先级**: **P2 优化** — 成本优化，非功能性问题

---

### G9: 缺少 post-compact hooks
**位置**: 无对应实现

**问题**:
- CC 在压缩前后执行 `executePreCompactHooks` / `executePostCompactHooks`
- 允许用户自定义压缩行为（如注入 custom instructions）
- 我们的实现中压缩完全自动化，无扩展点

**对照 CC**: `compact.ts:412-423` + `721-729`

**优先级**: **P2 优化** — 可扩展性，非核心功能

---

### G10: 触发阈值硬编码，无法动态调整
**位置**: `context-manager.ts:8-12`

**当前实现**:
```typescript
const DEFAULT_MAX_TOKENS = 120_000
const L1_THRESHOLD = 0.60
const L2_THRESHOLD = 0.75
const L3_THRESHOLD = 0.90
const L4_THRESHOLD = 0.95
```

**问题**:
- 阈值固定，不根据模型 context window 动态调整
- CC 根据 `shouldAutoCompact` 的 `autoCompactThreshold` 参数动态触发
- 不同模型的窗口大小差异很大（Claude 3.5 Sonnet = 200K，Haiku = 200K，但 Gemini Flash = 1M）

**对照 CC**: `autoCompact.ts` + model context window 查询

**优先级**: **P1 体验** — 多模型支持时必须动态调整

---

### G11: 压缩失败后的降级策略不完整
**位置**: `loop.ts:143-165` 只有熔断器

**当前实现**:
```typescript
if (state.consecutiveCompactFailures >= MAX_CONSECUTIVE_COMPACT_FAILURES) {
  log.warn('Compact circuit breaker tripped — skipping compression')
}
```

**问题**:
- 熔断后直接跳过压缩，但没有降级到更激进的策略（如强制截断）
- CC 在 PTL 重试失败后会抛出 `ERROR_MESSAGE_PROMPT_TOO_LONG`，引导用户手动干预
- 我们熔断后会继续执行，可能在下一轮直接因为超限而崩溃

**对照 CC**: `compact.ts:469-477` 的失败处理

**优先级**: **P0 正确性** — 熔断后的行为未定义

---

### G12: 缺少 compact boundary marker
**位置**: 无对应实现

**问题**:
- CC 在每次压缩后插入 `SystemCompactBoundaryMessage`
- 用于：
  1. 标记压缩点，方便 debug 和 transcript 回放
  2. 携带 metadata（压缩前 token 数、触发原因、保留的工具列表）
  3. 支持 partial compact 的 anchor 机制
- 我们的实现中，压缩后的消息序列和未压缩的无法区分

**对照 CC**: `compact.ts:599-611` + `messages.ts:createCompactBoundaryMessage`

**优先级**: **P1 体验** — 调试和可观测性缺失

---

### G13: estimateTokens 算法过于粗糙
**位置**: `context-manager.ts:49-60`

**当前实现**:
```typescript
export function estimateTokens(messages: ChatMessage[]): number {
  let total = 0
  for (const msg of messages) {
    total += Math.ceil(msg.content.length / 2.5) + 4
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        total += Math.ceil((tc.arguments?.length ?? 0) / 3) + 10
      }
    }
  }
  return total
}
```

**问题**:
- 混合中英文场景用 2.5 chars/token 是合理简化，但没有考虑：
  1. System prompt 的固定开销
  2. Tool schema 的 token 成本
  3. Thinking blocks（Claude 3.5+）
- CC 使用 `roughTokenCountEstimation` + `tokenCountWithEstimation`，后者会叠加 API 返回的真实 token 数

**对照 CC**: `tokens.ts:tokenCountWithEstimation`

**优先级**: **P2 优化** — 估算偏差不大，但精确度可提升

---

## 三、优先级汇总

### P0 正确性（必须修复）
- **G1**: L1 Snip 保护任务说明
- **G4**: Post-compact 文件恢复
- **G11**: 熔断后降级策略

### P1 体验（影响用户体验）
- **G2**: L2 去重逻辑优化
- **G3**: L3 结构化摘要
- **G6**: L4 独立会话隔离
- **G7**: PTL 重试循环
- **G10**: 动态阈值调整
- **G12**: Compact boundary marker

### P2 优化（性能与可扩展性）
- **G5**: Image/document 剥离（未来需要）
- **G8**: Prompt cache 复用
- **G9**: Post-compact hooks
- **G13**: Token 估算精度

---

## 四、修复建议顺序

1. **第一批 (P0)**: G1 + G4 + G11 — 保证基础正确性
2. **第二批 (P1 核心)**: G3 + G6 + G12 — 提升压缩质量与可观测性
3. **第三批 (P1 边界)**: G7 + G10 — 处理极端场景
4. **第四批 (P2)**: 按需修复 G2/G8/G9/G13

---

## 五、参考实现位置

### Alice Ch.05
- 四层压缩策略理论：L86-109
- 互斥问题：L110-120
- 记忆系统分离：L13-19

### Claude Code
- 主压缩流程：`src/services/compact/compact.ts:386-763`
- 分组与去重：`src/services/compact/grouping.ts`
- Prompt：`src/services/compact/prompt.ts`
- Post-compact 恢复：`compact.ts:1414-1464`
- Forked agent：`utils/forkedAgent.ts` + `compact.ts:1179-1229`

---

**分析完成时间**: 2026-07-02 23:45

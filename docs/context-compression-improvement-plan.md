# 上下文压缩系统改进方案

**日期**: 2026-07-02  
**状态**: 待用户确认  
**基于**: Alice Ch.05 + CC compact/ 源码 + Gap 分析

---

## 一、改进目标

将当前四层压缩系统从"能用"提升到"生产级"：
1. **正确性优先** — 修复可能导致任务失败的 P0 问题
2. **体验增强** — 提升压缩质量和可观测性
3. **边界完善** — 处理极端场景（极长会话、压缩失败）

---

## 二、分批改进路线

### Phase A: 正确性修复（P0，必做）

修复 3 个可能导致任务失败的关键问题：

#### A1: L1 Snip 保护任务说明 (G1)

**现状问题**：
- 当前只保护 `i === 0`（system prompt），但用户任务说明可能在第一条 user 消息
- 长任务中可能误删用户初始任务描述

**改进方案**：
```typescript
// 定义 preamble 边界
function getPreambleEndIndex(messages: ChatMessage[]): number {
  // preamble = system + 第一条 user 消息 + 第一条 assistant 回复（如果有）
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'assistant' && i > 0) {
      return i  // 第一条 assistant 之前都是 preamble
    }
  }
  return Math.min(1, messages.length - 1)  // 至少保护前 2 条
}

function snip(messages: ChatMessage[]): ChatMessage[] {
  const preambleEnd = getPreambleEndIndex(messages)
  // ... snip 逻辑，跳过 i <= preambleEnd
}
```

**验证方式**：
- 单测：构造"user 任务说明 → assistant → 多轮工具 → 触发 snip"场景
- 确认用户首消息未被删除

---

#### A2: Post-compact 文件恢复 (G4)

**现状问题**：
- 压缩后 `readFileState.clear()`，模型忘记之前读过的文件
- 导致重复 `file_read` 调用

**改进方案**：
```typescript
// 1. 压缩前快照
const preCompactFileState = new Map(context.readFileState)

// 2. 压缩后恢复最近读取的文件
function createPostCompactFileAttachments(
  fileState: Map<string, { content: string; timestamp: number }>,
  maxFiles: number = 5,
  maxTokensPerFile: number = 5000,
  maxTotalTokens: number = 50000,
): ChatMessage[] {
  // 按 timestamp 降序排序
  const sorted = Array.from(fileState.entries())
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
  
  const attachments: ChatMessage[] = []
  let totalTokens = 0
  
  for (const [path, { content }] of sorted.slice(0, maxFiles)) {
    const tokens = estimateTokens([{ role: 'user', content }])
    if (tokens > maxTokensPerFile) {
      // 截断到 maxTokensPerFile
      const truncated = content.slice(0, maxTokensPerFile * 2.5)
      attachments.push({
        role: 'user',
        content: `[File restored post-compact: ${path}]\n${truncated}\n[... truncated]`,
      })
      totalTokens += maxTokensPerFile
    } else {
      attachments.push({
        role: 'user',
        content: `[File restored post-compact: ${path}]\n${content}`,
      })
      totalTokens += tokens
    }
    
    if (totalTokens >= maxTotalTokens) break
  }
  
  return attachments
}

// 3. 注入到压缩后消息
async function collapse(messages: ChatMessage[], ...): Promise<ChatMessage[]> {
  const preCompactFileState = new Map(context.readFileState)
  
  // ... 生成摘要
  
  const attachments = createPostCompactFileAttachments(preCompactFileState)
  return [summaryMsg, ...recentMsgs, ...attachments]
}
```

**验证方式**：
- E2E 测试：读文件 → 压缩 → 后续对话引用文件内容
- 确认无重复 `file_read` 调用

---

#### A3: 熔断后降级策略 (G11)

**现状问题**：
- 熔断后直接跳过压缩，但未定义后续行为
- 可能在下一轮因超限而崩溃

**改进方案**：
```typescript
// loop.ts
if (state.consecutiveCompactFailures >= MAX_CONSECUTIVE_COMPACT_FAILURES) {
  log.warn('Compact circuit breaker tripped — emergency truncation')
  
  // 降级策略：强制截断到 50% context
  const targetSize = Math.floor(state.contextManager.maxTokens * 0.5)
  messages = emergencyTruncate(messages, targetSize)
  
  // 插入警告消息
  messages.push({
    role: 'assistant',
    content: '[System] Context压缩连续失败，已执行紧急截断。部分历史对话可能丢失。',
  })
  
  // 重置熔断器
  state.consecutiveCompactFailures = 0
}

function emergencyTruncate(
  messages: ChatMessage[], 
  targetTokens: number
): ChatMessage[] {
  // 保护 preamble + 保留最近 N 条
  const preambleEnd = getPreambleEndIndex(messages)
  const preamble = messages.slice(0, preambleEnd + 1)
  
  let recentMessages = messages.slice(preambleEnd + 1).reverse()
  let tokens = estimateTokens(preamble)
  
  const kept: ChatMessage[] = []
  for (const msg of recentMessages) {
    const msgTokens = estimateTokens([msg])
    if (tokens + msgTokens > targetTokens) break
    kept.unshift(msg)
    tokens += msgTokens
  }
  
  return [...preamble, ...kept]
}
```

**验证方式**：
- 模拟连续 3 次压缩失败
- 确认降级后对话可继续

---

### Phase B: 体验增强（P1 核心，强烈建议）

#### B1: L3 结构化摘要 (G3)

**现状问题**：
- 自由文本摘要导致模型理解偏差

**改进方案**：
```typescript
const STRUCTURED_SUMMARY_INSTRUCTION = `
请按以下结构化格式总结对话：

## 当前任务
[用一句话说明用户的核心目标]

## 已完成步骤
1. [步骤1]
2. [步骤2]
...

## 当前状态
[当前进展到哪一步，遇到什么问题]

## 下一步计划
[接下来应该做什么]

## 关键上下文
[需要记住的重要信息：文件路径、变量名、配置值等]

用中文回答，控制在 300 字以内。
`

async function collapse(messages: ChatMessage[], ...): Promise<ChatMessage[]> {
  // ... 
  const summary = await generateLLMSummary(
    toSummarize, 
    STRUCTURED_SUMMARY_INSTRUCTION
  )
  
  // 包装为带标记的消息
  return [
    {
      role: 'user',
      content: `[对话摘要]\n${summary}\n[/对话摘要]`,
      isMeta: true,
    },
    ...recentMessages,
  ]
}
```

**验证方式**：
- 人工审查生成的摘要格式
- 对比压缩前后的任务完成率

---

#### B2: L4 独立会话隔离 (G6)

**现状问题**：
- L4 摘要 LLM 可能调用工具，触发递归风险

**改进方案**：
```typescript
async function autoCompact(
  messages: ChatMessage[], 
  context: ToolContext
): Promise<ChatMessage[]> {
  // 启动独立子 agent，禁用所有工具
  const summaryAgent = await context.agentRuntime.spawnSubagent({
    sessionId: `${context.sessionId}_autocompact_${Date.now()}`,
    allowedTools: [],  // 空工具集
    messages: [
      { role: 'user', content: STRUCTURED_SUMMARY_INSTRUCTION },
      ...messages,
    ],
  })
  
  const summary = await summaryAgent.run()
  
  // 子 agent 完成后自动清理
  await summaryAgent.dispose()
  
  return [
    { role: 'user', content: `[全量重写摘要]\n${summary}\n[/全量重写摘要]`, isMeta: true },
  ]
}
```

**注意**：
- 需要先实现 `spawnSubagent` API（或复用现有 `delegate_task` 工具的底层逻辑）
- 如果实现成本过高，可暂时跳过（当前 `querySource` 防护已覆盖主要风险）

**验证方式**：
- 单测：模拟 L4 触发，确认摘要过程无工具调用
- 确认子 agent 资源正确清理

---

#### B3: Compact boundary marker (G12)

**现状问题**：
- 压缩后的消息序列无法与未压缩区分
- 调试和 transcript 回放困难

**改进方案**：
```typescript
interface CompactBoundaryMessage extends ChatMessage {
  role: 'system'
  content: '[COMPACT_BOUNDARY]'
  metadata: {
    compactedAt: number  // timestamp
    preCompactTokens: number
    postCompactTokens: number
    level: 'L1_Snip' | 'L2_MicroCompact' | 'L3_Collapse' | 'L4_AutoCompact'
    trigger: 'proactive' | 'reactive_413'
  }
}

function insertBoundaryMarker(
  level: string,
  preTokens: number,
  postTokens: number,
  trigger: string,
): CompactBoundaryMessage {
  return {
    role: 'system',
    content: '[COMPACT_BOUNDARY]',
    metadata: {
      compactedAt: Date.now(),
      preCompactTokens: preTokens,
      postCompactTokens: postTokens,
      level,
      trigger,
    },
  }
}

// 在每次压缩后插入
async function collapse(...): Promise<ChatMessage[]> {
  const preTokens = estimateTokens(messages)
  const result = [...summaryMsg, ...recentMessages]
  const postTokens = estimateTokens(result)
  
  return [
    insertBoundaryMarker('L3_Collapse', preTokens, postTokens, 'proactive'),
    ...result,
  ]
}
```

**验证方式**：
- Debug Panel 展示 boundary marker
- Transcript 导出时包含压缩元数据

---

### Phase C: 边界完善（P1 边界，建议做）

#### C1: PTL 重试循环 (G7)

**现状问题**：
- 压缩调用本身遇到 413 时无重试机制

**改进方案**：
```typescript
const MAX_PTL_RETRIES = 3
const PTL_RETRY_MARKER = '[earlier conversation truncated for compaction retry]'

async function generateLLMSummary(
  messages: ChatMessage[],
  instruction: string,
): Promise<string> {
  let attempts = 0
  let toSummarize = [...messages]
  
  while (attempts <= MAX_PTL_RETRIES) {
    try {
      const response = await llm.streamChat({
        messages: [
          { role: 'user', content: instruction },
          ...toSummarize,
        ],
        querySource: 'compact',
      })
      
      return extractText(response)
    } catch (error) {
      if (!is413Error(error) || attempts >= MAX_PTL_RETRIES) {
        throw error
      }
      
      // 截断最旧的 20%
      const dropCount = Math.max(1, Math.floor(toSummarize.length * 0.2))
      toSummarize = [
        { role: 'user', content: PTL_RETRY_MARKER, isMeta: true },
        ...toSummarize.slice(dropCount),
      ]
      
      attempts++
      log.warn(`Compact PTL retry ${attempts}/${MAX_PTL_RETRIES}`)
    }
  }
  
  throw new Error('Compact failed after max PTL retries')
}
```

**验证方式**：
- 构造超长会话（150K+ tokens）触发 PTL
- 确认重试后成功压缩

---

#### C2: 动态阈值调整 (G10)

**现状问题**：
- 阈值硬编码，不适配不同模型的 context window

**改进方案**：
```typescript
interface ModelConfig {
  contextWindow: number  // 实际窗口
  reservedTokens: number  // 预留给输出的 tokens
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'claude-3-5-sonnet-20241022': { contextWindow: 200_000, reservedTokens: 8_000 },
  'claude-3-5-haiku-20241022': { contextWindow: 200_000, reservedTokens: 8_000 },
  'gemini-2.0-flash-exp': { contextWindow: 1_000_000, reservedTokens: 8_000 },
  'deepseek-chat': { contextWindow: 64_000, reservedTokens: 4_000 },
}

function getEffectiveContextWindow(model: string): number {
  const config = MODEL_CONFIGS[model] ?? { contextWindow: 120_000, reservedTokens: 8_000 }
  return config.contextWindow - config.reservedTokens
}

class ContextManager {
  constructor(model: string) {
    this.maxTokens = getEffectiveContextWindow(model)
    this.l1Threshold = this.maxTokens * 0.60
    this.l2Threshold = this.maxTokens * 0.75
    this.l3Threshold = this.maxTokens * 0.90
    this.l4Threshold = this.maxTokens * 0.95
  }
  
  // ...
}
```

**验证方式**：
- 切换不同模型，确认阈值自动调整
- 单测覆盖已知模型配置

---

### Phase D: 性能优化（P2，按需做）

暂缓以下 4 项：
- **G2**: L2 去重逻辑优化（当前已满足基本需求）
- **G5**: Image/document 剥离（当前无 multimodal 支持）
- **G8**: Prompt cache 复用（依赖 forked agent 实现）
- **G9**: Post-compact hooks（暂无扩展需求）
- **G13**: Token 估算精度（偏差可接受）

---

## 三、实施顺序建议

### 推荐路径（分 3 次迭代）

**迭代 1: 正确性（Phase A）**
- A1 + A2 + A3，约 200 行代码
- 补充 3 个单测 + 1 个 E2E
- **验收标准**：无 P0 正确性问题

**迭代 2: 体验核心（Phase B）**
- B1 + B3，约 150 行代码（跳过 B2，实现成本高）
- 补充 2 个单测
- **验收标准**：摘要质量显著提升 + 可观测性增强

**迭代 3: 边界完善（Phase C）**
- C1 + C2，约 180 行代码
- 补充 2 个单测
- **验收标准**：极长会话无崩溃

---

## 四、实施风险与缓解

### 风险 1: Phase B2 实现成本高
**缓解**: 
- 当前 `querySource` 防护已覆盖主要递归风险
- 可暂缓，等 subagent 系统成熟后再实现

### 风险 2: Phase A2 文件恢复可能引入 token 膨胀
**缓解**:
- 严格限制 `maxFiles=5` + `maxTotalTokens=50K`
- 单文件截断到 5K tokens

### 风险 3: 测试覆盖不足
**缓解**:
- 每个 Phase 必须补充单测
- E2E 覆盖完整压缩流程

---

## 五、成功标准

**Phase A（正确性）**:
- ✅ 长任务中用户任务说明不被误删
- ✅ 压缩后无重复文件读取
- ✅ 熔断后对话可继续

**Phase B（体验）**:
- ✅ 摘要格式结构化，模型理解准确
- ✅ Debug Panel 可查看压缩边界

**Phase C（边界）**:
- ✅ 150K+ tokens 会话压缩成功
- ✅ 多模型自动适配阈值

---

## 六、需要确认的问题

请确认以下决策：

1. **Phase B2（L4 独立会话）是否实施？**
   - ✅ 实施 — 需要先实现 subagent API（约 2 小时）
   - ⏸️ 暂缓 — 当前 querySource 防护已足够

2. **Phase A2 文件恢复的 token 限制是否合理？**
   - 提议：maxFiles=5, maxTotalTokens=50K
   - 是否需要调整？

3. **Phase C 是否必须在本次迭代完成？**
   - ✅ 必须 — 极长会话是实际场景
   - ⏸️ 暂缓 — 先做 A+B，C 后续优化

---

**方案完成时间**: 2026-07-02 23:55  
**待用户确认后进入 Phase A 编码**

# M7：可观测性工程化方法论 — 代码走读

> 本文档对照 [`m07-observability.md`](m07-observability.md) 的认知框架，展示真实代码实现。
> 代码来源：my-agent `electron/main/utils/tracer.ts` × `agent/loop.ts` × `agent/runtime.ts` × `index.ts`
> 所有代码块逐行注释，阐释设计意图与方法论对照。

---

## 推论组 A：怎么划分「一步」

### §三 SpanType — 七种 Span 类型定义

```typescript
// electron/main/utils/tracer.ts

/**
 * Span 类型 — 对照 CC sessionTracing.ts 的 SpanType。
 * blocked_on_user vs execution 分离是 Alice Ch.13 的核心要求。
 * → m07 §三
 */
export type SpanType =
  | 'interaction'      // 一次完整的用户对话（顶层容器，包含所有子 span）
  | 'llm_request'      // 单次 LLM API 调用（最贵的操作）
  | 'tool'             // 工具调用（包含 blocked + execution 两个子 span）
  | 'tool_blocked'     // 等待用户确认的时间（独立计时，→ m07 §五）
  | 'tool_execution'   // 工具实际执行的时间（独立计时，→ m07 §五）
  | 'compress'         // 上下文压缩事件
  | 'subagent'         // 子 Agent 执行

export type SpanCaller =
  | 'main'      // 主对话
  | 'compact'   // 上下文压缩
  | 'memory'    // 记忆系统
  | 'title'     // 标题生成
  | 'subagent'  // 子 Agent
  | 'tool'      // 工具执行
  | 'profile'   // 画像提取
  | 'system'    // 系统初始化

export interface TraceSpan {
  id: string
  name: string
  type: SpanType
  caller: SpanCaller
  parentId?: string           // 父 span ID（形成调用链树，→ m07 §四）
  startTime: number
  endTime?: number
  duration?: number           // undefined = span 未结束；0 = span 立即结束（合法值！）
  status: 'running' | 'ok' | 'error'
  attributes: Record<string, unknown>  // 元数据（不记内容，→ m07 §八）
  error?: string
}
```

---

### §四 父子嵌套 — startSpan + SpanHandle

```typescript
// electron/main/utils/tracer.ts

const MAX_SPANS = 500           // 内存中最多保留 500 条（FIFO，旧 span 被剪裁）
const spans: TraceSpan[] = []   // 所有 span 的内存缓冲

/**
 * 开始一个 Span — 返回 SpanHandle 用于结束。
 * → m07 §四
 */
export function startSpan(
  name: string,
  caller: SpanCaller,
  type: SpanType = 'interaction',
  parentId?: string,                       // 传入父 span ID → 形成父子关系
  attributes: Record<string, unknown> = {},
): SpanHandle {
  const span: TraceSpan = {
    id: generateSpanId(),                  // span-{counter}-{timestamp36}
    name,
    type,
    caller,
    parentId,                              // 挂载到父 span（undefined = 顶层 span）
    startTime: Date.now(),
    status: 'running',
    attributes,
  }

  spans.push(span)
  if (spans.length > MAX_SPANS) {
    spans.splice(0, spans.length - MAX_SPANS)  // 超出上限时剪掉最旧的
  }

  return new SpanHandle(span)
}

export class SpanHandle {
  constructor(private span: TraceSpan) {}

  get id(): string { return this.span.id }

  /** 设置单个元数据属性（如 model / toolName） */
  setAttribute(key: string, value: unknown): void {
    this.span.attributes[key] = value
  }

  /** 批量设置元数据属性 */
  setAttributes(attrs: Record<string, unknown>): void {
    Object.assign(this.span.attributes, attrs)
  }

  /**
   * 结束 span — 记录耗时和状态。
   * duration=0 是合法值（span 在同一毫秒开始和结束），不应被过滤。
   */
  end(status: 'ok' | 'error' = 'ok', error?: string): void {
    this.span.endTime = Date.now()
    this.span.duration = this.span.endTime - this.span.startTime  // 可以是 0
    this.span.status = status
    if (error) this.span.error = error
    log.debug(`Span ${this.span.name} [${this.span.type}/${this.span.caller}]`, {
      duration: this.span.duration,
      status,
    })
  }
}
```

---

### §四 调用链树的组装 — runtime.ts 传 interactionSpanId（M7 关键修复）

```typescript
// electron/main/agent/runtime.ts

// ① 创建顶层 interaction span（对话级别的容器）
const chatSpan = startSpan('chat', 'main', 'interaction', undefined, {
  sessionId,
  model: llmConfig.model,
})

// ② 把 chatSpan.id 传给 agentLoop → loop 内的子 span 都以此为 parentId
const stream = agentLoop(
  {
    config: llmConfig,
    messages,
    tools: toolRegistry.getAll(),
    // ... 其他选项
    interactionSpanId: chatSpan.id,  // M7 补完的一根线：传入父 span ID
  },
  toolRegistry,
)
```

```typescript
// src/shared/types.ts — AgentLoopOptions

export interface AgentLoopOptions {
  // ... 其他字段
  /** 父 interaction span ID，用于将 loop 内的子 span 挂在同一棵调用链树下 */
  interactionSpanId?: string  // M7 新增
}
```

```typescript
// electron/main/agent/loop.ts — LoopState

interface LoopState {
  messages: ChatMessage[]
  // ... 其他字段
  /** 父 interaction span ID，用于嵌套子 span */
  interactionSpanId?: string  // M7 新增：从 options 传入，初始化时赋值
}

// LoopState 初始化
const state: LoopState = {
  messages: [...],
  // ...
  interactionSpanId,  // 从 options 解构，挂载父 span ID
}
```

**方法论对照 → m07 §四**：M7 之前调用链树的三个组成部分（tracer 基础设施、loop 埋点、runtime 入口）已经各自存在，但 runtime 没有把 interaction span ID 传给 loop，导致所有子 span 的 parentId 是 undefined，无法还原树形结构。这一修复让三个部分连通。

---

## 推论组 B：哪些时间维度必须分离计量

### §五 blocked_on_user vs execution — 两种等待分开计时

```typescript
// electron/main/agent/loop.ts

// ── Act: 执行工具 ──

for (const call of toolCalls) {
  let args: Record<string, unknown> = {}
  try { args = JSON.parse(call.arguments || '{}') } catch { /* registry handles */ }
  parsedArgs.set(call.id, args)

  const permResult = checkToolPermission(call.name)

  const needsConfirm =
    executionMode === 'confirm-all' ||
    permResult.allowed === 'needs_approval' ||
    ((executionMode === 'auto' || executionMode === 'plan-first') && registry.get(call.name)?.metadata.isDestructive)

  if (needsConfirm && confirmTool) {
    // ① G2: blocked_on_user 独立计时 — Alice Ch.13 核心要求（→ m07 §五）
    // 这段时间是"用户看到弹窗但还没点"，不反映 Agent 的能力
    const blockedSpan = startSpan(
      `blocked_${call.name}`,
      'tool',
      'tool_blocked',
      state.interactionSpanId,  // 父 span = 顶层 interaction
      { toolName: call.name },
    )
    yield { type: 'tool_confirm', callId: call.id, name: call.name, args }
    const approved = await confirmTool(call.name, args)  // ← 等待用户点击
    blockedSpan.setAttribute('decision', approved ? 'approved' : 'denied')
    blockedSpan.end('ok')
    // blocked_on_user span 在用户点击后立即结束
  }
}

// 为每个 pending 工具创建 tool span
const toolSpans = new Map<string, SpanHandle>()
for (const call of pendingCalls) {
  // ② tool span 是 blocked + execution 的父容器
  const toolSpan = startSpan(
    `tool_${call.name}`,
    'tool',
    'tool',
    state.interactionSpanId,
    { toolName: call.name },
  )
  toolSpans.set(call.id, toolSpan)
  yield { type: 'tool_start', callId: call.id, name: call.name, args: parsedArgs.get(call.id)! }
}

// ③ tool_execution span 只覆盖工具实际执行时间（不含用户等待）
const execSpan = startSpan(
  'tool_batch_exec',
  'tool',
  'tool_execution',
  state.interactionSpanId,
  { batchSize: pendingCalls.length, toolNames: pendingCalls.map(c => c.name).join(',') },
)
const batchResults = await registry.executeAll(pendingCalls, toolContext)  // ← 真正执行
execSpan.end('ok')
```

**方法论对照 → m07 §五**：三个 span 的时间区间不重叠：
- `tool_blocked`：弹窗显示 → 用户点击（纯等待时间）
- `tool_execution`：开始执行 → 执行完成（纯机器时间）
- `tool`：包含上述两者的容器 span

---

### §六 caller 分类 + token 归因 — llm_request span

```typescript
// electron/main/agent/loop.ts

// ① 在 LLM 调用前创建 llm_request span（带 caller 标记）
const llmSpan = startSpan(
  `llm_request_t${state.turnCount}`,
  'main',                        // caller = 'main'（主对话，对比 'compact'/'profile'/'title'）
  'llm_request',
  state.interactionSpanId,       // 父 span = 顶层 interaction
  {
    model: config.model,         // 记录哪个模型（用于成本分析）
    turn: state.turnCount,       // 第几轮（排查超限等问题）
  }
)

// ② LLM 调用完成后，记录 token 使用量（Phase C）
llmSpan.setAttributes({
  inputTokens: result.usage?.promptTokens ?? 0,       // 输入 token 数（成本归因）
  outputTokens: result.usage?.completionTokens ?? 0,  // 输出 token 数
  attempt: attempt,                                   // 第几次重试（诊断重试频率）
  stopReason: stopReason ?? 'unknown',               // 停止原因（max_tokens = 截断）
  toolCallCount: toolCalls.length,                   // 本轮工具调用数
})
llmSpan.end('ok')
```

```typescript
// electron/main/utils/tracer.ts — getCallerStats()

/** 获取按 caller 分类的耗时 + token 统计 */
export function getCallerStats(): Record<SpanCaller, {
  count: number
  totalMs: number
  avgMs: number
  totalInputTokens: number
  totalOutputTokens: number
}> {
  const stats: Record<string, { count: number; totalMs: number; totalInputTokens: number; totalOutputTokens: number }> = {}

  for (const span of spans) {
    if (span.duration === undefined) continue  // ① 跳过未结束的 span（注意：duration=0 是合法值）
    if (!stats[span.caller]) {
      stats[span.caller] = { count: 0, totalMs: 0, totalInputTokens: 0, totalOutputTokens: 0 }
    }
    const s = stats[span.caller]
    s.count++
    s.totalMs += span.duration

    // ② 只有 llm_request span 才有 token 数据
    if (span.type === 'llm_request') {
      if (typeof span.attributes.inputTokens === 'number') s.totalInputTokens += span.attributes.inputTokens
      if (typeof span.attributes.outputTokens === 'number') s.totalOutputTokens += span.attributes.outputTokens
    }
  }

  const result: Record<string, any> = {}
  for (const [caller, s] of Object.entries(stats)) {
    result[caller] = { ...s, avgMs: Math.round(s.totalMs / s.count) }  // ③ 计算平均耗时
  }
  return result as Record<SpanCaller, any>
}
```

**方法论对照 → m07 §六**：DevPanel 调用 `getCallerStats()` 可以看到：

```
caller: 'main'    → count: 15, avgMs: 2300ms, totalInputTokens: 45000
caller: 'compact' → count: 3,  avgMs: 1200ms, totalInputTokens: 18000
caller: 'title'   → count: 1,  avgMs: 600ms,  totalInputTokens: 500
```

---

### §七 启动性能 marks — index.ts 关键节点打点

```typescript
// electron/main/utils/tracer.ts

const processStartTime = Date.now()  // 进程启动时间（模块被 import 时记录）

export interface StartupMark {
  name: string
  timestamp: number      // 绝对时间戳
  relativeMs: number     // 相对进程启动的毫秒数
}

/**
 * 记录启动性能打点 — Alice Ch.13 startup marks。
 * 在关键初始化节点调用，记录相对进程启动的耗时。
 * → m07 §七
 */
export function mark(name: string): void {
  const now = Date.now()
  startupMarks.push({
    name,
    timestamp: now,
    relativeMs: now - processStartTime,  // 从进程启动到这里花了多少 ms
  })
  log.debug(`Startup mark: ${name}`, { relativeMs: now - processStartTime })
}
```

```typescript
// electron/main/index.ts — 在关键初始化节点打 mark

import { mark } from './utils/tracer'

mark('imports_done')  // 主进程模块全部 import 完成（进程启动后的第一个 mark）

// ... 工具注册 ...
mark('tools_ready')   // 工具注册表初始化完成

// ... window 创建 ...

app.whenReady().then(async () => {
  await createWindow()

  // ... MCP 连接 ...
  restoreMcpConnections().then(() => mark('mcp_ready'))   // MCP 连接完成（可能最慢）

  mark('window_shown')  // 窗口显示给用户（用户感知的"启动完成"）
})
```

```typescript
// electron/main/ipc/debug.ts — 暴露给 DevPanel

import { getRecentSpans, getCallerStats, getStartupMarks, getSpanTypeStats } from '../utils/tracer'

ipcMain.handle('debug:traces', () => {
  return {
    spans: getRecentSpans(100),     // 最近 100 条 span
    callerStats: getCallerStats(),  // 按 caller 聚合的耗时 + token
    startupMarks: getStartupMarks(), // ← 启动打点（M7 新增）
    dailyTokenUsage: getDailyUsage(),
  }
})
```

---

## 推论组 C：可观测性的边界与代价

### §八 隐私默认保守 — attributes 只记元数据

```typescript
// ✅ 正确：只记元数据（模型名、token 数、耗时维度）
llmSpan.setAttributes({
  model: config.model,                       // 模型名（不是内容）
  inputTokens: result.usage?.promptTokens,   // token 数量（不是 Prompt 文本）
  outputTokens: result.usage?.completionTokens,
  turn: state.turnCount,                     // 第几轮（不是消息内容）
  stopReason: stopReason,                    // 停止原因（不是 LLM 回复文本）
})

// ❌ 错误：记录内容（可能包含敏感信息）
// llmSpan.setAttribute('prompt', systemPrompt)    // 不记！Prompt 可能有 API key
// llmSpan.setAttribute('response', content)      // 不记！LLM 回复可能有用户私密信息
// toolSpan.setAttribute('args', JSON.stringify(args))  // 不记！工具参数可能有文件路径/内容
```

**方法论对照 → m07 §八**：属性只记"量"（多少 token、多少毫秒），不记"内容"（Prompt 文字、工具参数、LLM 回复）。

---

### §九 轻量实现 — 不引入 OTel SDK

```typescript
// 我们的 SpanHandle vs OTel Span（概念对照）

// OTel SDK 写法：
// import { trace } from '@opentelemetry/api'
// const tracer = trace.getTracer('my-agent')
// const span = tracer.startSpan('llm_request')
// span.setAttribute('model', config.model)
// span.end()

// 我们的写法（等价但不依赖 OTel SDK）：
const span = startSpan('llm_request', 'main', 'llm_request', parentId, { model: config.model })
span.end('ok')

// 概念映射：
// OTel Span   → TraceSpan
// OTel Tracer → startSpan() 函数
// OTel Context → parentId 字段（手动传递，而非 context propagation）
// OTel Exporter → DevPanel 通过 getRecentSpans() 读取（本地展示，无远程导出）
```

---

## 关键设计总结

### 1. 断点修复：三处改动接上调用链树

```
修复前：
runtime.ts：chatSpan = startSpan(...)   ← 创建了 interaction span
loop.ts：   startSpan(..., state.interactionSpanId)   ← interactionSpanId = undefined!
 └─ 所有子 span 的 parentId = undefined，调用链树没有形成

修复后：
types.ts：  AgentLoopOptions 加 interactionSpanId?: string
runtime.ts：agentLoop({ ..., interactionSpanId: chatSpan.id })  ← 传入
loop.ts：   const state = { ..., interactionSpanId }  ← 初始化时赋值
 └─ 子 span.parentId = interaction span 的 id，树形结构形成 ✅
```

### 2. duration=0 是合法值

```typescript
// ❌ 错误：!span.duration 会把 duration=0 也过滤掉
if (!span.duration) continue

// ✅ 正确：只过滤未结束的 span
if (span.duration === undefined) continue
```

场景：span 开始和结束在同一毫秒（常见于同步操作），duration=0 是合法的测量结果，不应被跳过。

### 3. 调用链树的查询方式

DevPanel 从 `debug:traces` 拿到扁平的 span 数组，按 parentId 还原树形结构：

```
// 扁平 span 列表：
[
  { id: 'span-1', type: 'interaction', parentId: undefined },
  { id: 'span-2', type: 'llm_request', parentId: 'span-1' },
  { id: 'span-3', type: 'tool_blocked', parentId: 'span-1' },
  { id: 'span-4', type: 'tool', parentId: 'span-1' },
  { id: 'span-5', type: 'tool_execution', parentId: 'span-1' },
  { id: 'span-6', type: 'compress', parentId: 'span-1' },
]

// 还原后的树：
interaction (span-1, 根节点)
├── llm_request (span-2)
├── tool_blocked (span-3)
├── tool (span-4)
├── tool_execution (span-5)
└── compress (span-6)
```

G5（DevPanel 树状视图）的前端实现只需按 parentId 分组渲染，数据模型已经完备。

---

**全文完** — 对照 [`m07-observability.md`](m07-observability.md) 认知框架阅读。

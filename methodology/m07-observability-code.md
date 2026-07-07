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

## G4：日志文件落盘（§十 补做）

对照产品文档 §二（OTel 三信号里的 Logs）+ §十 G4。核心诉求：日志不能只在 console，关窗口就没了；要落盘、按日期轮转、且不破坏 44 个现有调用方。

### 1. 惰性初始化 + 降级不崩

```typescript
import { appendFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

let logDir: string | null = null                   // null = 不落盘（未解析或降级）
let logDirResolved = false                          // 是否已尝试解析（失败也只试一次）

function resolveLogDir(): string | null {
  if (logDirResolved) return logDir                 // ① 只解析一次，失败后不反复重试
  logDirResolved = true
  try {
    // ② require 而非顶部 import——electron 在纯 Node 测试环境里 require 会抛，
    //    抛了就走 catch 降级，不污染模块加载
    const { app } = require('electron') as typeof import('electron')
    const dir = join(app.getPath('logs'), 'my-agent')  // ③ Electron 官方日志目录下开子目录
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    logDir = dir
    cleanupOldLogs(dir)                             // ④ 首次解析成功时顺带清理过期日志
  } catch {
    logDir = null                                   // ⑤ 降级：非 Electron 环境（vitest / 纯 Node）跳过落盘
  }
  return logDir
}
```

**关键设计**：`resolveLogDir()` 返回 `null` 时，落盘整段跳过，console 照常输出。这是"44 个调用方 + 所有测试零改动"的根基——测试环境没有 Electron app，`require('electron')` 或 `app.getPath` 会失败，落盘静默降级，logger 行为对测试完全透明。

> 为什么用 `require` 不用顶部 `import`：顶部 import electron 在 vitest 里会在**模块加载期**就抛（还没进 try/catch），导致整个 logger 模块 import 失败，44 个调用方全崩。放进函数体内 `require` + try/catch，失败被局部捕获。

### 2. 落盘与 console 并行（去 ANSI 颜色）

```typescript
function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[globalLevel]) return

  const time = new Date().toISOString().slice(11, 23)
  const color = LEVEL_COLORS[level]
  const prefix = `${color}[${time}] [${level.toUpperCase()}] [${module}]${RESET}`  // console 带颜色
  const plainPrefix = `[${time}] [${level.toUpperCase()}] [${module}]`             // ① 落盘去颜色码

  if (data && Object.keys(data).length > 0) {
    console.log(`${prefix} ${message}`, data)
    writeToFile(`${plainPrefix} ${message} ${safeStringify(data)}`)                // ② data 安全序列化
  } else {
    console.log(`${prefix} ${message}`)
    writeToFile(`${plainPrefix} ${message}`)
  }
}

function writeToFile(line: string): void {
  const dir = resolveLogDir()
  if (!dir) return                                  // ③ 降级：不落盘
  try {
    appendFileSync(currentLogFile(dir), line + '\n', 'utf-8')  // ④ 同步 append 保证顺序
  } catch { /* 落盘失败不影响 console 输出 */ }
}

function currentLogFile(dir: string): string {
  const date = new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
  return join(dir, `agent-${date}.log`)               // ⑤ 按日期分文件
}
```

**两个细节**：①**落盘去 ANSI 颜色码**——console 要颜色好看，但文件里 `\x1b[32m` 是乱码，落盘用 `plainPrefix`。②**`safeStringify` 兜底**——`data` 可能有循环引用或 BigInt，`JSON.stringify` 会抛，包一层 try/catch 返回 `[unserializable]`，不让日志序列化失败拖垮业务。

**为什么同步 `appendFileSync` 而非异步**：日志量不大，同步写避免异步回调乱序（多条日志并发写可能交错），也避免进程退出时丢未 flush 的日志。用异步会为了性能牺牲"日志顺序"这个日志最重要的属性。

### 3. 轮转：纯逻辑与副作用分离

```typescript
const MAX_LOG_DAYS = 7

// ① 纯函数：给定文件名列表，算出哪些该删——可单测，不碰文件系统
export function selectExpiredLogs(files: string[], maxDays: number = MAX_LOG_DAYS): string[] {
  const logs = files
    .filter(f => /^agent-\d{4}-\d{2}-\d{2}\.log$/.test(f))  // 只认自己的日志文件名
    .sort()                                                  // 文件名含日期，字典序 = 时间序
  if (logs.length <= maxDays) return []
  return logs.slice(0, logs.length - maxDays)                // 超出保留数的最旧的
}

// ② 副作用壳：读目录 + 删文件，调用上面的纯函数决策
function cleanupOldLogs(dir: string): void {
  try {
    const expired = selectExpiredLogs(readdirSync(dir))
    for (const f of expired) unlinkSync(join(dir, f))
  } catch { /* 清理失败无所谓，下次再试 */ }
}
```

**方法论对照**：这延续 M5 坑 2「难测＝逻辑和副作用耦合」。"哪些文件算过期"是纯逻辑，抽成 `selectExpiredLogs` 能直接喂假文件名单测；"读目录、删文件"是副作用，留在 `cleanupOldLogs` 壳里。测试只测纯函数，不碰真实文件系统。

**为什么按字典序而非时间比较**：文件名是 `agent-YYYY-MM-DD.log`，日期零填充后**字典序恰好等于时间序**，`.sort()` 后前面的就是最旧的。省掉了"解析日期字符串成时间戳再比较"的一步，也不依赖 `now`——纯粹按"保留最近 N 个"截断。

**安全细节**：正则 `^agent-\d{4}-\d{2}-\d{2}\.log$` 严格锚定自己的文件名——即使日志目录里混入别的文件（用户手动放的、其他程序的），也只删自己按日期命名的日志，不误删。

### 4. 脱敏为什么另算

落盘层目前**不过滤** `data` 里的敏感字段（API key / token）。§八 隐私原则要求"记元数据不记内容"，但强制脱敏需要在写盘前对 `data` 做递归字段扫描（识别 `sk-` 前缀、`apiKey`/`token`/`password` 键名），是独立一小块。当前先落地"能持久化"，脱敏作为后续独立任务——检查清单第 7 条留了锚点。

---

**全文完** — 对照 [`m07-observability.md`](m07-observability.md) 认知框架阅读。

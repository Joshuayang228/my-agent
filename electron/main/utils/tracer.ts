/**
 * 结构化 Tracing — 轻量级 Span 追踪系统。
 *
 * Alice 方法论 Ch.13：OTel Traces + caller 分类 + blocked_on_user vs execution 分离。
 * CC 参考：sessionTracing.ts 五种 SpanType + cost-tracker 按模型累计。
 *
 * 不引入完整 OTel SDK，实现兼容的 Span 模型：
 * - SpanType 分类（interaction/llm_request/tool/tool_blocked/tool_execution/compress/subagent）
 * - 嵌套 Span（parent-child）
 * - caller 分类（main/compact/memory/title/subagent/tool/profile/system）
 * - blocked_on_user vs execution 分离计时
 * - 启动性能 mark 打点
 * - token 维度按 caller 聚合
 * - 可导出到 DevPanel 和日志
 */

import { createLogger } from './logger'
import { shouldSampleSession } from './session-sampler'
import { captureAttributes, captureAttributeValue, captureErrorMessage } from './text-capture'
import { getTraceContext, traceContextAttributes } from './trace-context'

const log = createLogger('Tracer')

export type SpanCaller = 'main' | 'compact' | 'memory' | 'title' | 'subagent' | 'tool' | 'profile' | 'system'

/**
 * Span 类型 — 对照 CC sessionTracing.ts 的 SpanType。
 * blocked_on_user vs execution 分离是 Alice Ch.13 的核心要求。
 */
export type SpanType =
  | 'interaction'      // 一次完整的用户对话
  | 'llm_request'      // 单次 LLM API 调用
  | 'tool'             // 工具调用（包含 blocked + execution）
  | 'tool_blocked'     // 等待用户确认的时间（独立计时）
  | 'tool_execution'   // 工具实际执行的时间（独立计时）
  | 'compress'         // 上下文压缩事件
  | 'subagent'         // 子 Agent 执行

export interface TraceSpan {
  id: string
  name: string
  type: SpanType
  caller: SpanCaller
  parentId?: string
  /**
   * 因果链接（非父子）：后台任务指向主对话 span。
   * 对照 OTel Span Links / 灵犀 StartLinkedAsyncSpan——不拉长主 trace 耗时。
   */
  links?: string[]
  startTime: number
  endTime?: number
  duration?: number
  status: 'running' | 'ok' | 'error'
  attributes: Record<string, unknown>
  error?: string
}

/** 启动性能打点 — Alice Ch.13 startup marks */
export interface StartupMark {
  name: string
  timestamp: number
  relativeMs: number   // 相对进程启动的毫秒数
}

const MAX_SPANS = 500
const spans: TraceSpan[] = []
let spanCounter = 0

const processStartTime = Date.now()
const startupMarks: StartupMark[] = []

function generateSpanId(): string {
  return `span-${++spanCounter}-${Date.now().toString(36)}`
}

/**
 * 开始一个 Span — 返回 SpanHandle 用于结束。
 *
 * Identity 自动注入优先级（后者覆盖前者）：
 * 1. AsyncLocalStorage TraceContext（wishlist：无需手动传参）
 * 2. 父 span attributes（parentId 树内继承）
 * 3. 本次显式 attributes
 *
 * 对照 lingxi observability/context.go: With../From.. 系列。
 */
export function startSpan(
  name: string,
  caller: SpanCaller,
  type: SpanType = 'interaction',
  parentId?: string,
  attributes: Record<string, unknown> = {},
): SpanHandle {
  const fromContext = traceContextAttributes()
  const inherited: Record<string, unknown> = {}
  if (parentId) {
    const parentSpan = spans.find(s => s.id === parentId)
    if (parentSpan) {
      if (parentSpan.attributes.sessionId !== undefined) inherited.sessionId = parentSpan.attributes.sessionId
      if (parentSpan.attributes.userId !== undefined) inherited.userId = parentSpan.attributes.userId
    }
  }

  // 先合并再采样：保证同一 sessionId 整树收/丢（对照 session_sampler）
  const mergedAttrs = captureAttributes({ ...fromContext, ...inherited, ...attributes })
  const sessionId = typeof mergedAttrs.sessionId === 'string' ? mergedAttrs.sessionId : undefined

  const span: TraceSpan = {
    id: generateSpanId(),
    name,
    type,
    caller,
    parentId,
    startTime: Date.now(),
    status: 'running',
    attributes: mergedAttrs,
  }

  if (!shouldSampleSession(sessionId)) {
    // 仍返回真实 id，供 interactionSpanId / parentId 接线；不入环形缓冲
    return new SpanHandle(span, { dropped: true })
  }

  spans.push(span)
  if (spans.length > MAX_SPANS) {
    spans.splice(0, spans.length - MAX_SPANS)
  }

  return new SpanHandle(span)
}

/**
 * 后台异步任务用的 linked span：无 parentId（不并入主对话耗时树），
 * 通过 links 指向主 interaction span（可追溯）。
 */
export function startLinkedAsyncSpan(
  name: string,
  caller: SpanCaller,
  opts?: {
    /** 显式链接目标；默认取 TraceContext.interactionSpanId */
    linkToSpanId?: string
    type?: SpanType
    attributes?: Record<string, unknown>
  },
): SpanHandle {
  const linkTo = (opts?.linkToSpanId || getTraceContext().interactionSpanId || '').trim()
  const handle = startSpan(
    name,
    caller,
    opts?.type ?? 'interaction',
    undefined,
    {
      asyncLinked: true,
      ...(linkTo ? { linkedTo: linkTo } : {}),
      ...(opts?.attributes ?? {}),
    },
  )
  if (linkTo && !handle.dropped) {
    const span = spans.find((s) => s.id === handle.id)
    if (span) span.links = [linkTo]
  }
  return handle
}

export class SpanHandle {
  /** 未采样会话：句柄可用但不进入 getRecentSpans */
  readonly dropped: boolean

  constructor(
    private span: TraceSpan,
    opts?: { dropped?: boolean },
  ) {
    this.dropped = opts?.dropped === true
  }

  get id(): string {
    return this.span.id
  }

  setAttribute(key: string, value: unknown): void {
    if (this.dropped) return
    this.span.attributes[key] = captureAttributeValue(key, value)
  }

  /** 批量设置属性（含 PII 脱敏与文本预算） */
  setAttributes(attrs: Record<string, unknown>): void {
    if (this.dropped) return
    Object.assign(this.span.attributes, captureAttributes(attrs))
  }

  end(status: 'ok' | 'error' = 'ok', error?: string): void {
    if (this.dropped) return
    this.span.endTime = Date.now()
    this.span.duration = this.span.endTime - this.span.startTime
    this.span.status = status
    if (error) this.span.error = captureErrorMessage(error)

    log.debug(`Span ${this.span.name} [${this.span.type}/${this.span.caller}]`, {
      duration: this.span.duration,
      status,
      ...this.span.attributes,
    })
  }
}

// ── 启动性能 Mark ──

/**
 * 记录启动性能打点 — Alice Ch.13 startup marks。
 * 在关键初始化节点调用，记录相对进程启动的耗时。
 */
export function mark(name: string): void {
  const now = Date.now()
  startupMarks.push({
    name,
    timestamp: now,
    relativeMs: now - processStartTime,
  })
  log.debug(`Startup mark: ${name}`, { relativeMs: now - processStartTime })
}

/** 获取所有启动打点 */
export function getStartupMarks(): StartupMark[] {
  return [...startupMarks]
}

// ── 查询 API ──

/** 获取最近的 Span 列表（用于 DevPanel 展示） */
export function getRecentSpans(limit = 100): TraceSpan[] {
  return spans.slice(-limit)
}

/** 获取按 caller 分类的耗时 + token 统计 */
export function getCallerStats(): Record<SpanCaller, {
  count: number
  totalMs: number
  avgMs: number
  totalInputTokens: number
  totalOutputTokens: number
}> {
  const stats: Record<string, {
    count: number
    totalMs: number
    totalInputTokens: number
    totalOutputTokens: number
  }> = {}

  for (const span of spans) {
    if (span.duration === undefined) continue  // 只跳过未结束的 span（duration=0 是合法的）
    if (!stats[span.caller]) {
      stats[span.caller] = { count: 0, totalMs: 0, totalInputTokens: 0, totalOutputTokens: 0 }
    }
    const s = stats[span.caller]
    s.count++
    s.totalMs += span.duration

    // 从 llm_request span 的 attributes 里提取 token 统计
    if (span.type === 'llm_request') {
      const inputTokens = span.attributes.inputTokens
      const outputTokens = span.attributes.outputTokens
      if (typeof inputTokens === 'number') s.totalInputTokens += inputTokens
      if (typeof outputTokens === 'number') s.totalOutputTokens += outputTokens
    }
  }

  const result: Record<string, {
    count: number
    totalMs: number
    avgMs: number
    totalInputTokens: number
    totalOutputTokens: number
  }> = {}
  for (const [caller, s] of Object.entries(stats)) {
    result[caller] = { ...s, avgMs: Math.round(s.totalMs / s.count) }
  }

  return result as Record<SpanCaller, {
    count: number
    totalMs: number
    avgMs: number
    totalInputTokens: number
    totalOutputTokens: number
  }>
}

/** 按 SpanType 分类的统计 */
export function getSpanTypeStats(): Record<SpanType, { count: number; totalMs: number; avgMs: number }> {
  const stats: Record<string, { count: number; totalMs: number }> = {}

  for (const span of spans) {
    if (span.duration === undefined) continue  // 只跳过未结束的 span
    if (!stats[span.type]) {
      stats[span.type] = { count: 0, totalMs: 0 }
    }
    stats[span.type].count++
    stats[span.type].totalMs += span.duration
  }

  const result: Record<string, { count: number; totalMs: number; avgMs: number }> = {}
  for (const [type, s] of Object.entries(stats)) {
    result[type] = { ...s, avgMs: Math.round(s.totalMs / s.count) }
  }

  return result as Record<SpanType, { count: number; totalMs: number; avgMs: number }>
}

/**
 * M09：前后台 token 分离。
 * foreground = main 对话；background = 其余 caller（compact/memory/title/subagent/tool/profile/system）。
 */
export function getTokenLaneStats(): {
  foreground: { inputTokens: number; outputTokens: number }
  background: { inputTokens: number; outputTokens: number }
  byCaller: ReturnType<typeof getCallerStats>
} {
  const byCaller = getCallerStats()
  const sum = (keys: SpanCaller[]) => {
    let inputTokens = 0
    let outputTokens = 0
    for (const k of keys) {
      const s = byCaller[k]
      if (!s) continue
      inputTokens += s.totalInputTokens
      outputTokens += s.totalOutputTokens
    }
    return { inputTokens, outputTokens }
  }
  return {
    foreground: sum(['main']),
    background: sum(['compact', 'memory', 'title', 'subagent', 'tool', 'profile', 'system']),
    byCaller,
  }
}

/** 清空 Span 记录 */
export function clearSpans(): void {
  spans.length = 0
}

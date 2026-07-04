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
 */
export function startSpan(
  name: string,
  caller: SpanCaller,
  type: SpanType = 'interaction',
  parentId?: string,
  attributes: Record<string, unknown> = {},
): SpanHandle {
  const span: TraceSpan = {
    id: generateSpanId(),
    name,
    type,
    caller,
    parentId,
    startTime: Date.now(),
    status: 'running',
    attributes,
  }

  spans.push(span)
  if (spans.length > MAX_SPANS) {
    spans.splice(0, spans.length - MAX_SPANS)
  }

  return new SpanHandle(span)
}

export class SpanHandle {
  constructor(private span: TraceSpan) {}

  get id(): string {
    return this.span.id
  }

  setAttribute(key: string, value: unknown): void {
    this.span.attributes[key] = value
  }

  /** 批量设置属性 */
  setAttributes(attrs: Record<string, unknown>): void {
    Object.assign(this.span.attributes, attrs)
  }

  end(status: 'ok' | 'error' = 'ok', error?: string): void {
    this.span.endTime = Date.now()
    this.span.duration = this.span.endTime - this.span.startTime
    this.span.status = status
    if (error) this.span.error = error

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

/** 清空 Span 记录 */
export function clearSpans(): void {
  spans.length = 0
}

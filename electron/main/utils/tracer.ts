/**
 * 结构化 Tracing — 轻量级 Span 追踪系统。
 *
 * Alice 方法论 Ch.13：OTel Traces + caller 分类 + blocked_on_user vs execution 分离。
 *
 * 不引入完整 OTel SDK，实现兼容的 Span 模型：
 * - 嵌套 Span（parent-child）
 * - caller 分类（main/compact/memory/title/subagent/tool）
 * - 耗时统计
 * - 可导出到 DevPanel 和日志
 */

import { createLogger } from './logger'

const log = createLogger('Tracer')

export type SpanCaller = 'main' | 'compact' | 'memory' | 'title' | 'subagent' | 'tool' | 'system'

export interface TraceSpan {
  id: string
  name: string
  caller: SpanCaller
  parentId?: string
  startTime: number
  endTime?: number
  duration?: number
  status: 'running' | 'ok' | 'error'
  attributes: Record<string, unknown>
  error?: string
}

const MAX_SPANS = 500
const spans: TraceSpan[] = []
let spanCounter = 0

function generateSpanId(): string {
  return `span-${++spanCounter}-${Date.now().toString(36)}`
}

/**
 * 开始一个 Span — 返回 SpanHandle 用于结束。
 */
export function startSpan(name: string, caller: SpanCaller, parentId?: string, attributes: Record<string, unknown> = {}): SpanHandle {
  const span: TraceSpan = {
    id: generateSpanId(),
    name,
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

  end(status: 'ok' | 'error' = 'ok', error?: string): void {
    this.span.endTime = Date.now()
    this.span.duration = this.span.endTime - this.span.startTime
    this.span.status = status
    if (error) this.span.error = error

    log.debug(`Span ${this.span.name} [${this.span.caller}]`, {
      duration: this.span.duration,
      status,
      ...this.span.attributes,
    })
  }
}

/** 获取最近的 Span 列表（用于 DevPanel 展示） */
export function getRecentSpans(limit = 100): TraceSpan[] {
  return spans.slice(-limit)
}

/** 获取按 caller 分类的耗时统计 */
export function getCallerStats(): Record<SpanCaller, { count: number; totalMs: number; avgMs: number }> {
  const stats: Record<string, { count: number; totalMs: number }> = {}

  for (const span of spans) {
    if (!span.duration) continue
    if (!stats[span.caller]) {
      stats[span.caller] = { count: 0, totalMs: 0 }
    }
    stats[span.caller].count++
    stats[span.caller].totalMs += span.duration
  }

  const result: Record<string, { count: number; totalMs: number; avgMs: number }> = {}
  for (const [caller, s] of Object.entries(stats)) {
    result[caller] = { ...s, avgMs: Math.round(s.totalMs / s.count) }
  }

  return result as Record<SpanCaller, { count: number; totalMs: number; avgMs: number }>
}

/** 清空 Span 记录 */
export function clearSpans(): void {
  spans.length = 0
}

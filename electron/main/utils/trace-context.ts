/**
 * Trace Context 传播（M14 / wishlist）
 *
 * 背景：仅靠 parentId 继承时，无父 span 的后台任务仍需手动塞 sessionId。
 * 意图：AsyncLocalStorage 承载 identity；startSpan 自动合并。
 * 对照：灵犀 observability/context.go 的 With../From.. 系列。
 */

import { AsyncLocalStorage } from 'node:async_hooks'

export interface TraceIdentity {
  sessionId?: string
  userId?: string
  /** 当前主对话 interaction span，供后台 linked span 追溯（非 parent） */
  interactionSpanId?: string
}

const als = new AsyncLocalStorage<TraceIdentity>()

/** 桌面单用户默认身份 */
export const DEFAULT_TRACE_USER_ID = 'local'

function stripEmpty(ctx: TraceIdentity): TraceIdentity {
  const out: TraceIdentity = {}
  if (ctx.sessionId?.trim()) out.sessionId = ctx.sessionId.trim()
  if (ctx.userId?.trim()) out.userId = ctx.userId.trim()
  if (ctx.interactionSpanId?.trim()) out.interactionSpanId = ctx.interactionSpanId.trim()
  return out
}

/**
 * 就地更新当前 ALS store（须已在 runWithTraceContext 内）。
 * 用于 chat 创建 interaction span 后写入 interactionSpanId。
 */
export function updateTraceContext(patch: TraceIdentity): void {
  const store = als.getStore()
  if (!store) return
  Object.assign(store, stripEmpty(patch))
}

/** 读取当前异步上下文中的 identity（无则空对象） */
export function getTraceContext(): TraceIdentity {
  return { ...(als.getStore() ?? {}) }
}

/**
 * 在回调内运行并传播 identity（同步 / 返回 Promise 均可）。
 * 与父上下文合并，显式字段覆盖。
 */
export function runWithTraceContext<T>(ctx: TraceIdentity, fn: () => T): T {
  const merged = { ...getTraceContext(), ...stripEmpty(ctx) }
  return als.run(merged, fn)
}

/**
 * 包装 AsyncGenerator：每次 next 都在同一 identity 上下文中执行，
 * 避免 yield 交还调用方后 ALS 丢失。
 */
export async function* runWithTraceContextAsyncGen<T>(
  ctx: TraceIdentity,
  factory: () => AsyncGenerator<T, void, unknown>,
): AsyncGenerator<T, void, unknown> {
  const merged = { ...getTraceContext(), ...stripEmpty(ctx) }
  const gen = factory()
  let nextInput: unknown
  while (true) {
    const step: IteratorResult<T, void> = await als.run(merged, () =>
      gen.next(nextInput),
    )
    if (step.done) return
    nextInput = yield step.value
  }
}

/** 供 startSpan 合并的扁平 attributes（仅含已设字段） */
export function traceContextAttributes(): Record<string, unknown> {
  const ctx = getTraceContext()
  const attrs: Record<string, unknown> = {}
  if (ctx.sessionId) attrs.sessionId = ctx.sessionId
  if (ctx.userId) attrs.userId = ctx.userId
  return attrs
}

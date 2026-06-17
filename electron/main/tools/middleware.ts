/**
 * Tool 中间件管道 — 可组合的工具执行拦截器。
 *
 * Alice 方法论 Ch.4：声明式契约驱动调度；WrapWithApproval；并发信号量；maxResultSizeChars。
 *
 * 中间件按注册顺序执行（洋葱模型），每个中间件可以：
 * - 修改参数 → 调用 next → 修改结果
 * - 直接返回结果（跳过后续中间件和工具执行）
 * - 抛出错误（中断执行）
 */

import type { ToolCall, ToolResult, ToolDefinition } from '../../../src/shared/types'
import { createLogger } from '../utils/logger'

const log = createLogger('ToolMiddleware')

export interface ToolExecutionContext {
  call: ToolCall
  tool: ToolDefinition
  args: Record<string, unknown>
}

export type ToolMiddlewareNext = (ctx: ToolExecutionContext) => Promise<ToolResult>

export type ToolMiddleware = (
  ctx: ToolExecutionContext,
  next: ToolMiddlewareNext,
) => Promise<ToolResult>

/**
 * 中间件管道 — 管理和执行中间件链。
 */
export class ToolMiddlewarePipeline {
  private middlewares: { name: string; fn: ToolMiddleware }[] = []

  use(name: string, middleware: ToolMiddleware): void {
    this.middlewares.push({ name, fn: middleware })
    log.debug('Middleware registered', { name, total: this.middlewares.length })
  }

  remove(name: string): boolean {
    const idx = this.middlewares.findIndex(m => m.name === name)
    if (idx >= 0) {
      this.middlewares.splice(idx, 1)
      return true
    }
    return false
  }

  /**
   * 构建执行函数 — 将中间件链和最终执行器组合成一个函数。
   */
  build(executor: ToolMiddlewareNext): ToolMiddlewareNext {
    let chain = executor
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const mw = this.middlewares[i]
      const next = chain
      chain = (ctx) => mw.fn(ctx, next)
    }
    return chain
  }

  get count(): number {
    return this.middlewares.length
  }
}

// ── 内置中间件 ──

/**
 * 日志中间件 — 记录工具调用的输入输出和耗时。
 */
export const loggingMiddleware: ToolMiddleware = async (ctx, next) => {
  const start = Date.now()
  log.info(`Tool call: ${ctx.call.name}`, {
    callId: ctx.call.id,
    argsKeys: Object.keys(ctx.args),
  })

  const result = await next(ctx)

  log.info(`Tool done: ${ctx.call.name}`, {
    callId: ctx.call.id,
    duration: Date.now() - start,
    isError: result.isError,
    resultLength: result.content.length,
  })

  return result
}

const MAX_RESULT_CHARS = 50_000
const TRUNCATION_MSG = '\n\n[Result truncated — original output exceeded 50,000 characters]'

/**
 * 结果截断中间件 — 大结果自动截断，防止上下文爆炸。
 */
export const resultTruncationMiddleware: ToolMiddleware = async (ctx, next) => {
  const result = await next(ctx)

  if (result.content.length > MAX_RESULT_CHARS) {
    log.warn('Tool result truncated', {
      tool: ctx.call.name,
      originalLength: result.content.length,
      truncatedTo: MAX_RESULT_CHARS,
    })
    return {
      ...result,
      content: result.content.slice(0, MAX_RESULT_CHARS) + TRUNCATION_MSG,
    }
  }

  return result
}

/**
 * 错误格式化中间件 — 统一错误消息格式。
 */
export const errorFormattingMiddleware: ToolMiddleware = async (ctx, next) => {
  try {
    return await next(ctx)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      callId: ctx.call.id,
      name: ctx.call.name,
      content: `[Tool Error] ${ctx.call.name}: ${message}`,
      isError: true,
    }
  }
}

/**
 * 创建默认中间件管道（包含所有内置中间件）。
 */
export function createDefaultPipeline(): ToolMiddlewarePipeline {
  const pipeline = new ToolMiddlewarePipeline()
  pipeline.use('error-formatting', errorFormattingMiddleware)
  pipeline.use('logging', loggingMiddleware)
  pipeline.use('result-truncation', resultTruncationMiddleware)
  return pipeline
}

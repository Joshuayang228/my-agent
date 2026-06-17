import { describe, it, expect, vi } from 'vitest'
import {
  ToolMiddlewarePipeline,
  loggingMiddleware,
  resultTruncationMiddleware,
  errorFormattingMiddleware,
  createDefaultPipeline,
  type ToolExecutionContext,
  type ToolMiddleware,
} from '../../electron/main/tools/middleware'
import type { ToolDefinition, ToolResult } from '../../src/shared/types'

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

function makeCtx(overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext {
  return {
    call: { id: 'c1', name: 'echo', arguments: '{}' },
    tool: {
      name: 'echo',
      description: 'echo',
      parameters: { type: 'object', properties: {} },
      metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
      execute: async () => 'ok',
    } as ToolDefinition,
    args: {},
    ...overrides,
  }
}

function okResult(content = 'ok'): ToolResult {
  return { callId: 'c1', name: 'echo', content }
}

describe('ToolMiddlewarePipeline', () => {
  it('空管道直接执行 executor', async () => {
    const pipeline = new ToolMiddlewarePipeline()
    const executor = vi.fn().mockResolvedValue(okResult())
    const fn = pipeline.build(executor)

    const result = await fn(makeCtx())
    expect(result.content).toBe('ok')
    expect(executor).toHaveBeenCalledOnce()
  })

  it('中间件按洋葱模型执行', async () => {
    const order: string[] = []
    const pipeline = new ToolMiddlewarePipeline()

    pipeline.use('first', async (ctx, next) => {
      order.push('first-before')
      const result = await next(ctx)
      order.push('first-after')
      return result
    })

    pipeline.use('second', async (ctx, next) => {
      order.push('second-before')
      const result = await next(ctx)
      order.push('second-after')
      return result
    })

    const executor = async () => { order.push('executor'); return okResult() }
    const fn = pipeline.build(executor)
    await fn(makeCtx())

    expect(order).toEqual(['first-before', 'second-before', 'executor', 'second-after', 'first-after'])
  })

  it('中间件可以短路（不调用 next）', async () => {
    const pipeline = new ToolMiddlewarePipeline()

    pipeline.use('blocker', async () => {
      return { callId: 'c1', name: 'echo', content: 'blocked', isError: true }
    })

    const executor = vi.fn().mockResolvedValue(okResult())
    const fn = pipeline.build(executor)
    const result = await fn(makeCtx())

    expect(result.content).toBe('blocked')
    expect(executor).not.toHaveBeenCalled()
  })

  it('remove 移除中间件', () => {
    const pipeline = new ToolMiddlewarePipeline()
    pipeline.use('a', async (_, next) => next(_))
    pipeline.use('b', async (_, next) => next(_))

    expect(pipeline.count).toBe(2)
    expect(pipeline.remove('a')).toBe(true)
    expect(pipeline.count).toBe(1)
    expect(pipeline.remove('nonexistent')).toBe(false)
  })
})

describe('内置中间件', () => {
  it('resultTruncationMiddleware 截断超长结果', async () => {
    const longContent = 'x'.repeat(60_000)
    const next = vi.fn().mockResolvedValue(okResult(longContent))

    const result = await resultTruncationMiddleware(makeCtx(), next)

    expect(result.content.length).toBeLessThan(60_000)
    expect(result.content).toContain('[Result truncated')
  })

  it('resultTruncationMiddleware 不截断正常结果', async () => {
    const next = vi.fn().mockResolvedValue(okResult('short'))
    const result = await resultTruncationMiddleware(makeCtx(), next)
    expect(result.content).toBe('short')
  })

  it('errorFormattingMiddleware 捕获异常', async () => {
    const next = vi.fn().mockRejectedValue(new Error('boom'))
    const result = await errorFormattingMiddleware(makeCtx(), next)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Tool Error')
    expect(result.content).toContain('boom')
  })

  it('errorFormattingMiddleware 正常时透传', async () => {
    const next = vi.fn().mockResolvedValue(okResult('fine'))
    const result = await errorFormattingMiddleware(makeCtx(), next)
    expect(result.content).toBe('fine')
  })

  it('createDefaultPipeline 创建包含 3 个中间件的管道', () => {
    const pipeline = createDefaultPipeline()
    expect(pipeline.count).toBe(3)
  })
})

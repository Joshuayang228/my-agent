import type { ToolDefinition, ToolCall, ToolResult } from '../../../src/shared/types'
import { ToolMiddlewarePipeline, createDefaultPipeline, type ToolMiddlewareNext } from './middleware'

const TOOL_TIMEOUT_MS = 30_000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tool "${label}" timed out after ${ms}ms`)), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()
  private pipeline: ToolMiddlewarePipeline
  private executeFn: ToolMiddlewareNext

  constructor(pipeline?: ToolMiddlewarePipeline) {
    this.pipeline = pipeline ?? createDefaultPipeline()
    this.executeFn = this.pipeline.build((ctx) => this.rawExecute(ctx))
  }

  /** 获取中间件管道（允许外部添加自定义中间件） */
  get middlewarePipeline(): ToolMiddlewarePipeline {
    return this.pipeline
  }

  /** 重新构建执行链（添加/移除中间件后调用） */
  rebuildPipeline(): void {
    this.executeFn = this.pipeline.build((ctx) => this.rawExecute(ctx))
  }

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`)
    }
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  /**
   * 执行一组工具调用。
   * 按 isConcurrencySafe 分批：安全的并发执行，不安全的串行。
   */
  async executeAll(calls: ToolCall[]): Promise<ToolResult[]> {
    const concurrent: ToolCall[] = []
    const sequential: ToolCall[] = []

    for (const call of calls) {
      const tool = this.tools.get(call.name)
      if (!tool) {
        sequential.push(call)
        continue
      }
      if (tool.metadata.isConcurrencySafe) {
        concurrent.push(call)
      } else {
        sequential.push(call)
      }
    }

    const results: ToolResult[] = []

    if (concurrent.length > 0) {
      const concurrentResults = await Promise.all(
        concurrent.map((call) => this.executeSingle(call)),
      )
      results.push(...concurrentResults)
    }

    for (const call of sequential) {
      results.push(await this.executeSingle(call))
    }

    return results
  }

  private async executeSingle(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name)
    if (!tool) {
      return {
        callId: call.id,
        name: call.name,
        content: `Error: Unknown tool "${call.name}"`,
        isError: true,
      }
    }

    let args: Record<string, unknown>
    try {
      args = JSON.parse(call.arguments || '{}')
    } catch {
      return {
        callId: call.id,
        name: call.name,
        content: `Error: Invalid JSON arguments: ${call.arguments}`,
        isError: true,
      }
    }

    return this.executeFn({ call, tool, args })
  }

  /** 原始执行器 — 中间件链的终点 */
  private async rawExecute(ctx: { call: ToolCall; tool: ToolDefinition; args: Record<string, unknown> }): Promise<ToolResult> {
    const content = await withTimeout(ctx.tool.execute(ctx.args), TOOL_TIMEOUT_MS, ctx.call.name)
    return { callId: ctx.call.id, name: ctx.call.name, content }
  }
}

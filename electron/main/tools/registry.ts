import type { ToolDefinition, ToolCall, ToolResult, ToolContext } from '../../../src/shared/types'
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
   * 执行一组工具调用，保持 LLM 返回的原始顺序。
   * 连续的 concurrencySafe 工具并行执行，遇到非安全工具则先 flush 再串行。
   */
  async executeAll(calls: ToolCall[], toolContext?: ToolContext): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    let safeBatch: ToolCall[] = []

    const flushBatch = async () => {
      if (safeBatch.length === 0) return
      const batch = safeBatch
      safeBatch = []
      const batchResults = await Promise.all(
        batch.map((call) => this.executeSingle(call, toolContext)),
      )
      results.push(...batchResults)
    }

    for (const call of calls) {
      const tool = this.tools.get(call.name)
      const isSafe = tool?.metadata.isConcurrencySafe ?? false

      if (isSafe) {
        safeBatch.push(call)
      } else {
        await flushBatch()
        results.push(await this.executeSingle(call, toolContext))
      }
    }

    await flushBatch()
    return results
  }

  private async executeSingle(call: ToolCall, toolContext?: ToolContext): Promise<ToolResult> {
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

    return this.executeFn({ call, tool, args, toolContext })
  }

  /** 原始执行器 — 中间件链的终点 */
  private async rawExecute(ctx: { call: ToolCall; tool: ToolDefinition; args: Record<string, unknown>; toolContext?: ToolContext }): Promise<ToolResult> {
    // longRunning 工具（如 delegate_task 跑完整子 Agent 循环）跳过 30s 超时，
    // 否则会被误杀。这类工具自己靠子 Agent 的 maxIterations / abort signal 兜底。
    const content = ctx.tool.metadata.longRunning
      ? await ctx.tool.execute(ctx.args, ctx.toolContext)
      : await withTimeout(ctx.tool.execute(ctx.args, ctx.toolContext), TOOL_TIMEOUT_MS, ctx.call.name)
    return { callId: ctx.call.id, name: ctx.call.name, content }
  }
}

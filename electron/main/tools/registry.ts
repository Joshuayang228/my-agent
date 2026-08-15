import type { ToolDefinition, ToolCall, ToolResult, ToolContext, ToolAssetUsageReport } from '../../../src/shared/types'
import { ToolMiddlewarePipeline, createDefaultPipeline, type ToolMiddlewareNext } from './middleware'

const TOOL_TIMEOUT_MS = 30_000
/** 单批 concurrencySafe 工具最大并行数（M04），防止 Promise.all 打爆资源 */
const MAX_CONCURRENT_TOOLS = 10

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tool "${label}" timed out after ${ms}ms`)), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()
  /** 别名 → 主工具名 */
  private aliases = new Map<string, string>()
  private pipeline: ToolMiddlewarePipeline
  private executeFn: ToolMiddlewareNext

  constructor(pipeline?: ToolMiddlewarePipeline) {
    this.pipeline = pipeline ?? createDefaultPipeline()
    this.executeFn = this.pipeline.build((ctx) => this.rawExecute(ctx))
  }

  /** 解析主名或别名 → 主工具名 */
  resolveName(name: string): string {
    return this.aliases.get(name) ?? name
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
    if (this.tools.has(tool.name) || this.aliases.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`)
    }
    for (const alias of tool.aliases ?? []) {
      if (this.tools.has(alias) || this.aliases.has(alias)) {
        throw new Error(`Tool alias "${alias}" conflicts with existing name`)
      }
    }
    this.tools.set(tool.name, tool)
    for (const alias of tool.aliases ?? []) {
      this.aliases.set(alias, tool.name)
    }
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(this.resolveName(name))
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  has(name: string): boolean {
    return this.tools.has(this.resolveName(name))
  }

  unregister(name: string): boolean {
    const canonical = this.resolveName(name)
    const tool = this.tools.get(canonical)
    if (!tool) return false
    for (const alias of tool.aliases ?? []) {
      this.aliases.delete(alias)
    }
    return this.tools.delete(canonical)
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
      // 分片并行，避免一次 Promise.all 开过多工具
      for (let i = 0; i < batch.length; i += MAX_CONCURRENT_TOOLS) {
        const chunk = batch.slice(i, i + MAX_CONCURRENT_TOOLS)
        const chunkResults = await Promise.all(
          chunk.map((call) => this.executeSingle(call, toolContext)),
        )
        results.push(...chunkResults)
      }
    }

    for (const call of calls) {
      const tool = this.get(call.name)
      let isSafe = tool?.metadata.isConcurrencySafe ?? false
      if (tool?.resolveMetadata) {
        try {
          const args = JSON.parse(call.arguments || '{}') as Record<string, unknown>
          const dyn = tool.resolveMetadata(args)
          if (typeof dyn.isConcurrencySafe === 'boolean') isSafe = dyn.isConcurrencySafe
        } catch { /* 参数非法时按静态元数据 */ }
      }

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
    const canonical = this.resolveName(call.name)
    const tool = this.tools.get(canonical)
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

    // 元数据函数化：按参数覆盖静态 metadata（权限/并发决策方应读合并后的 tool）
    const resolved = tool.resolveMetadata?.(args)
    const effectiveTool: ToolDefinition = resolved
      ? { ...tool, metadata: { ...tool.metadata, ...resolved } }
      : tool

    const normalizedCall = call.name === canonical ? call : { ...call, name: canonical }
    const toolSpanId = toolContext?.assetUsageSpanIdByCall?.[call.id]
    const scopedToolContext = toolContext
      ? {
          ...toolContext,
          assetUsageReporter: toolContext.assetUsageReporter
            ? (report: ToolAssetUsageReport) => toolContext.assetUsageReporter?.({
                ...report,
                ...(report.spanId || !toolSpanId ? {} : { spanId: toolSpanId }),
              })
            : undefined,
        }
      : undefined
    return this.executeFn({ call: normalizedCall, tool: effectiveTool, args, toolContext: scopedToolContext })
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

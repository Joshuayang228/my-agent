import type { ToolDefinition, ToolCall, ToolResult, ToolContext, ToolAssetUsageReport, ToolMetadata } from '../../../src/shared/types'
import { ToolMiddlewarePipeline, createDefaultPipeline, type ToolMiddlewareNext } from './middleware'
import { createLogger } from '../utils/logger'
import { checkFileToolPermission, consumeFilePermissionApproval, hasFilePermissionRules } from '../sandbox/file-tool-permission'
import { loadEffectiveSandbox } from '../sandbox/effective-sandbox'

const TOOL_TIMEOUT_MS = 30_000
/** 单批 concurrencySafe 工具最大并行数（M04），防止 Promise.all 打爆资源 */
const MAX_CONCURRENT_TOOLS = 10
const log = createLogger('ToolRegistry')

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

  /**
   * 合并工具静态与按参数动态 metadata，供权限、并发和执行链共同使用。
   *
   * 背景：动态 metadata 若只在执行阶段解析，Loop 的确认门和 Debug 预检会继续读取静态值，
   * 可写的参数化工具就可能被误判成只读。设计意图是让所有决策方共享同一解析入口。
   * 关键约束：解析函数抛错时 fail-closed，按可写、破坏性、不可并发处理。
   */
  resolveEffectiveMetadata(name: string, args: Record<string, unknown>): ToolMetadata | undefined {
    const tool = this.get(name)
    if (!tool) return undefined
    if (!tool.resolveMetadata) return tool.metadata
    try {
      return { ...tool.metadata, ...tool.resolveMetadata(args) }
    } catch {
      return {
        ...tool.metadata,
        isReadOnly: false,
        isDestructive: true,
        isConcurrencySafe: false,
      }
    }
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
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(call.arguments || '{}') as Record<string, unknown> } catch { /* 执行阶段返回参数错误 */ }
      const isSafe = this.resolveEffectiveMetadata(call.name, args)?.isConcurrencySafe ?? false

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
      log.warn('Tool arguments JSON parse failed', { toolName: call.name, argumentLength: call.arguments?.length ?? 0 })
      return {
        callId: call.id,
        name: call.name,
        content: '错误：工具参数不是有效 JSON。',
        isError: true,
      }
    }

    // 权限、并发和执行阶段共用同一个 fail-closed metadata 解析入口。
    const effectiveMetadata = this.resolveEffectiveMetadata(canonical, args) ?? tool.metadata
    const effectiveTool: ToolDefinition = { ...tool, metadata: effectiveMetadata }

    const normalizedCall = call.name === canonical ? call : { ...call, name: canonical }
    const toolSpanId = toolContext?.assetUsageSpanIdByCall?.[call.id]
    const scopedToolContext = toolContext
      ? {
          ...toolContext,
          toolCallId: call.id,
          skillState: toolContext.skillState ??= {},
          assetUsageReporter: toolContext.assetUsageReporter
            ? (report: ToolAssetUsageReport) => toolContext.assetUsageReporter?.({
                ...report,
                ...(report.spanId || !toolSpanId ? {} : { spanId: toolSpanId }),
              })
            : undefined,
        }
      : undefined
    if (hasFilePermissionRules()) {
      const permission = checkFileToolPermission(canonical, args, scopedToolContext, await loadEffectiveSandbox(), call.id)
      if (permission?.allowed === false || (permission?.allowed === 'needs_approval'
        && !consumeFilePermissionApproval(toolContext?.filePermissionApprovals?.[call.id], permission))) {
        return { callId: call.id, name: canonical, isError: true, content: permission.allowed === false
          ? '[权限已拒绝] 文件操作被当前规则或安全边界阻止。' : '[需要确认] 文件规则尚未获得有效确认，请重新发起确认。' }
      }
    }
    return this.executeFn({ call: normalizedCall, tool: effectiveTool, args, toolContext: scopedToolContext })
  }

  /** 原始执行器 — 中间件链的终点 */
  private async rawExecute(ctx: { call: ToolCall; tool: ToolDefinition; args: Record<string, unknown>; toolContext?: ToolContext }): Promise<ToolResult> {
    const { tool, call, args, toolContext } = ctx
    const identity = { callId: call.id, name: call.name }
    const parent = toolContext?.signal
    if (parent?.aborted) return { ...identity, isError: true, content: '工具调用已取消，未启动执行。' }

    // 超时只取消本次调用，不能取消其他并行工具或整个会话。
    // 长任务仍接受父操作取消，已交给外部系统的写入则必须核实实际结果。
    const controller = new AbortController()
    const signal = controller.signal
    const timeoutError = new DOMException('工具执行超时。', 'TimeoutError')
    const abortFromParent = () => controller.abort(parent?.reason)
    parent?.addEventListener('abort', abortFromParent, { once: true })
    const timer = tool.metadata.longRunning ? undefined : setTimeout(() => controller.abort(timeoutError), TOOL_TIMEOUT_MS)
    let onAbort: (() => void) | undefined
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason)
      signal.addEventListener('abort', onAbort, { once: true })
    })
    try {
      const context = toolContext ? { ...toolContext, signal } : undefined
      const output = await Promise.race([tool.execute(args, context), cancelled])
      signal.throwIfAborted()
      return { ...(typeof output === 'string' ? { content: output } : output), ...identity }
    } catch (error) {
      if (!signal.aborted) throw error
      const reason = signal.reason === timeoutError ? '工具执行超时。' : '工具调用已取消。'
      const outcome = tool.metadata.isReadOnly ? '' : '写入结果可能尚未确定，请先核实实际状态再决定是否重试。'
      return { ...identity, isError: true, content: reason + outcome }
    } finally {
      clearTimeout(timer)
      parent?.removeEventListener('abort', abortFromParent)
      if (onAbort) signal.removeEventListener('abort', onAbort)
    }
  }
}

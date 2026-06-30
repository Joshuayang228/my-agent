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

import type { ToolCall, ToolResult, ToolDefinition, ToolContext } from '../../../src/shared/types'
import { createLogger } from '../utils/logger'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomBytes } from 'node:crypto'

const log = createLogger('ToolMiddleware')

export interface ToolExecutionContext {
  call: ToolCall
  tool: ToolDefinition
  args: Record<string, unknown>
  /** 运行时上下文（workdir/sessionId/signal） */
  toolContext?: ToolContext
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

const DEFAULT_MAX_RESULT_CHARS = 50_000

/**
 * 大结果落盘中间件 — 替代截断中间件。
 *
 * 背景：shell_exec 执行 find / 等命令可能返回几十 MB 输出。硬截断会导致 AI 看不到
 *       完整结果，影响任务完成率。落盘方案允许 AI 通过 file_read 工具读取完整内容。
 *
 * 策略：
 * - 超过 tool.maxResultSizeChars（默认 50,000）的结果写入临时文件
 * - 返回文件路径 + 提示 AI 使用 file_read 工具读取
 * - 临时文件在进程退出时自动清理
 *
 * 特殊处理：
 * - maxResultSizeChars=Infinity 的工具（如 file_read）永不落盘，防止循环
 * - 优先写入 workdir/.tmp/tool-results/，其次系统临时目录
 *
 * 调用方：createDefaultPipeline() 注册为 'result-persistence' 中间件
 */
export const resultPersistenceMiddleware: ToolMiddleware = async (ctx, next) => {
  const result = await next(ctx)

  const maxSize = ctx.tool.maxResultSizeChars ?? DEFAULT_MAX_RESULT_CHARS
  if (maxSize === Infinity || result.content.length <= maxSize) return result

  log.warn('Tool result exceeds limit, persisting to file', {
    tool: ctx.call.name,
    size: result.content.length,
    limit: maxSize,
  })

  try {
    const filePath = await writeLargeResult(result.content, ctx.call.name, ctx.toolContext?.workdir)
    return {
      ...result,
      content: `Result too large (${result.content.length.toLocaleString()} chars, limit: ${maxSize.toLocaleString()}).\nFull output saved to: ${filePath}\nUse file_read tool to view the complete content.`,
    }
  } catch (err) {
    // 写文件失败 → 降级为截断，确保工具执行不完全失败
    log.error('Failed to persist large result, falling back to truncation', { err })
    return {
      ...result,
      content: result.content.slice(0, maxSize) + `\n\n[Result truncated at ${maxSize.toLocaleString()} characters — persistence failed]`,
    }
  }
}

// 注册进程退出清理的路径集合
const tempFilesToCleanup = new Set<string>()
let cleanupRegistered = false

function registerCleanup(filePath: string): void {
  tempFilesToCleanup.add(filePath)
  if (!cleanupRegistered) {
    cleanupRegistered = true
    const cleanup = () => {
      for (const p of tempFilesToCleanup) {
        try { require('node:fs').unlinkSync(p) } catch { /* ignore */ }
      }
    }
    process.on('exit', cleanup)
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  }
}

/**
 * 将大结果写入临时文件。
 *
 * 写入路径优先级：workdir/.tmp/tool-results/ > os.tmpdir()
 * 调用方负责注册清理（本函数内部已注册）。
 */
async function writeLargeResult(content: string, toolName: string, workdir?: string): Promise<string> {
  const tmpDir = workdir
    ? path.join(workdir, '.tmp', 'tool-results')
    : path.join(os.tmpdir(), 'my-agent-tool-results')

  await fs.mkdir(tmpDir, { recursive: true })

  const id = randomBytes(4).toString('hex')
  const fileName = `${toolName}_${Date.now()}_${id}.txt`
  const filePath = path.join(tmpDir, fileName)

  await fs.writeFile(filePath, content, 'utf-8')
  registerCleanup(filePath)

  return filePath
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
 * Verify 中间件 — 文件写入/编辑后自动检测基础语法错误。
 * 对 file_write / file_edit / apply_patch 的执行结果追加验证。
 * 如检测到问题，将错误信息附加到工具结果中，Agent 可据此自行修复。
 */
export const verifyMiddleware: ToolMiddleware = async (ctx, next) => {
  const result = await next(ctx)

  const VERIFY_TOOLS = new Set(['file_write', 'file_edit', 'apply_patch'])
  if (!VERIFY_TOOLS.has(ctx.call.name) || result.isError) return result

  const filePath = ctx.args.path as string
  if (!filePath) return result

  const ext = filePath.split('.').pop()?.toLowerCase()
  if (!ext) return result

  const CHECKABLE = new Set(['ts', 'tsx', 'js', 'jsx', 'json', 'py'])
  if (!CHECKABLE.has(ext)) return result

  try {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execAsync = promisify(execFile)
    const path = await import('node:path')
    const resolved = path.resolve(filePath)

    let verifyCmd: string[] | null = null
    let verifyBin = ''

    if (ext === 'json') {
      const { readFileSync } = await import('node:fs')
      try {
        JSON.parse(readFileSync(resolved, 'utf-8'))
        return result
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e)
        return {
          ...result,
          content: result.content + `\n\n⚠️ [Verify] JSON syntax error detected:\n${errMsg}\nPlease fix the JSON syntax.`,
        }
      }
    }

    if (['ts', 'tsx'].includes(ext)) {
      verifyBin = 'npx'
      verifyCmd = ['tsc', '--noEmit', '--pretty', 'false', '--isolatedModules', resolved]
    } else if (ext === 'py') {
      verifyBin = 'python3'
      verifyCmd = ['-m', 'py_compile', resolved]
    }

    if (verifyCmd && verifyBin) {
      try {
        await execAsync(verifyBin, verifyCmd, { timeout: 15_000, cwd: path.dirname(resolved) })
      } catch (err) {
        const stderr = (err as Record<string, unknown>).stderr as string || ''
        const stdout = (err as Record<string, unknown>).stdout as string || ''
        const errors = (stderr + stdout).trim()
        if (errors) {
          const truncated = errors.length > 1000 ? errors.slice(0, 1000) + '...' : errors
          return {
            ...result,
            content: result.content + `\n\n⚠️ [Verify] Syntax/type errors detected after edit:\n${truncated}\nPlease review and fix.`,
          }
        }
      }
    }
  } catch {
    // Verify tooling not available — skip silently
  }

  return result
}

/**
 * 创建默认中间件管道（包含所有内置中间件）。
 */
export function createDefaultPipeline(): ToolMiddlewarePipeline {
  const pipeline = new ToolMiddlewarePipeline()
  pipeline.use('error-formatting', errorFormattingMiddleware)
  pipeline.use('logging', loggingMiddleware)
  pipeline.use('verify', verifyMiddleware)
  pipeline.use('result-persistence', resultPersistenceMiddleware)
  return pipeline
}

import type {
  AgentLoopOptions,
  AgentStreamEvent,
  ChatMessage,
  ToolCall,
  ToolResult,
} from '../../../src/shared/types'
import { streamChat } from '../llm/index'
import { ToolRegistry } from '../tools/registry'
import { createLogger } from '../utils/logger'
import { sanitizeError } from '../utils/sanitize-error'
import { compressContext } from './context-manager'

const log = createLogger('AgentLoop')

const DEFAULT_MAX_ITERATIONS = 25
const MAX_LLM_RETRIES = 2
const TOOL_TIMEOUT_MS = 30_000
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You have access to tools that you can use to help the user. When you need to perform actions, use the available tools. Always respond in the same language as the user.`

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return msg.includes('fetch failed') || msg.includes('network') ||
    msg.includes('econnreset') || msg.includes('timeout') ||
    msg.includes('429') || msg.includes('502') || msg.includes('503')
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

/**
 * Agent 主循环 — think → act → observe → think → ...
 *
 * 无状态：所有依赖通过 options 注入。
 * 输出：AsyncGenerator<AgentStreamEvent>，UI 层消费事件并渲染。
 */
export async function* agentLoop(
  options: AgentLoopOptions,
  registry: ToolRegistry,
): AsyncGenerator<AgentStreamEvent> {
  const {
    config,
    messages: inputMessages,
    tools,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    signal,
    confirmTool,
  } = options

  log.info('Loop started', {
    model: config.model,
    messageCount: inputMessages.length,
    toolCount: tools.length,
    maxIterations,
  })

  const workingMessages: ChatMessage[] = [
    { id: 'system', role: 'system', content: systemPrompt, timestamp: Date.now() },
    ...inputMessages,
  ]

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (signal?.aborted) {
      log.warn('Loop cancelled by signal', { iteration })
      yield { type: 'error', message: 'Agent loop was cancelled' }
      return
    }

    log.info(`Iteration ${iteration + 1}/${maxIterations} — calling LLM`)

    // ── 上下文压缩（每次迭代前检查） ──
    const compressed = compressContext(workingMessages)
    if (compressed.length < workingMessages.length) {
      workingMessages.length = 0
      workingMessages.push(...compressed)
    }

    // ── Think: 调用 LLM（带重试） ──
    let content: string | null = null
    let toolCalls: ToolCall[] = []
    const llmStart = Date.now()
    let lastErr: unknown = null

    for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoff = 1000 * Math.pow(2, attempt - 1)
        log.warn(`LLM retry ${attempt}/${MAX_LLM_RETRIES}, waiting ${backoff}ms`)
        await sleep(backoff)
        if (signal?.aborted) break
      }

      try {
        const stream = streamChat({ config, messages: workingMessages, tools, signal })

        let streamResult = await stream.next()
        while (!streamResult.done) {
          yield streamResult.value
          streamResult = await stream.next()
        }

        const result = streamResult.value
        content = result.content
        toolCalls = result.toolCalls

        log.info('LLM response received', {
          duration: Date.now() - llmStart,
          contentLength: content?.length ?? 0,
          toolCallCount: toolCalls.length,
          usage: result.usage,
          attempt,
        })
        lastErr = null
        break
      } catch (err) {
        lastErr = err
        if (!isRetryableError(err) || attempt === MAX_LLM_RETRIES) break
        log.warn('LLM call failed (retryable)', {
          attempt,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    if (lastErr) {
      const raw = lastErr instanceof Error ? lastErr.message : String(lastErr)
      log.error('LLM call failed', { duration: Date.now() - llmStart, error: raw })
      yield { type: 'error', message: sanitizeError(raw) }
      return
    }

    // ── 写入 assistant 消息 ──
    if (toolCalls.length > 0) {
      log.debug('Discarding companion text (Alice strategy)', {
        discardedLength: content?.length ?? 0,
        toolNames: toolCalls.map((tc) => tc.name),
      })
      workingMessages.push({
        id: `assistant-${iteration}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls,
      })
    } else {
      log.info('Loop complete — text response', { contentLength: content?.length ?? 0 })
      workingMessages.push({
        id: `assistant-${iteration}`,
        role: 'assistant',
        content: content || '',
        timestamp: Date.now(),
      })
      yield { type: 'done' }
      return
    }

    // ── Act: 执行工具（并发安全的走 Promise.all，其余串行） ──
    const results: ToolResult[] = []
    const skippedCallIds = new Set<string>()

    // 先处理破坏性工具确认
    const parsedArgs = new Map<string, Record<string, unknown>>()
    for (const call of toolCalls) {
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(call.arguments || '{}') } catch { /* registry handles */ }
      parsedArgs.set(call.id, args)

      const toolDef = registry.get(call.name)
      if (toolDef?.metadata.isDestructive && confirmTool) {
        yield { type: 'tool_confirm', callId: call.id, name: call.name, args }
        const approved = await confirmTool(call.name, args)
        if (!approved) {
          log.info(`Tool rejected by user: ${call.name}`, { callId: call.id })
          results.push({ callId: call.id, name: call.name, content: 'User denied execution of this tool.', isError: true })
          yield { type: 'tool_end', callId: call.id, name: call.name, result: 'User denied execution.', isError: true }
          skippedCallIds.add(call.id)
        }
      }
    }

    const pendingCalls = toolCalls.filter((c) => !skippedCallIds.has(c.id))

    if (signal?.aborted) {
      log.warn('Loop cancelled before tool execution', { iteration })
      yield { type: 'error', message: 'Agent loop was cancelled during tool execution' }
      return
    }

    // 发出所有 tool_start 事件
    for (const call of pendingCalls) {
      yield { type: 'tool_start', callId: call.id, name: call.name, args: parsedArgs.get(call.id)! }
    }

    // 利用 registry.executeAll 的并发分流（concurrencySafe → Promise.all）
    const toolStart = Date.now()
    const batchResults = await registry.executeAll(pendingCalls)
    results.push(...batchResults)

    for (const result of batchResults) {
      const call = pendingCalls.find((c) => c.id === result.callId)
      log.info(`Tool finished: ${result.name}`, {
        callId: result.callId,
        duration: Date.now() - toolStart,
        isError: result.isError,
        resultLength: result.content.length,
      })
      yield {
        type: 'tool_end',
        callId: result.callId,
        name: result.name,
        result: result.content,
        isError: result.isError,
      }
    }

    // ── Observe: 工具结果写回上下文 ──
    for (const result of results) {
      workingMessages.push({
        id: `tool-${result.callId}`,
        role: 'tool',
        content: result.content,
        timestamp: Date.now(),
        toolCallId: result.callId,
      })
    }

    log.debug('Context updated, entering next iteration', {
      totalMessages: workingMessages.length,
    })
  }

  log.warn(`Max iterations reached (${maxIterations})`)
  yield { type: 'error', message: `Agent loop reached maximum iterations (${maxIterations})` }
  yield { type: 'done' }
}

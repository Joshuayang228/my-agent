import type {
  AgentLoopOptions,
  AgentStreamEvent,
  ChatMessage,
  TerminalReason,
  ToolCall,
  ToolResult,
} from '../../../src/shared/types'
import { streamChat, LLMError } from '../llm/index'
import { ToolRegistry } from '../tools/registry'
import { checkToolPermission } from '../sandbox/permission-engine'
import { createLogger } from '../utils/logger'
import { sanitizeError } from '../utils/sanitize-error'
import { compressContext, emergencyTruncate, estimateTokens, DEFAULT_MAX_TOKENS } from './context-manager'
import { sanitizeMessages } from './message-pipeline'

const log = createLogger('AgentLoop')

const DEFAULT_MAX_ITERATIONS = 50
const MAX_LLM_RETRIES = 2
const MAX_OUTPUT_RECOVERY_LIMIT = 2
const MAX_CONSECUTIVE_COMPACT_FAILURES = 3
const TOOL_TIMEOUT_MS = 30_000
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You have access to tools that you can use to help the user. When you need to perform actions, use the available tools. Always respond in the same language as the user.`

// ── LoopState ──

type ContinueReason = 'next_turn' | 'reactive_compact_retry' | 'max_output_recovery'

interface LoopState {
  messages: ChatMessage[]
  turnCount: number
  lastPromptTokens?: number
  hasAttemptedReactiveCompact: boolean
  maxOutputRecoveryCount: number
  consecutiveCompactFailures: number
  deniedTools: Array<{ name: string; reason: string }>
  transition?: { reason: ContinueReason }
}

// ── Helpers ──

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return msg.includes('fetch failed') || msg.includes('network') ||
    msg.includes('econnreset') || msg.includes('timeout') ||
    msg.includes('429') || msg.includes('502') || msg.includes('503')
}

function is413Error(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return msg.includes('413') || msg.includes('prompt is too long') ||
    msg.includes('prompt too long') || msg.includes('context_length_exceeded') ||
    msg.includes('max_tokens')
}

function isMaxOutputError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return msg.includes('max_output_tokens') || msg.includes('length')
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function buildDeniedToolsPromptSuffix(denied: Array<{ name: string; reason: string }>): string {
  if (denied.length === 0) return ''
  const lines = denied.map(d => `- ${d.name}: ${d.reason}`)
  return `\n\n[System] The following tools were denied during this session. Do not attempt to call them again:\n${lines.join('\n')}`
}

/**
 * Agent 主循环 — think → act → observe → think → ...
 *
 * 状态通过 LoopState 集中管理，支持：
 * - 413 紧急压缩 + 重试
 * - max_output_tokens 截断恢复
 * - 权限拒绝累积追踪
 * - abort 后合成 tool_result 保持消息配对
 * - done 事件携带 TerminalReason
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
    filterTools,
    executionMode = 'auto',
    toolContext,
  } = options

  log.info('Loop started', {
    model: config.model,
    messageCount: inputMessages.length,
    toolCount: tools.length,
    maxIterations,
  })

  const state: LoopState = {
    messages: [
      { id: 'system', role: 'system', content: systemPrompt, timestamp: Date.now() },
      ...sanitizeMessages(inputMessages),
    ],
    turnCount: 0,
    hasAttemptedReactiveCompact: false,
    maxOutputRecoveryCount: 0,
    consecutiveCompactFailures: 0,
    deniedTools: [],
  }

  while (state.turnCount < maxIterations) {
    // ── 检查 abort ──
    if (signal?.aborted) {
      log.warn('Loop cancelled by signal', { turn: state.turnCount })
      yield* terminateLoop(state, 'aborted')
      return
    }

    state.turnCount++
    log.info(`Turn ${state.turnCount}/${maxIterations} — calling LLM`)

    const effectiveTools = filterTools ? filterTools(tools) : tools

    // ── 注入权限拒绝摘要到 system prompt ──
    const deniedSuffix = buildDeniedToolsPromptSuffix(state.deniedTools)
    if (deniedSuffix && state.messages[0]?.role === 'system') {
      const basePrompt = systemPrompt
      state.messages[0] = {
        ...state.messages[0],
        content: basePrompt + deniedSuffix,
      }
    }

    // ── 上下文压缩（每次迭代前检查，带熔断器） ──
    if (state.consecutiveCompactFailures >= MAX_CONSECUTIVE_COMPACT_FAILURES) {
      // A3: 熔断后不能什么都不做（下一轮会因超限崩溃），降级为紧急截断
      const tokens = state.lastPromptTokens ?? estimateTokens(state.messages)
      if (tokens > DEFAULT_MAX_TOKENS * 0.9) {
        const before = state.messages.length
        const truncated = emergencyTruncate(state.messages, DEFAULT_MAX_TOKENS * 0.5)
        state.messages.length = 0
        state.messages.push(...truncated)
        log.warn('Compact circuit breaker tripped — emergency truncation applied', {
          failures: state.consecutiveCompactFailures,
          messages: `${before} → ${truncated.length}`,
        })
        // 截断后重置熔断器，给压缩系统重新尝试的机会
        state.consecutiveCompactFailures = 0
      } else {
        log.warn('Compact circuit breaker tripped — skipping compression', {
          failures: state.consecutiveCompactFailures,
        })
      }
    } else {
      const beforeCount = state.messages.length
      const compressed = await compressContext(state.messages, {
        lastActualPromptTokens: state.lastPromptTokens,
        llmConfig: config,
        querySource: 'main',
      })
      if (compressed.length < beforeCount) {
        state.messages.length = 0
        state.messages.push(...compressed)
        state.consecutiveCompactFailures = 0
      } else {
        state.consecutiveCompactFailures++
        if (state.consecutiveCompactFailures >= MAX_CONSECUTIVE_COMPACT_FAILURES) {
          log.warn('Compact failed to reduce messages, circuit breaker will trip next turn', {
            failures: state.consecutiveCompactFailures,
          })
        }
      }
    }

    // ── Think: 调用 LLM（带重试） ──
    let content: string | null = null
    let toolCalls: ToolCall[] = []
    const llmStart = Date.now()
    let lastErr: unknown = null
    let stopReason: string | undefined
    // 服务端 retry-after（毫秒），由上一次失败的 LLMError 传入下一轮重试
    let nextRetryAfterMs: number | undefined

    for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
      if (attempt > 0) {
        // 优先遵从服务端 retry-after，否则退回指数退避（对照 CC withRetry.ts:530）
        const backoff = nextRetryAfterMs ?? 1000 * Math.pow(2, attempt - 1)
        log.warn(`LLM retry ${attempt}/${MAX_LLM_RETRIES}, waiting ${backoff}ms`, {
          source: nextRetryAfterMs != null ? 'retry-after' : 'exponential',
        })
        await sleep(backoff)
        if (signal?.aborted) break
      }

      try {
        const stream = streamChat({ config, messages: state.messages, tools: effectiveTools, signal, enablePromptCache: true, caller: 'main' })

        let streamResult = await stream.next()
        while (!streamResult.done) {
          yield streamResult.value
          streamResult = await stream.next()
        }

        const result = streamResult.value
        content = result.content
        toolCalls = result.toolCalls
        stopReason = result.stopReason

        if (result.usage?.promptTokens) {
          state.lastPromptTokens = result.usage.promptTokens
        }

        log.info('LLM response received', {
          duration: Date.now() - llmStart,
          contentLength: content?.length ?? 0,
          toolCallCount: toolCalls.length,
          usage: result.usage,
          stopReason,
          attempt,
        })
        lastErr = null
        break
      } catch (err) {
        lastErr = err

        // ── 413 紧急压缩 + 重试 ──
        if (is413Error(err) && !state.hasAttemptedReactiveCompact) {
          log.warn('413 detected — triggering reactive compact')
          state.hasAttemptedReactiveCompact = true
          const emergencyCompressed = await compressContext(state.messages, {
            llmConfig: config,
            querySource: 'main',
          })
          if (emergencyCompressed.length < state.messages.length) {
            state.messages.length = 0
            state.messages.push(...emergencyCompressed)
            log.info('Reactive compact done, retrying LLM', { newMessageCount: state.messages.length })
            state.transition = { reason: 'reactive_compact_retry' }
            lastErr = null
            break
          }
          // C1: 压缩没缩小消息 —— 用 emergencyTruncate 逐级硬截断作为 413 的最后逃生舱，
          // 而非直接放弃。对照 CC truncateHeadForPTLRetry 的渐进删除逻辑。
          log.warn('Reactive compact did not shrink — falling back to emergency truncation')
          const truncated = emergencyTruncate(state.messages, DEFAULT_MAX_TOKENS * 0.5)
          if (truncated.length < state.messages.length) {
            state.messages.length = 0
            state.messages.push(...truncated)
            log.info('Emergency truncation done, retrying LLM', { newMessageCount: state.messages.length })
            state.transition = { reason: 'reactive_compact_retry' }
            lastErr = null
            break
          }
          log.error('Reactive compact and emergency truncation both failed to reduce messages')
          yield { type: 'error', message: '对话上下文过长，压缩后仍超限。请开始新对话。' }
          yield { type: 'done', reason: 'prompt_too_long' }
          return
        }

        if (!isRetryableError(err) || attempt === MAX_LLM_RETRIES) break
        // 若服务端返回了 Retry-After，下一轮优先遵从它而非指数退避（对照 CC withRetry.ts:530）
        nextRetryAfterMs = err instanceof LLMError ? err.retryAfterMs : undefined
        log.warn('LLM call failed (retryable)', {
          attempt,
          error: err instanceof Error ? err.message : String(err),
          retryAfterMs: nextRetryAfterMs,
        })
      }
    }

    // 413 触发 reactive compact 后跳回循环头重试
    if (state.transition?.reason === 'reactive_compact_retry') {
      state.transition = undefined
      state.turnCount--
      continue
    }

    if (lastErr) {
      const raw = lastErr instanceof Error ? lastErr.message : String(lastErr)
      log.error('LLM call failed', { duration: Date.now() - llmStart, error: raw })
      yield { type: 'error', message: sanitizeError(raw) }
      yield { type: 'done', reason: 'model_error' }
      return
    }

    // ── max_output_tokens 截断恢复 ──
    if (stopReason === 'max_tokens' || stopReason === 'length') {
      if (state.maxOutputRecoveryCount < MAX_OUTPUT_RECOVERY_LIMIT) {
        state.maxOutputRecoveryCount++
        log.warn('Output truncated, attempting recovery', {
          recoveryAttempt: state.maxOutputRecoveryCount,
          contentLength: content?.length ?? 0,
        })
        state.messages.push({
          id: `assistant-${state.turnCount}`,
          role: 'assistant',
          content: content || '',
          timestamp: Date.now(),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        })
        state.messages.push({
          id: `user-recovery-${state.turnCount}`,
          role: 'user',
          content: '[System] Your previous response was truncated due to length limits. Please continue from where you left off.',
          timestamp: Date.now(),
        })
        state.transition = { reason: 'max_output_recovery' }
        continue
      }
      log.warn('Max output recovery limit reached, proceeding with truncated content')
    }

    // ── 写入 assistant 消息 ──
    if (toolCalls.length > 0) {
      log.debug('Discarding companion text (Alice strategy)', {
        discardedLength: content?.length ?? 0,
        toolNames: toolCalls.map((tc) => tc.name),
      })
      state.messages.push({
        id: `assistant-${state.turnCount}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls,
      })
      yield { type: 'tool_calls', calls: toolCalls }
    } else {
      log.info('Loop complete — text response', { contentLength: content?.length ?? 0 })
      state.messages.push({
        id: `assistant-${state.turnCount}`,
        role: 'assistant',
        content: content || '',
        timestamp: Date.now(),
      })
      yield { type: 'done', reason: 'completed' }
      return
    }

    // ── Act: 执行工具 ──
    const results: ToolResult[] = []
    const skippedCallIds = new Set<string>()

    const parsedArgs = new Map<string, Record<string, unknown>>()
    for (const call of toolCalls) {
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(call.arguments || '{}') } catch { /* registry handles */ }
      parsedArgs.set(call.id, args)

      const permResult = checkToolPermission(call.name)

      if (permResult.allowed === false) {
        log.info(`Tool blocked by permission engine: ${call.name}`, { reason: permResult.reason, chain: permResult.chain })
        const denyMsg = `[Permission Denied] ${permResult.reason}`
        results.push({ callId: call.id, name: call.name, content: denyMsg, isError: true })
        yield { type: 'tool_end', callId: call.id, name: call.name, result: denyMsg, isError: true }
        skippedCallIds.add(call.id)
        if (!state.deniedTools.some(d => d.name === call.name)) {
          state.deniedTools.push({ name: call.name, reason: permResult.reason || 'blocked by policy' })
        }
        continue
      }

      const needsConfirm =
        executionMode === 'confirm-all' ||
        permResult.allowed === 'needs_approval' ||
        ((executionMode === 'auto' || executionMode === 'plan-first') && registry.get(call.name)?.metadata.isDestructive)

      if (needsConfirm && confirmTool) {
        yield { type: 'tool_confirm', callId: call.id, name: call.name, args }
        const approved = await confirmTool(call.name, args)
        if (!approved) {
          log.info(`Tool rejected by user: ${call.name}`, { callId: call.id, executionMode })
          results.push({ callId: call.id, name: call.name, content: 'User denied execution of this tool.', isError: true })
          yield { type: 'tool_end', callId: call.id, name: call.name, result: 'User denied execution.', isError: true }
          skippedCallIds.add(call.id)
        }
      }
    }

    const pendingCalls = toolCalls.filter((c) => !skippedCallIds.has(c.id))

    // ── abort 后合成 synthetic tool_result ──
    if (signal?.aborted) {
      log.warn('Loop cancelled before tool execution — synthesizing tool_results', { turn: state.turnCount })
      for (const call of pendingCalls) {
        const syntheticResult = '[Tool execution cancelled by user]'
        state.messages.push({
          id: `tool-${call.id}`,
          role: 'tool',
          content: syntheticResult,
          timestamp: Date.now(),
          toolCallId: call.id,
        })
        yield { type: 'tool_end', callId: call.id, name: call.name, result: syntheticResult, isError: true }
      }
      yield* terminateLoop(state, 'aborted')
      return
    }

    for (const call of pendingCalls) {
      yield { type: 'tool_start', callId: call.id, name: call.name, args: parsedArgs.get(call.id)! }
    }

    const toolStart = Date.now()
    const batchResults = await registry.executeAll(pendingCalls, toolContext)
    results.push(...batchResults)

    for (const result of batchResults) {
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
      state.messages.push({
        id: `tool-${result.callId}`,
        role: 'tool',
        content: result.content,
        timestamp: Date.now(),
        toolCallId: result.callId,
      })
    }

    log.debug('Context updated, entering next turn', {
      totalMessages: state.messages.length,
      turn: state.turnCount,
    })
  }

  log.warn(`Max turns reached (${maxIterations})`)
  yield { type: 'error', message: `Agent 已达到最大迭代次数 (${maxIterations})，停止处理。` }
  yield { type: 'done', reason: 'max_turns' }
}

async function* terminateLoop(
  state: LoopState,
  reason: TerminalReason,
): AsyncGenerator<AgentStreamEvent> {
  if (reason === 'aborted') {
    yield { type: 'error', message: 'Agent loop was cancelled' }
  }
  yield { type: 'done', reason }
}

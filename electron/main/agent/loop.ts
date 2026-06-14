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
import { compressContext } from './context-manager'

const log = createLogger('AgentLoop')

const DEFAULT_MAX_ITERATIONS = 25
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You have access to tools that you can use to help the user. When you need to perform actions, use the available tools. Always respond in the same language as the user.`

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

    // ── Think: 调用 LLM ──
    let content: string | null = null
    let toolCalls: ToolCall[] = []
    const llmStart = Date.now()

    try {
      const stream = streamChat({ config, messages: workingMessages, tools })

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
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('LLM call failed', { duration: Date.now() - llmStart, error: message })
      yield { type: 'error', message }
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

    // ── Act: 执行工具 ──
    const results: ToolResult[] = []

    for (const call of toolCalls) {
      if (signal?.aborted) {
        log.warn('Loop cancelled during tool execution', { iteration, tool: call.name })
        yield { type: 'error', message: 'Agent loop was cancelled during tool execution' }
        return
      }

      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(call.arguments || '{}')
      } catch {
        // args parse failure handled by registry
      }

      log.info(`Tool executing: ${call.name}`, { callId: call.id, args })

      // 破坏性工具需要用户确认
      const toolDef = registry.get(call.name)
      if (toolDef && toolDef.metadata.isDestructive && confirmTool) {
        yield { type: 'tool_confirm', callId: call.id, name: call.name, args }
        const approved = await confirmTool(call.name, args)
        if (!approved) {
          log.info(`Tool rejected by user: ${call.name}`, { callId: call.id })
          results.push({ callId: call.id, name: call.name, content: 'User denied execution of this tool.', isError: true })
          yield { type: 'tool_end', callId: call.id, name: call.name, result: 'User denied execution.', isError: true }
          continue
        }
      }

      yield { type: 'tool_start', callId: call.id, name: call.name, args }

      const toolStart = Date.now()
      const [result] = await registry.executeAll([call])
      results.push(result)

      log.info(`Tool finished: ${call.name}`, {
        callId: call.id,
        duration: Date.now() - toolStart,
        isError: result.isError,
        resultLength: result.content.length,
      })

      yield {
        type: 'tool_end',
        callId: call.id,
        name: call.name,
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

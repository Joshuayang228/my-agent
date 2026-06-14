import type { ChatMessage } from '../../../src/shared/types'
import { createLogger } from '../utils/logger'

const log = createLogger('ContextManager')

const DEFAULT_MAX_TOKENS = 120_000
const L1_THRESHOLD = 0.60
const L2_THRESHOLD = 0.75
const L3_THRESHOLD = 0.90
const RECENT_KEEP_COUNT = 6

export interface ContextManagerOptions {
  maxTokens?: number
}

/**
 * 粗略估算消息列表的 token 数量。
 * 混合中英文场景：中文 ~2 chars/token，英文 ~4 chars/token。
 * 取折中值 ~2.5 chars/token + 每条消息固定开销 4 tokens。
 */
export function estimateTokens(messages: ChatMessage[]): number {
  let total = 0
  for (const msg of messages) {
    total += Math.ceil(msg.content.length / 2.5) + 4
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        total += Math.ceil((tc.arguments?.length ?? 0) / 3) + 10
      }
    }
  }
  return total
}

/**
 * 上下文压缩入口 — 按 Alice 四层分级策略的前三层实现。
 *
 * 保证：
 * - system prompt（第一条）永远不压缩
 * - 最近 RECENT_KEEP_COUNT 条消息保持完整
 * - 压缩后消息结构仍有效（tool 消息跟对应 assistant 成对）
 */
export function compressContext(
  messages: ChatMessage[],
  options: ContextManagerOptions = {},
): ChatMessage[] {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS
  let current = [...messages]
  let tokens = estimateTokens(current)

  log.debug('Context check', { tokens, maxTokens, messageCount: current.length })

  // ── L1 Snip：删除最早的工具调用轮次 ──
  if (tokens > maxTokens * L1_THRESHOLD) {
    const before = current.length
    current = snip(current)
    const after = estimateTokens(current)
    if (before !== current.length) {
      log.info(`L1 Snip: ${before} → ${current.length} messages, ${tokens} → ${after} tokens`)
    }
    tokens = after
  }

  // ── L2 MicroCompact：去重相同工具调用 ──
  if (tokens > maxTokens * L2_THRESHOLD) {
    const before = current.length
    current = microCompact(current)
    const after = estimateTokens(current)
    if (before !== current.length) {
      log.info(`L2 MicroCompact: ${before} → ${current.length} messages, ${tokens} → ${after} tokens`)
    }
    tokens = after
  }

  // ── L3 Collapse：截断式压缩（保留首尾，删中间旧消息） ──
  if (tokens > maxTokens * L3_THRESHOLD) {
    const before = current.length
    current = collapse(current, maxTokens)
    const after = estimateTokens(current)
    log.info(`L3 Collapse: ${before} → ${current.length} messages, ${tokens} → ${after} tokens`)
    tokens = after
  }

  return current
}

/**
 * L1 Snip — 删除最早的工具调用轮次（assistant+tool 对）。
 * 保护 system prompt 和最近消息。
 */
function snip(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = []
  const recentStart = Math.max(1, messages.length - RECENT_KEEP_COUNT)
  let snipped = 0
  const MAX_SNIP = 5

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    if (i === 0 || i >= recentStart || snipped >= MAX_SNIP) {
      result.push(msg)
      continue
    }

    // 跳过 assistant 消息 + 紧随其后的 tool 消息（一组工具调用轮次）
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      const toolCallIds = new Set(msg.toolCalls.map((tc) => tc.id))
      snipped++

      let j = i + 1
      while (j < messages.length && messages[j].role === 'tool' && messages[j].toolCallId && toolCallIds.has(messages[j].toolCallId!)) {
        j++
      }
      i = j - 1
      continue
    }

    result.push(msg)
  }

  return result
}

/**
 * L2 MicroCompact — 对重复的同名工具调用只保留最后一次结果。
 * 早期重复调用替换为一行说明。
 */
function microCompact(messages: ChatMessage[]): ChatMessage[] {
  const toolCallLastSeen = new Map<string, number>()

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === 'assistant' && msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        const key = `${tc.name}:${tc.arguments}`
        toolCallLastSeen.set(key, i)
      }
    }
  }

  const result: ChatMessage[] = []
  const recentStart = Math.max(1, messages.length - RECENT_KEEP_COUNT)
  const skipToolIds = new Set<string>()

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    if (i === 0 || i >= recentStart) {
      result.push(msg)
      continue
    }

    if (msg.role === 'assistant' && msg.toolCalls) {
      const keptCalls = []
      const removedCalls = []

      for (const tc of msg.toolCalls) {
        const key = `${tc.name}:${tc.arguments}`
        if (toolCallLastSeen.get(key) !== i) {
          removedCalls.push(tc)
          skipToolIds.add(tc.id)
        } else {
          keptCalls.push(tc)
        }
      }

      if (removedCalls.length > 0 && keptCalls.length === 0) {
        result.push({
          ...msg,
          toolCalls: undefined,
          content: `[earlier duplicate tool calls removed: ${removedCalls.map((c) => c.name).join(', ')}]`,
        })
      } else if (removedCalls.length > 0) {
        result.push({ ...msg, toolCalls: keptCalls })
      } else {
        result.push(msg)
      }
      continue
    }

    if (msg.role === 'tool' && msg.toolCallId && skipToolIds.has(msg.toolCallId)) {
      continue
    }

    result.push(msg)
  }

  return result
}

/**
 * L3 Collapse — 保留 system prompt + 近期消息，中间旧消息替换为结构化摘要占位符。
 * 这是一个简化版：不调用 LLM 做摘要，而是用规则生成一段"已压缩"标记。
 * 后续可升级为真正的 LLM 摘要。
 */
function collapse(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
  const recentKeep = Math.max(RECENT_KEEP_COUNT, 8)
  const recentStart = Math.max(1, messages.length - recentKeep)

  const system = messages[0]
  const recent = messages.slice(recentStart)

  const middleMessages = messages.slice(1, recentStart)
  const userMsgCount = middleMessages.filter((m) => m.role === 'user').length
  const assistantMsgCount = middleMessages.filter((m) => m.role === 'assistant').length
  const toolMsgCount = middleMessages.filter((m) => m.role === 'tool').length

  const summaryContent = [
    '[Context compressed — earlier conversation summary]',
    `Previous conversation contained ${userMsgCount} user messages, ${assistantMsgCount} assistant responses, and ${toolMsgCount} tool results.`,
    'Key topics discussed in earlier messages have been compressed to save context space.',
    'If you need to refer to earlier context, ask the user to clarify.',
  ].join('\n')

  const summaryMsg: ChatMessage = {
    id: 'context-summary',
    role: 'system',
    content: summaryContent,
    timestamp: Date.now(),
  }

  const result = [system, summaryMsg, ...recent]

  const finalTokens = estimateTokens(result)
  if (finalTokens > maxTokens) {
    log.warn('Context still over limit after L3 collapse, trimming recent messages', {
      tokens: finalTokens,
      maxTokens,
    })
    const trimmed = [system, summaryMsg]
    for (let i = recent.length - 1; i >= 0; i--) {
      trimmed.splice(2, 0, recent[i])
      if (estimateTokens(trimmed) > maxTokens * 0.85) {
        trimmed.splice(2, 1)
        break
      }
    }
    return trimmed
  }

  return result
}

import type { ChatMessage, LLMConfig } from '../../../src/shared/types'
import { createLogger } from '../utils/logger'

const log = createLogger('ContextManager')

const DEFAULT_MAX_TOKENS = 120_000
const L1_THRESHOLD = 0.60
const L2_THRESHOLD = 0.75
const L3_THRESHOLD = 0.90
const L4_THRESHOLD = 0.95
const RECENT_KEEP_COUNT = 6

/**
 * querySource 标记 — 区分调用来源，防止压缩/记忆系统递归触发 LLM 调用。
 * 'main' = 主对话循环, 'compact' = 压缩系统, 'memory' = 记忆提取, 'title' = 标题生成
 */
export type QuerySource = 'main' | 'compact' | 'memory' | 'title' | 'classifier'

let activeQuerySource: QuerySource | null = null

export function getQuerySource(): QuerySource | null {
  return activeQuerySource
}

export function setQuerySource(source: QuerySource | null): void {
  activeQuerySource = source
}

export function isCompactGuardActive(): boolean {
  return activeQuerySource === 'compact'
}

export interface ContextManagerOptions {
  maxTokens?: number
  /** API 上一轮返回的实际 promptTokens，比启发式估算更准 */
  lastActualPromptTokens?: number
  /** LLM 配置，L3/L4 需要调用 LLM 做摘要 */
  llmConfig?: LLMConfig
  /** 调用来源，非 'main' 时跳过 LLM 摘要避免递归 */
  querySource?: QuerySource
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
 * 上下文压缩入口 — 四层分级策略（Alice 方法论 Ch.5）。
 *
 * L1 Snip（零成本）→ L2 MicroCompact（零成本）→ L3 Collapse（LLM 摘要）→ L4 AutoCompact（全量重写）
 *
 * 保证：
 * - system prompt（第一条）永远不压缩
 * - 最近 RECENT_KEEP_COUNT 条消息保持完整
 * - 压缩后消息结构仍有效（tool 消息跟对应 assistant 成对）
 * - querySource 非 'main' 时，L3/L4 降级为规则摘要（防递归）
 */
export async function compressContext(
  messages: ChatMessage[],
  options: ContextManagerOptions = {},
): Promise<ChatMessage[]> {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS
  const querySource = options.querySource ?? 'main'
  let current = [...messages]
  let tokens = options.lastActualPromptTokens ?? estimateTokens(current)
  const source = options.lastActualPromptTokens ? 'api' : 'estimate'

  log.debug('Context check', { tokens, maxTokens, source, messageCount: current.length, querySource })

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

  // ── L3 Collapse：保留首尾，中间替换为摘要 ──
  if (tokens > maxTokens * L3_THRESHOLD) {
    const before = current.length
    const useLLM = querySource === 'main' && !!options.llmConfig
    current = await collapse(current, maxTokens, useLLM ? options.llmConfig : undefined)
    const after = estimateTokens(current)
    log.info(`L3 Collapse: ${before} → ${current.length} messages, ${tokens} → ${after} tokens`, { usedLLM: useLLM })
    tokens = after
  }

  // ── L4 AutoCompact：紧急全量重写（只在主循环 + 有 LLM 配置时触发） ──
  if (tokens > maxTokens * L4_THRESHOLD && querySource === 'main' && options.llmConfig) {
    const before = current.length
    current = await autoCompact(current, maxTokens, options.llmConfig)
    const after = estimateTokens(current)
    log.info(`L4 AutoCompact: ${before} → ${current.length} messages, ${tokens} → ${after} tokens`)
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
 * L3 Collapse — 保留 system prompt + 近期消息，中间替换为 LLM 生成的摘要。
 * 当 llmConfig 可用且 querySource='main' 时使用 LLM 生成摘要；否则降级为规则占位符。
 */
async function collapse(messages: ChatMessage[], maxTokens: number, llmConfig?: LLMConfig): Promise<ChatMessage[]> {
  const recentKeep = Math.max(RECENT_KEEP_COUNT, 8)
  const recentStart = Math.max(1, messages.length - recentKeep)

  const system = messages[0]
  const recent = messages.slice(recentStart)
  const middleMessages = messages.slice(1, recentStart)

  if (middleMessages.length === 0) return messages

  let summaryContent: string

  if (llmConfig) {
    try {
      setQuerySource('compact')
      summaryContent = await generateLLMSummary(middleMessages, llmConfig)
    } catch (err) {
      log.warn('L3 LLM summary failed, falling back to rule-based', { error: String(err) })
      summaryContent = buildRuleSummary(middleMessages)
    } finally {
      setQuerySource(null)
    }
  } else {
    summaryContent = buildRuleSummary(middleMessages)
  }

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
      tokens: finalTokens, maxTokens,
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

/**
 * L4 AutoCompact — 紧急全量重写。将全部对话压缩为一条摘要 + 最近几条消息。
 * 只在主循环 (querySource='main') 且 L3 仍不够时触发。
 */
async function autoCompact(messages: ChatMessage[], maxTokens: number, llmConfig: LLMConfig): Promise<ChatMessage[]> {
  const system = messages[0]
  const recentKeep = 4
  const recentStart = Math.max(1, messages.length - recentKeep)
  const toSummarize = messages.slice(1, recentStart)
  const recent = messages.slice(recentStart)

  if (toSummarize.length === 0) return messages

  let summaryContent: string
  try {
    setQuerySource('compact')
    summaryContent = await generateLLMSummary(toSummarize, llmConfig, true)
  } catch (err) {
    log.warn('L4 AutoCompact LLM summary failed', { error: String(err) })
    summaryContent = buildRuleSummary(toSummarize)
  } finally {
    setQuerySource(null)
  }

  return [
    system,
    {
      id: 'auto-compact-summary',
      role: 'system',
      content: `[AutoCompact — Full conversation summary]\n${summaryContent}`,
      timestamp: Date.now(),
    },
    ...recent,
  ]
}

/** 调用 LLM 生成对话摘要 */
async function generateLLMSummary(
  messages: ChatMessage[],
  llmConfig: LLMConfig,
  comprehensive = false,
): Promise<string> {
  const conversationText = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      if (m.role === 'tool') return `[Tool Result] ${m.content.slice(0, 200)}`
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return `[Assistant called: ${m.toolCalls.map(tc => tc.name).join(', ')}]`
      }
      return `[${m.role}] ${m.content.slice(0, 300)}`
    })
    .join('\n')
    .slice(0, 6000)

  const instruction = comprehensive
    ? '请详细总结以下对话的完整内容，包括：讨论的主题、做出的决策、完成的任务、关键代码变更、未完成的工作。确保不丢失重要信息。用中文回答，控制在 500 字以内。'
    : '请简洁总结以下对话的要点：主要话题、关键结论、执行了什么操作。用中文回答，控制在 200 字以内。'

  const resp = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llmConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: llmConfig.model,
      max_tokens: comprehensive ? 800 : 400,
      temperature: 0.2,
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: conversationText },
      ],
    }),
  })

  if (!resp.ok) {
    throw new Error(`LLM summary API error (${resp.status})`)
  }

  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
  const summary = data.choices?.[0]?.message?.content?.trim()

  if (!summary) throw new Error('Empty summary from LLM')

  return `[Context compressed — conversation summary]\n${summary}`
}

/** 规则占位符摘要（不调用 LLM 的降级方案） */
function buildRuleSummary(middleMessages: ChatMessage[]): string {
  const userMsgCount = middleMessages.filter(m => m.role === 'user').length
  const assistantMsgCount = middleMessages.filter(m => m.role === 'assistant').length
  const toolMsgCount = middleMessages.filter(m => m.role === 'tool').length
  const toolNames = new Set<string>()

  for (const m of middleMessages) {
    if (m.toolCalls) {
      for (const tc of m.toolCalls) toolNames.add(tc.name)
    }
  }

  const parts = [
    '[Context compressed — earlier conversation summary]',
    `Previous conversation contained ${userMsgCount} user messages, ${assistantMsgCount} assistant responses, and ${toolMsgCount} tool results.`,
  ]

  if (toolNames.size > 0) {
    parts.push(`Tools used: ${Array.from(toolNames).join(', ')}.`)
  }

  parts.push('Key topics discussed in earlier messages have been compressed to save context space.')
  parts.push('If you need to refer to earlier context, ask the user to clarify.')

  return parts.join('\n')
}

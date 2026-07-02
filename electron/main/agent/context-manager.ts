import type { ChatMessage, LLMConfig } from '../../../src/shared/types'
import { createLogger } from '../utils/logger'
import { chatComplete } from '../llm/index'

const log = createLogger('ContextManager')

export const DEFAULT_MAX_TOKENS = 120_000
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

  // A2: 在任何压缩层运行前快照文件读取状态。L1 Snip 会删掉早期 file_read 轮次，
  // 若等到 L3/L4 再提取就晚了——必须从原始消息捕获。对照 CC preCompactReadFileState。
  const preCompactFileReads = extractRecentFileReads(messages)

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
    current = await collapse(current, maxTokens, useLLM ? options.llmConfig : undefined, preCompactFileReads)
    const after = estimateTokens(current)
    log.info(`L3 Collapse: ${before} → ${current.length} messages, ${tokens} → ${after} tokens`, { usedLLM: useLLM })
    tokens = after
  }

  // ── L4 AutoCompact：紧急全量重写（只在主循环 + 有 LLM 配置时触发） ──
  if (tokens > maxTokens * L4_THRESHOLD && querySource === 'main' && options.llmConfig) {
    const before = current.length
    current = await autoCompact(current, maxTokens, options.llmConfig, preCompactFileReads)
    const after = estimateTokens(current)
    log.info(`L4 AutoCompact: ${before} → ${current.length} messages, ${tokens} → ${after} tokens`)
    tokens = after
  }

  return current
}

/**
 * 计算 preamble（前导消息）边界，返回最后一条 preamble 消息的索引。
 *
 * Preamble = 第一条 assistant 消息「之前」的所有消息（system + 用户任务说明）。
 * 这些消息包含任务锚点，压缩时必须永久保护。对照 CC groupMessagesByApiRound
 * 的 group 0：第一条 assistant 开启 group 1，此前都是 preamble。
 */
function getPreambleEndIndex(messages: ChatMessage[]): number {
  if (messages.length === 0) return -1

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'assistant') {
      return i - 1 // preamble 到第一条 assistant 之前为止
    }
  }

  // 没有 assistant 消息，全部都是 preamble
  return messages.length - 1
}

const FILE_READ_TOOL_NAMES = new Set(['file_read'])
const MAX_RESTORED_FILES = 5
const MAX_RESTORED_TOKENS_PER_FILE = 5_000
const MAX_RESTORED_TOTAL_TOKENS = 50_000

interface RestoredFile {
  path: string
  content: string
  /** 在原消息序列中的位置，越大越近 */
  order: number
}

/**
 * 从「将被摘要掉」的消息中提取最近读取的文件内容。
 *
 * 压缩会把中段的 file_read 结果摘要成一句话，AI 随后可能重复 Read 同一文件。
 * 这里按路径去重（保留最近一次），取最近 MAX_RESTORED_FILES 个，作为附件
 * 重新注入压缩结果，避免重复工具调用。
 *
 * 对照 CC 的 createPostCompactFileAttachments（compact.ts），但我们没有独立的
 * readFileState 全局状态，改为直接从消息历史提取——纯函数，无副作用。
 */
function extractRecentFileReads(summarizedMessages: ChatMessage[]): RestoredFile[] {
  // toolCallId → 文件路径（从 assistant 的 toolCall arguments 解析）
  const toolCallPaths = new Map<string, string>()

  for (const msg of summarizedMessages) {
    if (msg.role === 'assistant' && msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        if (!FILE_READ_TOOL_NAMES.has(tc.name)) continue
        try {
          const args = JSON.parse(tc.arguments || '{}') as { path?: string }
          if (args.path) toolCallPaths.set(tc.id, args.path)
        } catch {
          // 参数解析失败则跳过该调用
        }
      }
    }
  }

  // path → 最近一次读取结果（后出现的覆盖先出现的）
  const byPath = new Map<string, RestoredFile>()

  for (let i = 0; i < summarizedMessages.length; i++) {
    const msg = summarizedMessages[i]
    if (msg.role !== 'tool' || !msg.toolCallId) continue
    const filePath = toolCallPaths.get(msg.toolCallId)
    if (!filePath) continue
    // 跳过错误结果，避免把 "Error reading file" 当有效内容恢复
    if (msg.content.startsWith('Error')) continue
    byPath.set(filePath, { path: filePath, content: msg.content, order: i })
  }

  // 按 order 降序（最近的在前），取前 N 个
  return Array.from(byPath.values())
    .sort((a, b) => b.order - a.order)
    .slice(0, MAX_RESTORED_FILES)
}

/**
 * 将提取到的文件构造成一条附件消息，注入压缩后的上下文。
 * 严格限制单文件和总 token 上限，防止恢复本身导致上下文膨胀。
 * 返回 null 表示没有可恢复的文件。
 */
function buildFileRestoreMessage(files: RestoredFile[]): ChatMessage | null {
  if (files.length === 0) return null

  const sections: string[] = []
  let totalTokens = 0

  for (const file of files) {
    let content = file.content
    let contentTokens = estimateTokens([{ role: 'user', content } as ChatMessage])

    if (contentTokens > MAX_RESTORED_TOKENS_PER_FILE) {
      // 截断到单文件上限（token → chars，用 estimateTokens 的 2.5 反推）
      content = content.slice(0, MAX_RESTORED_TOKENS_PER_FILE * 2.5) + '\n[... truncated for compaction]'
      contentTokens = MAX_RESTORED_TOKENS_PER_FILE
    }

    if (totalTokens + contentTokens > MAX_RESTORED_TOTAL_TOKENS) break

    sections.push(`### ${file.path}\n${content}`)
    totalTokens += contentTokens
  }

  if (sections.length === 0) return null

  return {
    id: 'context-file-restore',
    role: 'system',
    content: `[压缩后文件恢复 — 以下是压缩前最近读取的文件内容，避免重复读取]\n\n${sections.join('\n\n')}`,
    timestamp: Date.now(),
  }
}

/**
 * 紧急截断 — 压缩熔断后的降级策略。
 *
 * 当 L1~L4 连续失败触发熔断时，不能什么都不做（下一轮会因超限崩溃）。
 * 这里强制保护 preamble + 保留最近消息，硬截断到目标 token 内。
 * 纯规则、零 LLM 成本、不会失败——是最后的安全兜底。
 *
 * 对照 CC：PTL 重试耗尽后抛 ERROR_MESSAGE_PROMPT_TOO_LONG 引导用户手动干预；
 * 我们是桌面伙伴产品，不适合把错误抛给用户，改为自动截断 + 保留最近上下文。
 */
export function emergencyTruncate(messages: ChatMessage[], targetTokens: number): ChatMessage[] {
  if (messages.length === 0) return messages

  const preambleEnd = getPreambleEndIndex(messages)
  const preamble = messages.slice(0, preambleEnd + 1)
  const rest = messages.slice(preambleEnd + 1)

  let tokens = estimateTokens(preamble)
  const kept: ChatMessage[] = []

  // 从最近往前保留，直到逼近目标
  for (let i = rest.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens([rest[i]])
    if (tokens + msgTokens > targetTokens && kept.length > 0) break
    kept.unshift(rest[i])
    tokens += msgTokens
  }

  return [...preamble, ...removeOrphanToolMessages(kept)]
}

/**
 * 移除孤儿 tool 消息 —— 截断可能把 assistant(toolCalls) 留在被删段，
 * 只剩 tool 结果消息在头部，会导致 LLM API 400。
 */
function removeOrphanToolMessages(messages: ChatMessage[]): ChatMessage[] {
  const validToolCallIds = new Set<string>()
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.toolCalls) {
      for (const tc of msg.toolCalls) validToolCallIds.add(tc.id)
    }
  }
  return messages.filter(
    (msg) => msg.role !== 'tool' || (msg.toolCallId != null && validToolCallIds.has(msg.toolCallId)),
  )
}

/**
 * L1 Snip — 删除最早的工具调用轮次（assistant+tool 对）。
 * 保护 preamble（任务说明）和最近消息。
 */
function snip(messages: ChatMessage[]): ChatMessage[] {
  const preambleEnd = getPreambleEndIndex(messages)
  const result: ChatMessage[] = []
  const recentStart = Math.max(preambleEnd + 1, messages.length - RECENT_KEEP_COUNT)
  let snipped = 0
  const MAX_SNIP = 5

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    // 保护 preamble、最近消息，以及达到 snip 上限
    if (i <= preambleEnd || i >= recentStart || snipped >= MAX_SNIP) {
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
async function collapse(
  messages: ChatMessage[],
  maxTokens: number,
  llmConfig?: LLMConfig,
  preCompactFileReads: RestoredFile[] = [],
): Promise<ChatMessage[]> {
  const preambleEnd = getPreambleEndIndex(messages)
  const recentKeep = Math.max(RECENT_KEEP_COUNT, 8)
  const recentStart = Math.max(preambleEnd + 1, messages.length - recentKeep)

  // A1: 保护整个 preamble（system + 任务说明 + 首条回复），而非只保护 system
  const preamble = messages.slice(0, preambleEnd + 1)
  const recent = messages.slice(recentStart)
  const middleMessages = messages.slice(preambleEnd + 1, recentStart)

  if (middleMessages.length === 0) return messages

  const preCompactTokens = estimateTokens(messages)
  let summaryContent: string
  let usedLLM = false

  if (llmConfig) {
    try {
      setQuerySource('compact')
      summaryContent = await generateLLMSummary(middleMessages, llmConfig)
      usedLLM = true
    } catch (err) {
      log.warn('L3 LLM summary failed, falling back to rule-based', { error: String(err) })
      summaryContent = buildRuleSummary(middleMessages)
    } finally {
      setQuerySource(null)
    }
  } else {
    summaryContent = buildRuleSummary(middleMessages)
  }

  // A2: 恢复压缩前最近读取的文件（快照来自 compressContext 入口，未受 L1 Snip 影响）
  const fileRestore = buildFileRestoreMessage(preCompactFileReads)

  const summaryMsg: ChatMessage = {
    id: 'context-summary',
    role: 'system',
    content: summaryContent,
    timestamp: Date.now(),
    // B3: boundary marker 元数据（postCompactTokens 在组装后回填）
    compactMetadata: {
      level: 'L3_Collapse',
      preCompactTokens,
      postCompactTokens: 0,
      trigger: 'proactive',
      compactedAt: Date.now(),
      usedLLM,
    },
  }

  const head = fileRestore ? [...preamble, summaryMsg, fileRestore] : [...preamble, summaryMsg]
  const result = [...head, ...recent]
  const finalTokens = estimateTokens(result)
  summaryMsg.compactMetadata!.postCompactTokens = finalTokens

  if (finalTokens > maxTokens) {
    log.warn('Context still over limit after L3 collapse, trimming recent messages', {
      tokens: finalTokens, maxTokens,
    })
    const trimmed = [...head]
    const insertAt = trimmed.length
    for (let i = recent.length - 1; i >= 0; i--) {
      trimmed.splice(insertAt, 0, recent[i])
      if (estimateTokens(trimmed) > maxTokens * 0.85) {
        trimmed.splice(insertAt, 1)
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
async function autoCompact(
  messages: ChatMessage[],
  maxTokens: number,
  llmConfig: LLMConfig,
  preCompactFileReads: RestoredFile[] = [],
): Promise<ChatMessage[]> {
  const preambleEnd = getPreambleEndIndex(messages)
  const recentKeep = 4
  const recentStart = Math.max(preambleEnd + 1, messages.length - recentKeep)
  // A1: 保护整个 preamble（含任务说明），而非只保护 system
  const preamble = messages.slice(0, preambleEnd + 1)
  const toSummarize = messages.slice(preambleEnd + 1, recentStart)
  const recent = messages.slice(recentStart)

  if (toSummarize.length === 0) return messages

  const preCompactTokens = estimateTokens(messages)
  let summaryContent: string
  let usedLLM = false
  try {
    setQuerySource('compact')
    summaryContent = await generateLLMSummary(toSummarize, llmConfig, true)
    usedLLM = true
  } catch (err) {
    log.warn('L4 AutoCompact LLM summary failed', { error: String(err) })
    summaryContent = buildRuleSummary(toSummarize)
  } finally {
    setQuerySource(null)
  }

  // A2: 恢复压缩前最近读取的文件（快照来自 compressContext 入口）
  const fileRestore = buildFileRestoreMessage(preCompactFileReads)

  const summaryMsg: ChatMessage = {
    id: 'auto-compact-summary',
    role: 'system',
    content: `[AutoCompact — Full conversation summary]\n${summaryContent}`,
    timestamp: Date.now(),
    compactMetadata: {
      level: 'L4_AutoCompact',
      preCompactTokens,
      postCompactTokens: 0,
      trigger: 'proactive',
      compactedAt: Date.now(),
      usedLLM,
    },
  }

  const result = fileRestore
    ? [...preamble, summaryMsg, fileRestore, ...recent]
    : [...preamble, summaryMsg, ...recent]
  summaryMsg.compactMetadata!.postCompactTokens = estimateTokens(result)
  return result
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

  // B1: 结构化摘要框架 —— 自由文本摘要在下一轮推理时易被误读，
  // 结构化框架（当前任务/已完成/状态/下一步/关键上下文）更利于 LLM 正确解读。
  // 对照 Alice Ch.5 + CC compact/prompt.ts getCompactPrompt。
  const wordLimit = comprehensive ? 500 : 300
  const instruction = `你正在为一个持续进行的对话生成压缩摘要。摘要将替换早期对话历史，供 AI 继续任务时参考。

请严格按以下结构化格式输出（每节简明扼要，缺失的节写「无」）：

## 当前任务
[用一句话说明用户的核心目标]

## 已完成步骤
[按顺序列出已完成的关键操作，无则写「无」]

## 当前状态
[进展到哪一步，遇到什么问题，无则写「无」]

## 下一步计划
[接下来应该做什么，无则写「无」]

## 关键上下文
[必须记住的信息：文件路径、变量名、配置值、用户偏好等，无则写「无」]

用中文回答，总字数控制在 ${wordLimit} 字以内。只输出上述结构，不要额外说明。`

  // 走统一路由层（chatComplete）而非直接 fetch —— 自动获得多 Provider 支持 + failover
  const summary = await chatComplete({
    config: llmConfig,
    messages: [
      { role: 'system', content: instruction },
      { role: 'user', content: conversationText },
    ],
    temperature: 0.2,
    maxTokens: comprehensive ? 800 : 400,
    caller: 'summary',
  })

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

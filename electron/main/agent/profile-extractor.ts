/**
 * 用户画像自动提取器
 *
 * 每次 Agent Loop 结束后，分析最近的对话，
 * 自动提取关于用户的 identity / workflow / voice 信息，
 * 写入记忆系统。
 *
 * 使用独立的 LLM 调用（不影响主对话流），
 * 只在用户消息包含足够线索时触发。
 */

import type { ChatMessage, LLMConfig } from '../../../src/shared/types'
import { createLogger } from '../utils/logger'
import { EXTRACTION_PROMPT } from '../prompts/texts'
import { PROMPT_KEYS } from '../prompts/keys'
import { chatComplete } from '../llm/index'
import { addMemory, listMemories, type MemoryCategory } from '../storage/memory-store'
import { recordAssetUsage } from '../utils/asset-usage'
import { MEMORY_STRATEGY_ASSET_KEYS } from '../memory/asset-keys'
import { detectSensitiveKinds } from '../../../src/shared/sensitive-memory'

export { EXTRACTION_PROMPT } from '../prompts/texts'

const log = createLogger('ProfileExtractor')

export const PROFILE_EXTRACTION_MIN_USER_MESSAGES = 3
export const PROFILE_EXTRACTION_MAX_RECENT_MESSAGES = 20
export const PROFILE_EXTRACTION_INTERVAL_MS = 2 * 60 * 1000
export const PROFILE_EXTRACTION_CATEGORIES = ['identity', 'workflow', 'voice', 'preference', 'fact', 'feedback'] as const
export const PROFILE_EXTRACTION_MAX_ITEMS = 20
export const PROFILE_EXTRACTION_MAX_CONTENT_LENGTH = 2_000

export function isSafeExtractedProfileItem(value: unknown): value is { category: MemoryCategory; content: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.category === 'string'
    && PROFILE_EXTRACTION_CATEGORIES.includes(item.category as typeof PROFILE_EXTRACTION_CATEGORIES[number])
    && typeof item.content === 'string'
    && item.content.length > 0
    && item.content.length <= PROFILE_EXTRACTION_MAX_CONTENT_LENGTH
    && detectSensitiveKinds(item.content).length === 0
}

let lastExtractTime = 0

export async function maybeExtractProfile(
  messages: ChatMessage[],
  config: LLMConfig,
  latestAssistantContent?: string,
  opts?: { roleId?: string; sessionId?: string },
): Promise<void> {
  const now = Date.now()
  if (now - lastExtractTime < PROFILE_EXTRACTION_INTERVAL_MS) return

  const userMessages = messages.filter(m => m.role === 'user')
  if (userMessages.length < PROFILE_EXTRACTION_MIN_USER_MESSAGES) return

  log.info('Starting profile extraction', { userMessageCount: userMessages.length })
  void recordAssetUsage({
    assetKey: MEMORY_STRATEGY_ASSET_KEYS.profileExtraction,
    relation: 'triggered', usageKind: 'memory-operation', sessionId: opts?.sessionId,
    status: 'running', metadata: { userMessageCount: userMessages.length },
  })

  try {
    const allMessages = latestAssistantContent
      ? [...messages, { id: 'latest', role: 'assistant' as const, content: latestAssistantContent, timestamp: Date.now() }]
      : messages
    const recentMessages = allMessages.slice(-PROFILE_EXTRACTION_MAX_RECENT_MESSAGES)
    const conversationText = recentMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? '用户' : '助手'}： ${m.content.slice(0, 500)}`)
      .join('\n\n')

    const existingMemories = await listMemories()
    const existingFacts = existingMemories
      .filter((memory) => !detectSensitiveKinds(memory.content).includes('credentials'))
      .map((memory) => memory.content)
      .join('; ')

    const prompt = existingFacts
      ? `已知的用户信息：${existingFacts}\n\n不要重复已知事实，只提取新信息。\n\n近期对话：\n${conversationText}`
      : `近期对话：\n${conversationText}`

    // 走统一路由层（chatComplete）而非直接 fetch —— 自动获得多 Provider 支持 + failover
    let text: string
    try {
      text = await chatComplete({
        config,
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        maxTokens: 500,
        caller: 'profile',
        promptAssetKeys: [PROMPT_KEYS.profileExtraction],
        sessionId: opts?.sessionId,
      })
    } catch (apiErr) {
      const errorMessage = apiErr instanceof Error ? apiErr.message : String(apiErr)
      log.warn('Profile extraction API failed', { errorType: apiErr instanceof Error ? apiErr.name : 'unknown', errorLength: errorMessage.length })
      void recordAssetUsage({
        assetKey: MEMORY_STRATEGY_ASSET_KEYS.profileExtraction,
        relation: 'used', usageKind: 'memory-operation', sessionId: opts?.sessionId,
        status: 'error', metadata: { candidateCount: 0, writtenCount: 0 },
      })
      return
    }

    const jsonMatch = /\[[\s\S]*\]/.exec(text)
    if (!jsonMatch) {
      void recordAssetUsage({
        assetKey: MEMORY_STRATEGY_ASSET_KEYS.profileExtraction,
        relation: 'used', usageKind: 'memory-operation', sessionId: opts?.sessionId,
        status: 'success', metadata: { candidateCount: 0, writtenCount: 0 },
      })
      return
    }

    const parsedItems: unknown = JSON.parse(jsonMatch[0])

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      log.info('No new profile items extracted')
      void recordAssetUsage({
        assetKey: MEMORY_STRATEGY_ASSET_KEYS.profileExtraction,
        relation: 'used', usageKind: 'memory-operation', sessionId: opts?.sessionId,
        status: 'success', metadata: { candidateCount: 0, writtenCount: 0 },
      })
      return
    }

    const items = parsedItems.slice(0, PROFILE_EXTRACTION_MAX_ITEMS)
    let added = 0
    let sensitiveSkipped = 0

    for (const rawItem of items) {
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) continue
      const candidate = rawItem as Record<string, unknown>
      if (typeof candidate.content === 'string' && detectSensitiveKinds(candidate.content).length > 0) {
        sensitiveSkipped++
        continue
      }
      if (!isSafeExtractedProfileItem(rawItem)) continue
      const item = rawItem

      const isDuplicate = existingMemories.some(
        m => m.content.toLowerCase() === item.content.toLowerCase(),
      )
      if (isDuplicate) continue

      await addMemory(item.category as MemoryCategory, item.content, {
        roleId: item.category === 'feedback' ? opts?.roleId : undefined,
      })
      added++
      log.info('Profile item added', { category: item.category, contentLength: item.content.length })
    }

    lastExtractTime = Date.now()

    if (added > 0) {
      log.info(`Profile extraction complete: ${added} new items added`)
    }
    void recordAssetUsage({
      assetKey: MEMORY_STRATEGY_ASSET_KEYS.profileExtraction,
      relation: 'used', usageKind: 'memory-operation', sessionId: opts?.sessionId,
      status: 'success', metadata: { candidateCount: items.length, writtenCount: added, sensitiveSkipped },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    log.warn('Profile extraction error', { errorType: err instanceof Error ? err.name : 'unknown', errorLength: errorMessage.length })
    void recordAssetUsage({
      assetKey: MEMORY_STRATEGY_ASSET_KEYS.profileExtraction,
      relation: 'used', usageKind: 'memory-operation', sessionId: opts?.sessionId,
      status: 'error', metadata: { candidateCount: 0, writtenCount: 0 },
    })
  }
}

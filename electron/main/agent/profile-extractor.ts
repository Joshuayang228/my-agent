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
import { addMemory, listMemories, type MemoryCategory } from '../storage/memory-store'

const log = createLogger('ProfileExtractor')

const EXTRACTION_PROMPT = `You are a user profile analyzer. Given the recent conversation, extract any NEW information about the user. Only extract information that is clearly stated or strongly implied.

Output a JSON array where each item has:
- "category": one of "identity", "workflow", "voice"
- "content": a concise statement (one sentence max)

Categories:
- identity: who they are (name, role, interests, tech stack, location, etc.)
- workflow: how they work (tools, habits, schedule, preferences for collaboration)
- voice: communication style (formal/casual, language preferences, humor style)

Rules:
- Only extract facts clearly supported by the conversation
- Skip vague or uncertain information
- Skip information that is too generic (e.g. "uses a computer")
- Return [] if nothing new is found
- Respond with ONLY the JSON array, no other text`

const MIN_USER_MESSAGES = 3
const MAX_RECENT_MESSAGES = 20
const EXTRACT_INTERVAL_MS = 5 * 60 * 1000

let lastExtractTime = 0

export async function maybeExtractProfile(
  messages: ChatMessage[],
  config: LLMConfig,
): Promise<void> {
  const now = Date.now()
  if (now - lastExtractTime < EXTRACT_INTERVAL_MS) return

  const userMessages = messages.filter(m => m.role === 'user')
  if (userMessages.length < MIN_USER_MESSAGES) return

  lastExtractTime = now
  log.info('Starting profile extraction', { userMessageCount: userMessages.length })

  try {
    const recentMessages = messages.slice(-MAX_RECENT_MESSAGES)
    const conversationText = recentMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 500)}`)
      .join('\n\n')

    const existingMemories = await listMemories()
    const existingFacts = existingMemories.map(m => m.content).join('; ')

    const prompt = existingFacts
      ? `Already known about this user: ${existingFacts}\n\nDo NOT repeat known facts. Only extract NEW information.\n\nRecent conversation:\n${conversationText}`
      : `Recent conversation:\n${conversationText}`

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      log.warn('Profile extraction API failed', { status: response.status })
      return
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return

    const jsonMatch = /\[[\s\S]*\]/.exec(text)
    if (!jsonMatch) return

    const items = JSON.parse(jsonMatch[0]) as Array<{
      category: string
      content: string
    }>

    if (!Array.isArray(items) || items.length === 0) {
      log.info('No new profile items extracted')
      return
    }

    const validCategories = new Set<string>(['identity', 'workflow', 'voice'])
    let added = 0

    for (const item of items) {
      if (!validCategories.has(item.category) || !item.content) continue

      const isDuplicate = existingMemories.some(
        m => m.content.toLowerCase() === item.content.toLowerCase(),
      )
      if (isDuplicate) continue

      await addMemory(item.category as MemoryCategory, item.content)
      added++
      log.info('Profile item added', { category: item.category, content: item.content })
    }

    if (added > 0) {
      log.info(`Profile extraction complete: ${added} new items added`)
    }
  } catch (err) {
    log.warn('Profile extraction error', { error: err instanceof Error ? err.message : String(err) })
  }
}

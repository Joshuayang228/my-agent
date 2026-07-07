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
import { chatComplete } from '../llm/index'
import { addMemory, listMemories, type MemoryCategory } from '../storage/memory-store'

const log = createLogger('ProfileExtractor')

const EXTRACTION_PROMPT = `You are a user profile analyzer. Given the recent conversation, extract any NEW, DURABLE information about the user. The guiding test: a memory should be something that "stays useful once added" — not a log of what happened.

Output a JSON array where each item has:
- "category": one of "identity", "workflow", "voice", "preference", "fact", "feedback"
- "content": a concise statement (one sentence max)

Categories:
- identity: who they are (name, role, interests, tech stack, location, etc.)
- workflow: how they work (tools, habits, schedule, preferences for collaboration)
- voice: communication style (formal/casual, language preferences, humor style)
- preference: explicit preferences (likes/dislikes, preferred tools, approaches, aesthetic choices)
- fact: durable facts about their projects, environment, or context
- feedback: the user's corrections AND confirmations about how you should work. BOTH matter:
  - correction ("don't auto-commit", "stop explaining so much") — what to change
  - confirmation ("that's exactly right", "yes, keep doing it this way") — what to keep doing
  For feedback, phrase content as "what to do/avoid + why", e.g. "Prefers concise answers without preamble (said long explanations waste time)". Confirmations are as valuable as corrections — remembering "you did that well last time" is core to being a companion, not just a tool.

DO save (durable knowledge):
- Stable preferences and habits ("prefers TypeScript over JS", "works late at night")
- Identity facts (role, expertise, tech stack, location)
- Explicit corrections about how they want you to work → category "feedback"
- Explicit confirmations that you did something the right way → category "feedback"

Do NOT save (these are noise or belong elsewhere):
- Transient task state ("currently debugging the login flow", "on step 3")
- Anything derivable from the current conversation or easily re-observed
- The assistant's own instructions, persona, or behavior rules
- Overly generic statements ("uses a computer", "likes good code")
- One-off facts that won't matter in the next conversation

Rules:
- Only extract facts clearly supported by the conversation
- Skip vague or uncertain information
- Return [] if nothing durable is found
- Respond with ONLY the JSON array, no other text`

const MIN_USER_MESSAGES = 3
const MAX_RECENT_MESSAGES = 20
const EXTRACT_INTERVAL_MS = 2 * 60 * 1000

let lastExtractTime = 0

export async function maybeExtractProfile(
  messages: ChatMessage[],
  config: LLMConfig,
  latestAssistantContent?: string,
): Promise<void> {
  const now = Date.now()
  if (now - lastExtractTime < EXTRACT_INTERVAL_MS) return

  const userMessages = messages.filter(m => m.role === 'user')
  if (userMessages.length < MIN_USER_MESSAGES) return

  log.info('Starting profile extraction', { userMessageCount: userMessages.length })

  try {
    const allMessages = latestAssistantContent
      ? [...messages, { id: 'latest', role: 'assistant' as const, content: latestAssistantContent, timestamp: Date.now() }]
      : messages
    const recentMessages = allMessages.slice(-MAX_RECENT_MESSAGES)
    const conversationText = recentMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 500)}`)
      .join('\n\n')

    const existingMemories = await listMemories()
    const existingFacts = existingMemories.map(m => m.content).join('; ')

    const prompt = existingFacts
      ? `Already known about this user: ${existingFacts}\n\nDo NOT repeat known facts. Only extract NEW information.\n\nRecent conversation:\n${conversationText}`
      : `Recent conversation:\n${conversationText}`

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
      })
    } catch (apiErr) {
      log.warn('Profile extraction API failed', { error: apiErr instanceof Error ? apiErr.message : String(apiErr) })
      return
    }

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

    const validCategories = new Set<string>(['identity', 'workflow', 'voice', 'preference', 'fact', 'feedback'])
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

    lastExtractTime = Date.now()

    if (added > 0) {
      log.info(`Profile extraction complete: ${added} new items added`)
    }
  } catch (err) {
    log.warn('Profile extraction error', { error: err instanceof Error ? err.message : String(err) })
  }
}

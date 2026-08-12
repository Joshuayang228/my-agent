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

export const EXTRACTION_PROMPT = `你是用户画像分析器。请根据近期对话，提取关于用户的、此前尚未记录且长期有效的信息。判断标准是：一条记忆在加入后应当能持续发挥作用，而不是对已发生事情的流水账。

输出 JSON 数组，每一项包含：
- "category"：只能是 "identity"、"workflow"、"voice"、"preference"、"fact"、"feedback" 之一
- "content"：简洁陈述，最多一句话

类别说明：
- identity：用户是谁，例如姓名、角色、兴趣、技术栈、所在地等
- workflow：用户如何工作，例如工具、习惯、日程、协作偏好
- voice：用户的沟通风格，例如正式或随意、语言偏好、幽默风格
- preference：用户明确表达的偏好，例如喜欢或不喜欢的工具、方法、审美选择
- fact：关于用户项目、环境或背景的长期事实
- feedback：用户对你工作方式的纠正与确认，两者都重要：
  - 纠正，例如“不要自动提交”“别解释这么多”——表示需要改变什么
  - 确认，例如“完全正确”“以后继续这样做”——表示应当保持什么
  对 feedback，content 应写成“应该做或避免什么 + 原因”，例如“偏好省略铺垫的简洁回答，因为长篇解释浪费时间”。确认和纠正同样有价值；记住“你上次这样做得很好”是伙伴关系的一部分，而不只是工具行为。

应该保存（长期知识）：
- 稳定的偏好和习惯，例如“偏好 TypeScript 而不是 JS”“经常深夜工作”
- 身份事实，例如角色、专业水平、技术栈、所在地
- 用户明确纠正你应如何工作的内容，category 使用 "feedback"
- 用户明确确认你采用了正确工作方式的内容，category 使用 "feedback"
- 只提取助手应该记住的用户信息；不要提取助手应该记住的自身信息

不要保存（噪声或应归入其他系统）：
- 临时任务状态，例如“正在调试登录流程”“目前到第 3 步”
- 可从当前对话直接推导或很容易再次观察到的信息
- 助手自身的指令、人设或行为规则
- 助手承诺将来记住某事；那是助手要执行的动作，不是关于用户的事实
- 过于泛化的陈述，例如“会使用电脑”“喜欢好代码”
- 只出现一次、下次对话不会再有价值的事实

规则：
- 只提取有对话明确支持的事实
- 跳过模糊或不确定的信息
- 没有长期有效信息时返回 []
- 只输出 JSON 数组，不要输出其他文字`

const MIN_USER_MESSAGES = 3
const MAX_RECENT_MESSAGES = 20
const EXTRACT_INTERVAL_MS = 2 * 60 * 1000

let lastExtractTime = 0

export async function maybeExtractProfile(
  messages: ChatMessage[],
  config: LLMConfig,
  latestAssistantContent?: string,
  opts?: { roleId?: string; sessionId?: string },
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
      .map(m => `${m.role === 'user' ? '用户' : '助手'}： ${m.content.slice(0, 500)}`)
      .join('\n\n')

    const existingMemories = await listMemories()
    const existingFacts = existingMemories.map(m => m.content).join('; ')

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
        sessionId: opts?.sessionId,
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

      await addMemory(item.category as MemoryCategory, item.content, {
        roleId: item.category === 'feedback' ? opts?.roleId : undefined,
      })
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

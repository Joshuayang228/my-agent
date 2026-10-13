import type { ChatMessage } from '../../../src/shared/types'

/** 画像提取输入包装；已知事实防重复，原始对话仍是运行时资料。 */
export function buildProfileExtractionInputPrompt(messages: ChatMessage[], existingFacts: string): string {
    const conversationText = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? '用户' : '助手'}： ${m.content.slice(0, 500)}`)
      .join('\n\n')

    return existingFacts
      ? `已知的用户信息：${existingFacts}\n\n不要重复已知事实，只提取新信息。\n\n近期对话：\n${conversationText}`
      : `近期对话：\n${conversationText}`
}

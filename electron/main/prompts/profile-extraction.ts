import type { ChatMessage } from '../../../src/shared/types'
import { composeFeaturePrompt } from './composition'

/** 画像提取输入包装；已知事实防重复，原始对话仍是运行时资料。 */
export function buildProfileExtractionInputPrompt(messages: ChatMessage[], existingFacts: string): string {
    const conversationText = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? '用户' : '助手'}： ${m.content.slice(0, 500)}`)
      .join('\n\n')

    return composeFeaturePrompt('profileExtraction', {
      platformRules: '只提取用户本人明确表达且有原话证据的事实；助手、人物设定和世界资料不能写入用户画像。',
      featureRules: existingFacts ? '不要重复已知事实，只提取新信息。' : '从近期对话中筛选可验证的用户信息。',
      characterAdapter: '人物信息只用于识别并排除人物事实，不用于生成用户画像。',
      runtimeData: { existingFacts, recentConversation: conversationText },
      outputRules: '继续由画像提炼器使用既有结构化 JSON 输出和敏感信息校验。',
    })
}

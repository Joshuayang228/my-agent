import { compileTitleRequest } from '../prompts/registered-request'
import { chatComplete } from '../llm/index'
import { getSessionTitle, updateSessionTitle } from '../storage/session-store'
import { createLogger } from '../utils/logger'
import type { LLMConfig } from '../../../src/shared/types'

const log = createLogger('SessionTitleService')

export async function generateSmartTitle(
  sessionId: string,
  userMessage: string,
  assistantReply: string,
  llmConfig: LLMConfig,
  opts?: { force?: boolean },
): Promise<void> {
  try {
    if (!opts?.force) {
      const title = await getSessionTitle(sessionId)
      if (title === null || (title !== '新对话' && title !== 'New Chat')) return
    }

    // 走统一路由层（chatComplete）而非直接 fetch —— 自动获得多 Provider 支持 + failover
    // maxTokens 略放宽：即使未关闭 thinking，也给正文留一点预算
    const title = (await chatComplete({
      config: llmConfig,
      request: compileTitleRequest(userMessage, assistantReply),
      temperature: 0.3,
      maxTokens: 64,
      caller: 'title',
      sessionId,
    })).trim()

    if (title && title.length >= 2 && title.length <= 30) {
      await updateSessionTitle(sessionId, title)
      log.info('Smart title generated', { sessionId, title })
    }
  } catch (err) {
    log.warn('Smart title generation failed', { error: String(err) })
  }
}

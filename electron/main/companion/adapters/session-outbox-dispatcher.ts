import { dispatchCompanionOutbox } from '../core/outbox/outbox'
import { saveMessageIfAbsent } from '../../storage/session-store'
import type { ChatMessage } from '../../../../src/shared/types'

/**
 * 投递人物世界主会话增量消息。
 *
 * 背景：生活服务直接写主会话会让领域事实和用户可见消息无法分别重试。
 * 设计意图：主会话消息作为 Outbox 消费，由消息 ID 做最终幂等，事实提交失败不会伪造已送达消息。
 * 关键约束：只消费 main-session-message，消息已存在时视为成功，不能重复插入同一消息。
 */
export async function dispatchCompanionSessionOutbox(limit = 20): Promise<number> {
  return dispatchCompanionOutbox({
    limit,
    kinds: ['main-session-message'],
    deliver: async (message) => {
      const payload = message.payload as { sessionId?: unknown; message?: unknown }
      if (typeof payload.sessionId !== 'string' || !payload.message || typeof payload.message !== 'object') throw new Error('主会话消息载荷无效。')
      await saveMessageIfAbsent(payload.sessionId, payload.message as ChatMessage)
    },
  })
}

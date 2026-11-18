import { contentProvenanceFromEvent } from '../../../../src/shared/content-integrity'
import { getDatabase } from '../../storage/database'
import { ensureMemoryTable, writeMemoryToDatabase } from '../../storage/memory-store'
import { createLogger } from '../../utils/logger'
import { getCompanionDomainEventById } from '../core/events/domain-events'
import { COMPANION_FOLLOWUP, COMPANION_FOLLOWUP_KINDS } from '../core/outbox/followup-kinds'
import { assertCompanionOutboxClaim, dispatchCompanionOutbox } from '../core/outbox/outbox'
import { recordCompanionProjection } from '../core/projections/receipts'
import { isCompanionCommitActive, withCompanionUnitOfWork } from '../core/transaction/unit-of-work'
import { tryRecordMilestone } from '../growth/milestones'
import { markResonanceFeedbackDelivered, settleChatResonance } from '../life/chat-resonance'
import { settleVitalsAfterChat } from '../life/world-state'
import { loadAuxLLMConfig } from '../../llm/aux-config'

const log = createLogger('CompanionFollowups')

/**
 * 背景：日记和信物已提交时进程可能退出，后续记忆或里程碑不能依靠当前调用继续存活。
 * 设计意图：使用现有 Outbox 领取与恢复。业务写入和消费回执同库提交，迟到或重复投递可安全结束。
 * 关键约束：只接收内部类型，窗口不消费；内存索引通知必须等数据库提交。
 */
export async function recoverCompanionFollowups(): Promise<void> {
  if (isCompanionCommitActive()) return
  try {
    await dispatchCompanionOutbox({
      kinds: COMPANION_FOLLOWUP_KINDS.filter(kind => kind !== COMPANION_FOLLOWUP.chatResonance),
      deliver: async message => {
        const { eventId, kind, roleId, payload } = message
        if (!eventId) throw new Error('人物后续任务缺少来源事件。')
        const afterCommit = await withCompanionUnitOfWork(async () => {
          // 等待数据库时租约可能过期。事务内复核后才写回执，避免旧领取先于恢复执行者提交。
          await assertCompanionOutboxClaim(message)
          const first = await recordCompanionProjection({ projectionName: kind, eventId })
          if (!first) return undefined
          if (kind === COMPANION_FOLLOWUP.nightlyMemory) {
            const event = await getCompanionDomainEventById(eventId)
            const epiphany = event?.payload.epiphany
            if (!event?.sourceId || event.roleId !== roleId || event.type !== 'nightly_reflection_created' || typeof epiphany !== 'string') throw new Error('日记感悟任务无效。')
            await ensureMemoryTable()
            const result = writeMemoryToDatabase(await getDatabase(), 'feedback', `[深夜感悟] ${epiphany}`, {
              roleId,
              provenance: contentProvenanceFromEvent({ origin: 'agent', sourceType: 'nightly-reflection', sourceId: event.sourceId, occurredAt: event.occurredAt }),
            })
            return result.afterCommit
          }
          if (kind === COMPANION_FOLLOWUP.keepsakeMilestone) {
            const { roleDisplayName, occurredAt } = payload
            if (typeof roleDisplayName !== 'string' || typeof occurredAt !== 'number') throw new Error('信物里程碑任务无效。')
            await tryRecordMilestone(roleId, 'keepsake_gifted', { roleDisplayName, now: occurredAt })
            return undefined
          }
          if (kind === COMPANION_FOLLOWUP.chatVitals || kind === COMPANION_FOLLOWUP.chatFeedback) {
            const event = await getCompanionDomainEventById(eventId)
            if (event?.type !== 'conversation_turn_completed' || event.roleId !== roleId) throw new Error('对话结算任务无效。')
            if (kind === COMPANION_FOLLOWUP.chatVitals) await settleVitalsAfterChat(roleId)
            else if (typeof event.payload.pendingFeedbackId === 'string') {
              await markResonanceFeedbackDelivered(event.payload.pendingFeedbackId, { roleId, deliveredAt: event.occurredAt })
            } else throw new Error('对话反馈任务缺少反馈标识。')
            return undefined
          }
          throw new Error('未知人物后续任务。')
        })
        afterCommit?.()
      },
    })
    await dispatchCompanionOutbox({
      kinds: [COMPANION_FOLLOWUP.chatResonance],
      leaseMs: 150_000,
      deliver: async message => {
        const event = message.eventId ? await getCompanionDomainEventById(message.eventId) : null
        const sessionId = event?.payload.sessionId
        if (event?.type !== 'conversation_turn_completed' || event.roleId !== message.roleId || !event.sourceId || typeof sessionId !== 'string') {
          throw new Error('对话共鸣任务缺少原始消息。')
        }
        const projection = (await getDatabase()).exec('SELECT 1 FROM companion_projection_receipts WHERE projection_name = ? AND event_id = ?', [COMPANION_FOLLOWUP.chatResonance, event.id])
        if (projection.length) return
        await settleChatResonance(message.roleId, sessionId, await loadAuxLLMConfig(), {
          sourceEventId: event.id,
          assistantMessageId: event.sourceId,
          assertClaim: () => assertCompanionOutboxClaim(message),
        })
      },
    })
  } catch (error) {
    log.warn('Companion followup recovery deferred', { errorType: error instanceof Error ? error.name : 'unknown' })
  }
}

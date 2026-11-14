import { randomUUID } from 'node:crypto'
import type { CompanionEvent, CompanionEventStatus } from '../types'
import * as legacyStore from '../life/store'
import { appendCompanionDomainEvent } from '../core/events/domain-events'
import { withCompanionUnitOfWork } from '../core/transaction/unit-of-work'
import { attachContentProvenance, contentProvenanceFromEvent } from '../../../../src/shared/content-integrity'

/**
 * 创建生活事件并登记 Core 事实。
 *
 * 背景：日剧本和文化心愿过去直接写入旧 events 表，Core 账本无法证明事件何时产生。
 * 设计意图：应用层在同一 Unit of Work 内写旧查询投影和 Core Domain Event，让现有读取者继续工作，同时把新事实接入统一事件链。
 * 关键约束：事件 ID 是幂等键，Core 事件只记录创建事实，发布和执行由后续生命周期动作记录；模型与窗口副作用不能进入事务。
 */
export async function createCompanionLifeEvent(input: {
  id?: string
  roleId: string
  universeId?: string
  scheduledAt: number
  status: CompanionEventStatus
  type: string
  payload: Record<string, unknown>
  dayScriptId: string | null
}): Promise<CompanionEvent> {
  const eventId = input.id ?? randomUUID()
  return withCompanionUnitOfWork(async () => {
    const existing = await legacyStore.getEventById(eventId)
    if (existing) return existing
    const event = await legacyStore.insertEvent({
      id: eventId,
      roleId: input.roleId,
      scheduledAt: input.scheduledAt,
      status: input.status,
      type: input.type,
      payload: input.payload,
      dayScriptId: input.dayScriptId,
    })
    await appendCompanionDomainEvent({
      roleId: input.roleId,
      universeId: input.universeId ?? 'default',
      type: 'life_event_created',
      sourceType: 'life_event',
      sourceId: event.id,
      causationId: null,
      correlationId: event.id,
      idempotencyKey: `life-event-created:${event.id}`,
      occurredAt: event.scheduledAt,
      payload: attachContentProvenance(input.payload, contentProvenanceFromEvent({
        origin: 'derived',
        sourceType: 'life_event',
        sourceId: event.id,
        occurredAt: event.scheduledAt,
      })),
      schemaVersion: 1,
    })
    return event
  })
}

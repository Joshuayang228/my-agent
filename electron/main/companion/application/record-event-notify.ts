import { appendCompanionDomainEvent } from '../core/events/domain-events'
import { getCompanionRuntimeState } from '../core/state/runtime-state'
import { enqueueCompanionOutbox } from '../core/outbox/outbox'
import { dispatchCompanionWindowOutbox } from '../adapters/window-outbox-dispatcher'
import { withCompanionUnitOfWork } from '../core/transaction/unit-of-work'

/**
 * 记录人物世界事实并投递对应的用户可见通知。
 *
 * 背景：生活服务过去先写自己的表，再直接向窗口广播，事件历史和通知状态无法关联。
 * 设计意图：应用层把核心事实账本和 Electron 投递适配器编排在同一条路径，核心层本身不依赖窗口运行时。
 * 关键约束：先写事件再写出站消息，通知失败保留 Outbox 状态供下一轮重试，不能绕过核心事实账本直接广播。
 */
export async function recordCompanionEventAndNotify(input: {
  roleId: string
  type: string
  sourceType: string
  sourceId: string
  idempotencyKey: string
  occurredAt: number
  payload: Record<string, unknown>
  notification: {
    kind: string
    dedupeKey: string
    payload: Record<string, unknown>
  } | Array<{
    kind: string
    dedupeKey: string
    payload: Record<string, unknown>
  }>
}): Promise<{ eventId: string }> {
  const event = await withCompanionUnitOfWork(async () => {
    const runtime = await getCompanionRuntimeState(input.roleId)
    const domainEvent = await appendCompanionDomainEvent({
      roleId: input.roleId,
      universeId: runtime.universeId,
      type: input.type,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      causationId: input.sourceId,
      correlationId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
      occurredAt: input.occurredAt,
      payload: input.payload,
      schemaVersion: 1,
    })
    const notifications = Array.isArray(input.notification) ? input.notification : [input.notification]
    for (const notification of notifications) {
      await enqueueCompanionOutbox({
        roleId: input.roleId,
        eventId: domainEvent.id,
        kind: notification.kind,
        dedupeKey: notification.dedupeKey,
        payload: notification.payload,
      })
    }
    return domainEvent
  })
  await dispatchCompanionWindowOutbox()
  return { eventId: event.id }
}

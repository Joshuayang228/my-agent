import type { DayScriptPayload, DayScriptRow } from '../types'
import * as legacyStore from '../life/store'
import { appendCompanionDomainEvent } from '../core/events/domain-events'
import { withCompanionUnitOfWork } from '../core/transaction/unit-of-work'
import { attachContentProvenance, contentProvenanceFromEvent } from '../../../../src/shared/content-integrity'

/**
 * 创建日剧本并登记 Core 事实。
 *
 * 背景：日剧本是生活事件的上游，直接写旧 day_scripts 表会让 Core 账本缺少生成依据。
 * 设计意图：在同一 Unit of Work 内写查询投影和剧本生成事件，后续事件槽位继续通过生活事件入口登记。
 * 关键约束：同一角色同一天只允许一份剧本，模型生成发生在调用方事务之外，Core 事件使用剧本 ID 幂等。
 */
export async function createCompanionDayScript(input: {
  roleId: string
  universeId?: string
  date: string
  payload: DayScriptPayload
}): Promise<DayScriptRow> {
  return withCompanionUnitOfWork(async () => {
    const existing = await legacyStore.getDayScript(input.roleId, input.date)
    if (existing) return existing
    const row = await legacyStore.insertDayScript(input.roleId, input.date, input.payload)
    await appendCompanionDomainEvent({
      roleId: input.roleId,
      universeId: input.universeId ?? 'default',
      type: 'day_script_created',
      sourceType: 'day_script',
      sourceId: row.id,
      causationId: null,
      correlationId: row.id,
      idempotencyKey: `day-script-created:${row.id}`,
      occurredAt: row.createdAt,
      payload: attachContentProvenance({ date: row.date, payload: row.payload }, contentProvenanceFromEvent({
        origin: 'derived',
        sourceType: 'day_script',
        sourceId: row.id,
        occurredAt: row.createdAt,
      })),
      schemaVersion: 1,
    })
    return row
  })
}

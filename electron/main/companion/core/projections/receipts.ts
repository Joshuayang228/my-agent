import { getDatabase, persist } from '../../../storage/database'
import { ensureCompanionCoreSchema } from '../schema'

/**
 * 记录一次领域事件已被指定投影消费。
 *
 * 背景：迁移期旧生活表仍承担读取职责，同一事件可能因重试被重复投影，造成重复卡片、重复关系变化或重复资产。
 * 设计意图：以 projection_name + event_id 作为消费幂等边界，让投影器可以安全重试，不把去重逻辑散落到各张业务表。
 * 关键约束：只在投影实际完成后调用，唯一键冲突返回 false，不能把“已开始”误记成“已完成”。
 */
export async function recordCompanionProjection(input: {
  projectionName: string
  eventId: string
  appliedAt?: number
}): Promise<boolean> {
  await ensureCompanionCoreSchema()
  const db = await getDatabase()
  const existing = db.exec('SELECT 1 FROM companion_projection_receipts WHERE projection_name = ? AND event_id = ?', [input.projectionName, input.eventId])[0]?.values[0]
  if (existing) return false
  db.run('INSERT INTO companion_projection_receipts (projection_name, event_id, applied_at) VALUES (?, ?, ?)', [input.projectionName, input.eventId, input.appliedAt ?? Date.now()])
  persist()
  return true
}

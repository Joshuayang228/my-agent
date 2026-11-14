import { z } from 'zod'

export const contentOriginSchema = z.enum(['user', 'agent', 'system', 'role-pack', 'derived'])
export type ContentOrigin = z.infer<typeof contentOriginSchema>

export const contentProvenanceSchema = z.object({
  origin: contentOriginSchema,
  sourceType: z.string().trim().min(1).max(120),
  sourceId: z.string().trim().min(1).max(240).optional(),
  eventId: z.string().trim().min(1).max(240).optional(),
  traceId: z.string().trim().min(1).max(240).optional(),
  occurredAt: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
}).strict()
export type ContentProvenance = z.infer<typeof contentProvenanceSchema>

export interface ContentEventIntegrityInput {
  roleId: string
  type: string
  sourceType: string
  sourceId: string | null
  correlationId: string
  idempotencyKey: string
  occurredAt: number
  payload: Record<string, unknown>
  schemaVersion: number
}

/**
 * 背景：人物内容由用户、模型、生活引擎和 Role Pack 共同产生，来源缺失时无法判断事实是否可信。
 * 设计意图：把来源、时间、关联和置信度收成共享纯校验，供领域事件和内容 Eval 复用，不让每个面板各自解释来源。
 * 关键约束：角色、事件类型、关联 ID、幂等键和发生时间必须存在；校验失败必须拒绝事实提交，不能降级为无来源内容。
 */
export function contentIntegrityError(input: ContentEventIntegrityInput): string | null {
  if (!input.roleId.trim()) return '内容事实缺少人物归属。'
  if (!input.type.trim()) return '内容事实缺少事件类型。'
  if (!input.sourceType.trim()) return '内容事实缺少来源类型。'
  if (!input.correlationId.trim()) return '内容事实缺少关联 ID。'
  if (!input.idempotencyKey.trim()) return '内容事实缺少幂等键。'
  if (!Number.isSafeInteger(input.occurredAt) || input.occurredAt < 0) return '内容事实时间无效。'
  if (!Number.isInteger(input.schemaVersion) || input.schemaVersion < 1) return '内容事实版本无效。'
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) return '内容事实载荷无效。'
  return null
}

export function attachContentProvenance(
  payload: Record<string, unknown>,
  provenance: ContentProvenance,
): Record<string, unknown> {
  const result = contentProvenanceSchema.safeParse(provenance)
  if (!result.success) throw new Error('内容来源证据无效，未保存。')
  const existing = payload.contentProvenance
  if (existing !== undefined) {
    const current = contentProvenanceSchema.safeParse(existing)
    if (!current.success) throw new Error('已有内容来源证据无效，拒绝覆盖。')
    return { ...payload }
  }
  return { ...payload, contentProvenance: result.data }
}

export function contentProvenanceFromEvent(input: {
  origin: ContentOrigin
  sourceType: string
  sourceId?: string | null
  eventId?: string
  traceId?: string
  occurredAt: number
  confidence?: number
}): ContentProvenance {
  return contentProvenanceSchema.parse({
    origin: input.origin,
    sourceType: input.sourceType,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    ...(input.eventId ? { eventId: input.eventId } : {}),
    ...(input.traceId ? { traceId: input.traceId } : {}),
    occurredAt: input.occurredAt,
    ...(input.confidence === undefined ? {} : { confidence: input.confidence }),
  })
}

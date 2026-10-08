import { z } from 'zod'
import type { GeneratedImageReference } from './types'

const imageReferenceSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/), path: z.string().min(1),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  width: z.number().int().positive(), height: z.number().int().positive(),
  byteLength: z.number().int().positive(),
})

export function worldRecordImageReference(payload: Record<string, unknown>): GeneratedImageReference | null {
  const result = imageReferenceSchema.safeParse(payload.image)
  return result.success ? result.data : null
}

const identity = z.string().trim().min(1).max(160)
const shortText = z.string().trim().max(160)
const narrative = z.string().max(4000)
const timestamp = z.number().int().min(0).max(8_640_000_000_000_000)
const date = z.iso.date()

export const wardrobeCategorySchema = z.enum(['top', 'bottom', 'outerwear', 'shoes'])
export const wardrobeSlotsSchema = z.object({
  top: identity.optional(), bottom: identity.optional(),
  outerwear: identity.optional(), shoes: identity.optional(),
}).strict().refine(slots => Object.keys(slots).length > 0, '穿搭至少包含一件衣物')
export type WardrobeCategory = z.infer<typeof wardrobeCategorySchema>
export type WardrobeSlots = z.infer<typeof wardrobeSlotsSchema>

export const readingNoteSchema = z.object({
  id: identity,
  text: narrative.refine(value => value.trim().length > 0, '笔记不能为空'),
  occurredAt: timestamp.optional(), createdAt: timestamp.optional(),
  page: z.number().int().min(1).max(1_000_000).optional(),
  chapter: shortText.optional(),
}).strict()
export type ReadingNoteRecord = z.infer<typeof readingNoteSchema>

export const tripStopSchema = z.object({
  id: identity, name: shortText.min(1), story: narrative,
  date: date.optional(),
}).strict()
export const tripStatusSchema = z.enum(['planned', 'active', 'completed', 'cancelled'])
export type TripStopRecord = z.infer<typeof tripStopSchema>
export type TripStatus = z.infer<typeof tripStatusSchema>

function uniqueRecords<T extends { id: string }>(schema: z.ZodType<T>) {
  return z.array(schema).max(200).refine(records => new Set(records.map(record => record.id)).size === records.length, '记录 ID 不得重复')
}

const cultureFields: Record<string, z.ZodType> = {
  type: z.enum(['reading', 'film', 'music', 'photography']),
  readingNotes: uniqueRecords(readingNoteSchema),
  author: shortText, artist: shortText, director: shortText,
  summary: narrative, detail: narrative, note: narrative,
  currentPage: z.number().int().min(0).max(1_000_000),
  totalPages: z.number().int().min(1).max(1_000_000),
  readingStatus: z.enum(['planned', 'reading', 'paused', 'finished', 'abandoned']),
  watchStatus: z.enum(['planned', 'watching', 'paused', 'finished', 'abandoned']),
  listeningStatus: z.enum(['queued', 'listening', 'revisiting', 'finished']),
  workStatus: z.enum(['draft', 'published']),
  mediaKind: z.enum(['movie', 'series']), musicKind: z.enum(['track', 'album']),
  season: z.number().int().min(1).max(10_000),
  episode: z.number().int().min(0).max(100_000),
  totalEpisodes: z.number().int().min(1).max(100_000),
  albumTitle: shortText, locationName: shortText, depictedAt: shortText,
}

const fieldsByKind: Record<string, Record<string, z.ZodType>> = {
  wardrobe: {
    recordType: z.enum(['garment', 'outfit', 'wear-state']),
    category: wardrobeCategorySchema, slots: wardrobeSlotsSchema,
    outfitVersion: z.number().int().min(1), imageOutfitVersion: z.number().int().min(1),
  },
  culture: cultureFields,
  bookshelf: cultureFields,
  home: {
    recordType: z.enum(['residence', 'space']), spaceId: identity,
    residenceId: identity, description: narrative,
  },
  furniture: {
    spaceId: identity, displayInHome: z.boolean(), displayReason: narrative,
    displayEvidence: z.array(identity).max(100), description: narrative, originNote: narrative,
  },
  footprint: {
    recordType: z.enum(['place', 'trip']), destination: shortText.min(1),
    start: date, end: date, status: tripStatusSchema,
    story: narrative, stops: uniqueRecords(tripStopSchema),
  },
}

/**
 * 背景：六面复用资产 payload，旧短标签截断会破坏正文和结构化生活记录。
 * 设计意图：只规范已登记字段，保留既有媒体 / 来源元数据；复用 Zod 而不手写解析器。
 * 关键约束：null 删除由调用层处理；任何字段无效拒绝整次更新，不静默丢弃数组项。
 */
export function normalizeWorldRecordField(kind: string, key: string, value: unknown):
  | { handled: false }
  | { handled: true; ok: true; value: unknown }
  | { handled: true; ok: false; error: string } {
  const schema = Object.hasOwn(fieldsByKind, kind) && Object.hasOwn(fieldsByKind[kind], key) ? fieldsByKind[kind][key] : undefined
  if (!schema) return { handled: false }
  const result = schema.safeParse(value)
  return result.success
    ? { handled: true, ok: true, value: result.data }
    : { handled: true, ok: false, error: '生活记录字段无效或超出长度限制，未保存。' }
}

/**
 * 背景：单字段有效不代表旅行日期、页码与总量组合有效。
 * 设计意图：在完整补丁合并后校验不变量，不靠渲染时修正持久化事实。
 * 关键约束：不补造缺失日期；旧地点记录不自动转换为旅行。
 */
export function worldRecordConsistencyError(kind: string, payload: Record<string, unknown>): string | null {
  if (kind === 'wardrobe' && ['outfit', 'wear-state'].includes(String(payload.recordType))) {
    const slots = wardrobeSlotsSchema.safeParse(payload.slots)
    if (!slots.success) return '穿搭需要有效衣物槽位。'
    if (payload.recordType === 'outfit' && (!slots.data.top || !slots.data.bottom || !slots.data.shoes)) return '套装必须包含上装、下装和鞋子。'
  }
  if (kind === 'footprint' && payload.recordType === 'trip') {
    if (!tripStatusSchema.safeParse(payload.status).success || !shortText.min(1).safeParse(payload.destination).success) return '旅行需要有效状态和目的地。'
    if (['active', 'completed'].includes(String(payload.status)) && !date.safeParse(payload.start).success) return '已出发旅行必须有有效出发日期。'
    if (payload.status === 'completed' && !date.safeParse(payload.end).success) return '已完成旅行必须有有效结束日期。'
    if (payload.status === 'active' && payload.end != null) return '进行中的旅行不能有结束日期。'
    if (typeof payload.start === 'string' && typeof payload.end === 'string' && payload.end < payload.start) return '旅行结束日期不能早于出发日期。'
    if (payload.stops !== undefined) {
      const stops = uniqueRecords(tripStopSchema).safeParse(payload.stops)
      if (!stops.success) return '旅行停留记录无效。'
      for (const stop of stops.data) {
        if (stop.date && ((typeof payload.start === 'string' && stop.date < payload.start) || (typeof payload.end === 'string' && stop.date > payload.end))) return '停留日期必须在旅行日期范围内。'
      }
    }
  }
  if (kind === 'culture' || kind === 'bookshelf') {
    for (const [current, total] of [['currentPage', 'totalPages'], ['episode', 'totalEpisodes']]) {
      if (typeof payload[current] === 'number' && typeof payload[total] === 'number' && payload[current] > payload[total]) return '当前进度不能超过总量。'
    }
  }
  return null
}

/**
 * 背景：历史单条笔记与新多条笔记需要同一读模型，列表和详情不能各取一份文案。
 * 设计意图：显式数组优先，无数组时保留原 note；稳定 ID 不依赖展示时刻。
 * 关键约束：不制造笔记日期；显式空数组就是无笔记，不能被旧 note 复活。
 */
export function readingNotesForAsset(asset: { id: string; payload: Record<string, unknown> }): Array<ReadingNoteRecord & { assetId: string }> {
  if (Object.hasOwn(asset.payload, 'readingNotes')) {
    const result = uniqueRecords(readingNoteSchema).safeParse(asset.payload.readingNotes)
    return result.success ? result.data.map(note => ({ ...note, assetId: asset.id })) : []
  }
  return typeof asset.payload.note === 'string' && asset.payload.note.trim()
    ? [{ id: `${asset.id}:note`, assetId: asset.id, text: asset.payload.note }] : []
}

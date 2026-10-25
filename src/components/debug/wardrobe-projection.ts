import type { DebugEvidenceRecord } from '../../shared/debug-evidence'
import { wardrobeSlotsSchema, wardrobeCategorySchema, normalizeWorldRecordField, worldRecordConsistencyError } from '../../shared/world-records'
import { evidenceObject } from './EvidenceSummary'
import { snapshotTime } from './NowStateReading'
import type { WardrobeReadingItem } from './WardrobeReading'

export interface ProjectedWardrobe extends WardrobeReadingItem { record: DebugEvidenceRecord }
const text = (value: unknown) => typeof value === 'string' ? value : ''
const CATEGORIES: Record<string, string> = { top: '上装', bottom: '下装', outerwear: '外套', shoes: '鞋子' }

/** 背景：同表包含旧单件和未知类型，槽位校验可能修剪 ID，直接使用会伪造关联。
 * 意图：复用生产 schema，只读投影真实类型 / 版本和原样保存的槽位。
 * 约束：不采用规范化后的替代引用，收录时间不作换装时间，坏字段和完整原文保留。
 */
export function projectWardrobeRecords(records: readonly DebugEvidenceRecord[]): ProjectedWardrobe[] {
  return records.map(record => {
    const payload = evidenceObject(record.data.payload)
    const kind = record.kind !== 'wardrobe' ? 'unknown' : payload.recordType === 'outfit' || payload.recordType === 'wear-state' ? payload.recordType : payload.recordType === 'garment' || payload.recordType === undefined && wardrobeCategorySchema.safeParse(payload.category).success ? 'garment' : 'unknown'
    const version = normalizeWorldRecordField('wardrobe', 'outfitVersion', payload.outfitVersion)
    const parsed = wardrobeSlotsSchema.safeParse(payload.slots)
    const rawSlots = evidenceObject(payload.slots)
    const originalSlots = parsed.success && Object.entries(parsed.data).every(([slot, id]) => id === rawSlots[slot])
    const slots = originalSlots && parsed.success ? Object.entries(parsed.data).map(([slot, id]) => ({ slot, id, label: CATEGORIES[slot] ?? slot })) : undefined
    const issue = worldRecordConsistencyError('wardrobe', payload) || (parsed.success && !originalSlots && ['outfit', 'wear-state'].includes(kind) ? '槽位标识与原始保存值不一致，未建立规范化关联。' : null)
    return { id: record.id, ownerId: record.roleId, title: record.title, kind, category: text(payload.category), description: text(payload.description), truncated: record.truncated, issue, slots,
      meta: kind === 'garment' ? CATEGORIES[text(payload.category)] ?? '分类未识别' : kind === 'unknown' ? '记录类型未识别，原文保留' : payload.outfitVersion === undefined ? '版本未记录' : version.handled && version.ok ? `版本 v${version.value}` : '版本字段无效', record }
  })
}

export function wardrobeFields(item: ProjectedWardrobe, timezone: string): Array<[string, string]> {
  const payload = evidenceObject(item.record.data.payload)
  return [['资产', item.id], ['来源', item.record.source], ['记录类型', text(payload.recordType) || '未提供，按已读分类解释'], ['收录时间', snapshotTime(item.record.data.acquired_at, timezone)], ['来源事件', text(item.record.data.source_event_id) || text(item.record.data.event_id) || '未保存']]
}

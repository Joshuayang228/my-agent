import type { DebugEvidenceRecord } from '../../shared/debug-evidence'
import { snapshotTime } from './NowStateReading'
import type { LinksReadingItem } from './LinksReading'

export interface ProjectedLink extends LinksReadingItem { record: DebugEvidenceRecord }
const text = (value: unknown) => typeof value === 'string' ? value : ''
const RELATIONS: Record<string, string> = { wears: '穿着关联', references: '引用关联', depicts: '图片关联', coframe: '共同在场关联', participant: '参与关联' }

/** 背景：关联元数据可为任何 JSON 形态，保存名称不等于目标的当前解析结果。
 * 意图：逐边投影真实字段，标题只解释已保存关系与注释；原始载荷始终保留。
 * 约束：不从元数据补事件 / 目标 ID 或跳转，创建时间不解释为事件发生时间。
 */
export function projectLinkRecords(records: readonly DebugEvidenceRecord[]): ProjectedLink[] {
  return records.map(record => {
    const value = record.data.metadata, metadata = value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
    const relation = text(record.data.relation)
    const title = RELATIONS[relation] ?? `关系 ${relation.slice(0, 40) || '未记录'}`
    const name = text(metadata?.name)
    return { id: record.id, ownerId: record.roleId, eventId: text(record.data.event_id), targetId: text(record.data.target_id), targetType: text(record.data.target_type), relation,
      title: name ? `${title} · ${name.slice(0, 80)}${name.length > 80 ? '…' : ''}（保存名）` : title, metadata, truncated: record.truncated, record }
  })
}

export function linkFields(item: ProjectedLink, timezone: string): Array<[string, string]> {
  return [['关联记录', item.id], ['来源', item.record.source], ['来源事件', item.eventId || '未记录'], ['目标类型', item.targetType || '未记录'], ['目标标识', item.targetId || '未记录'], ['关系类型', item.relation || '未记录'], ['关联创建时间', snapshotTime(item.record.data.created_at, timezone)]]
}

import type { DebugEvidenceRecord } from '../../shared/debug-evidence'
import { evidenceObject } from './EvidenceSummary'
import { snapshotTime } from './NowStateReading'
import type { RelationsReadingItem } from './RelationsReading'

export interface ProjectedRelation extends RelationsReadingItem { record: DebugEvidenceRecord }
const text = (value: unknown) => typeof value === 'string' ? value : ''
const firstText = (payload: Record<string, unknown>, keys: string[]) => keys.map(key => text(payload[key])).find(Boolean) || ''

/** 背景：真实关系与共同事件均有方向和范围，坏字段不能被 UI 补成有效关系。
 * 意图：保存所有已读行和原始载荷，分别投影定义 / 共同事件 / 未提供来源。
 * 约束：不按姓名合并、不给缺失端点或事件补 ID，时间只取实际计划字段；原文不写回。
 */
export function projectRelationRecords(records: readonly DebugEvidenceRecord[], timezone: string): ProjectedRelation[] {
  return records.map(record => {
    const edges = record.data.relations, experiences = record.data.experiences
    return { id: record.id, personId: text(record.data.id) || record.id, name: text(record.data.name) || record.id, truncated: record.truncated,
      issue: !Array.isArray(edges) || edges.some(value => { const edge = evidenceObject(value); return !text(edge.from) || !text(edge.to) || !text(edge.type) }) ? '部分关系定义格式异常，原始记录保留。' : undefined,
      edges: Array.isArray(edges) ? edges.map(value => { const edge = evidenceObject(value); return { from: text(edge.from), to: text(edge.to), type: text(edge.type), note: text(edge.note) } }) : [],
      experienceIssue: experiences !== undefined && !Array.isArray(experiences) ? '共同经历字段格式异常，原始记录保留。' : undefined,
      experiences: Array.isArray(experiences) ? experiences.map(value => {
        const event = evidenceObject(value), payload = evidenceObject(event.payload)
        const id = typeof event.id === 'string' && event.id.length > 0 && event.id.length <= 200 ? event.id : undefined
        return { id, title: firstText(payload, ['activity', 'title']) || '已发布生活事件', at: snapshotTime(event.time, timezone), location: text(payload.location), body: firstText(payload, ['text', 'story', 'description']), issue: !id ? '事件标识异常，未提供来源跳转；原始记录保留。' : undefined }
      }) : undefined, record }
  })
}

export function relationFields(item: ProjectedRelation): Array<[string, string]> {
  return [['人物标识', item.personId], ['资料名称', item.name], ['来源', item.record.source], ['关系定义', Array.isArray(item.record.data.relations) ? `${item.edges.length} 条已读定义` : '数量未知'], ['共同经历范围', item.experiences === undefined ? '本次查询未提供' : '显式共同在场的已读事件范围，非完整历史'], ['忙闲状态', '本查询未提供']]
}

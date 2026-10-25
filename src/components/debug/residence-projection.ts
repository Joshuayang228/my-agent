import type { DebugEvidenceRecord } from '../../shared/debug-evidence'
import { normalizeWorldRecordField } from '../../shared/world-records'
import { evidenceObject } from './EvidenceSummary'
import type { ResidenceReadingItem } from './ResidenceReading'

export interface ProjectedResidence extends ResidenceReadingItem { record: DebugEvidenceRecord }
const text = (value: unknown) => typeof value === 'string' ? value : ''

/** 背景：Debug 读取可能包含旧记录或损坏字段，不能用默认住所填补。
 * 意图：按真实 kind / recordType 投影，引用只使用生产校验通过且原样保存的 ID。
 * 约束：不规范化后再当作原始关联，不按名称推断父级；异常记录和完整载荷始终保留。
 */
export function projectResidenceRecords(records: readonly DebugEvidenceRecord[]): ProjectedResidence[] {
  return records.map(record => {
    const payload = evidenceObject(record.data.payload)
    const kind = record.kind === 'furniture' ? 'object' : record.kind === 'home' && (payload.recordType === 'residence' || payload.recordType === 'space') ? payload.recordType : 'unknown'
    const field = kind === 'space' ? 'residenceId' : kind === 'object' ? 'spaceId' : undefined
    let parentId: string | undefined, parentIssue: string | undefined
    if (field && payload[field] !== undefined) {
      const checked = normalizeWorldRecordField(record.kind, field, payload[field])
      if (checked.handled && checked.ok && checked.value === payload[field] && typeof checked.value === 'string') parentId = checked.value
      else parentIssue = '归属字段格式异常，未建立关联'
    }
    return { id: record.id, ownerId: record.roleId, title: record.title, kind, parentId, parentIssue, description: typeof payload.description === 'string' ? payload.description : record.body,
      displayInHome: typeof payload.displayInHome === 'boolean' ? payload.displayInHome : undefined,
      displayIssue: payload.displayInHome !== undefined && typeof payload.displayInHome !== 'boolean' ? '陈列标记格式异常' : undefined,
      notice: record.truncated ? '来源读取已截断' : undefined, record }
  })
}

export function residenceFields(item: ProjectedResidence): Array<[string, string]> {
  const payload = evidenceObject(item.record.data.payload)
  return [['资产', item.id], ['存储类型', item.record.kind], ['记录类型', text(payload.recordType) || (item.kind === 'object' ? '物件' : '未提供')],
    ...(item.kind === 'space' ? [['所属住所', item.parentId || (item.parentIssue ? '字段异常，见原文' : '未提供')]] as Array<[string, string]> : []),
    ...(item.kind === 'object' ? [['空间', item.parentId || (item.parentIssue ? '字段异常，见原文' : '未归置')], ['家居展示', item.displayIssue || (item.displayInHome === undefined ? '未记录' : `displayInHome = ${item.displayInHome}`)], ['展示理由', text(payload.displayReason) || '未提供'], ['展示依据', Array.isArray(payload.displayEvidence) && payload.displayEvidence.every(value => typeof value === 'string') ? payload.displayEvidence.join('、') || '未提供' : payload.displayEvidence === undefined ? '未提供' : '字段异常，见原文'], ['来源说明', text(payload.originNote) || '未提供']] as Array<[string, string]> : []), ['描述', item.description || '未提供']]
}

import type { DebugEvidenceRecord } from '../../shared/debug-evidence'
import { normalizeWorldRecordField, worldRecordConsistencyError } from '../../shared/world-records'
import { evidenceObject } from './EvidenceSummary'
import type { FootprintReadingItem } from './FootprintsReading'

export interface ProjectedFootprint extends FootprintReadingItem { record: DebugEvidenceRecord }
const text = (value: unknown) => typeof value === 'string' ? value : ''
function date(value: unknown): string | undefined {
  const checked = normalizeWorldRecordField('footprint', 'start', value)
  return checked.handled && checked.ok && typeof checked.value === 'string' && checked.value === value ? checked.value : undefined
}

/** 背景：旧资产可能有未知类型、坏日期或坏停留资料，不能被正常旅行摘要掩盖。
 * 意图：复用生产校验，原值只读投影；分组按明确类型 / 状态，日期只取合法旅行字段。
 * 约束：收录时间不参与旅行日期；不写回规范化值，异常条目和完整来源不得丢弃。
 */
export function projectFootprintRecords(records: readonly DebugEvidenceRecord[]): ProjectedFootprint[] {
  return records.map(record => {
    const payload = evidenceObject(record.data.payload)
    const group = record.kind !== 'footprint' ? 'unknown' : payload.recordType === 'place' ? 'place' : payload.recordType !== 'trip' ? 'unknown' : payload.status === 'active' || payload.status === 'completed' ? 'actual' : payload.status === 'planned' ? 'planned' : payload.status === 'cancelled' ? 'cancelled' : 'unknown'
    const start = date(payload.start), end = date(payload.end)
    const stopsCheck = payload.stops === undefined ? undefined : normalizeWorldRecordField('footprint', 'stops', payload.stops)
    const issue = group === 'unknown' ? '记录类型或旅行状态未识别' : worldRecordConsistencyError('footprint', payload)
      || (stopsCheck?.handled && !stopsCheck.ok ? '停留资料格式异常，完整原文保留' : null)
      || (payload.start !== undefined && !start || payload.end !== undefined && !end ? '旅行日期格式异常' : null)
    return { id: record.id, title: record.title, group, dateLabel: group === 'place' ? '访问日期未记录' : start ? `${start}${end ? ` — ${end}` : ''}` : '旅行日期未提供', sortDate: start ?? '', destination: text(payload.destination),
      statusLabel: ({ active: '旅行中', completed: '已结束旅行', planned: '未出发', cancelled: '已取消' } as Record<string, string>)[text(payload.status)] ?? '未识别', issue,
      story: typeof payload.story === 'string' ? payload.story : record.body,
      stops: Array.isArray(payload.stops) ? payload.stops.map((value, index) => { const stop = evidenceObject(value); return { key: `${record.id}:${index}`, date: date(stop.date), name: text(stop.name) || '停留名称未提供', story: text(stop.story) || '停留正文未提供' } }) : [], record }
  })
}

export function footprintFields(item: ProjectedFootprint): Array<[string, string]> {
  const payload = evidenceObject(item.record.data.payload)
  return [['资产', item.id], ['记录类型', text(payload.recordType) || '未提供'], ['目的地', item.destination || '未提供'], ['旅行日期', item.dateLabel], ['保存状态', text(payload.status) || '未提供'], ['资料核对', item.issue || '未发现结构矛盾'], ['停留记录 ID', Array.isArray(payload.stops) ? payload.stops.map(stop => text(evidenceObject(stop).id) || '未提供').join('、') || '未提供' : payload.stops === undefined ? '未提供' : '字段异常，见原文']]
}

import type { DebugEvidenceRecord } from '../../shared/debug-evidence'
import type { ScheduleReadingItem } from './ScheduleReading'
import { evidenceObject } from './EvidenceSummary'

export interface ProjectedScheduleSlot extends ScheduleReadingItem { record: DebugEvidenceRecord; slot: unknown; index: number; signature: string }
const text = (value: unknown) => typeof value === 'string' ? value : ''

/** 背景：查询返回日剧本，展示需要独立时段；已有异常记录不能被悄悄规范化为正常事实。
 * 意图：以来源 / 日剧本 / 原数组位置标记展示行，排序副本；签名只保护刷新后的选中归属。
 * 约束：展示 ID 不作为生产时段或事件 ID；缺分钟沿执行默认值 00 并标明，坏时间不补当前时刻，原始结构始终保留。
 */
export function projectScheduleSlots(records: readonly DebugEvidenceRecord[]) {
  const issues: string[] = []
  const slots: ProjectedScheduleSlot[] = []
  for (const record of records) {
    const payload = evidenceObject(record.data.payload)
    if (!Array.isArray(payload.slots)) { issues.push(`日剧本 ${record.id} 的计划时段${'slots' in payload ? '不是数组' : '字段未提供'}；原始来源保留。`); continue }
    for (const [index, raw] of payload.slots.entries()) {
      const slot = evidenceObject(raw)
      const minute = slot.minute === undefined ? 0 : slot.minute
      const validTime = typeof slot.hour === 'number' && Number.isInteger(slot.hour) && slot.hour >= 0 && slot.hour <= 23 && typeof minute === 'number' && Number.isInteger(minute) && minute >= 0 && minute <= 59
      const notices = [!validTime ? '时间字段异常，未补值' : slot.minute === undefined ? '分钟未提供，按执行默认值 00 展示' : '', !text(slot.activity) ? '活动正文未提供' : '', record.truncated ? '来源读取已截断' : ''].filter(Boolean)
      slots.push({ id: JSON.stringify([record.source, record.id, index]), sourceRecordId: record.id, time: validTime ? `${String(slot.hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : '时间未记录', activity: text(slot.activity) || '活动未记录', location: text(slot.location) || '地点未记录', notice: notices.join(' · '), record, slot: raw, index, signature: JSON.stringify(raw) ?? '[undefined]' })
    }
  }
  return { issues, slots: slots.sort((a, b) => (a.time === '时间未记录' ? '\uffff' : a.time).localeCompare(b.time === '时间未记录' ? '\uffff' : b.time) || a.record.source.localeCompare(b.record.source) || a.record.id.localeCompare(b.record.id) || a.index - b.index) }
}

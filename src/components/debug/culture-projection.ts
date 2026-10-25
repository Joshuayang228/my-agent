import type { DebugEvidenceRecord } from '../../shared/debug-evidence'
import { normalizeWorldRecordField, readingNotesForAsset, worldRecordConsistencyError } from '../../shared/world-records'
import { evidenceObject } from './EvidenceSummary'
import { snapshotTime } from './NowStateReading'
import type { CultureReadingItem } from './CultureReading'

export interface ProjectedCulture extends CultureReadingItem { record: DebugEvidenceRecord }
const text = (value: unknown) => typeof value === 'string' ? value : ''
const STATUS_FIELDS: Record<string, string> = { reading: 'readingStatus', film: 'watchStatus', music: 'listeningStatus', photography: 'workStatus' }
const STATUS_LABELS: Record<string, Record<string, string>> = { reading: { planned: '想读', reading: '阅读中', paused: '暂停阅读', finished: '已读完', abandoned: '未继续阅读' }, film: { planned: '想看', watching: '观看中', paused: '暂停观看', finished: '已看完', abandoned: '未继续观看' }, music: { queued: '想听', listening: '聆听中', revisiting: '最近常听', finished: '已听完' }, photography: { draft: '草稿作品', published: '已发布作品' } }

/** 背景：正式文化资产有旧书架和多类型状态，读取不能从标题 / 收录日补体验事实。
 * 意图：复用生产字段及笔记解析器，独立投影状态、正文与有明确时间来源的笔记。
 * 约束：显式空 / 坏笔记数组优先，旧 note 只在无数组时生效；所有原始字段保留且无回写。
 */
export function projectCultureRecords(records: readonly DebugEvidenceRecord[], timezone: string): ProjectedCulture[] {
  return records.map(record => {
    const payload = evidenceObject(record.data.payload)
    const checkedType = normalizeWorldRecordField(record.kind, 'type', payload.type)
    const type = record.kind === 'bookshelf' ? 'reading' : record.kind === 'culture' && checkedType.handled && checkedType.ok ? String(checkedType.value) : 'unknown'
    const stateKey = STATUS_FIELDS[type], stateValue = payload[stateKey], checkedState = stateKey ? normalizeWorldRecordField(record.kind, stateKey, stateValue) : undefined
    const status = !stateKey ? '状态未识别' : stateValue === undefined ? '状态未记录' : checkedState?.handled && checkedState.ok ? STATUS_LABELS[type]?.[String(stateValue)] ?? '状态未识别' : '状态未识别'
    const checkedNotes = normalizeWorldRecordField(record.kind, 'readingNotes', payload.readingNotes)
    const notesIssue = Object.hasOwn(payload, 'readingNotes') && checkedNotes.handled && !checkedNotes.ok
    const notes = readingNotesForAsset({ id: record.id, payload }).sort((a, b) => (b.occurredAt ?? b.createdAt ?? 0) - (a.occurredAt ?? a.createdAt ?? 0) || a.id.localeCompare(b.id)).map(note => ({ id: note.id, text: note.text, at: `${note.occurredAt !== undefined ? '发生时间' : note.createdAt !== undefined ? '创建时间' : '笔记时间'}：${snapshotTime(note.occurredAt ?? note.createdAt, timezone)}`, page: note.page, chapter: note.chapter }))
    return { id: record.id, title: record.title, type, status, creator: text(payload[({ reading: 'author', film: 'director', music: 'artist' } as Record<string, string>)[type] ?? 'author']), archived: payload.visibility === 'archived', truncated: record.truncated,
      body: text(payload.detail).trim() ? text(payload.detail) : text(payload.summary).trim() ? text(payload.summary) : text(payload.description), issue: worldRecordConsistencyError(record.kind, payload), notesIssue, notes,
      emptyNotes: Object.hasOwn(payload, 'readingNotes') ? '本次已读笔记数组为空，未回退旧笔记。' : '本记录未提供笔记正文，不推断从未记过笔记。', record }
  })
}

export function cultureFields(item: ProjectedCulture, timezone: string): Array<[string, string]> {
  const payload = evidenceObject(item.record.data.payload)
  return [['资产', item.id], ['来源', `${item.record.source} · ${item.record.kind}`], ['类型', item.type], ['已读状态', item.status], ['收录时间', snapshotTime(item.record.data.acquired_at, timezone)], ['来源事件', text(item.record.data.source_event_id) || text(item.record.data.event_id) || '未保存'],
    ...[['currentPage', '当前页'], ['totalPages', '总页数'], ['season', '季'], ['episode', '当前集'], ['totalEpisodes', '总集数'], ['mediaKind', '影视形式'], ['musicKind', '音乐形式'], ['locationName', '作品地点标记'], ['depictedAt', '作品时间标记']].filter(([key]) => Object.hasOwn(payload, key)).map(([key, label]): [string, string] => [label, typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : String(payload[key])])]
}

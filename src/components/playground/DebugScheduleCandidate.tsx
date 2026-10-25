import { useState, type ChangeEvent } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { TextField } from '../foundation/TextField'
import { SelectField } from '../foundation/SelectField'
import { ScheduleReading } from '../debug/ScheduleReading'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type SchedulePreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'invalid' | 'long' | 'missing'
interface Props {
  empty: boolean
  previewState: SchedulePreviewState
  initialSelectedId?: string
  onRetry: () => void
  onEvidence: (page: DebugEvidencePageId, id: string) => void
}

/** 背景：通用证据卡让每个计划时段重复展示字段标签，首次失败又容易被误当为空日程。
 * 意图：参考 Alice 的时间列、活动正文和辅助地点，详情按显式时段展开；读取状态与成功结果分开。
 * 约束：只读固定夹具；没有执行状态，不展示完成标记；刷新失败保留筛选、详情和旧快照，未知引用不选替代项。
 */
export function DebugScheduleCandidate({ empty, previewState, initialSelectedId, onRetry, onEvidence }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.schedule.items
  const target = fixtures.find(entry => entry.id === initialSelectedId)
  const [role, setRole] = useState<string>(target?.role ?? 'lin')
  const [date, setDate] = useState(target?.date ?? '2026-10-13')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  const items = empty || previewState === 'invalid' ? [] : fixtures.map((entry, index) => {
    if (previewState !== 'long' || index !== 0) return entry
    const schedule = { ...entry.schedule!, activity: '整理旅途中拍摄的照片，逐一核对拍摄地点与日期，并为下一次旅行写下可调整的准备清单。'.repeat(4), location: '虚构住所内靠窗的长桌与临时资料整理区' }
    // 背景：长文样张的摘要和详情仍是同一时段；意图：同步派生显示值；约束：地点固定为夹具 fields[1]，不通过自然语言标签推断。
    const fields = entry.fields.map((field, fieldIndex): [string, string] => fieldIndex === 1 ? [field[0], schedule.location] : [...field])
    return { ...entry, title: `${schedule.time} · ${schedule.activity}`, schedule, fields, readingFields: [fields[1]] }
  })
  // 背景：全部人物夹具按人物存放；意图：阅读顺序按时间，不沿用存放次序；约束：只排序筛选副本，夹具时间为固定 HH:mm。
  const scoped = items.filter(entry => (role === 'all' || entry.role === role) && entry.date === date).sort((left, right) => (left.schedule?.time ?? '').localeCompare(right.schedule?.time ?? ''))
  const filtered = scoped.filter(entry => `${entry.schedule?.time} ${entry.schedule?.activity} ${entry.schedule?.location} ${entry.fields.flat().join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const missing = previewState === 'missing' || Boolean(initialSelectedId && !target)
  const clearFilters = () => { setRole('lin'); setDate('2026-10-13'); setQuery(''); setSelectedId(undefined) }

  return <section className="debug-schedule-workbench" data-testid="debug-evidence-schedule">
    <div className="debug-schedule-toolbar">
      <label>人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedId(undefined) }}><option value="all">全部人物</option>{DEBUG_ROLES.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</SelectField></label>
      <label>计划日期<TextField appearance="outlined" type="date" aria-label="证据日期" value={date} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setDate(event.target.value); setSelectedId(undefined) }} /></label>
      <label className="debug-schedule-search">搜索<TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索活动或地点" value={query} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setSelectedId(undefined) }} /></label>
    </div>
    {!available ? <div className="debug-schedule-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}>
      <p>{previewState === 'unread' ? '日程尚未读取' : previewState === 'loading' ? '正在读取日程…' : previewState === 'unavailable' ? '日程接口不可用；桌面连接建立后可读取。' : '日程读取失败'}</p>
      {previewState !== 'loading' && <ActionButton onClick={onRetry}>读取日程样张</ActionButton>}
    </div> : !date ? <p className="debug-schedule-state" role="status">请选择计划日期。</p> : <>
      {previewState === 'refresh-error' && <div className="debug-schedule-state" role="alert"><p>刷新失败，保留上次日程；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      <div className="debug-schedule-context"><span>{date} · 计划</span><span aria-label="计划时段计数">{filtered.length} 个计划时段{query && ' · 当前筛选'}</span></div>
      {missing ? <p className="debug-schedule-state" role="status">引用时段未在该人物范围找到，未选择替代记录。</p> : previewState === 'invalid' ? <p className="debug-schedule-state" role="status">日剧本已读取，但没有可读取的计划时段。</p> : !filtered.length ? <div className="debug-schedule-state" role="status"><p>{scoped.length ? '没有匹配的证据' : '此范围没有记录'}</p>{(!empty || query) && <ActionButton onClick={clearFilters}>清除筛选</ActionButton>}</div> : <>
        <ScheduleReading items={filtered.map(entry => ({ ...entry, time: entry.schedule?.time ?? '时间未记录', activity: entry.schedule?.activity ?? '活动未记录', location: `${entry.schedule?.location ?? ''}${role === 'all' ? ` · ${DEBUG_ROLES.find(value => value.id === entry.role)?.label}` : ''}` }))} selectedId={selectedId} onSelect={setSelectedId} renderDetail={selected => <>
          <p>计划时段，执行结果未记录。</p>
          <dl className="debug-candidate-facts">{selected.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {selected.links?.map(link => <ActionButton key={link.id} variant="plain" onClick={() => onEvidence(link.page, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}
          <details className="debug-prompt-provenance"><summary>记录标识与范围</summary><code>{selected.id}</code><p>{selected.date} · {selected.role} · 隔离样张</p><pre>{JSON.stringify(selected, null, 2)}</pre></details>
        </>} />
      </>}
      <p className="debug-schedule-boundary">日程是计划，活动是否发生以事件证据为准。</p>
    </>}
  </section>
}

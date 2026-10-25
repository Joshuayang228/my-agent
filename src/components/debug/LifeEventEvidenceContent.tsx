import { useState, type ChangeEvent } from 'react'
import { Search } from 'lucide-react'
import type { DebugEvidenceRecord, DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { evidenceObject, evidenceTime } from './EvidenceSummary'
import { EventTimelineReading } from './EventTimelineReading'

const EVENT_STATUS_LABELS: Record<string, string> = { planned: '已计划', published: '已发布', cancelled: '已取消' }
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isFinite(new Date(value).getTime())

/** 背景：最近事项与行为证据共读生活事件，通用展开卡使正文、状态和字段互相挤占。
 * 意图：真实事件投影到已确认的清单 / 单条阅读，原始来源与分页保持可达。
 * 约束：只读父容器的完整快照；计划时间不代表发布时间，搜索只覆盖已读范围，刷新不清除选中或展开。
 */
export function LifeEventEvidenceContent({ view, result, loading, error, date, query, roleId, scope, targetId, onRoleChange, onDateChange, onQueryChange, onRetry, onNext, onEvidence, onPage }: {
  view: 'recent' | 'activity'; onPage: (page: 'traces' | 'growth') => void
  result: DebugEvidenceResult | null; loading: boolean; error: string; date: string; query: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string
  onRoleChange?: (id: string) => void; onDateChange: (date: string) => void; onQueryChange: (query: string) => void; onRetry: () => void; onNext: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(targetId)
  const readLabel = view === 'activity' ? '行为证据' : '事项'
  const ready = result?.state === 'ready'
  const filtered = (result?.records ?? []).filter(record => `${record.title} ${record.body} ${record.id} ${record.status} ${JSON.stringify(record.data)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const items = filtered.map(record => {
    const payload = evidenceObject(record.data.payload)
    const time = record.data.scheduled_at
    return { id: record.id, title: record.title, time: validTime(time) ? new Intl.DateTimeFormat('zh-CN', { timeZone: result!.timezone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(time) : '时间未记录', status: EVENT_STATUS_LABELS[record.status] ?? (record.status ? `未知状态：${record.status}` : '状态未记录'), locationText: typeof payload.location === 'string' ? payload.location : undefined, record }
  })
  const fullFields = (record: DebugEvidenceRecord) => <dl className="debug-candidate-facts">{[['计划时间', validTime(record.data.scheduled_at) ? evidenceTime(record.data.scheduled_at, result!.timezone) : '时间未记录'], ['记录状态', record.status || '未记录'], ['事件类型', record.kind], ['地点', typeof evidenceObject(record.data.payload).location === 'string' ? String(evidenceObject(record.data.payload).location) : '未记录']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  return <section className="debug-evidence-workbench" data-testid={`debug-evidence-${view}`}>
    {view === 'activity' && <div className="debug-activity-boundary"><p>当前读取生活事件；完整行动日志尚未建立。</p><div><ActionButton variant="plain" onClick={() => onPage('traces')}>查看调用链</ActionButton><ActionButton variant="plain" onClick={() => onPage('growth')}>查看成长与反思</ActionButton></div></div>}
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence(view, '')}>返回当前领域列表</ActionButton>}
    <div className="debug-candidate-toolbar">
      {scope && onRoleChange && <div className="debug-focused-scope"><label>人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label></div>}
      <label className="debug-candidate-search"><Search size={14} /><TextField appearance="outlined" className="h-8 px-3" aria-label="搜索当前页证据" placeholder="搜索已读名称、正文或字段" disabled={!ready} value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => { setSelectedId(undefined); onQueryChange(event.target.value) }} /></label>
      {!targetId && <label className="debug-evidence-date">日期<TextField appearance="outlined" className="h-8 px-2" type="date" aria-label="证据日期" value={date} onChange={(event: ChangeEvent<HTMLInputElement>) => onDateChange(event.target.value)} /></label>}
    </div>
    {error && <div className="debug-recent-state" role="alert"><p>{result ? `刷新失败，保留上次${readLabel}和全部已读页；下方不是最新结果。` : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-recent-state" role="status">正在读取{readLabel}…</p>}
    {ready ? <>
      <p className="debug-recent-range"><span>{date || '全部日期'} · 按计划时间 · {result.timezone}</span><span aria-label={view === 'activity' ? '行为证据范围计数' : '事项范围计数'}>{filtered.length} 条{query ? '匹配 · 已读取范围' : '已读取'} · 总数未知</span></p>
      {result.issues.map((issue, index) => <p className="debug-recent-state" role="status" key={index}>{issue}</p>)}
      {selectedId && !filtered.some(record => record.id === selectedId) && <p className="debug-recent-state" role="status">引用{readLabel}未在该人物范围找到，未选择替代记录。</p>}
      {!filtered.length && <p className="debug-recent-state" role="status">{result.records.length ? '没有匹配的证据' : '此范围没有记录'}</p>}
      <EventTimelineReading items={items} selectedId={selectedId} onSelect={setSelectedId} renderDetail={({ record }) => <>
        <p className="debug-recent-state">计划时间不代表发布时间；已发布不证明活动完成。</p>
        {record.truncated && <p role="status">正文或结构已截断。</p>}
        {record.body ? <p className="debug-reading-body">{record.body}</p> : <p className="debug-recent-state">此{readLabel}未保存正文。</p>}
        <details className="debug-prompt-provenance"><summary>完整字段</summary>{fullFields(record)}</details>
        <details className="debug-prompt-provenance"><summary>记录标识与范围</summary><p>{record.source} · {record.id} · {record.roleId}</p><pre>{JSON.stringify(record.data, null, 2)}</pre></details>
        <section className="debug-candidate-section"><h3>明确关联的来源与证据</h3>{record.links.length ? record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}</ActionButton>) : <p>没有保存更多关联标识，不按时间或名称补猜。</p>}</section>
        {view === 'activity' && record.source === 'companion_events' && <ActionButton variant="plain" onClick={() => onEvidence('recent', record.id)}>查看来源生活事件</ActionButton>}
      </>} />
      {result.hasMore && result.nextCursor && <ActionButton disabled={loading} onClick={onNext}>读取下一页</ActionButton>}
    </> : result && <p className="debug-recent-state" role="status">{result.state === 'unsupported' ? '此类证据尚无独立读取源' : '诊断源暂不可用'} · {result.boundary}</p>}
    {result && <details className="debug-prompt-provenance"><summary>读取来源与边界</summary><p>{result.source} · {result.boundary}</p></details>}
  </section>
}

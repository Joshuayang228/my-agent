import { useState, type ChangeEvent } from 'react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { evidenceObject } from './EvidenceSummary'
import { ScheduleReading } from './ScheduleReading'
import { projectScheduleSlots } from './schedule-projection'

/** 背景：正式日程需要从真实日剧本读取，同时采用候选的时段阅读。
 * 意图：加载由所属证据容器持有，本组件只管理时段选择和渐进详情。
 * 约束：刷新失败不清除旧选中；数组位置内容变化后不把另一时段当成原条目，查询 / 展示行 / 事件身份不得混用。
 */
export function ScheduleEvidenceContent({ result, loading, error, date, query, roleId, scope, targetId, onRoleChange, onDateChange, onQueryChange, onRetry, onEvidence }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; date: string; query: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string
  onRoleChange?: (id: string) => void; onDateChange: (date: string) => void; onQueryChange: (query: string) => void; onRetry: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [selection, setSelection] = useState<{ id: string; signature: string }>()
  const projection = projectScheduleSlots(result?.records ?? [])
  const filtered = projection.slots.filter(slot => `${slot.time} ${slot.activity} ${slot.location} ${result?.timezone} ${JSON.stringify(slot.slot)} ${slot.record.source} ${slot.record.id} ${slot.record.data.date ?? ''} ${evidenceObject(slot.record.data.payload).theme ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selected = selection ? filtered.find(slot => slot.id === selection.id && slot.signature === selection.signature) : undefined
  const ready = result?.state === 'ready'
  return <section className="debug-schedule-workbench" data-testid="debug-evidence-schedule">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('schedule', '')}>返回当前领域列表</ActionButton>}
    <div className="debug-schedule-toolbar">
      {scope && onRoleChange && <label>人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label>}
      {!targetId && <label>计划日期<TextField appearance="outlined" type="date" aria-label="证据日期" value={date} onChange={(event: ChangeEvent<HTMLInputElement>) => onDateChange(event.target.value)} /></label>}
      <label className="debug-schedule-search">搜索<TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索活动或地点" disabled={!ready} value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => { setSelection(undefined); onQueryChange(event.target.value) }} /></label>
    </div>
    {error && <div className="debug-schedule-state" role="alert"><p>{result ? '刷新失败，保留原范围及全部已读页；下方不是最新结果。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-schedule-state" role="status">正在读取日程…</p>}
    {!date && !targetId ? <p className="debug-schedule-state" role="status">请选择计划日期。</p> : ready ? <>
      <div className="debug-schedule-context"><span>{targetId ? '指定日剧本' : date} · 计划 · {result.timezone}</span><span aria-label="计划时段计数">{projection.issues.length || result.records.some(record => record.truncated) ? '计划时段数量未知' : `${filtered.length} 个计划时段`}{query && ' · 当前筛选'}</span></div>
      {[...result.issues, ...projection.issues].map((issue, index) => <p key={index} className="debug-schedule-state" role="status">{issue}</p>)}
      {selection && !selected && <p className="debug-schedule-state" role="status">原选中时段已变更或不在本次结果中，未选择替代项。</p>}
      {!filtered.length && <p className="debug-schedule-state" role="status">{targetId && !result.records.length ? '引用日剧本未在该人物范围找到' : projection.slots.length ? '没有匹配的证据' : result.records.length ? '日剧本已读取，但没有可读取的计划时段。' : '此范围没有记录'}</p>}
      <ScheduleReading items={filtered} selectedId={selected?.id} onSelect={id => { const slot = filtered.find(item => item.id === id); setSelection(slot ? { id: slot.id, signature: slot.signature } : undefined) }} renderDetail={item => {
        const slot = evidenceObject(item.slot), payload = evidenceObject(item.record.data.payload)
        return <><p>本读取未提供执行证据，计划不等于已发生。</p><dl className="debug-candidate-facts">{[['地点', item.location], ['情绪', typeof slot.mood === 'string' ? slot.mood : '未记录'], ['计划类型', typeof slot.type === 'string' ? slot.type : '未记录'], ['日剧本主题', typeof payload.theme === 'string' ? payload.theme : '未记录'], ['计划日期', String(item.record.data.date ?? payload.date ?? '未记录')], ['时区', result.timezone]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {item.record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}（日剧本关联）</ActionButton>)}
          <details className="debug-prompt-provenance"><summary>记录标识与范围</summary><p>{item.record.source} · {item.record.id} · 原数组第 {item.index + 1} 项</p><p>数组位置仅用于本页阅读，不作为独立事件标识。</p><pre>{JSON.stringify(item.slot, null, 2)}</pre></details></>
      }} />
      <p className="debug-schedule-boundary">日程是计划，活动是否发生以事件证据为准。</p>
    </> : result && <p className="debug-schedule-state" role="status">{result.state === 'unsupported' ? '此类证据尚无独立读取源' : '诊断源暂不可用'} · {result.boundary}</p>}
    {result && <details className="debug-prompt-provenance"><summary>日剧本与完整来源</summary><p>{result.boundary}</p><p>{result.records.length} 条已读日剧本 · {result.timezone}</p>{result.records.map(record => <section key={`${record.source}:${record.id}`}><p>{record.source} · {record.id}{record.truncated ? ' · 读取已截断' : ''}</p><pre>{JSON.stringify(record.data, null, 2)}</pre></section>)}</details>}
  </section>
}

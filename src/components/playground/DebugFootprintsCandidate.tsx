import { useEffect, useState, type ChangeEvent } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { FootprintsReading } from '../debug/FootprintsReading'
import { projectFootprintRecords, footprintFields } from '../debug/footprints-projection'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type FootprintsPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'unknown' | 'undated' | 'paged' | 'missing'
interface Props {
  empty: boolean
  previewState: FootprintsPreviewState
  snapshotState: FootprintsPreviewState
  initialSelectedId?: string
  onRetry: () => void
  onPage: (page: DebugEvidencePageId) => void
  onAsset: (key: string) => void
}
/** 背景：资产创建时间和计划常被误读为到访，列表铺开停留正文又妨碍扫描。
 * 意图：明确分组并以名称 / 状态 / 明确日期阅读，经历和停留在详情展开。
 * 约束：不按标题或创建时间猜日期，未知状态不算实际旅行，分页和失败保留同一快照。
 */
export function DebugFootprintsCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onPage, onAsset }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.footprints.items
  const [role, setRole] = useState<string>(fixtures.find(entry => entry.id === initialSelectedId)?.role ?? 'lin')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [moreLoaded, setMoreLoaded] = useState(false)
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  useEffect(() => setMoreLoaded(false), [dataState])
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  let items = empty ? [] : fixtures.map(entry => ({ ...entry, travel: entry.travel ? { ...entry.travel } : undefined }))
  if (dataState === 'unknown') items = items.map((entry, index) => index === 0 && entry.travel ? { ...entry, travel: { ...entry.travel, status: 'unrecognized', kind: 'unknown' } } : entry)
  if (dataState === 'undated') items = items.map(entry => entry.travel ? { ...entry, travel: { ...entry.travel, start: undefined, end: undefined, stops: entry.travel.stops?.map(stop => ({ ...stop, date: undefined })) } } : entry)
  if (dataState === 'long') items = items.map((entry, index) => index === 0 && entry.travel ? { ...entry, title: '河边旅行 · 经过多个小镇并整理沿途照片的虚构旅行长名称。'.repeat(2), travel: { ...entry.travel, story: '【旅行长文样张】沿河边步道走了一段，记下了光线、天气和与同行者的谈话。\n\n'.repeat(30), stops: entry.travel.stops?.map(stop => ({ ...stop, story: '【停留长文样张】在步道旁安静整理照片，记录值得保存的细节。\n\n'.repeat(35) })) } } : entry)
  if (dataState === 'paged' && !moreLoaded) items = items.slice(0, 2)
  const scoped = items.filter(entry => role === 'all' || entry.role === role)
  const filtered = scoped.filter(entry => `${entry.id} ${entry.title} ${JSON.stringify(entry.travel)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const projected = projectFootprintRecords(scoped.map(entry => ({ id: entry.id, roleId: entry.role, kind: 'footprint', title: entry.title, body: '', source: 'demo', time: null, status: '', truncated: false, links: [], data: { payload: entry.travel } })))
  const missing = dataState === 'missing' || Boolean(selectedId && !scoped.some(entry => entry.id === selectedId))
  const hasMore = dataState === 'paged' && !moreLoaded && !empty && (role === 'lin' || role === 'all')
  return <section className="debug-travel-workbench" data-testid="debug-evidence-footprints">
    <div className="debug-travel-toolbar"><label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedId(undefined) }}><option value="all">全部人物</option>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label><label className="debug-travel-search"><Search size={14} /><TextField aria-label="搜索当前页证据" placeholder="搜索旅行、地点或经历" value={query} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setSelectedId(undefined) }} /></label></div>
    {!available ? <div className="debug-travel-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '足迹尚未读取' : previewState === 'loading' ? '正在读取足迹…' : previewState === 'unavailable' ? '足迹接口不可用；需要桌面诊断连接。' : '足迹读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取足迹样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-travel-state" role="alert"><p>刷新失败，保留上次资产及已加载页；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {missing && <p className="debug-travel-state" role="status">引用足迹未在当前已读人物范围找到，未选择替代记录。{!scoped.length && '当前范围没有已读取足迹资产；不推断人物从未到访。'}</p>}
      <p className="debug-travel-range">{query ? `${filtered.length} 项匹配 · ` : ''}{scoped.length} 项已读 · 总数未知</p>
      {!filtered.length ? !(missing && !scoped.length) && <div className="debug-travel-state" role="status"><p>{scoped.length ? '没有匹配的足迹资料' : '该人物范围没有已读取足迹资产；不推断人物从未到访。'}</p>{query && <ActionButton onClick={() => setQuery('')}>清除搜索</ActionButton>}</div> : null}
      <FootprintsReading items={projected.filter(entry => filtered.some(match => match.id === entry.id))} allItems={missing ? [] : projected} selectedId={selectedId} onSelect={setSelectedId}
        afterList={hasMore && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页样张</ActionButton>}
        renderDetail={item => {
          const selected = scoped.find(entry => entry.id === item.id)!
          return <>
        <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{footprintFields(item).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        {selected.relatedPages?.map(link => <ActionButton key={link.page} variant="plain" onClick={() => onPage(link.page)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}
        <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><code>companion_assets footprint · {selected.id}</code><p>目录日期 {selected.date} 不作为到访或出发日期。注册定义不证明历史输入使用。</p><pre>{JSON.stringify({ id: selected.id, role: selected.role, travel: selected.travel }, null, 2)}</pre>{selected.assets?.map(key => <ActionButton key={key} variant="plain" onClick={() => onAsset(key)}>查看注册定义 · {key}<ArrowUpRight size={14} /></ActionButton>)}</details>
          </>
        }} />
    </>}
  </section>
}

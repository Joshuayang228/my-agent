import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugGrowthFields, debugGrowthKey, debugNowTime, type DebugEvidenceItem, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type GrowthPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'empty-body' | 'unknown-time' | 'reflection-error' | 'paged' | 'missing'
interface Props {
  empty: boolean
  previewState: GrowthPreviewState
  snapshotState: GrowthPreviewState
  initialSelectedId?: string
  onRetry: () => void
  onPage: (page: DebugEvidencePageId) => void
  onAsset: (key: string) => void
}
/** 背景：当前覆盖、历史版本和反思状态共用人物 ID，混合平铺会误选且把摘要当成思维。
 * 意图：当前正文优先，各来源独立阅读，详情保留完整记录；只对历史分页。
 * 约束：用来源 + 记录 ID 选中，不补默认正文 / 门闸判断 / 1970 时间，不触发反思或写入。
 */
export function DebugGrowthCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onPage, onAsset }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.growth.items
  const [role, setRole] = useState<string>(fixtures.find(entry => entry.id === initialSelectedId)?.role ?? 'lin')
  const [selectedKey, setSelectedKey] = useState(() => { const entry = fixtures.find(value => value.id === initialSelectedId); return entry ? debugGrowthKey(entry) : initialSelectedId })
  const [moreLoaded, setMoreLoaded] = useState(false)
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const detailRef = useRef<HTMLElement>(null)
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  useEffect(() => setMoreLoaded(false), [dataState])
  useEffect(() => { if (selectedKey) detailRef.current?.scrollIntoView({ block: 'start' }) }, [selectedKey])
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  let items = empty ? [] : fixtures.map(entry => ({ ...entry, growth: entry.growth ? { ...entry.growth } : undefined }))
  if (dataState === 'reflection-error') items = items.filter(entry => entry.growth?.kind !== 'reflection')
  if (dataState === 'empty-body') items = items.map(entry => entry.growth?.kind === 'current' ? { ...entry, growth: { ...entry.growth, body: '' } } : entry)
  if (dataState === 'unknown-time') items = items.map(entry => entry.growth ? { ...entry, growth: { ...entry.growth, at: undefined, lastRunAt: undefined, runs: entry.growth.runs?.map(run => ({ ...run, at: 0 })) } } : entry)
  if (dataState === 'long') items = items.map(entry => entry.growth && (['current', 'default'].includes(entry.growth.kind) || entry.growth.kind === 'history' && entry.growth.version === 2) ? { ...entry, growth: { ...entry.growth, body: '【成长长文样张】交流时先确认对方的意图，保留必要的边界，再给出简短结论与可展开依据。\n\n'.repeat(12) } } : entry)
  if (dataState === 'paged' && !moreLoaded) items = items.filter(entry => entry.growth?.kind !== 'history' || entry.growth.version === 2)
  const scoped = items.filter(entry => entry.role === role)
  const current = scoped.find(entry => ['current', 'default'].includes(entry.growth?.kind ?? ''))
  const versions = scoped.filter(entry => entry.growth?.kind === 'history').sort((a, b) => (b.growth?.at ?? 0) - (a.growth?.at ?? 0) || (b.growth?.version ?? 0) - (a.growth?.version ?? 0))
  const reflection = scoped.find(entry => entry.growth?.kind === 'reflection')
  const selected = scoped.find(entry => debugGrowthKey(entry) === selectedKey)
  const missing = dataState === 'missing' || Boolean(selectedKey && !selected)
  const reflectionIssue = dataState === 'reflection-error' && role === 'lin'
  const hasMore = dataState === 'paged' && !moreLoaded && !empty && role === 'lin'
  const name = (entry: DebugEvidenceItem) => <ActionButton ref={node => { if (node) rowRefs.current.set(debugGrowthKey(entry), node); else rowRefs.current.delete(debugGrowthKey(entry)) }} variant="plain" className="debug-growth-name" style={{ color: 'var(--text-primary)' }} aria-label={entry.title} aria-expanded={selectedKey === debugGrowthKey(entry)} onClick={() => setSelectedKey(debugGrowthKey(entry))}>{entry.title}</ActionButton>
  const close = () => { setSelectedKey(undefined); requestAnimationFrame(() => selectedKey && rowRefs.current.get(selectedKey)?.focus()) }
  return <section className="debug-growth-workbench" data-testid="debug-evidence-growth">
    <div className="debug-growth-toolbar debug-focused-scope"><label>人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedKey(undefined) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label></div>
    {!available ? <div className="debug-growth-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '成长资料尚未读取' : previewState === 'loading' ? '正在读取成长资料…' : previewState === 'unavailable' ? '成长接口不可用；需要桌面诊断连接。' : '成长资料读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取成长样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-growth-state" role="alert"><p>刷新失败，保留上次正文、来源和已加载历史；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {missing && <p className="debug-growth-state" role="status">引用成长记录未在当前已读人物范围找到，未选择替代记录。{!scoped.length && '此范围没有已读成长资料；未补默认正文。'}</p>}
      {!scoped.length ? !missing && <p className="debug-growth-state" role="status">此范围没有已读成长资料；未补默认正文。</p> : <>
        {current?.growth && <section className="debug-growth-current" data-record-id={current.id} data-source-key={debugGrowthKey(current)}>{name(current)}
          <p className="debug-growth-body">{current.growth.body ? `${current.growth.body.slice(0, 180)}${current.growth.body.length > 180 ? '…' : ''}` : '当前覆盖正文为空；未改用默认正文。'}</p>
          <p className="debug-growth-meta">{current.growth.kind === 'default' ? '已读 Role Pack 默认定义 · 不是用户覆盖' : `用户成长覆盖 · v${current.growth.version ?? '未记录'} · ${debugNowTime(current.growth.at ?? 0, 'Asia/Shanghai')}`}{(current.growth.body?.length ?? 0) > 180 && ' · 正文预览，完整正文在详情'}</p>
        </section>}
        <section className="debug-growth-history"><h3>已保存版本</h3>{versions.length ? <><p className="debug-growth-meta">{versions.length} 项已读历史 · 总数未知</p>{versions.map(entry => <article className="debug-growth-row" key={debugGrowthKey(entry)} data-record-id={entry.id} data-source-key={debugGrowthKey(entry)}>{name(entry)}<p className="debug-growth-meta">{debugNowTime(entry.growth?.at ?? 0, 'Asia/Shanghai')} · {entry.growth?.summary || '摘要未提供'}</p></article>)}</> : <p className="debug-growth-meta">当前已读范围没有历史版本。</p>}{hasMore && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页历史样张</ActionButton>}</section>
        <section className="debug-growth-reflection"><h3>反思结果</h3>{reflectionIssue ? <p className="debug-growth-state" role="status">一条反思记录格式损坏或超限；结果数量未知。当前正文与历史仍可阅读。</p> : reflection?.growth ? <article className="debug-growth-row" data-record-id={reflection.id} data-source-key={debugGrowthKey(reflection)}>{name(reflection)}<p className="debug-growth-meta">最后运行：{debugNowTime(reflection.growth.lastRunAt ?? 0, 'Asia/Shanghai')}</p><p className="debug-growth-summary">{reflection.growth.runs?.at(-1)?.summary || '已读取反思状态，未保存运行结果。'}</p></article> : <p className="debug-growth-meta">当前已读范围没有反思状态。</p>}</section>
      </>}
      {selected?.growth && !missing && <article ref={detailRef} className="debug-growth-detail" aria-label="领域证据详情"><ActionButton variant="plain" onClick={close}><ArrowLeft size={14} />返回列表</ActionButton><h3>{selected.title}</h3>
        {selected.growth.kind === 'reflection' ? <><p className="debug-growth-meta">只读已保存的结果，不是隐藏思维；不据此推断当前门闸。</p>{selected.growth.runs?.slice().sort((a, b) => b.at - a.at).map((run, index) => <section key={index}><p className="debug-growth-meta">{debugNowTime(run.at, 'Asia/Shanghai')} · {run.changed ? '覆盖已变更' : '未改变'}</p><p className="debug-growth-body">{run.summary}</p></section>)}</> : <p className="debug-growth-body">{selected.growth.body || '该记录正文为空；未补默认正文。'}</p>}
        <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{debugGrowthFields(selected.growth).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        {selected.relatedPages?.map(link => <ActionButton key={link.page} variant="plain" onClick={() => onPage(link.page)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}
        <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><code>{debugGrowthKey(selected)}</code><p>时间以 Asia/Shanghai 显示。当前正文不是历史请求输入；注册定义可能与历史版本不同。门闸决策未在本查询提供。</p><pre>{JSON.stringify({ role, ...selected.growth }, null, 2)}</pre>{selected.assets?.map(key => <ActionButton key={key} variant="plain" onClick={() => onAsset(key)}>查看当前注册定义 · {key}<ArrowUpRight size={14} /></ActionButton>)}</details>
      </article>}
    </>}
  </section>
}

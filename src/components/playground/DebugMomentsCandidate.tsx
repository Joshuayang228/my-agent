import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowUpRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { parseCastInteractions } from '../../shared/moment-user-interactions'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugMomentDate, debugMomentFields, debugMomentPreview, debugNowTime, type DebugMomentRecord, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type MomentsPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'empty-body' | 'unknown-time' | 'partial' | 'truncated' | 'paged' | 'missing'
interface Props {
  empty: boolean
  previewState: MomentsPreviewState
  snapshotState: MomentsPreviewState
  initialSelectedId?: string
  onRetry: () => void
  onPage: (page: DebugEvidencePageId) => void
  onEvidence: (page: DebugEvidencePageId, id: string) => void
}
function Interactions({ moment }: { moment: DebugMomentRecord }) {
  const cast = parseCastInteractions(moment.meta)
  const rawCast = moment.meta.interactions
  return <details className="debug-prompt-provenance debug-moments-interactions"><summary>互动记录</summary>
    <section><h4>卡司投影</h4>{cast.length ? cast.map((entry, index) => <div key={index} className="debug-moments-interaction"><p className="debug-moments-meta">{entry.castName} · {entry.kind === 'coframe' ? '同框记录' : '评论'}</p>{entry.kind === 'comment' && <p className="debug-moments-body">{entry.text || '评论正文未提供'}</p>}</div>) : <p className="debug-moments-meta">未记录可识别的卡司互动。</p>}{Array.isArray(rawCast) && cast.length < rawCast.length && <p className="debug-moments-state">部分卡司互动无法识别，原始记录保留在来源区。</p>}</section>
    <section><h4>用户保存的互动</h4>{moment.userInteractions === undefined ? <p className="debug-moments-meta">本次查询未提供用户互动，数量未知。</p> : moment.userInteractions.length ? moment.userInteractions.map((entry, index) => <div key={index} className="debug-moments-interaction"><p className="debug-moments-meta">{entry.actor_id === 'user' ? '我' : entry.actor_id || '参与者未记录'} · {entry.kind === 'like' ? '点赞' : entry.kind === 'comment' ? '评论' : '未识别的互动'} · {debugNowTime(entry.created_at, 'Asia/Shanghai')}</p>{entry.text && <p className="debug-moments-body">{entry.text}</p>}</div>) : <p className="debug-moments-meta">本次已读范围没有用户互动。</p>}</section>
    <p className="debug-moments-meta">卡司投影与用户保存记录分开；不据此推断关系或全量互动数。</p>
  </details>
}
/** 背景：事件标题、发布正文和两类互动混排，导致计划与发布、同框与评论含义混淆。
 * 意图：正文预览优先，发布时地作辅助，全文与分来源互动在单记录详情阅读。
 * 约束：只读隔离记录，日期依据 publishedAt，不补时间 / 互动统计 / 图片，也不触发赞评写入。
 */
export function DebugMomentsCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onPage, onEvidence }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.moments.items
  const target = fixtures.find(entry => entry.id === initialSelectedId)
  const [role, setRole] = useState<string>(target?.role ?? 'lin')
  const [date, setDate] = useState(() => target ? debugMomentDate(target.moment?.publishedAt) : '')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [moreLoaded, setMoreLoaded] = useState(false)
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const detailRef = useRef<HTMLElement>(null)
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  useEffect(() => setMoreLoaded(false), [dataState, role, date])
  useEffect(() => { if (selectedId) detailRef.current?.scrollIntoView({ block: 'start' }) }, [selectedId])
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  let items = empty ? [] : fixtures.map(entry => ({ ...entry, moment: entry.moment ? { ...entry.moment } : undefined }))
  if (dataState === 'partial') items = items.filter(entry => entry.id !== 'demo-moment-reading')
  items = items.map(entry => {
    if (!entry.moment || entry.id !== 'demo-moment-reading') return entry
    const moment = { ...entry.moment }
    if (dataState === 'empty-body') moment.text = ''
    if (dataState === 'unknown-time') moment.publishedAt = undefined
    if (dataState === 'truncated') moment.truncated = true
    if (dataState === 'long') { moment.text = '【动态长文样张】翻看旅途留下的笔记，在每个段落里保留当时见到的光线、天气和人的声音。\n\n'.repeat(35); moment.userInteractions = moment.userInteractions?.map(value => value.kind === 'comment' ? { ...value, text: '【用户长评论样张】希望下次还能一起看这些照片，慢慢整理沿途留下的故事。'.repeat(6) } : value) }
    return { ...entry, moment }
  }).sort((a, b) => (b.moment?.publishedAt ?? -Infinity) - (a.moment?.publishedAt ?? -Infinity) || b.id.localeCompare(a.id))
  const eligible = items.filter(entry => entry.role === role && (!date || debugMomentDate(entry.moment?.publishedAt) === date))
  const scoped = dataState === 'paged' && !moreLoaded && !initialSelectedId ? eligible.slice(0, 1) : eligible
  const filtered = scoped.filter(entry => `${entry.id} ${JSON.stringify(entry.moment)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selected = filtered.find(entry => entry.id === selectedId)
  const missing = dataState === 'missing' || Boolean(initialSelectedId && !scoped.some(entry => entry.id === initialSelectedId))
  const hasMore = dataState === 'paged' && !moreLoaded && !initialSelectedId && eligible.length > scoped.length
  const close = () => { setSelectedId(undefined); requestAnimationFrame(() => selectedId && rowRefs.current.get(selectedId)?.focus()) }
  return <section className="debug-moments-workbench" data-testid="debug-evidence-moments">
    <div className="debug-moments-toolbar"><label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedId(undefined) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label><label className="debug-moments-search"><Search size={14} /><TextField aria-label="搜索当前页证据" appearance="outlined" placeholder="搜索已读正文或互动" value={query} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setSelectedId(undefined) }} /></label><label>发布日<TextField appearance="outlined" type="date" aria-label="动态发布日" value={date} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setDate(event.target.value); setSelectedId(undefined) }} /></label></div>
    {!available ? <div className="debug-moments-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '动态尚未读取' : previewState === 'loading' ? '正在读取动态…' : previewState === 'unavailable' ? '动态接口不可用；需要桌面诊断连接。' : '动态读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取动态样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-moments-state" role="alert"><p>刷新失败，保留原人物、发布日、筛选和已加载记录；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {dataState === 'partial' && role === 'lin' && <p className="debug-moments-state" role="status">一条动态记录格式不可读取；其余记录保留，条数仅含已读可用记录。</p>}
      {missing && <p className="debug-moments-state" role="status">引用动态未在当前已读人物范围找到，未选择替代记录。</p>}
      {scoped.length > 0 && <p className="debug-moments-range">{query || date ? `${filtered.length} 项匹配 · ` : ''}{scoped.length} 项已读动态 · 总数未知</p>}
      {!filtered.length ? <p className="debug-moments-state" role="status">{!scoped.length ? '此范围没有已读动态；不据此推断人物从未发布。' : '当前已读范围没有匹配的动态。'}{Boolean(query || date) && <ActionButton variant="plain" onClick={() => { setDate(''); setQuery('') }}>清除筛选</ActionButton>}</p> : <div className="debug-moments-list">{filtered.map(entry => entry.moment && <article key={entry.id} className="debug-moments-row" data-record-id={entry.id}><ActionButton ref={node => { if (node) rowRefs.current.set(entry.id, node); else rowRefs.current.delete(entry.id) }} className="debug-moments-preview" style={{ color: 'var(--text-primary)' }} variant="plain" aria-label={`查看动态：${debugMomentPreview(entry.moment)}`} aria-expanded={selectedId === entry.id} onClick={() => setSelectedId(entry.id)}>{debugMomentPreview(entry.moment)}</ActionButton><p className="debug-moments-meta">发布：{debugNowTime(entry.moment.publishedAt ?? 0, 'Asia/Shanghai')}{typeof entry.moment.meta.location === 'string' && entry.moment.meta.location && ` · ${entry.moment.meta.location}`}</p>{entry.moment.truncated && <p className="debug-moments-state">此记录已被读取边界截断，正文和互动均不保证完整。</p>}</article>)}</div>}
      {hasMore && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页动态样张</ActionButton>}
      {selected?.moment && !missing && <article ref={detailRef} className="debug-moments-detail" aria-label="领域证据详情"><ActionButton variant="plain" onClick={close}><ArrowLeft size={14} />返回列表</ActionButton><h3>动态正文</h3><p className="debug-moments-body">{selected.moment.text || '此动态正文为空；未补事件文案。'}</p><p className="debug-moments-meta">发布：{debugNowTime(selected.moment.publishedAt ?? 0, 'Asia/Shanghai')}。发布不证明活动完成。</p>{selected.moment.truncated && <p className="debug-moments-state">记录读取有截断；以下仅含本次已返回内容，互动总数未知。</p>}
        <Interactions moment={selected.moment} />
        <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{debugMomentFields(selected.id, selected.moment).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        <div className="debug-moments-related">{selected.links?.map(link => <ActionButton key={`${link.page}:${link.id}`} variant="plain" onClick={() => onEvidence(link.page, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}{selected.relatedPages?.map(link => <ActionButton key={link.page} variant="plain" onClick={() => onPage(link.page)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}</div>
        <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><code>companion_moments · {selected.id}</code><p>时间以 Asia/Shanghai 显示。仅保存发布资料与已读互动，不提供图片文件、完整反应统计或历史请求输入。</p><pre>{JSON.stringify({ id: selected.id, role: selected.role, ...selected.moment, eventId: selected.links?.find(link => link.page === 'recent')?.id }, null, 2)}</pre></details>
      </article>}
    </>}
  </section>
}

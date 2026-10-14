import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowUpRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { TextField } from '../foundation/TextField'
import { EmptyState } from '../foundation/EmptyState'
import { DEBUG_ROLES, type DebugRecordFixture } from './debug-experience-fixtures'
import { getDebugEvidencePage, type DebugEvidencePageId, type DebugEvidenceItem } from './debug-evidence-fixtures'

interface Props {
  id: DebugEvidencePageId
  records: readonly DebugRecordFixture[]
  empty: boolean
  initialSelectedId?: string
  onAsset: (key: string) => void
  onRecord: (id: string) => void
  onEvidence: (page: DebugEvidencePageId, id: string) => void
}
const TIMELINE_PAGES = new Set<DebugEvidencePageId>(['recent', 'activity', 'events', 'moments', 'proactive', 'growth', 'traces'])
const STATUS_PAGES = new Set<DebugEvidencePageId>(['now', 'location', 'character', 'profile', 'context'])

/** 背景：默认必须读到领域事实，不能靠逐条选择通用字段列表。
 * 设计意图：时序、状态、资料和资产分别阅读，共享筛选及显式证据跳转；技术字段留在详情。
 * 关键约束：仅消费隔离数据，家居归属与旅行分类由类型化元数据给定，禁止比较中文 label 推断关系。
 */
export function DebugEvidenceCandidate({ id, records, empty, initialSelectedId, onAsset, onRecord, onEvidence }: Props) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [date, setDate] = useState(() => getDebugEvidencePage(id, records).items.find(entry => entry.id === initialSelectedId)?.date ?? '2026-10-13')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [detailOpen, setDetailOpen] = useState(Boolean(initialSelectedId))
  const detailRef = useRef<HTMLElement | null>(null)
  const entryButtons = useRef(new Map<string, HTMLButtonElement>())
  const page = getDebugEvidencePage(id, records)
  const items = empty ? [] : page.items
  const filtered = items.filter(entry =>
    (role === 'all' || entry.role === role || entry.role === 'shared') &&
    (!page.dateFilter || !date || entry.date === date) &&
    `${entry.title} ${entry.subtitle} ${entry.id} ${entry.status} ${entry.body ?? ''} ${entry.fields.flat().join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )
  const selected = filtered.find(entry => entry.id === selectedId)
  useEffect(() => { if (detailOpen) detailRef.current?.scrollIntoView({ block: 'start' }) }, [detailOpen, selectedId])
  const searchable = !STATUS_PAGES.has(id)
  const layout = id === 'schedule' ? 'schedule' : TIMELINE_PAGES.has(id) ? 'timeline' : STATUS_PAGES.has(id) ? 'summary' : 'catalog'
  const reset = () => { setQuery(''); setRole('all'); setDate('2026-10-13'); setDetailOpen(false) }
  const facts = (entry: DebugEvidenceItem, reading = false) => <dl className="debug-candidate-facts">{(reading ? entry.readingFields ?? entry.fields : entry.fields).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  const card = (entry: DebugEvidenceItem) => <article key={entry.id} className="debug-reading-entry" data-record-id={entry.id}>
    <ActionButton ref={node => { if (node) entryButtons.current.set(entry.id, node); else entryButtons.current.delete(entry.id) }} variant="plain" className="debug-reading-entry-title" aria-pressed={(selected?.id ?? filtered[0]?.id) === entry.id} onClick={() => { setSelectedId(entry.id); setDetailOpen(true) }}>
      <strong>{entry.title}</strong><Badge tone={entry.status.includes('失败') ? 'danger' : 'neutral'}>{entry.status}</Badge>
    </ActionButton>
    <p className="debug-reading-subtitle">{entry.role === 'shared' ? '显式共享' : DEBUG_ROLES.find(value => value.id === entry.role)?.label}</p>
    {entry.summaries ? <div className="debug-reading-summaries">{entry.summaries.map(summary => <section key={summary.title}><h3>{summary.title}</h3><p>{summary.text}</p><small>{summary.scope}</small></section>)}</div> : facts(entry, true)}
    {!entry.stages && entry.body && <p className="debug-reading-body">{entry.body}</p>}
    {entry.stages && <ol className="debug-candidate-timeline">{entry.stages.map((stage, index) => <li key={stage.title}><span className="debug-candidate-step">{index + 1}</span><div><strong>{stage.title}</strong><p>{stage.detail}</p></div><code>{stage.duration}</code></li>)}</ol>}
    {entry.travel?.stops?.map(stop => <section key={`${stop.name}:${stop.date}`} className="debug-reading-stop"><h4>{stop.date ?? '日期未提供'} · {stop.name}</h4><p>{stop.story}</p></section>)}
    {entry.travel?.kind === 'planned' && <p className="debug-reading-warning">尚未出发，不计入实际旅行。</p>}
    {entry.travel?.kind === 'place' && <p className="debug-reading-warning">地点资料，访问日期未记录，不转为旅行。</p>}
  </article>

  // 背景：家居对象在扁平列表中失去住所和空间关系；意图：只用显式 parentId 嵌套。
  // 约束：筛选造成父记录不在当前结果时独立保留子记录，不隐去搜索命中。
  const home = () => {
    const nestedIds = new Set<string>()
    const homes = filtered.filter(entry => entry.home?.kind === 'residence')
    const sections = homes.map(residence => {
      nestedIds.add(residence.id)
      const spaces = filtered.filter(entry => entry.home?.kind === 'space' && entry.home.parentId === residence.id)
      return <section key={residence.id} className="debug-reading-home">{card(residence)}{spaces.map(space => {
        nestedIds.add(space.id)
        const objects = filtered.filter(entry => entry.home?.kind === 'object' && entry.home.parentId === space.id)
        objects.forEach(object => nestedIds.add(object.id))
        return <section key={space.id} className="debug-reading-space">{card(space)}<div className="debug-reading-object-grid">{objects.map(card)}</div></section>
      })}</section>
    })
    const remaining = filtered.filter(entry => !nestedIds.has(entry.id))
    return <>{sections}{remaining.length > 0 && <section><h3 className="debug-reading-group-title">未归置、未设定或当前筛选的独立记录</h3>{remaining.map(card)}</section>}</>
  }
  const travel = () => <>{(['actual', 'planned', 'cancelled', 'place'] as const).map(kind => {
    const entries = filtered.filter(entry => entry.travel?.kind === kind)
    const names = { actual: '实际旅行', planned: '旅行计划 · 尚未出发', cancelled: '已取消计划', place: '地点资料 · 非旅行' }
    return entries.length > 0 && <section key={kind}><h3 className="debug-reading-group-title">{names[kind]} · {entries.length}</h3>{entries.map(card)}</section>
  })}</>

  const culture = () => <>{(['reading', 'music', 'film', 'photography'] as const).map(category => {
    const entries = filtered.filter(entry => entry.category === category)
    const labels = { reading: '阅读', music: '音乐', film: '影视', photography: '摄影' }
    return entries.length > 0 && <section key={category}><h3 className="debug-reading-group-title">{labels[category]}</h3>{entries.map(card)}</section>
  })}</>

  return <section className="debug-evidence-workbench" data-testid={`debug-evidence-${id}`}>
    <div className="debug-candidate-role-filter" role="group" aria-label="证据人物筛选">
      {[{ id: 'all', label: '全部人物' }, ...DEBUG_ROLES].map(entry => <ActionButton key={entry.id} variant="plain" aria-pressed={role === entry.id} onClick={() => { setRole(entry.id); setDetailOpen(false) }}>{entry.label}</ActionButton>)}
      <span>{filtered.length} / {items.length} {page.unit} · 样张范围{role !== 'all' && ' · 含显式共享'}</span>
    </div>
    {(searchable || page.dateFilter) && <div className="debug-candidate-toolbar">
      {searchable && <label className="debug-candidate-search"><Search size={14} /><TextField aria-label="搜索当前页证据" value={query} placeholder="搜索名称、正文或字段" onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setDetailOpen(false) }} /></label>}
      {page.dateFilter && <label className="debug-evidence-date">样张日期<TextField type="date" aria-label="证据日期" value={date} onChange={(event: ChangeEvent<HTMLInputElement>) => { setDate(event.target.value); setDetailOpen(false) }} /></label>}
    </div>}
    {!filtered.length ? <EmptyState title={items.length ? '没有匹配的证据' : '此范围没有记录'} description={items.length ? '调整搜索、人物或日期；没有匹配不等于能力未实现。' : '真实读取为空时保留来源与范围，不生成默认人物事实。'} action={items.length ? <ActionButton onClick={reset}>清除筛选</ActionButton> : undefined} /> : <>
      <div className={`debug-reading debug-reading-${layout}`} data-reading-layout={id === 'residence' ? 'home' : id === 'footprints' ? 'travel' : layout} data-detail-open={detailOpen && Boolean(selected)}>
        {id === 'residence' ? home() : id === 'footprints' ? travel() : id === 'items' ? culture() : filtered.map(card)}
      </div>
      {detailOpen && selected && <article ref={detailRef} className="debug-candidate-detail debug-reading-detail" aria-label="领域证据详情">
        <ActionButton variant="plain" onClick={() => { setDetailOpen(false); requestAnimationFrame(() => entryButtons.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} /> 返回列表</ActionButton>
        <div className="debug-candidate-detail-heading"><h3>{selected.title}</h3><Badge>{selected.status}</Badge></div>
        {facts(selected)}
        {selected.body && <p className="debug-reading-body">{selected.body}</p>}
        <details className="debug-prompt-provenance"><summary>记录标识与范围</summary><code>{selected.id}</code><p>{selected.subtitle}</p><p>{selected.date} · {selected.role} · 隔离样张</p></details>
        <section className="debug-candidate-section"><h3>明确关联的来源与证据</h3>
          {selected.assets?.map(key => <ActionButton key={key} variant="plain" className="debug-candidate-asset-link" onClick={() => onAsset(key)}><div><strong>查看注册定义</strong><code>{key}</code></div><ArrowUpRight size={14} /></ActionButton>)}
          {selected.callId && <ActionButton variant="plain" className="debug-candidate-asset-link" onClick={() => onRecord(selected.callId!)}><div><strong>查看关联调用</strong><code>{selected.callId}</code></div><ArrowUpRight size={14} /></ActionButton>}
          {selected.links?.map(link => <ActionButton key={`${link.page}:${link.id}`} variant="plain" className="debug-candidate-asset-link" onClick={() => onEvidence(link.page, link.id)}><div><strong>{link.label}</strong><code>{link.id}</code></div><ArrowUpRight size={14} /></ActionButton>)}
          {!selected.assets?.length && !selected.callId && !selected.links?.length && <p>没有保存更多关联标识，不按时间或名称补猜。</p>}
        </section>
      </article>}
    </>}
    <details className="debug-prompt-provenance"><summary>数据范围与能力边界</summary><p>{page.boundary}</p></details>
  </section>
}

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowUpRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { TextField } from '../foundation/TextField'
import { SelectField } from '../foundation/SelectField'
import { EmptyState } from '../foundation/EmptyState'
import { DEBUG_ROLES, type DebugRecordFixture } from './debug-experience-fixtures'
import { getDebugEvidencePage, type DebugEvidencePageId, type DebugEvidenceItem } from './debug-evidence-fixtures'

export type EvidencePreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'missing' | 'unknown-time' | 'paged'

interface Props {
  id: DebugEvidencePageId
  records: readonly DebugRecordFixture[]
  empty: boolean
  initialSelectedId?: string
  previewState?: EvidencePreviewState
  snapshotState?: EvidencePreviewState
  onRetry?: () => void
  onAsset: (key: string) => void
  onRecord: (id: string) => void
  onEvidence: (page: DebugEvidencePageId, id: string) => void
}
const TIMELINE_PAGES = new Set<DebugEvidencePageId>(['recent', 'activity', 'events', 'moments', 'proactive', 'growth', 'traces'])
const STATUS_PAGES = new Set<DebugEvidencePageId>(['now', 'location', 'character', 'profile', 'context'])
const ROUTINE_STATUS = new Set(['计划时段', '当前快照', '当前', '已有记录', '已设定', '人物资料', '记忆聚合', '已存储', '已记录', '已收到', '当前版本', '已提供资料', '已有线索', '显式关联'])

/** 背景：默认必须读到领域事实，不能靠逐条选择通用字段列表。
 * 设计意图：时序、状态、资料和资产分别阅读，共享筛选及显式证据跳转；技术字段留在详情。
 * 关键约束：仅消费隔离数据，家居归属与旅行分类由类型化元数据给定，禁止比较中文 label 推断关系。
 */
export function DebugEvidenceCandidate({ id, records, empty, initialSelectedId, previewState = 'ready', snapshotState = 'ready', onRetry, onAsset, onRecord, onEvidence }: Props) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<string>(() => getDebugEvidencePage(id, records).items.find(entry => entry.id === initialSelectedId)?.role === 'yu' ? 'yu' : 'lin')
  const [date, setDate] = useState(() => getDebugEvidencePage(id, records).items.find(entry => entry.id === initialSelectedId)?.date ?? (id === 'recent' ? '' : '2026-10-13'))
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [detailOpen, setDetailOpen] = useState(Boolean(initialSelectedId))
  const detailRef = useRef<HTMLElement | null>(null)
  const entryButtons = useRef(new Map<string, HTMLButtonElement>())
  const page = getDebugEvidencePage(id, records)
  const [moreLoaded, setMoreLoaded] = useState(false)
  const recent = id === 'recent'
  const available = !recent || !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  useEffect(() => { setMoreLoaded(false) }, [dataState])
  const items = empty ? [] : page.items.map((entry, index) => {
    if (!recent || index !== 0) return entry
    if (dataState === 'long') return { ...entry, title: '整理一段较长的旅行见闻与材料，保留原始记录和明确关联以便逐步核对。'.repeat(3), body: '【长正文样张】这是虚构的旅行记录段落，用来验证自然语言正文的行宽、换行和完整读取。'.repeat(30) }
    if (dataState !== 'unknown-time') return entry
    const fields = entry.fields.map((field, fieldIndex): [string, string] => fieldIndex === 0 ? [field[0], '未记录'] : [...field])
    return { ...entry, event: { ...entry.event, scheduledAt: null }, subtitle: '时间未记录', fields, readingFields: [fields[0]] }
  }).slice(0, recent && dataState === 'paged' && !moreLoaded && !initialSelectedId ? 2 : undefined)
  const filtered = items.filter(entry =>
    (role === 'all' || entry.role === role || entry.role === 'shared') &&
    (!page.dateFilter || !date || entry.date === date) &&
    `${entry.title} ${entry.subtitle} ${entry.id} ${entry.status} ${entry.body ?? ''} ${entry.fields.flat().join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )
  if (recent) filtered.sort((left, right) => (right.event?.scheduledAt ?? -Infinity) - (left.event?.scheduledAt ?? -Infinity) || right.id.localeCompare(left.id))
  const missing = recent && (dataState === 'missing' || Boolean(initialSelectedId && !page.items.some(entry => entry.id === initialSelectedId)))
  const selected = filtered.find(entry => entry.id === selectedId)
  useEffect(() => { if (detailOpen) detailRef.current?.scrollIntoView({ block: 'start' }) }, [detailOpen, selectedId])
  const searchable = !STATUS_PAGES.has(id)
  const layout = id === 'schedule' ? 'schedule' : TIMELINE_PAGES.has(id) ? 'timeline' : STATUS_PAGES.has(id) ? 'summary' : 'catalog'
  const reset = () => { setQuery(''); setRole('lin'); setDate(recent ? '' : '2026-10-13'); setDetailOpen(false) }
  const facts = (entry: DebugEvidenceItem, reading = false) => <dl className="debug-candidate-facts">{(reading ? entry.readingFields ?? [] : entry.fields).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  const card = (entry: DebugEvidenceItem) => <article key={entry.id} className="debug-reading-entry" data-record-id={entry.id}>
    {recent ? <>
      <time className="debug-recent-time">{entry.event?.scheduledAt == null ? '时间未记录' : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(entry.event.scheduledAt)}</time>
      <div className="debug-recent-summary"><ActionButton ref={node => { if (node) entryButtons.current.set(entry.id, node); else entryButtons.current.delete(entry.id) }} variant="plain" className="debug-recent-title" aria-label={entry.title} aria-expanded={detailOpen && selected?.id === entry.id} onClick={() => { setSelectedId(entry.id); setDetailOpen(true) }}>{entry.title}</ActionButton>
        <p><span>{entry.status}</span>{entry.event?.location && <span>{entry.event.location}</span>}{role === 'all' && <span>{DEBUG_ROLES.find(value => value.id === entry.role)?.label}</span>}</p>
      </div>
    </> : <><ActionButton ref={node => { if (node) entryButtons.current.set(entry.id, node); else entryButtons.current.delete(entry.id) }} variant="plain" className="debug-reading-entry-title" aria-label={entry.title} aria-expanded={detailOpen && selected?.id === entry.id} onClick={() => { setSelectedId(entry.id); setDetailOpen(true) }}>
      {STATUS_PAGES.has(id) && filtered.length === 1 ? <span className="debug-candidate-muted">查看详情 <ArrowUpRight size={12} /></span> : <strong>{entry.title}</strong>}{!ROUTINE_STATUS.has(entry.status) && <Badge tone={entry.status.includes('失败') ? 'danger' : 'neutral'}>{entry.status}</Badge>}
    </ActionButton>
    {role === 'all' && <p className="debug-reading-subtitle">{entry.role === 'shared' ? '显式共享' : DEBUG_ROLES.find(value => value.id === entry.role)?.label}</p>}
    {entry.summaries ? <div className="debug-reading-summaries">{entry.summaries.map(summary => <section key={summary.title}><h3>{summary.title}</h3><p>{summary.text}</p></section>)}</div> : facts(entry, true)}
    {!entry.stages && entry.body && <p className="debug-reading-body">{entry.body}</p>}
    {entry.stages && <ol className="debug-candidate-timeline">{entry.stages.map((stage, index) => <li key={stage.title}><span className="debug-candidate-step">{index + 1}</span><div><strong>{stage.title}</strong><p>{stage.detail}</p></div><code>{stage.duration}</code></li>)}</ol>}
    {entry.travel?.stops?.map(stop => <section key={`${stop.name}:${stop.date}`} className="debug-reading-stop"><h4>{stop.date ?? '日期未提供'} · {stop.name}</h4><p>{stop.story}</p></section>)}
    {entry.travel?.kind === 'planned' && <p className="debug-reading-warning">尚未出发，不计入实际旅行。</p>}
    {entry.travel?.kind === 'place' && <p className="debug-reading-warning">地点资料，访问日期未记录，不转为旅行。</p>}</>}
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
    {id === 'profile' && <p className="debug-reading-subtitle">{role === 'all' ? '全局资料与各人物的协作反馈' : '全局资料与当前人物的协作反馈'}</p>}
    <div className="debug-candidate-toolbar">
    <div className="debug-candidate-role-filter debug-focused-scope" role="group" aria-label="证据人物筛选">
      <label>人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setDetailOpen(false); setMoreLoaded(false) }}>{[{ id: 'all', label: '全部人物' }, ...DEBUG_ROLES].map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</SelectField></label>
      {!recent && (query || role === 'all') && <span>{filtered.length} {page.unit}</span>}
    </div>
      {searchable && <label className="debug-candidate-search"><Search size={14} /><TextField appearance="outlined" className="h-8 px-3" aria-label="搜索当前页证据" value={query} disabled={!available} placeholder="搜索名称、正文或字段" onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setDetailOpen(false) }} /></label>}
      {page.dateFilter && <label className="debug-evidence-date">{id === 'schedule' ? '计划日期' : '日期'}<TextField appearance="outlined" className="h-8 px-2" type="date" aria-label="证据日期" value={date} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setDate(event.target.value); setDetailOpen(false); setMoreLoaded(false) }} /></label>}
    </div>
    {recent && !available ? <div className="debug-recent-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '事项尚未读取' : previewState === 'loading' ? '正在读取事项…' : previewState === 'unavailable' ? '事项接口不可用；需要桌面诊断连接。' : '事项读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取事项样张</ActionButton>}</div> : <>
    {recent && previewState === 'refresh-error' && <div className="debug-recent-state" role="alert"><p>刷新失败，保留上次事项；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
    {recent && <p className="debug-recent-range"><span>{date || '全部日期'} · 按计划时间</span><span aria-label="事项范围计数">{filtered.length} 条{query ? '匹配 · 已读取范围' : '已读取'} · 总数未知</span></p>}
    {missing ? <p className="debug-recent-state" role="status">引用事项未在该人物范围找到，未选择替代记录。</p> : recent && !filtered.length ? <div className="debug-recent-state" role="status"><p>{items.some(entry => (role === 'all' || entry.role === role) && (!date || entry.date === date)) ? '没有匹配的证据' : '此范围没有记录'}</p>{(query || date || role !== 'lin') && <ActionButton onClick={reset}>清除筛选</ActionButton>}</div> : !filtered.length ? <EmptyState title={items.length ? '没有匹配的证据' : '此范围没有记录'} description={items.length ? '调整搜索、人物或日期；没有匹配不等于能力未实现。' : '真实读取为空时保留来源与范围，不生成默认人物事实。'} action={items.length ? <ActionButton onClick={reset}>清除筛选</ActionButton> : undefined} /> : <>
      <div className={`debug-reading debug-reading-${layout}`} data-reading-layout={id === 'residence' ? 'home' : id === 'footprints' ? 'travel' : layout} data-detail-open={detailOpen && Boolean(selected)}>
        {id === 'residence' ? home() : id === 'footprints' ? travel() : id === 'items' ? culture() : filtered.map(card)}
      </div>
      {detailOpen && selected && <article ref={detailRef} className="debug-candidate-detail debug-reading-detail" aria-label="领域证据详情">
        <ActionButton variant="plain" onClick={() => { setDetailOpen(false); requestAnimationFrame(() => entryButtons.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} /> 返回列表</ActionButton>
        <div className="debug-candidate-detail-heading"><h3>{selected.title}</h3><Badge>{selected.status}</Badge></div>
        {recent ? <>
          <p className="debug-recent-state">计划时间不代表发布时间；已发布不证明活动完成。</p>
          {selected.body ? <p className="debug-reading-body">{selected.body}</p> : <p className="debug-recent-state">此事项未保存正文。</p>}
          <details className="debug-prompt-provenance"><summary>完整字段</summary>{facts(selected)}</details>
        </> : <>{facts(selected)}{selected.body && <p className="debug-reading-body">{selected.body}</p>}</>}
        <details className="debug-prompt-provenance"><summary>记录标识与范围</summary><code>{selected.id}</code><p>{selected.subtitle}</p><p>{selected.date} · {selected.role} · 隔离样张</p>{recent && <pre>{JSON.stringify(selected, null, 2)}</pre>}</details>
        <section className="debug-candidate-section"><h3>明确关联的来源与证据</h3>
          {selected.assets?.map(key => <ActionButton key={key} variant="plain" className="debug-candidate-asset-link" onClick={() => onAsset(key)}><div><strong>查看注册定义</strong><code>{key}</code></div><ArrowUpRight size={14} /></ActionButton>)}
          {selected.callId && <ActionButton variant="plain" className="debug-candidate-asset-link" onClick={() => onRecord(selected.callId!)}><div><strong>查看关联调用</strong><code>{selected.callId}</code></div><ArrowUpRight size={14} /></ActionButton>}
          {selected.links?.map(link => <ActionButton key={`${link.page}:${link.id}`} variant="plain" className="debug-candidate-asset-link" onClick={() => onEvidence(link.page, link.id)}><div><strong>{link.label}</strong><code>{link.id}</code></div><ArrowUpRight size={14} /></ActionButton>)}
          {!selected.assets?.length && !selected.callId && !selected.links?.length && <p>没有保存更多关联标识，不按时间或名称补猜。</p>}
        </section>
      </article>}
    </>}
    {recent && dataState === 'paged' && !moreLoaded && !initialSelectedId && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页样张</ActionButton>}
    </>}
  </section>
}

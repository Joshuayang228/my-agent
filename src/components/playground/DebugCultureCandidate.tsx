import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowUpRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { TabStrip } from '../foundation/TabStrip'
import { normalizeWorldRecordField, readingNotesForAsset, worldRecordConsistencyError } from '../../shared/world-records'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugCultureType, debugCultureStatus, debugCultureText, debugCultureBody, debugCultureFields, debugNowTime, type DebugCultureRecord, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type CulturePreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'empty-notes' | 'legacy-note' | 'invalid-notes' | 'invalid-progress' | 'missing-fields' | 'unknown' | 'archived' | 'truncated' | 'paged' | 'missing'
interface Props { empty: boolean; previewState: CulturePreviewState; snapshotState: CulturePreviewState; initialSelectedId?: string; onRetry: () => void; onEvidence: (page: DebugEvidencePageId, id: string) => void }
const CATEGORIES = [{ id: 'all', label: '全部' }, { id: 'reading', label: '书籍' }, { id: 'film', label: '影视' }, { id: 'music', label: '音乐' }, { id: 'photography', label: '摄影' }, { id: 'unknown', label: '未识别' }]
const creator = (record: DebugCultureRecord) => debugCultureText(record, ({ reading: 'author', film: 'director', music: 'artist' } as Record<string, string>)[debugCultureType(record)] ?? 'author')
const notesIssue = (record: DebugCultureRecord) => { const parsed = normalizeWorldRecordField(record.kind, 'readingNotes', record.payload.readingNotes); return Object.hasOwn(record.payload, 'readingNotes') && parsed.handled && !parsed.ok }
function ReadingNotes({ id, record }: { id: string; record: DebugCultureRecord }) {
  const notes = readingNotesForAsset({ id, payload: record.payload }).sort((a, b) => (b.occurredAt ?? b.createdAt ?? 0) - (a.occurredAt ?? a.createdAt ?? 0) || a.id.localeCompare(b.id))
  return <section className="debug-culture-notes"><h4>阅读笔记</h4>{notesIssue(record) ? <p className="debug-culture-state">笔记结构无效；保留原始数据，不用旧笔记替代。</p> : notes.length ? <><p className="debug-culture-meta">{notes.length} 条已读笔记</p>{notes.map(note => <section key={note.id} data-note-id={note.id}><p className="debug-culture-meta">{note.occurredAt !== undefined ? '发生时间' : note.createdAt !== undefined ? '创建时间' : '笔记时间'}：{debugNowTime(note.occurredAt ?? note.createdAt ?? 0, 'Asia/Shanghai')}{note.page !== undefined && ` · 第 ${note.page} 页`}{note.chapter && ` · ${note.chapter}`}</p><p className="debug-culture-body">{note.text}</p></section>)}</> : <p className="debug-culture-meta">{Object.hasOwn(record.payload, 'readingNotes') ? '本次已读笔记数组为空，未回退旧笔记。' : '本记录未提供笔记正文，不推断从未记过笔记。'}</p>}</section>
}
/** 背景：四类文化状态和作品 / 多笔记正文不能由同一泛化摘要替代。
 * 意图：名称与各自状态优先，正文和独立笔记在详情保留，读取异常与归档不静默过滤。
 * 约束：复用生产笔记解析与校验，空数组不回退，时间不由收录日补齐；只读，无进度 / 笔记写入。
 */
export function DebugCultureCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onEvidence }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.items.items
  const [role, setRole] = useState<string>(fixtures.find(entry => entry.id === initialSelectedId)?.role ?? 'lin')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [moreLoaded, setMoreLoaded] = useState(false)
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const detailRef = useRef<HTMLElement>(null)
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  useEffect(() => setMoreLoaded(false), [dataState, role])
  useEffect(() => { if (selectedId) detailRef.current?.scrollIntoView({ block: 'start' }) }, [selectedId])
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  const items = (empty ? [] : fixtures).map(entry => {
    if (!entry.culture) return entry
    const culture = { ...entry.culture, payload: { ...entry.culture.payload } }
    let title = entry.title
    if (dataState === 'truncated') culture.truncated = true
    if (dataState === 'archived' && entry.id === 'demo-culture-music') culture.payload.visibility = 'archived'
    if (dataState === 'unknown' && entry.id === 'demo-culture-photo') culture.payload.type = 'future-type'
    if (entry.id === 'demo-item-book') {
      if (dataState === 'empty-notes') { culture.payload.readingNotes = []; culture.payload.note = '不应复活的旧笔记 · 样张' }
      if (dataState === 'legacy-note') { delete culture.payload.readingNotes; culture.payload.note = '【旧笔记样张】只有一段笔记，没有独立日期。' }
      if (dataState === 'invalid-notes') { culture.payload.readingNotes = [{ id: 'demo-duplicate-note', text: '第一段' }, { id: 'demo-duplicate-note', text: '第二段' }]; culture.payload.note = '不应替代坏数组的旧笔记' }
      if (dataState === 'invalid-progress') culture.payload.currentPage = 200
      if (dataState === 'missing-fields') { delete culture.payload.readingStatus; delete culture.payload.author; culture.payload.readingNotes = [{ id: 'demo-undated-note', text: '【缺时间笔记样张】不从资产收录日补日期。' }] }
      if (dataState === 'long') { title = '旅行笔记 · 从沿河步行与整理照片里记录细小的观察。'.repeat(4); culture.payload.summary = '【长作品说明样张】记录旅途中留意到的光线、步道和交流片段。\n\n'.repeat(35); culture.payload.readingNotes = [{ id: 'demo-long-note', text: '【长阅读笔记样张】在每一段观察里保留具体细节，慢慢回想当时的风景和各自不同的想法。\n\n'.repeat(40) }] }
    }
    return { ...entry, title, culture }
  }).sort((a, b) => (b.culture?.acquiredAt ?? 0) - (a.culture?.acquiredAt ?? 0) || b.id.localeCompare(a.id))
  const owned = items.filter(entry => entry.role === role)
  const scoped = dataState === 'paged' && !moreLoaded && !initialSelectedId ? owned.slice(0, 2) : owned
  const filtered = scoped.filter(entry => entry.culture && (category === 'all' || debugCultureType(entry.culture) === category) && `${entry.id} ${entry.title} ${JSON.stringify(entry.culture)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selected = filtered.find(entry => entry.id === selectedId)
  const missing = dataState === 'missing' || Boolean(initialSelectedId && !scoped.some(entry => entry.id === initialSelectedId))
  const issue = selected?.culture ? worldRecordConsistencyError(selected.culture.kind, selected.culture.payload) : null
  const close = () => { setSelectedId(undefined); requestAnimationFrame(() => selectedId && rowRefs.current.get(selectedId)?.focus()) }
  return <section className="debug-culture-workbench" data-testid="debug-evidence-items">
    <div className="debug-culture-toolbar"><label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedId(undefined) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label><label className="debug-culture-search"><Search size={14} /><TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索已读作品、感受或笔记" value={query} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setSelectedId(undefined) }} /></label></div>
    {!available ? <div className="debug-culture-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '文化资料尚未读取' : previewState === 'loading' ? '正在读取文化资料…' : previewState === 'unavailable' ? '文化接口不可用；需要桌面诊断连接。' : '文化资料读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取文化样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-culture-state" role="alert"><p>刷新失败，保留原人物、分类、筛选与已加载记录；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      <TabStrip label="文化分类" variant="underline" items={CATEGORIES} activeId={category} onSelect={id => { setCategory(id); setSelectedId(undefined) }} />
      {missing && <p className="debug-culture-state" role="status">引用文化记录未在当前已读人物范围找到，未选择替代记录。</p>}
      {scoped.length > 0 && <p className="debug-culture-range">{Boolean(query || category !== 'all') && `${filtered.length} 项匹配 · `}{scoped.length} 项已读作品 · 总数未知</p>}
      {!filtered.length ? <p className="debug-culture-state" role="status">{scoped.length ? '当前已读范围没有匹配的文化记录。' : '当前查询未返回文化记录，不推断没有兴趣或从未体验。'}{Boolean(query || category !== 'all') && <ActionButton variant="plain" onClick={() => { setQuery(''); setCategory('all') }}>清除筛选</ActionButton>}</p> : <div className="debug-culture-list">{filtered.map(entry => entry.culture && <article key={entry.id} className="debug-culture-row" data-record-id={entry.id}><ActionButton ref={node => { if (node) rowRefs.current.set(entry.id, node); else rowRefs.current.delete(entry.id) }} variant="plain" className="debug-culture-name" style={{ color: 'var(--text-primary)' }} aria-label={entry.title} aria-expanded={selectedId === entry.id} onClick={() => setSelectedId(entry.id)}>{entry.title}</ActionButton><p className="debug-culture-meta">{[category === 'all' ? CATEGORIES.find(value => value.id === debugCultureType(entry.culture!))?.label : '', debugCultureStatus(entry.culture), creator(entry.culture), entry.culture.payload.visibility === 'archived' ? '已归档记录' : ''].filter(Boolean).join(' · ')}</p>{(entry.culture.truncated || worldRecordConsistencyError(entry.culture.kind, entry.culture.payload) || notesIssue(entry.culture)) && <p className="debug-culture-state">{entry.culture.truncated ? '记录读取有截断，原始资料不保证完整。' : notesIssue(entry.culture) ? '笔记结构异常，详情保留原始资料。' : '资料进度不一致，详情保留原始资料。'}</p>}</article>)}</div>}
      {scoped.length < owned.length && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页文化样张</ActionButton>}
      {selected?.culture && !missing && <article ref={detailRef} className="debug-culture-detail" aria-label="领域证据详情"><ActionButton variant="plain" onClick={close}><ArrowLeft size={14} />返回列表</ActionButton><h3>{selected.title}</h3><p className="debug-culture-meta">{debugCultureStatus(selected.culture)}{creator(selected.culture) && ` · ${creator(selected.culture)}`}</p>{issue && <p className="debug-culture-state">资料不完整：{issue}</p>}{selected.culture.truncated && <p className="debug-culture-state">以下仅含已返回资料，不能认定为完整作品与笔记。</p>}<p className="debug-culture-body">{debugCultureBody(selected.culture) || '本记录未提供作品说明或感受正文。'}</p>
        {debugCultureType(selected.culture) === 'reading' && <ReadingNotes id={selected.id} record={selected.culture} />}
        <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{[...debugCultureFields(selected), ...[['currentPage', '当前页'], ['totalPages', '总页数'], ['season', '季'], ['episode', '当前集'], ['totalEpisodes', '总集数'], ['mediaKind', '影视形式'], ['musicKind', '音乐形式'], ['locationName', '作品地点标记'], ['depictedAt', '作品时间标记']].filter(([key]) => Object.hasOwn(selected.culture!.payload, key)).map(([key, label]): [string, string] => [label, String(selected.culture!.payload[key])])].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        {selected.links?.map(link => <ActionButton key={link.id} variant="plain" onClick={() => onEvidence(link.page, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}
        <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><code>companion_assets · {selected.culture.kind} · {selected.id}</code><p>收录时间不是阅读、观看、聆听或拍摄时间；归档保留为已读资料。笔记数组优先，无效数组不回退旧 note，时间仅按保存字段显示。原始记录不是历史模型输入。</p><pre>{JSON.stringify({ id: selected.id, role, ...selected.culture }, null, 2)}</pre></details>
      </article>}
    </>}
  </section>
}

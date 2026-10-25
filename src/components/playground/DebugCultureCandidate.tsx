import { useEffect, useState, type ChangeEvent } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { TabStrip } from '../foundation/TabStrip'
import { CultureReading, CULTURE_CATEGORIES } from '../debug/CultureReading'
import { projectCultureRecords } from '../debug/culture-projection'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugCultureFields, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type CulturePreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'empty-notes' | 'legacy-note' | 'invalid-notes' | 'invalid-progress' | 'missing-fields' | 'unknown' | 'archived' | 'truncated' | 'paged' | 'missing'
interface Props { empty: boolean; previewState: CulturePreviewState; snapshotState: CulturePreviewState; initialSelectedId?: string; onRetry: () => void; onEvidence: (page: DebugEvidencePageId, id: string) => void }
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
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  useEffect(() => setMoreLoaded(false), [dataState, role])
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
  const projected = projectCultureRecords(scoped.map(entry => ({ id: entry.id, roleId: entry.role, kind: entry.culture?.kind ?? 'culture', title: entry.title, body: '', source: 'companion_assets', time: null, status: '', truncated: entry.culture?.truncated ?? false, links: [], data: { payload: entry.culture?.payload } })), 'Asia/Shanghai')
  const filtered = projected.filter(item => (category === 'all' || item.type === category) && `${item.id} ${item.title} ${JSON.stringify(item.record.data)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const missing = dataState === 'missing' || Boolean(initialSelectedId && !scoped.some(entry => entry.id === initialSelectedId))
  return <section className="debug-culture-workbench" data-testid="debug-evidence-items">
    <div className="debug-culture-toolbar"><label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedId(undefined) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label><label className="debug-culture-search"><Search size={14} /><TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索已读作品、感受或笔记" value={query} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setSelectedId(undefined) }} /></label></div>
    {!available ? <div className="debug-culture-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '文化资料尚未读取' : previewState === 'loading' ? '正在读取文化资料…' : previewState === 'unavailable' ? '文化接口不可用；需要桌面诊断连接。' : '文化资料读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取文化样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-culture-state" role="alert"><p>刷新失败，保留原人物、分类、筛选与已加载记录；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      <TabStrip label="文化分类" variant="underline" items={CULTURE_CATEGORIES} activeId={category} onSelect={id => { setCategory(id); setSelectedId(undefined) }} />
      {missing && <p className="debug-culture-state" role="status">引用文化记录未在当前已读人物范围找到，未选择替代记录。</p>}
      {scoped.length > 0 && <p className="debug-culture-range">{Boolean(query || category !== 'all') && `${filtered.length} 项匹配 · `}{scoped.length} 项已读作品 · 总数未知</p>}
      {!filtered.length ? <p className="debug-culture-state" role="status">{scoped.length ? '当前已读范围没有匹配的文化记录。' : '当前查询未返回文化记录，不推断没有兴趣或从未体验。'}{Boolean(query || category !== 'all') && <ActionButton variant="plain" onClick={() => { setQuery(''); setCategory('all') }}>清除筛选</ActionButton>}</p> : null}
      <CultureReading items={filtered} allItems={missing ? [] : projected} selectedId={selectedId} onSelect={setSelectedId} category={category}
        afterList={scoped.length < owned.length && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页文化样张</ActionButton>}
        renderDetail={item => {
          const selected = scoped.find(entry => entry.id === item.id)!
          return <>
        <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{[...debugCultureFields(selected), ...[['currentPage', '当前页'], ['totalPages', '总页数'], ['season', '季'], ['episode', '当前集'], ['totalEpisodes', '总集数'], ['mediaKind', '影视形式'], ['musicKind', '音乐形式'], ['locationName', '作品地点标记'], ['depictedAt', '作品时间标记']].filter(([key]) => Object.hasOwn(selected.culture!.payload, key)).map(([key, label]): [string, string] => [label, String(selected.culture!.payload[key])])].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        {selected.links?.map(link => <ActionButton key={link.id} variant="plain" onClick={() => onEvidence(link.page, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}
        <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><code>companion_assets · {selected.culture?.kind ?? '未记录'} · {selected.id}</code><p>收录时间不是阅读、观看、聆听或拍摄时间；归档保留为已读资料。笔记数组优先，无效数组不回退旧 note，时间仅按保存字段显示。原始记录不是历史模型输入。</p><pre>{JSON.stringify({ id: selected.id, role, ...selected.culture }, null, 2)}</pre></details>
          </>
        }} />
    </>}
  </section>
}

import { useState, type ChangeEvent } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { RelationsReading } from '../debug/RelationsReading'
import { projectRelationRecords } from '../debug/relations-projection'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugRelationFields, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type RelationsPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'missing-note' | 'unknown-time' | 'experience-error' | 'no-experience-source' | 'limited' | 'unregistered' | 'same-name' | 'truncated' | 'missing'
interface Props {
  empty: boolean
  previewState: RelationsPreviewState
  snapshotState: RelationsPreviewState
  initialSelectedId?: string
  onRetry: () => void
  onPage: (page: DebugEvidencePageId) => void
  onEvidence: (page: DebugEvidencePageId, id: string) => void
}
/** 背景：关系边有方向，第一条摘要和有界共同事件不能合成完整交往或忙闲状态。
 * 意图：姓名与短摘要优先，详情逐条阅读关系方向 / 正文与共同在场来源。
 * 约束：只读隔离样张，不生成关系分数，不按名字补经历，不提供生产查询没有的下一页。
 */
export function DebugRelationsCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onPage, onEvidence }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.relations.items
  const [role, setRole] = useState<string>(fixtures.find(entry => entry.id === initialSelectedId)?.role ?? 'lin')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  let items = empty ? [] : fixtures.map(entry => ({ ...entry, relation: entry.relation ? { ...entry.relation, edges: entry.relation.edges.map(edge => ({ ...edge })), experiences: entry.relation.experiences?.map(event => ({ ...event, payload: { ...event.payload } })) } : undefined }))
  items = items.map(entry => {
    if (!entry.relation) return entry
    const relation = { ...entry.relation }
    if (dataState === 'no-experience-source') relation.experiences = undefined
    if (dataState === 'experience-error') relation.experiences = relation.experiences?.filter(event => event.id !== 'demo-event-reading')
    if (dataState === 'unknown-time') relation.experiences = relation.experiences?.map(event => ({ ...event, time: undefined }))
    if (dataState === 'truncated') relation.truncated = true
    if (dataState === 'same-name') relation.name = '予 · 样张'
    if (dataState === 'unregistered') relation.name = relation.personId
    if (dataState === 'missing-note') relation.edges = relation.edges.map(edge => ({ ...edge, note: undefined }))
    if (dataState === 'long') { relation.edges = relation.edges.map(edge => ({ ...edge, note: '【关系长文样张】保留彼此不同的看法，在整理照片和材料时愿意互相倾听，再慢慢补充各自的经历。'.repeat(14) })); relation.experiences = relation.experiences?.map(event => ({ ...event, payload: { ...event.payload, text: '【共同经历长文样张】一起翻看旅途笔记，逐页讨论记录的地点、当时的光线和后来想起的细节。\n\n'.repeat(30) } })) }
    return { ...entry, relation }
  })
  const owned = items.filter(entry => entry.role === role)
  const scoped = dataState === 'limited' && !initialSelectedId ? owned.slice(0, 1) : owned
  const filtered = scoped.filter(entry => `${entry.id} ${JSON.stringify(entry.relation)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const projected = projectRelationRecords(scoped.map(entry => ({ id: entry.id, roleId: entry.role, source: 'Role Pack / Universe relations', kind: 'relation', title: entry.title, body: '', time: null, status: '', truncated: entry.relation?.truncated ?? false, links: [], data: { id: entry.relation?.personId, name: entry.relation?.name, relations: entry.relation?.edges, experiences: entry.relation?.experiences } })), 'Asia/Shanghai')
  const missing = dataState === 'missing' || Boolean(initialSelectedId && !scoped.some(entry => entry.id === initialSelectedId))
  return <section className="debug-relations-workbench" data-testid="debug-evidence-relations">
    <div className="debug-relations-toolbar"><label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedId(undefined) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label><label className="debug-relations-search"><Search size={14} /><TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索已读人物、关系或经历" value={query} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setSelectedId(undefined) }} /></label></div>
    {!available ? <div className="debug-relations-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '关系资料尚未读取' : previewState === 'loading' ? '正在读取关系资料…' : previewState === 'unavailable' ? '关系接口不可用；需要桌面诊断连接。' : '关系资料读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取关系样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-relations-state" role="alert"><p>刷新失败，保留原人物、筛选和关系详情；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {dataState === 'experience-error' && role === 'lin' && <p className="debug-relations-state" role="status">一条共同经历格式损坏；关系定义和其余已读经历仍保留。</p>}
      {missing && <p className="debug-relations-state" role="status">引用人物未在当前已读范围找到，未选择替代记录。</p>}
      {scoped.length > 0 && <p className="debug-relations-range">{query && `${filtered.length} 项匹配 · `}{scoped.length} 位已读人物 · 总数未知{dataState === 'limited' && ' · 本查询没有后续游标'}</p>}
      {!filtered.length ? <p className="debug-relations-state" role="status">{scoped.length ? '当前已读范围没有匹配的关系资料。' : '当前查询未返回关系资料，不推断没有关系。'}{query && <ActionButton variant="plain" onClick={() => setQuery('')}>清除筛选</ActionButton>}</p> : null}
      <RelationsReading items={projected.filter(item => filtered.some(entry => entry.id === item.id))} allItems={missing ? [] : projected} selectedId={selectedId} onSelect={setSelectedId}
        roleId={role} roleName={DEBUG_ROLES.find(value => value.id === role)?.label ?? role} onEvent={id => onEvidence('recent', id)}
        renderDetail={item => {
          const selected = scoped.find(entry => entry.id === item.id)!
          return <>
        <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{debugRelationFields(selected.relation!).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        <div className="debug-relations-related">{selected.relatedPages?.map(link => <ActionButton key={link.page} variant="plain" onClick={() => onPage(link.page)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}</div>
        <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><code>Role Pack / Universe relations · {selected.relation!.personId}</code><p>关系边是已保存的定义，不是关系评分。共同事件全查询先限量后按人物分配；没有后续游标。时间以 Asia/Shanghai 显示，忙闲和里程碑未在本查询提供。</p><pre>{JSON.stringify({ role, ...selected.relation }, null, 2)}</pre></details>
          </>
        }} />
    </>}
  </section>
}

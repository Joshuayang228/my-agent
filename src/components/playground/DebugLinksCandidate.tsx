import { useEffect, useState, type ChangeEvent } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { LinksReading, LINK_TARGET_TYPES } from '../debug/LinksReading'
import { projectLinkRecords } from '../debug/links-projection'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugLinkFields, debugLinkMetadata, debugMomentDate, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type LinksPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'unknown-time' | 'no-jumps' | 'metadata-shape' | 'unknown' | 'partial' | 'truncated' | 'paged' | 'missing'
interface Props { empty: boolean; previewState: LinksPreviewState; snapshotState: LinksPreviewState; initialSelectedId?: string; onRetry: () => void; onEvidence: (page: DebugEvidencePageId, id: string) => void }
/** 背景：旧关联样张把多条边拼为故事，名称与日期又容易被误读为当前目标和事件发生时间。
 * 意图：同源事件分组、单边独立阅读，完整 ID / 元数据保留，定位只消费已返回跳转。
 * 约束：缺定位不推断删除，不按其他记录补目标标题，日期仅按关联创建日，纯只读隔离。
 */
export function DebugLinksCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onEvidence }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.links.items
  const target = fixtures.find(entry => entry.id === initialSelectedId)
  const [role, setRole] = useState<string>(target?.role ?? 'lin')
  const [date, setDate] = useState('')
  const [type, setType] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [moreLoaded, setMoreLoaded] = useState(false)
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  useEffect(() => setMoreLoaded(false), [dataState, role, date])
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  let items = (empty ? [] : fixtures).map(entry => ({ ...entry, link: entry.link ? { ...entry.link, metadata: debugLinkMetadata(entry.link) ? { ...debugLinkMetadata(entry.link) } : entry.link.metadata } : undefined }))
  if (dataState === 'partial') items = items.filter(entry => entry.id !== 'demo-link-image')
  items = items.map(entry => {
    if (!entry.link) return entry
    const link = { ...entry.link, metadata: debugLinkMetadata(entry.link) ? { ...debugLinkMetadata(entry.link) } : entry.link.metadata }
    if (dataState === 'metadata-shape' && entry.id === 'demo-link-reading') link.metadata = '【异形元数据样张】有效 JSON 字符串，不是对象。'
    if (dataState === 'unknown-time') link.createdAt = undefined
    if (dataState === 'truncated') link.truncated = true
    if (dataState === 'unknown' && entry.id === 'demo-link-reading') { link.targetType = 'future-target'; return { ...entry, link, links: entry.links?.filter(jump => jump.page === 'recent') } }
    if (dataState === 'long' && entry.id === 'demo-link-reading') link.metadata = { ...debugLinkMetadata(link), name: '【长保存名样张】这段名称只是当时保存在关联元数据中的注释，完整内容仍可阅读。'.repeat(25), note: '【长关联备注样张】逐条记录目标引用的意图与当时保存的线索，保留说明，不按时间相近补齐其他边。\n\n'.repeat(35) }
    return { ...entry, link, links: dataState === 'no-jumps' ? [] : entry.links }
  }).sort((a, b) => (b.link?.createdAt ?? 0) - (a.link?.createdAt ?? 0) || b.id.localeCompare(a.id))
  const owned = items.filter(entry => entry.role === role && (!date || debugMomentDate(entry.link?.createdAt) === date))
  const scoped = dataState === 'paged' && !moreLoaded && !initialSelectedId ? owned.slice(0, 2) : owned
  const filtered = scoped.filter(entry => entry.link && (type === 'all' || type === 'unknown' ? type === 'all' || !LINK_TARGET_TYPES.some(item => item.id === entry.link!.targetType && !['all', 'unknown'].includes(item.id)) : entry.link.targetType === type) && `${entry.id} ${JSON.stringify(entry.link)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const projected = projectLinkRecords(scoped.map(entry => ({ id: entry.id, roleId: entry.role, kind: 'link', title: entry.title, body: '', source: 'companion_event_links', time: null, status: '', truncated: entry.link?.truncated ?? false, links: [], data: { event_id: entry.link?.eventId, target_id: entry.link?.targetId, target_type: entry.link?.targetType, relation: entry.link?.relation, metadata: entry.link?.metadata } })))
  const missing = dataState === 'missing' || Boolean(initialSelectedId && !scoped.some(entry => entry.id === initialSelectedId))
  return <section className="debug-links-workbench" data-testid="debug-evidence-links">
    <div className="debug-links-toolbar"><label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedId(undefined) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label><label className="debug-links-search"><Search size={14} /><TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索已读事件、目标或元数据" value={query} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setSelectedId(undefined) }} /></label><details className="debug-links-filter"><summary>{date || type !== 'all' ? '筛选 · 已启用' : '筛选'}</summary><label>关联创建日<TextField appearance="outlined" type="date" aria-label="关联创建日" value={date} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setDate(event.target.value); setSelectedId(undefined) }} /></label><label className="debug-focused-scope">目标类型<SelectField aria-label="关联目标类型" value={type} disabled={!available} onChange={event => { setType(event.target.value); setSelectedId(undefined) }}>{LINK_TARGET_TYPES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label></details></div>
    {!available ? <div className="debug-links-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '关联记录尚未读取' : previewState === 'loading' ? '正在读取关联记录…' : previewState === 'unavailable' ? '关联接口不可用；需要桌面诊断连接。' : '关联记录读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取关联样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-links-state" role="alert"><p>刷新失败，保留原人物、日期、筛选、选中及已加载边；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {dataState === 'partial' && role === 'lin' && <p className="debug-links-state" role="status">一条关联记录格式不可读取，其余已读边保留。</p>}
      {missing && <p className="debug-links-state" role="status">引用关联边未在当前已读人物范围找到，未选择替代记录。</p>}
      {scoped.length > 0 && <p className="debug-links-range">{Boolean(query || type !== 'all') && `${filtered.length} 项匹配 · `}{scoped.length} 条已读关联 · 总数未知</p>}
      {!filtered.length ? <p className="debug-links-state" role="status">{scoped.length ? '当前已读范围没有匹配的关联。' : '当前查询未返回关联记录，不推断事件从未有关联。'}{Boolean(query || date || type !== 'all') && <ActionButton variant="plain" onClick={() => { setQuery(''); setDate(''); setType('all') }}>清除筛选</ActionButton>}</p> : null}
      <LinksReading items={projected.filter(item => filtered.some(entry => entry.id === item.id))} allItems={missing ? [] : projected} selectedId={selectedId} onSelect={setSelectedId}
        afterList={scoped.length < owned.length && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页关联样张</ActionButton>}
        renderDetail={item => {
          const selected = scoped.find(entry => entry.id === item.id)!
          return <>
        <div className="debug-links-actions">{selected.links?.map(jump => <ActionButton key={`${jump.page}:${jump.id}`} variant="plain" onClick={() => onEvidence(jump.page, jump.id)}>{jump.label}<ArrowUpRight size={14} /></ActionButton>)}</div>{!selected.links?.some(jump => jump.page === 'recent') && <p className="debug-links-meta">当前响应未提供事件定位，保留来源标识。</p>}{!selected.links?.some(jump => jump.page !== 'recent') && <p className="debug-links-meta">当前响应未提供目标定位，不推断目标已删除。</p>}
        <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{debugLinkFields(selected).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><code>companion_event_links · {selected.id}</code><p>名称来自保存元数据，不代表当前目标名；关联创建时间不当作事件发生、发布、购买或穿上时间。分组仅表示同来源 ID 的已读边，不证明完整顺序；图片和卡司标识不生成预览。</p><pre>{JSON.stringify({ id: selected.id, role, ...selected.link, providedJumps: selected.links ?? [] }, null, 2)}</pre></details>
          </>
        }} />
    </>}
  </section>
}

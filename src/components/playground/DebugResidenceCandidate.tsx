import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowUpRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugHomeFields, type DebugEvidenceItem, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type ResidencePreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'orphan' | 'unknown-display' | 'paged' | 'missing'
interface Props {
  empty: boolean
  previewState: ResidencePreviewState
  snapshotState: ResidencePreviewState
  initialSelectedId?: string
  onRetry: () => void
  onPage: (page: DebugEvidencePageId) => void
  onAsset: (key: string) => void
  onEvidence: (page: DebugEvidencePageId, id: string) => void
}

/** 背景：家居是资产关系，平铺全字段和默认住所会误导读者。
 * 意图：按已读显式父子关系组织轻列表，完整证据移入单记录详情。
 * 约束：不从名称推断归属；无行不补住所；父级不在已读范围与未归置分开，刷新保留当前分页和选择。
 */
export function DebugResidenceCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onPage, onAsset, onEvidence }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.residence.items
  const [role, setRole] = useState<string>(fixtures.find(entry => entry.id === initialSelectedId)?.role ?? 'lin')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [moreLoaded, setMoreLoaded] = useState(false)
  const rowsRef = useRef(new Map<string, HTMLButtonElement>())
  const detailRef = useRef<HTMLElement>(null)
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  useEffect(() => setMoreLoaded(false), [dataState])
  useEffect(() => { if (selectedId) detailRef.current?.scrollIntoView({ block: 'start' }) }, [selectedId])
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  let items = empty ? [] : fixtures.map(entry => ({ ...entry, home: entry.home ? { ...entry.home } : undefined }))
  if (dataState === 'orphan') items = items.map(entry => entry.home?.kind === 'object' && entry.home.parentId ? { ...entry, home: { ...entry.home, parentId: 'demo-unread-space' }, links: (entry.links ?? []).map(link => link.page === 'residence' ? { ...link, id: 'demo-unread-space' } : link) } : entry)
  if (dataState === 'unknown-display') items = items.map(entry => entry.home?.kind === 'object' ? { ...entry, home: { ...entry.home, displayInHome: undefined } } : entry)
  if (dataState === 'long') items = items.map(entry => entry.home?.kind === 'residence' ? { ...entry, title: '住所 · 虚构的长期生活与资料整理空间，供长名称换行验收使用。'.repeat(2), home: { ...entry.home, description: '【家居长描述样张】靠窗的桌面放着照片、书和待整理的笔记，空间保留了适合安静阅读的位置。\n\n'.repeat(30) } } : entry)
  if (dataState === 'paged' && !moreLoaded) items = items.slice(0, 2)
  const scoped = items.filter(entry => role === 'all' || entry.role === role)
  const hasNextPage = dataState === 'paged' && !moreLoaded && !empty && (role === 'lin' || role === 'all')
  const matches = scoped.filter(entry => `${entry.id} ${entry.title} ${JSON.stringify(entry.home)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selected = scoped.find(entry => entry.id === selectedId)
  const missing = dataState === 'missing' || Boolean(selectedId && !selected)
  const open = (id: string) => { setQuery(''); setSelectedId(id) }
  const close = () => { setSelectedId(undefined); requestAnimationFrame(() => selectedId && rowsRef.current.get(selectedId)?.focus()) }
  const row = (entry: DebugEvidenceItem) => {
    const parent = scoped.find(value => value.id === entry.home?.parentId && value.role === entry.role)
    const description = entry.home?.description ?? ''
    return <article className="debug-home-entry" key={entry.id} data-record-id={entry.id}>
      <ActionButton ref={node => { if (node) rowsRef.current.set(entry.id, node); else rowsRef.current.delete(entry.id) }} variant="plain" style={{ color: 'var(--text-primary)' }} className="debug-home-name" aria-label={entry.title} aria-expanded={selectedId === entry.id} onClick={() => setSelectedId(entry.id)}>{entry.title}</ActionButton>
      {description && <p className="debug-home-description">{description.slice(0, 90)}{description.length > 90 ? '…' : ''}</p>}
      <p className="debug-home-meta">{entry.home?.kind === 'object' && <span>{entry.home.displayInHome === undefined ? '陈列标记未记录' : entry.home.displayInHome ? '标记为陈列' : '未陈列'}</span>}{entry.home?.parentId && !parent && <span>父级未在当前已读范围</span>}{query && parent && <span>归属：{parent.title}</span>}{!entry.home?.parentId && entry.home?.kind === 'object' && <span>未归置</span>}{role === 'all' && <span>{DEBUG_ROLES.find(value => value.id === entry.role)?.label}</span>}</p>
    </article>
  }
  const used = new Set<string>()
  const homes = matches.filter(entry => entry.home?.kind === 'residence').map(home => {
    used.add(home.id)
    const spaces = matches.filter(entry => entry.home?.kind === 'space' && entry.home.parentId === home.id && entry.role === home.role)
    return <section key={home.id} className="debug-home-residence">{row(home)}{spaces.map(space => {
      used.add(space.id)
      const objects = matches.filter(entry => entry.home?.kind === 'object' && entry.home.parentId === space.id && entry.role === space.role)
      objects.forEach(entry => used.add(entry.id))
      return <section className="debug-home-space" key={space.id}>{row(space)}<div className="debug-home-objects">{objects.map(row)}</div></section>
    })}</section>
  })
  const independent = matches.filter(entry => !used.has(entry.id))
  return <section className="debug-home-workbench" data-testid="debug-evidence-residence">
    <div className="debug-home-toolbar"><label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedId(undefined) }}><option value="all">全部人物</option>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label><label className="debug-home-search"><Search size={14} /><TextField aria-label="搜索当前页证据" placeholder="搜索家居名称或资料" value={query} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setSelectedId(undefined) }} /></label></div>
    {!available ? <div className="debug-home-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '家居资料尚未读取' : previewState === 'loading' ? '正在读取家居资料…' : previewState === 'unavailable' ? '家居接口不可用；需要桌面诊断连接。' : '家居资料读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取家居样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-home-state" role="alert"><p>刷新失败，保留上次资产与已加载页；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {missing && <p className="debug-home-state" role="status">引用家居未在当前已读人物范围找到，未选择替代记录。{!scoped.length && '当前范围没有已读取家居资产；不推断默认住所或世界状态。'}</p>}
      <p className="debug-home-range">{query ? `${matches.length} 项匹配 · ` : ''}{scoped.length} 项已读 · 总数未知</p>
      {!matches.length ? !(missing && !scoped.length) && <div className="debug-home-state" role="status"><p>{scoped.length ? '没有匹配的家居资料' : '该人物范围没有已读取家居资产；不推断默认住所或世界状态。'}</p>{query && <ActionButton onClick={() => setQuery('')}>清除搜索</ActionButton>}</div> : <div className="debug-home-list" data-reading-layout="home">{homes}{independent.length > 0 && <section><h3>其他已读记录</h3>{independent.map(row)}</section>}</div>}
      {hasNextPage && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页样张</ActionButton>}
      {selected && !missing && <article ref={detailRef} className="debug-home-detail" aria-label="领域证据详情">
        <ActionButton variant="plain" onClick={close}><ArrowLeft size={14} />返回列表</ActionButton><h3>{selected.title}</h3>
        {selected.home?.description && <p className="debug-home-body">{selected.home.description}</p>}
        {selected.home?.kind === 'object' && <p className="debug-home-body">{selected.home.displayReason || '陈列理由未提供'}</p>}
        <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{debugHomeFields(selected).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        <div className="debug-home-related">{selected.links?.map(link => <ActionButton key={`${link.page}:${link.id}`} variant="plain" onClick={() => link.page === 'residence' ? open(link.id) : onEvidence(link.page, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}{selected.relatedPages?.map(link => <ActionButton key={link.page} variant="plain" onClick={() => onPage(link.page)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}</div>
        <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><p>只展示已读资产关系；陈列标记不等于当前使用，资产创建时间不代表购买时间。</p><code>companion_assets · {selected.id}</code><pre>{JSON.stringify({ id: selected.id, role: selected.role, home: selected.home }, null, 2)}</pre>{selected.assets?.map(key => <ActionButton key={key} variant="plain" onClick={() => onAsset(key)}>查看注册定义 · {key}<ArrowUpRight size={14} /></ActionButton>)}</details>
      </article>}
    </>}
  </section>
}

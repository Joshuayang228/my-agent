import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowUpRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { wardrobeSlotsSchema, worldRecordConsistencyError, normalizeWorldRecordField } from '../../shared/world-records'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugWardrobeFields, debugWardrobeKind, type DebugWardrobeRecord, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type WardrobePreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'unknown-time' | 'unread-reference' | 'mismatch' | 'invalid' | 'unknown' | 'conflict' | 'truncated' | 'paged' | 'missing'
interface Props { empty: boolean; previewState: WardrobePreviewState; snapshotState: WardrobePreviewState; initialSelectedId?: string; onRetry: () => void; onEvidence: (page: DebugEvidencePageId, id: string) => void }
const GROUPS = [{ kind: 'wear-state', label: '穿搭状态记录' }, { kind: 'outfit', label: '套装' }, { kind: 'garment', label: '衣物' }, { kind: 'unknown', label: '未识别记录' }] as const
const CATEGORIES: Record<string, string> = { top: '上装', bottom: '下装', outerwear: '外套', shoes: '鞋子' }
const versionText = (record: DebugWardrobeRecord) => {
  const value = record.payload.outfitVersion
  const normalized = normalizeWorldRecordField('wardrobe', 'outfitVersion', value)
  return value === undefined ? '版本未记录' : normalized.handled && normalized.ok ? `版本 v${normalized.value}` : '版本字段无效'
}
/** 背景：同表混有衣物、套装和穿搭状态，分页缺项容易被误读为衣物缺失或当前穿着。
 * 意图：类型分组与短行扫描，槽位 / 描述 / 来源在单记录详情，引用按同人物已读 ID 解析。
 * 约束：不挑选冲突状态，不补未读槽位，不以收录日当换装日；仅诊断，无换装、生图或存储调用。
 */
export function DebugWardrobeCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onEvidence }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.wardrobe.items
  const [role, setRole] = useState<string>(fixtures.find(entry => entry.id === initialSelectedId)?.role ?? 'lin')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [moreLoaded, setMoreLoaded] = useState(false)
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const detailRef = useRef<HTMLElement>(null)
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  useEffect(() => setMoreLoaded(false), [dataState, role])
  useEffect(() => { if (selectedId) detailRef.current?.scrollIntoView({ block: 'start' }) }, [selectedId])
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  let items = empty ? [] : fixtures.map(entry => ({ ...entry, wardrobe: entry.wardrobe ? { ...entry.wardrobe, payload: { ...entry.wardrobe.payload } } : undefined }))
  if (dataState === 'conflict' && items.length) { const state = items.find(entry => entry.wardrobe?.payload.recordType === 'wear-state')!; items.push({ ...state, id: 'demo-wardrobe-state-conflict', title: '另一条穿搭状态' }) }
  items = items.map(entry => {
    if (!entry.wardrobe) return entry
    const wardrobe = { ...entry.wardrobe, payload: { ...entry.wardrobe.payload } }
    if (dataState === 'unknown-time') wardrobe.acquiredAt = undefined
    if (dataState === 'truncated') wardrobe.truncated = true
    if (entry.id === 'demo-wardrobe-outfit') {
      if (dataState === 'unread-reference') wardrobe.payload.slots = { ...(wardrobe.payload.slots as object), top: 'demo-wardrobe-unread' }
      if (dataState === 'mismatch') wardrobe.payload.slots = { ...(wardrobe.payload.slots as object), top: 'demo-wardrobe-coat' }
      if (dataState === 'invalid') wardrobe.payload.slots = {}
    }
    if (entry.id === 'demo-wardrobe-coat') {
      if (dataState === 'unknown') wardrobe.payload.recordType = 'future-kind'
      if (dataState === 'long') { entry.title = '旅行外套 · 用于整理旅途照片与沿途材料的虚构衣物长名称。'.repeat(4); wardrobe.payload.description = '【衣物长文样张】这件外套的描述保留了材质、使用场景和沿途记录，方便之后逐步核对。\n\n'.repeat(35) }
    }
    return { ...entry, wardrobe }
  }).sort((a, b) => (b.wardrobe?.acquiredAt ?? 0) - (a.wardrobe?.acquiredAt ?? 0) || b.id.localeCompare(a.id))
  const owned = items.filter(entry => entry.role === role)
  const scoped = dataState === 'paged' && !moreLoaded && !initialSelectedId ? owned.slice(0, 2) : owned
  const filtered = scoped.filter(entry => `${entry.title} ${entry.id} ${JSON.stringify(entry.wardrobe)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selected = filtered.find(entry => entry.id === selectedId)
  const missing = dataState === 'missing' || Boolean(initialSelectedId && !scoped.some(entry => entry.id === initialSelectedId))
  const states = scoped.filter(entry => entry.wardrobe?.payload.recordType === 'wear-state')
  const hasMore = scoped.length < owned.length
  const slots = wardrobeSlotsSchema.safeParse(selected?.wardrobe?.payload.slots)
  const issue = selected?.wardrobe ? worldRecordConsistencyError('wardrobe', selected.wardrobe.payload) : null
  const close = () => { setSelectedId(undefined); requestAnimationFrame(() => selectedId && rowRefs.current.get(selectedId)?.focus()) }
  return <section className="debug-wardrobe-workbench" data-testid="debug-evidence-wardrobe">
    <div className="debug-wardrobe-toolbar"><label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedId(undefined) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label><label className="debug-wardrobe-search"><Search size={14} /><TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索已读名称、描述或槽位" value={query} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setSelectedId(undefined) }} /></label></div>
    {!available ? <div className="debug-wardrobe-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '衣柜尚未读取' : previewState === 'loading' ? '正在读取衣柜…' : previewState === 'unavailable' ? '衣柜接口不可用；需要桌面诊断连接。' : '衣柜读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取衣柜样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-wardrobe-state" role="alert"><p>刷新失败，保留原人物、搜索、选中及已加载页；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {missing && <p className="debug-wardrobe-state" role="status">引用衣柜记录未在当前已读人物范围找到，未选择替代记录。</p>}
      {scoped.length > 0 && <><p className="debug-wardrobe-range">{query && `${filtered.length} 项匹配 · `}{scoped.length} 项已读记录 · 总数未知</p>{states.length !== 1 && <p className="debug-wardrobe-state" role="status">{states.length > 1 ? '已读到多条穿搭状态，存在冲突；不推断哪条生效。' : '当前已读范围未包含穿搭状态，不能判断当前穿着。'}</p>}</>}
      {!filtered.length ? <p className="debug-wardrobe-state" role="status">{scoped.length ? '当前已读范围没有匹配的衣柜记录。' : '当前查询未返回衣柜记录，不推断没有衣物或当前未穿着。'}{query && <ActionButton variant="plain" onClick={() => setQuery('')}>清除筛选</ActionButton>}</p> : <div className="debug-wardrobe-list">{GROUPS.map(group => { const entries = filtered.filter(entry => entry.wardrobe && debugWardrobeKind(entry.wardrobe) === group.kind); return entries.length > 0 && <section key={group.kind} data-wardrobe-group={group.kind}><h3>{group.label}</h3>{entries.map(entry => <article key={entry.id} className="debug-wardrobe-row" data-record-id={entry.id}><ActionButton ref={node => { if (node) rowRefs.current.set(entry.id, node); else rowRefs.current.delete(entry.id) }} variant="plain" className="debug-wardrobe-name" style={{ color: 'var(--text-primary)' }} aria-label={entry.title} aria-expanded={selectedId === entry.id} onClick={() => setSelectedId(entry.id)}>{entry.title}</ActionButton><p className="debug-wardrobe-meta">{group.kind === 'garment' ? CATEGORIES[String(entry.wardrobe!.payload.category)] ?? '分类未识别' : group.kind === 'unknown' ? '记录类型未识别，原文保留' : versionText(entry.wardrobe!)}</p>{entry.wardrobe?.truncated && <p className="debug-wardrobe-state">此记录读取有截断，不保证完整。</p>}</article>)}</section> })}</div>}
      {hasMore && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页衣柜样张</ActionButton>}
      {selected?.wardrobe && !missing && <article ref={detailRef} className="debug-wardrobe-detail" aria-label="领域证据详情"><ActionButton variant="plain" onClick={close}><ArrowLeft size={14} />返回列表</ActionButton><h3>{selected.title}</h3>{issue && <p className="debug-wardrobe-state">资料不完整：{issue}</p>}{selected.wardrobe.truncated && <p className="debug-wardrobe-state">以下仅含已返回内容，记录存在截断。</p>}{typeof selected.wardrobe.payload.description === 'string' && <p className="debug-wardrobe-body">{selected.wardrobe.payload.description}</p>}
        {['outfit', 'wear-state'].includes(debugWardrobeKind(selected.wardrobe)) && <section className="debug-wardrobe-slots"><h4>已保存槽位</h4>{slots.success ? Object.entries(slots.data).map(([slot, id]) => { const target = scoped.find(entry => entry.id === id); const mismatch = target?.wardrobe && (debugWardrobeKind(target.wardrobe) !== 'garment' || target.wardrobe.payload.category !== slot); return <div key={slot}><span>{CATEGORIES[slot] ?? slot}</span>{target ? <><ActionButton variant="plain" onClick={() => { setQuery(''); setSelectedId(target.id) }}>{target.title}</ActionButton>{mismatch && <p className="debug-wardrobe-state">已读目标的记录类型或分类与槽位不匹配。</p>}</> : <p>{id} · 未在当前已读范围，不能判定不存在。</p>}</div> }) : <p className="debug-wardrobe-state">槽位结构不可解析，原始记录保留。</p>}<p className="debug-wardrobe-meta">槽位仅按同人物已读 ID 关联，不按名称或图片补全穿搭。</p></section>}
        <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{debugWardrobeFields(selected).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        {selected.links?.map(link => <ActionButton key={link.id} variant="plain" onClick={() => onEvidence(link.page, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}
        <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><code>companion_assets · wardrobe · {selected.id}</code><p>收录时间不是换装时间；保存状态不证明当前实际穿着。未读引用不判不存在，来源事件不证明购买或穿上时间。本查询不提供图片文件，完整 payload 仅供诊断。</p><pre>{JSON.stringify({ id: selected.id, role, ...selected.wardrobe }, null, 2)}</pre></details>
      </article>}
    </>}
  </section>
}

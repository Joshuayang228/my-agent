import { useEffect, useState, type ChangeEvent } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { WardrobeReading } from '../debug/WardrobeReading'
import { projectWardrobeRecords } from '../debug/wardrobe-projection'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugWardrobeFields, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type WardrobePreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'unknown-time' | 'unread-reference' | 'mismatch' | 'invalid' | 'unknown' | 'conflict' | 'truncated' | 'paged' | 'missing'
interface Props { empty: boolean; previewState: WardrobePreviewState; snapshotState: WardrobePreviewState; initialSelectedId?: string; onRetry: () => void; onEvidence: (page: DebugEvidencePageId, id: string) => void }
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
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  useEffect(() => setMoreLoaded(false), [dataState, role])
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
  const projected = projectWardrobeRecords(scoped.map(entry => ({ id: entry.id, roleId: entry.role, kind: 'wardrobe', title: entry.title, body: '', source: 'companion_assets', time: null, status: '', truncated: entry.wardrobe?.truncated ?? false, links: [], data: { payload: entry.wardrobe?.payload } })))
  const missing = dataState === 'missing' || Boolean(initialSelectedId && !scoped.some(entry => entry.id === initialSelectedId))
  const hasMore = scoped.length < owned.length
  return <section className="debug-wardrobe-workbench" data-testid="debug-evidence-wardrobe">
    <div className="debug-wardrobe-toolbar"><label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedId(undefined) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label><label className="debug-wardrobe-search"><Search size={14} /><TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索已读名称、描述或槽位" value={query} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setSelectedId(undefined) }} /></label></div>
    {!available ? <div className="debug-wardrobe-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '衣柜尚未读取' : previewState === 'loading' ? '正在读取衣柜…' : previewState === 'unavailable' ? '衣柜接口不可用；需要桌面诊断连接。' : '衣柜读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取衣柜样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-wardrobe-state" role="alert"><p>刷新失败，保留原人物、搜索、选中及已加载页；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {missing && <p className="debug-wardrobe-state" role="status">引用衣柜记录未在当前已读人物范围找到，未选择替代记录。</p>}
      {scoped.length > 0 && <><p className="debug-wardrobe-range">{query && `${filtered.length} 项匹配 · `}{scoped.length} 项已读记录 · 总数未知</p></>}
      {!filtered.length ? <p className="debug-wardrobe-state" role="status">{scoped.length ? '当前已读范围没有匹配的衣柜记录。' : '当前查询未返回衣柜记录，不推断没有衣物或当前未穿着。'}{query && <ActionButton variant="plain" onClick={() => setQuery('')}>清除筛选</ActionButton>}</p> : null}
      <WardrobeReading items={projected.filter(item => filtered.some(entry => entry.id === item.id))} allItems={missing ? [] : projected} selectedId={selectedId} onSelect={setSelectedId} onReference={id => { setQuery(''); setSelectedId(id) }}
        afterList={hasMore && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页衣柜样张</ActionButton>}
        renderDetail={item => {
          const selected = scoped.find(entry => entry.id === item.id)!
          return <>
        <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{debugWardrobeFields(selected).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        {selected.links?.map(link => <ActionButton key={link.id} variant="plain" onClick={() => onEvidence(link.page, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}
        <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><code>companion_assets · wardrobe · {selected.id}</code><p>收录时间不是换装时间；保存状态不证明当前实际穿着。未读引用不判不存在，来源事件不证明购买或穿上时间。本查询不提供图片文件，完整 payload 仅供诊断。</p><pre>{JSON.stringify({ id: selected.id, role, ...selected.wardrobe }, null, 2)}</pre></details>
          </>
        }} />
    </>}
  </section>
}

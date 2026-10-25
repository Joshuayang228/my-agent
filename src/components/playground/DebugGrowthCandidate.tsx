import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { GrowthReading } from '../debug/GrowthReading'
import { projectGrowthRecords } from '../debug/growth-projection'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugGrowthFields, debugGrowthKey, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type GrowthPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'empty-body' | 'unknown-time' | 'reflection-error' | 'paged' | 'missing'
interface Props {
  empty: boolean
  previewState: GrowthPreviewState
  snapshotState: GrowthPreviewState
  initialSelectedId?: string
  onRetry: () => void
  onPage: (page: DebugEvidencePageId) => void
  onAsset: (key: string) => void
}
/** 背景：当前覆盖、历史版本和反思状态共用人物 ID，混合平铺会误选且把摘要当成思维。
 * 意图：当前正文优先，各来源独立阅读，详情保留完整记录；只对历史分页。
 * 约束：用来源 + 记录 ID 选中，不补默认正文 / 门闸判断 / 1970 时间，不触发反思或写入。
 */
export function DebugGrowthCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onPage, onAsset }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.growth.items
  const [role, setRole] = useState<string>(fixtures.find(entry => entry.id === initialSelectedId)?.role ?? 'lin')
  const [selectedKey, setSelectedKey] = useState(() => { const entry = fixtures.find(value => value.id === initialSelectedId); return entry ? debugGrowthKey(entry) : initialSelectedId })
  const [moreLoaded, setMoreLoaded] = useState(false)
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  useEffect(() => setMoreLoaded(false), [dataState])
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  let items = empty ? [] : fixtures.map(entry => ({ ...entry, growth: entry.growth ? { ...entry.growth } : undefined }))
  if (dataState === 'reflection-error') items = items.filter(entry => entry.growth?.kind !== 'reflection')
  if (dataState === 'empty-body') items = items.map(entry => entry.growth?.kind === 'current' ? { ...entry, growth: { ...entry.growth, body: '' } } : entry)
  if (dataState === 'unknown-time') items = items.map(entry => entry.growth ? { ...entry, growth: { ...entry.growth, at: undefined, lastRunAt: undefined, runs: entry.growth.runs?.map(run => ({ ...run, at: 0 })) } } : entry)
  if (dataState === 'long') items = items.map(entry => entry.growth && (['current', 'default'].includes(entry.growth.kind) || entry.growth.kind === 'history' && entry.growth.version === 2) ? { ...entry, growth: { ...entry.growth, body: '【成长长文样张】交流时先确认对方的意图，保留必要的边界，再给出简短结论与可展开依据。\n\n'.repeat(12) } } : entry)
  if (dataState === 'paged' && !moreLoaded) items = items.filter(entry => entry.growth?.kind !== 'history' || entry.growth.version === 2)
  const scoped = items.filter(entry => entry.role === role)
  const projected = projectGrowthRecords(scoped.map(entry => ({ id: entry.growth?.recordId ?? entry.id, roleId: entry.role, kind: 'growth', title: entry.title, body: entry.growth?.body ?? '', source: entry.growth?.source ?? 'demo', time: null, status: '', truncated: false, links: [], data: { version: entry.growth?.version, updated_at: entry.growth?.at, created_at: entry.growth?.at, summary: entry.growth?.summary, last_run_at: entry.growth?.lastRunAt, runs: entry.growth?.runs } })), 'Asia/Shanghai').map((item, index) => ({ ...item, id: scoped[index].id, title: scoped[index].title }))
  const selected = scoped.find(entry => debugGrowthKey(entry) === selectedKey)
  const missing = dataState === 'missing' || Boolean(selectedKey && !selected)
  const reflectionIssue = dataState === 'reflection-error' && role === 'lin'
  const hasMore = dataState === 'paged' && !moreLoaded && !empty && role === 'lin'
  return <section className="debug-growth-workbench" data-testid="debug-evidence-growth">
    <div className="debug-growth-toolbar debug-focused-scope"><label>人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedKey(undefined) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label></div>
    {!available ? <div className="debug-growth-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '成长资料尚未读取' : previewState === 'loading' ? '正在读取成长资料…' : previewState === 'unavailable' ? '成长接口不可用；需要桌面诊断连接。' : '成长资料读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取成长样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-growth-state" role="alert"><p>刷新失败，保留上次正文、来源和已加载历史；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {missing && <p className="debug-growth-state" role="status">引用成长记录未在当前已读人物范围找到，未选择替代记录。{!scoped.length && '此范围没有已读成长资料；未补默认正文。'}</p>}
      {!scoped.length ? !missing && <p className="debug-growth-state" role="status">此范围没有已读成长资料；未补默认正文。</p> : <GrowthReading items={projected} selectedKey={missing ? undefined : selectedKey} onSelect={setSelectedKey}
        reflectionIssue={reflectionIssue ? '一条反思记录格式损坏或超限；结果数量未知。当前正文与历史仍可阅读。' : undefined}
        afterHistory={hasMore && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页历史样张</ActionButton>}
        renderDetail={item => {
          const selected = scoped.find(entry => debugGrowthKey(entry) === item.key)!
          return <>
        <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{debugGrowthFields(selected.growth!).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        {selected.relatedPages?.map(link => <ActionButton key={link.page} variant="plain" onClick={() => onPage(link.page)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}
        <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><code>{debugGrowthKey(selected)}</code><p>时间以 Asia/Shanghai 显示。当前正文不是历史请求输入；注册定义可能与历史版本不同。门闸决策未在本查询提供。</p><pre>{JSON.stringify({ role, ...selected.growth }, null, 2)}</pre>{selected.assets?.map(key => <ActionButton key={key} variant="plain" onClick={() => onAsset(key)}>查看当前注册定义 · {key}<ArrowUpRight size={14} /></ActionButton>)}</details>
          </>
        }} />}
    </>}
  </section>
}

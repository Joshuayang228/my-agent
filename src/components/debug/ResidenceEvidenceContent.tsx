import { useState, type ChangeEvent } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { evidenceObject } from './EvidenceSummary'
import { snapshotTime } from './NowStateReading'
import { ResidenceReading, residenceParent } from './ResidenceReading'
import { projectResidenceRecords, residenceFields, type ProjectedResidence } from './residence-projection'

/** 背景：正式家居仍用通用卡，分页后的父级与未知记录不易辨认。
 * 意图：真实资产投影到已确认的轻层级，保留全部已读页、单条详情与原始载荷。
 * 约束：只使用同人物显式引用；未读父级按 ID 查询，不把它宣布为不存在，不补造默认住所或陈列理由。
 */
export function ResidenceEvidenceContent({ result, loading, error, query, roleId, scope, targetId, onRoleChange, onQueryChange, onRetry, onNext, onEvidence }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; query: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string
  onRoleChange?: (id: string) => void; onQueryChange: (value: string) => void; onRetry: () => void; onNext: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(targetId)
  const items = projectResidenceRecords(result?.records ?? [])
  const matches = items.filter(item => `${item.id} ${item.title} ${item.description} ${JSON.stringify(item.record.data)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const missing = Boolean(selectedId && !items.some(item => item.id === selectedId))
  const openParent = (item: ProjectedResidence) => {
    if (!item.parentId) return
    onQueryChange('')
    if (items.some(parent => parent.id === item.parentId && parent.ownerId === item.ownerId)) setSelectedId(item.parentId)
    else onEvidence('residence', item.parentId)
  }
  return <section className="debug-home-workbench" data-testid="debug-evidence-residence">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('residence', '')}>返回当前领域列表</ActionButton>}
    <div className="debug-home-toolbar">{scope && onRoleChange && <label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label>}<label className="debug-home-search"><Search size={14} /><TextField aria-label="搜索当前页证据" placeholder="搜索家居名称或资料" value={query} disabled={result?.state !== 'ready'} onChange={(event: ChangeEvent<HTMLInputElement>) => { onQueryChange(event.target.value); setSelectedId(undefined) }} /></label></div>
    {error && <div className="debug-home-state" role="alert"><p>{result ? '刷新失败，保留上次资产与已加载页；下方不是最新结果。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-home-state" role="status">正在读取家居资料…</p>}
    {result?.issues.map((issue, index) => <p className="debug-home-state" role="status" key={index}>{issue}</p>)}
    {result?.state === 'ready' ? <>
      {missing && <p className="debug-home-state" role="status">引用家居未在当前已读人物范围找到，未选择替代记录。{!items.length && '当前范围没有已读取家居资产；不推断默认住所或世界状态。'}</p>}
      <p className="debug-home-range">{query ? `${matches.length} 项匹配 · ` : ''}{items.length} 项已读 · 总数未知</p>
      {!matches.length && !(missing && !items.length) && <div className="debug-home-state" role="status"><p>{items.length ? '没有匹配的家居资料' : '该人物范围没有已读取家居资产；不推断默认住所或世界状态。'}</p>{query && <ActionButton onClick={() => onQueryChange('')}>清除搜索</ActionButton>}</div>}
      <ResidenceReading items={matches} allItems={items} selectedId={selectedId} query={query} onSelect={setSelectedId}
        afterList={result.hasMore && result.nextCursor && <ActionButton disabled={loading || Boolean(error)} onClick={onNext}>读取下一页</ActionButton>}
        renderDetail={item => {
          const payload = evidenceObject(item.record.data.payload)
          const parent = residenceParent(item, items)
          return <>
            {item.description && <p className="debug-home-body">{item.description}</p>}
            {item.kind === 'object' && <p className="debug-home-body">{typeof payload.displayReason === 'string' && payload.displayReason || '陈列理由未提供'}</p>}
            {item.record.truncated && <p className="debug-home-state" role="status">正文或结构已截断。</p>}
            <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{[...residenceFields(item), ['收录时间', snapshotTime(item.record.data.acquired_at, result.timezone)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
            <div className="debug-home-related">{item.parentId && <ActionButton variant="plain" onClick={() => openParent(item)}>{item.kind === 'space' ? parent ? '查看所属住所' : '查看住所引用' : parent ? '查看所属空间' : '查看空间引用'}<ArrowUpRight size={14} /></ActionButton>}{item.record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}<ActionButton variant="plain" onClick={() => onEvidence('character', '')}>查看人物定义<ArrowUpRight size={14} /></ActionButton><ActionButton variant="plain" onClick={() => onEvidence('location', '')}>查看当前位置<ArrowUpRight size={14} /></ActionButton></div>
            <details className="debug-prompt-provenance"><summary>来源与原始记录</summary><p>只展示已读资产关系；陈列标记不等于当前使用，资产创建时间不代表购买时间。</p><p>{item.record.source} · {item.id} · {item.ownerId}</p><pre>{JSON.stringify(item.record.data, null, 2)}</pre></details>
          </>
        }} />
    </> : result && <p className="debug-home-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}

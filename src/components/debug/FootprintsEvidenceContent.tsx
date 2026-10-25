import { useState, type ChangeEvent } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { snapshotTime } from './NowStateReading'
import { FootprintsReading } from './FootprintsReading'
import { projectFootprintRecords, footprintFields } from './footprints-projection'

/** 背景：正式足迹曾以通用卡铺开正文，旅行计划与地点资料不易区分。
 * 意图：真实资产投影到已确认的清单 / 详情，完整来源独立展开。
 * 约束：仅使用当前人物已读记录，分页与刷新由外层原子管理，不补造出发或到访日期。
 */
export function FootprintsEvidenceContent({ result, loading, error, query, roleId, scope, targetId, onRoleChange, onQueryChange, onRetry, onNext, onEvidence }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; query: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string
  onRoleChange?: (id: string) => void; onQueryChange: (value: string) => void; onRetry: () => void; onNext: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(targetId)
  const items = projectFootprintRecords(result?.records ?? [])
  const matches = items.filter(item => `${item.id} ${item.title} ${item.story} ${JSON.stringify(item.record.data)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const missing = Boolean(selectedId && !items.some(item => item.id === selectedId))
  return <section className="debug-travel-workbench" data-testid="debug-evidence-footprints">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('footprints', '')}>返回当前领域列表</ActionButton>}
    <div className="debug-travel-toolbar">{scope && onRoleChange && <label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label>}<label className="debug-travel-search"><Search size={14} /><TextField aria-label="搜索当前页证据" placeholder="搜索足迹名称或资料" value={query} disabled={result?.state !== 'ready'} onChange={(event: ChangeEvent<HTMLInputElement>) => { onQueryChange(event.target.value); setSelectedId(undefined) }} /></label></div>
    {error && <div className="debug-travel-state" role="alert"><p>{result ? '刷新失败，保留上次资产与已加载页；下方不是最新结果。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-travel-state" role="status">正在读取足迹资料…</p>}
    {result?.issues.map((issue, index) => <p className="debug-travel-state" role="status" key={index}>{issue}</p>)}
    {result?.state === 'ready' ? <>
      {missing && <p className="debug-travel-state" role="status">引用足迹未在当前已读人物范围找到，未选择替代记录。{!items.length && '当前范围没有已读取足迹资产；不推断人物从未到访。'}</p>}
      <p className="debug-travel-range">{query ? `${matches.length} 项匹配 · ` : ''}{items.length} 项已读 · 总数未知</p>
      {!matches.length && !(missing && !items.length) && <div className="debug-travel-state" role="status"><p>{items.length ? '没有匹配的足迹资料' : '该人物范围没有已读取足迹资产；不推断人物从未到访。'}</p>{query && <ActionButton onClick={() => onQueryChange('')}>清除搜索</ActionButton>}</div>}
      <FootprintsReading items={matches} allItems={items} selectedId={selectedId} onSelect={setSelectedId}
        afterList={result.hasMore && result.nextCursor && <ActionButton disabled={loading || Boolean(error)} onClick={onNext}>读取下一页</ActionButton>}
        renderDetail={item => {
          return <>
            {item.record.truncated && <p className="debug-travel-state" role="status">正文或结构已截断。</p>}
            <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{[...footprintFields(item), ['收录时间', snapshotTime(item.record.data.acquired_at, result.timezone)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
            <div className="debug-travel-related">{item.record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}<ActionButton variant="plain" onClick={() => onEvidence('location', '')}>查看当前位置<ArrowUpRight size={14} /></ActionButton></div>
            <details className="debug-prompt-provenance"><summary>来源与原始记录</summary><p>旅行日期只取明确保存字段；收录时间不代表出发或到访日期。</p><p>{item.record.source} · {item.id} · {item.record.roleId}</p><pre>{JSON.stringify(item.record.data, null, 2)}</pre></details>
          </>
        }} />
    </> : result && <p className="debug-travel-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}

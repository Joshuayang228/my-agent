import { useState, type ChangeEvent } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { WardrobeReading } from './WardrobeReading'
import { projectWardrobeRecords, wardrobeFields } from './wardrobe-projection'

/** 背景：正式衣柜仍用通用卡，混合资产不易分清单件、套装和保存状态。
 * 意图：真实只读结果采用已确认的分组清单和槽位详情，完整来源按需展开。
 * 约束：分页不补穿搭状态，冲突不选生效值；引用只在已读同人物记录内解析，无换装或资产写入。
 */
export function WardrobeEvidenceContent({ result, loading, error, query, roleId, scope, targetId, onRoleChange, onQueryChange, onRetry, onNext, onEvidence }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; query: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string
  onRoleChange?: (id: string) => void; onQueryChange: (value: string) => void; onRetry: () => void; onNext: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(targetId)
  const items = projectWardrobeRecords(result?.records ?? [])
  const matches = items.filter(item => `${item.id} ${item.title} ${item.description} ${JSON.stringify(item.record.data)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const missing = Boolean(selectedId && !items.some(item => item.id === selectedId))
  return <section className="debug-wardrobe-workbench" data-testid="debug-evidence-wardrobe">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('wardrobe', '')}>返回当前领域列表</ActionButton>}
    <div className="debug-wardrobe-toolbar">{scope && onRoleChange && <label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label>}<label className="debug-wardrobe-search"><Search size={14} /><TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索已读名称、描述或槽位" value={query} disabled={result?.state !== 'ready'} onChange={(event: ChangeEvent<HTMLInputElement>) => { onQueryChange(event.target.value); setSelectedId(undefined) }} /></label></div>
    {error && <div className="debug-wardrobe-state" role="alert"><p>{result ? '刷新失败，保留上次资产与已加载页；下方不是最新结果。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-wardrobe-state" role="status">正在读取衣柜资料…</p>}
    {result?.issues.map((issue, index) => <p className="debug-wardrobe-state" role="status" key={index}>{issue}</p>)}
    {result?.state === 'ready' ? <>
      {missing && <p className="debug-wardrobe-state" role="status">引用衣柜未在当前已读人物范围找到，未选择替代记录。{!items.length && '当前范围没有已读取衣柜资产；不推断没有衣物或当前未穿着。'}</p>}
      {items.length > 0 && <p className="debug-wardrobe-range">{query ? `${matches.length} 项匹配 · ` : ''}{items.length} 项已读记录 · 总数未知</p>}
      {!matches.length && !(missing && !items.length) && <div className="debug-wardrobe-state" role="status"><p>{items.length ? '没有匹配的衣柜资料' : '该人物范围没有已读取衣柜资产；不推断没有衣物或当前未穿着。'}</p>{query && <ActionButton onClick={() => onQueryChange('')}>清除搜索</ActionButton>}</div>}
      <WardrobeReading items={matches} allItems={items} selectedId={selectedId} onSelect={setSelectedId} onReference={id => { onQueryChange(''); setSelectedId(id) }}
        afterList={result.hasMore && result.nextCursor && <ActionButton disabled={loading || Boolean(error)} onClick={onNext}>读取下一页</ActionButton>}
        renderDetail={item => {
          return <>
            <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{wardrobeFields(item, result.timezone).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
            <div className="debug-wardrobe-related">{item.record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}</div>
            <details className="debug-prompt-provenance"><summary>来源与原始记录</summary><p>收录时间不是换装时间；保存状态不证明当前实际穿着。未读引用不判不存在，来源事件不证明购买或穿上时间。本查询不提供图片文件，完整 payload 仅供诊断。</p><p>{item.record.source} · {item.id} · {item.record.roleId}</p><pre>{JSON.stringify(item.record.data, null, 2)}</pre></details>
          </>
        }} />
    </> : result && <p className="debug-wardrobe-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}

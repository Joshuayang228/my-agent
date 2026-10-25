import { useState, type ChangeEvent } from 'react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { MemoryReading, MEMORY_GROUPS, filterMemories } from './MemoryReading'

/** 背景：正式记忆仍用通用卡，缺少候选的类别和独立正文阅读。
 * 意图：现有只读接口驱动共享阅读，局部筛选不丢已读页，来源链接只使用返回标识。
 * 约束：不扩大人物查询、不补凭据或召回证明；首次失败、刷新失败与真实空结果分别表达。
 */
export function MemoryEvidenceContent({ result, loading, error, query, roleId, scope, targetId, onRoleChange, onQueryChange, onRetry, onNext, onEvidence }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; query: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string; onRoleChange?: (id: string) => void; onQueryChange: (value: string) => void; onRetry: () => void; onNext: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [category, setCategory] = useState('all'), [selectedId, setSelectedId] = useState<string | undefined>(targetId)
  const records = result?.records ?? [], matches = filterMemories(records, category, query)
  const missing = Boolean(selectedId && !records.some(record => record.id === selectedId))
  return <section className="debug-memory-workbench" data-testid="debug-evidence-memories">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('memories', '')}>返回当前领域列表</ActionButton>}
    <div className="debug-memory-toolbar">{scope && onRoleChange && <label>范围<SelectField aria-label="记忆人物范围" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label>}<label>类别<SelectField aria-label="记忆类别" value={category} disabled={result?.state !== 'ready'} onChange={event => { setCategory(event.target.value); setSelectedId(undefined) }}><option value="all">全部类别</option>{MEMORY_GROUPS.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</SelectField></label><TextField appearance="outlined" aria-label="搜索记忆" placeholder="搜索已读记忆" value={query} disabled={result?.state !== 'ready'} onChange={(event: ChangeEvent<HTMLInputElement>) => { onQueryChange(event.target.value); setSelectedId(undefined) }} /></div>
    {error && <div className="debug-memory-state" role="alert"><p>{result ? '刷新失败，保留原范围、筛选、选中和已读记录；下方不是最新记忆。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-memory-state" role="status">正在读取记忆…</p>}
    {result?.issues.map((issue, index) => <p className="debug-memory-state" role="status" key={index}>{issue}；其余来源保留，不能认定列表完整。</p>)}
    {result?.state === 'ready' ? <>
      {missing && <p className="debug-memory-state" role="status">引用记忆未在当前人物范围返回，未选择其他条目代替。</p>}
      {records.length > 0 && <p className="debug-memory-caption">{Boolean(query || category !== 'all') && `${matches.length} 项匹配 · `}{records.length} 条当前已读记忆 · 总数未知；共享条目会随人物范围保留。</p>}
      {!matches.length && <p className="debug-memory-state" role="status">{records.length ? '当前已读范围没有匹配的记忆。' : '当前查询没有已读记忆，不代表系统没有长期记忆。'}</p>}
      <MemoryReading records={matches} allRecords={records} selectedId={selectedId} onSelect={setSelectedId} timezone={result.timezone} afterList={result.hasMore && result.nextCursor && <ActionButton disabled={loading || Boolean(error)} onClick={onNext}>读取下一页记忆</ActionButton>} renderActions={record => record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}</ActionButton>)} />
      <details className="debug-memory-source"><summary>查询边界与关联入口</summary><p>当前查询按人物包含本桶与显式共享条目，不改写记忆，也不证明已召回或注入。画像查询的非反馈资料可跨桶读取，范围与本页不同。</p><p>{result.boundary}</p><ActionButton variant="plain" onClick={() => onEvidence('profile', '')}>查看用户画像摘要</ActionButton><ActionButton variant="plain" onClick={() => onEvidence('context', '')}>查看请求保存范围</ActionButton></details>
    </> : result && <p className="debug-memory-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}

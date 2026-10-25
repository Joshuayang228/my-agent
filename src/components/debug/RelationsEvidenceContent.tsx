import { useState, type ChangeEvent } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { RelationsReading } from './RelationsReading'
import { projectRelationRecords, relationFields } from './relations-projection'

/** 背景：正式通讯录仍用通用卡，首条关系摘要掩盖了方向与共同事件的来源边界。
 * 意图：真实只读结果采用候选姓名清单和关系详情，完整字段与原文独立展开。
 * 约束：只认同范围稳定 ID，无分页游标不造下一页，无关系写入或忙闲 / 评分推断。
 */
export function RelationsEvidenceContent({ result, loading, error, query, roleId, scope, targetId, onRoleChange, onQueryChange, onRetry, onEvidence }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; query: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string
  onRoleChange?: (id: string) => void; onQueryChange: (value: string) => void; onRetry: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(targetId)
  const items = projectRelationRecords(result?.records ?? [], result?.timezone ?? 'Asia/Shanghai')
  const matches = items.filter(item => `${item.id} ${JSON.stringify(item.record.data)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const missing = Boolean(selectedId && !items.some(item => item.id === selectedId))
  return <section className="debug-relations-workbench" data-testid="debug-evidence-relations">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('relations', '')}>返回当前领域列表</ActionButton>}
    <div className="debug-relations-toolbar">{scope && onRoleChange && <label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label>}<label className="debug-relations-search"><Search size={14} /><TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索已读人物、关系或经历" value={query} disabled={result?.state !== 'ready'} onChange={(event: ChangeEvent<HTMLInputElement>) => { onQueryChange(event.target.value); setSelectedId(undefined) }} /></label></div>
    {error && <div className="debug-relations-state" role="alert"><p>{result ? '刷新失败，保留原人物、筛选和关系详情；下方不是最新结果。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-relations-state" role="status">正在读取关系资料…</p>}
    {result?.issues.map((issue, index) => <p className="debug-relations-state" role="status" key={index}>{issue}；条数仅含已读可用记录。</p>)}
    {result?.state === 'ready' ? <>
      {missing && <p className="debug-relations-state" role="status">引用人物未在当前已读范围找到，未选择替代记录。</p>}
      {items.length > 0 && <p className="debug-relations-range">{query ? `${matches.length} 项匹配 · ` : ''}{items.length} 位已读人物 · 总数未知 · 本查询没有后续游标</p>}
      {!matches.length && <p className="debug-relations-state" role="status">{items.length ? '当前已读范围没有匹配的关系资料。' : '当前查询未返回关系资料，不推断没有关系。'}{Boolean(query) && <ActionButton variant="plain" onClick={() => onQueryChange('')}>清除筛选</ActionButton>}</p>}
      <RelationsReading items={matches} allItems={items} selectedId={selectedId} onSelect={setSelectedId} roleId={roleId} roleName={scope?.roles.find(role => role.id === roleId)?.name ?? roleId} onEvent={id => onEvidence('recent', id)}
        renderDetail={item => <>
          <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{relationFields(item).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
          <div className="debug-relations-related">{item.record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}<ActionButton variant="plain" onClick={() => onEvidence('growth', '')}>查看成长与反思<ArrowUpRight size={14} /></ActionButton></div>
          <details className="debug-prompt-provenance"><summary>来源与原始记录</summary><p>{item.record.source} · {item.id} · {item.record.roleId}</p><p>时间以 {result.timezone} 显示。关系边是已保存定义，不是关系评分。共同事件全查询先限量后按人物分配；没有后续游标，忙闲和里程碑未在本查询提供。</p><pre>{JSON.stringify(item.record.data, null, 2)}</pre></details>
        </>} />
    </> : result && <p className="debug-relations-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}

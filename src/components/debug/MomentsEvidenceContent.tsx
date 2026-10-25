import { useState, type ChangeEvent } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { MomentsReading } from './MomentsReading'
import { projectMomentRecords, momentFields } from './moments-projection'

/** 背景：正式朋友圈曾套用通用事件卡，发布日和互动来源难以辨认。
 * 意图：真实查询采用候选正文预览和详情，日期过滤交给真实时区查询。
 * 约束：搜索只在已读范围，刷新失败保留全部已读页；无赞评写入、图片加载或活动完成推断。
 */
export function MomentsEvidenceContent({ result, loading, error, query, date, roleId, scope, targetId, onRoleChange, onQueryChange, onDateChange, onRetry, onNext, onEvidence }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; query: string; date: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string
  onRoleChange?: (id: string) => void; onQueryChange: (value: string) => void; onDateChange: (value: string) => void; onRetry: () => void; onNext: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(targetId)
  const items = projectMomentRecords(result?.records ?? [], result?.timezone ?? 'Asia/Shanghai')
  const matches = items.filter(item => `${item.id} ${JSON.stringify(item.record.data)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const missing = Boolean(selectedId && !items.some(item => item.id === selectedId))
  return <section className="debug-moments-workbench" data-testid="debug-evidence-moments">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('moments', '')}>返回当前领域列表</ActionButton>}
    <div className="debug-moments-toolbar">{scope && onRoleChange && <label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label>}<label className="debug-moments-search"><Search size={14} /><TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索已读正文或互动" value={query} disabled={result?.state !== 'ready'} onChange={(event: ChangeEvent<HTMLInputElement>) => { onQueryChange(event.target.value); setSelectedId(undefined) }} /></label>{!targetId && <label>发布日<TextField appearance="outlined" type="date" aria-label="动态发布日" value={date} onChange={(event: ChangeEvent<HTMLInputElement>) => onDateChange(event.target.value)} /></label>}</div>
    {error && <div className="debug-moments-state" role="alert"><p>{result ? '刷新失败，保留原人物、发布日、筛选和已加载记录；下方不是最新结果。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-moments-state" role="status">正在读取动态…</p>}
    {result?.issues.map((issue, index) => <p className="debug-moments-state" role="status" key={index}>{issue}；条数仅含已读可用记录。</p>)}
    {result?.state === 'ready' ? <>
      {missing && <p className="debug-moments-state" role="status">引用动态未在当前已读人物范围找到，未选择替代记录。</p>}
      {items.length > 0 && <p className="debug-moments-range">{query || date ? `${matches.length} 项匹配 · ` : ''}{items.length} 项已读动态 · 总数未知</p>}
      {!matches.length && <p className="debug-moments-state" role="status">{items.length ? '当前已读范围没有匹配的动态。' : '此范围没有已读动态；不据此推断人物从未发布。'}{Boolean(query || date) && <ActionButton variant="plain" onClick={() => { onDateChange(''); onQueryChange('') }}>清除筛选</ActionButton>}</p>}
      <MomentsReading items={matches} allItems={items} selectedId={selectedId} onSelect={setSelectedId}
        afterList={result.hasMore && result.nextCursor && <ActionButton disabled={loading || Boolean(error)} onClick={onNext}>读取下一页动态</ActionButton>}
        renderDetail={item => <>
          <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{momentFields(item).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
          <div className="debug-moments-related">{item.record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}<ActionButton variant="plain" onClick={() => onEvidence('links', '')}>查看生活事件关联<ArrowUpRight size={14} /></ActionButton></div>
          <details className="debug-prompt-provenance"><summary>来源与原始记录</summary><p>{item.record.source} · {item.id} · {item.record.roleId}</p><p>时间以 {result.timezone} 显示。仅保存发布资料与已读互动，不提供图片文件、完整反应统计或历史请求输入。</p><pre>{JSON.stringify(item.record.data, null, 2)}</pre></details>
        </>} />
    </> : result && <p className="debug-moments-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}

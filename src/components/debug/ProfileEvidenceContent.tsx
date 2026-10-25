import { useState } from 'react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { ProfileReading } from './ProfileReading'

/** 背景：正式画像原先展开所有正文且漏掉未归类来源，无法按条核对。
 * 意图：真实查询驱动共享阅读，保留分页、失败快照与明确来源定位。
 * 约束：不再次按保存桶过滤全局来源；仅共享 / 当前人物记忆能跳到当前人物记忆查询，未知不补替代。
 */
export function ProfileEvidenceContent({ result, loading, error, roleId, scope, targetId, onRoleChange, onRetry, onNext, onEvidence }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string; onRoleChange?: (id: string) => void; onRetry: () => void; onNext: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(targetId)
  const records = result?.records ?? []
  const missing = Boolean(selectedId && !records.some(record => record.id === selectedId))
  return <section className="debug-profile-workbench" data-testid="debug-evidence-profile">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('profile', '')}>返回当前领域列表</ActionButton>}
    <div className="debug-profile-toolbar">{scope && onRoleChange && <label>人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label>}<span>全局资料与当前人物的协作反馈</span></div>
    {error && <div className="debug-profile-state" role="alert"><p>{result ? '刷新失败，保留原人物、已加载来源、选中与展开；下方不是最新画像。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-profile-state" role="status">正在读取画像来源…</p>}
    {result?.issues.map((issue, index) => <p className="debug-profile-state" role="status" key={index}>{issue}；其余已读资料保留，不能认定摘要完整。</p>)}
    {result?.state === 'ready' ? <>
      {missing && <p className="debug-profile-state" role="status">引用来源未在当前人物查询范围返回，未选择其他记忆代替。</p>}
      {!records.length && <p className="debug-profile-state" role="status">当前查询未返回画像来源，不代表用户没有相关资料。</p>}
      <ProfileReading records={records} selectedId={selectedId} onSelect={setSelectedId} timezone={result.timezone} afterList={result.hasMore && result.nextCursor && <ActionButton disabled={loading || Boolean(error)} onClick={onNext}>读取下一页来源</ActionButton>} renderActions={record => record.source === 'memories' && (record.roleId === '' || record.roleId === roleId) ? <ActionButton variant="plain" onClick={() => onEvidence('memories', record.id)}>查看这条来源记忆</ActionButton> : <p className="debug-profile-caption">此来源保存于其他范围，当前人物记忆查询不提供同条定位；请核对完整记录。</p>} />
      <details className="debug-profile-source"><summary>查询范围与其他入口</summary><p>来源：{result.source} · 当前页 {records.length} 条已读来源，总数未知。顺序来自更新时间与 ID；分类只整理当前返回行，不推导人物设定或关系评分。</p><p>{result.boundary}</p><p>主对话是否注入以运行时实际证据为准；工作区不注入此画像。读取层排除含凭据记忆；其他类别只保留来源，不凑成三块摘要。</p><ActionButton variant="plain" onClick={() => onEvidence('memories', '')}>查看用户记忆</ActionButton><ActionButton variant="plain" onClick={() => onEvidence('context', '')}>查看请求保存范围</ActionButton></details>
    </> : result && <p className="debug-profile-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}

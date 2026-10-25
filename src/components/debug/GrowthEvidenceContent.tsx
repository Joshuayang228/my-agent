import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { GrowthReading } from './GrowthReading'
import { projectGrowthRecords, growthFields } from './growth-projection'

/** 背景：当前覆盖、历史与反思是不同来源，通用卡曾将其平铺并用同一人物 ID 阅读。
 * 意图：真实结果使用候选的正文优先结构，历史分页由原有只读加载器管理。
 * 约束：选择以 source + ID 定位，缺失引用不替换；资料损坏时不宣布没有反思，不执行或写入成长。
 */
export function GrowthEvidenceContent({ result, loading, error, roleId, scope, targetId, onRoleChange, onRetry, onNext, onEvidence }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string
  onRoleChange?: (id: string) => void; onRetry: () => void; onNext: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [selectedKey, setSelectedKey] = useState<string | undefined | null>(null)
  const items = projectGrowthRecords(result?.records ?? [], result?.timezone ?? 'Asia/Shanghai')
  const target = targetId ? items.filter(item => item.id === targetId) : []
  const key = selectedKey === null ? target.length === 1 ? target[0].key : undefined : selectedKey
  const missing = Boolean((targetId && !target.length) || (selectedKey && !items.some(item => item.key === selectedKey)))
  return <section className="debug-growth-workbench" data-testid="debug-evidence-growth">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('growth', '')}>返回当前领域列表</ActionButton>}
    {scope && onRoleChange && <div className="debug-growth-toolbar debug-focused-scope"><label>人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label></div>}
    {error && <div className="debug-growth-state" role="alert"><p>{result ? '刷新失败，保留上次正文、来源和已加载历史；下方不是最新结果。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-growth-state" role="status">正在读取成长资料…</p>}
    {result?.issues.map((issue, index) => <p className="debug-growth-state" role="status" key={index}>{issue}</p>)}
    {result?.state === 'ready' ? <>
      {missing && <p className="debug-growth-state" role="status">引用成长记录未在当前已读人物范围找到，未选择替代记录。</p>}
      {target.length > 1 && <p className="debug-growth-state" role="status">同一标识返回多个来源，请按来源选择；未自动替代。</p>}
      {!items.length ? <p className="debug-growth-state" role="status">此范围没有已读成长资料；未补默认正文。</p> : <GrowthReading items={items} selectedKey={missing ? undefined : key} onSelect={setSelectedKey}
        reflectionIssue={result.issues.length ? '本次存在未读记录，未据此确认反思状态缺失。当前已读正文与历史仍可阅读。' : undefined}
        afterHistory={result.hasMore && result.nextCursor && <ActionButton disabled={loading || Boolean(error)} onClick={onNext}>读取下一页历史</ActionButton>}
        renderDetail={item => <>
          {item.record.truncated && <p className="debug-growth-state" role="status">正文或结构已截断。</p>}
          <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{growthFields(item).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
          {item.record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}
          <ActionButton variant="plain" onClick={() => onEvidence('character', '')}>查看稳定人物定义<ArrowUpRight size={14} /></ActionButton>
          <details className="debug-prompt-provenance"><summary>来源与原始记录</summary><p>{item.record.source} · {item.id} · {item.record.roleId}</p><p>时间以 {result.timezone} 显示。当前正文不是历史请求输入；门闸决策未在本查询提供。</p><pre>{JSON.stringify(item.record.data, null, 2)}</pre></details>
        </>} />}
    </> : result && <p className="debug-growth-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}

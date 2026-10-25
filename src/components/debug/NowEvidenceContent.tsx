import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { evidenceObject } from './EvidenceSummary'
import { NowStateReading, snapshotTime } from './NowStateReading'

const text = (value: unknown) => typeof value === 'string' ? value : ''
const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? String(value) : '未记录'

/** 背景：正式此刻曾套通用记录卡，活动摘要与 codec / 存储差异难以分开。
 * 意图：仅投影主进程已返回的解析快照和原始记录；原始值不经 UI 修复。
 * 约束：没有状态行不补世界；指定 ID 不匹配时不选择当前行；刷新失败保留展开与来源。
 */
export function NowEvidenceContent({ result, loading, error, roleId, scope, targetId, onRoleChange, onRetry, onEvidence }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string
  onRoleChange?: (id: string) => void; onRetry: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [expanded, setExpanded] = useState(Boolean(targetId))
  const record = result?.records.find(record => !targetId || record.id === targetId)
  const world = evidenceObject(record?.data.world)
  const storedWorld = evidenceObject(record?.data.storedWorld)
  // 背景：合法 JSON 也可能经过 codec 默认或规范化；意图：只报告返回投影的实际差异，不在 UI 重写 codec 判定。
  // 约束：不推断差异原因、不回写原文；脱敏和截断后的两个投影也只能按诊断范围解释。
  const warning = typeof record?.data.storedWorld === 'string' ? record.data.storedWorld : Object.entries(world).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(storedWorld[key])) ? '保存值与运行时解析快照存在差异；请展开完整来源核对。' : undefined
  const pause = record?.data.paused_at
  const timezone = result?.timezone ?? ''
  const pauseTime = snapshotTime(pause, timezone)
  const pauseNotice = pause === undefined || pause === null ? undefined : pauseTime === '未记录' ? '生活暂停字段异常；原始值保留，未推断运行健康。' : `生活推进已暂停 · ${pauseTime}`
  const fields: Array<[string, string]> = [
    ['活动', text(world.currentActivity) || '未记录'], ['当前位置', text(world.currentLocation) || '未设定'],
    ['情绪', score(world.mood)], ['能量', score(world.energy)], ['社交需求', score(world.socialNeed)],
    ['生活暂停', pause === null ? '否' : pause === undefined ? '未记录' : pauseTime === '未记录' ? '字段异常' : `是 · ${pauseTime}`],
    ['最后推进', snapshotTime(record?.data.last_tick_at, timezone)], ['世界更新时间', snapshotTime(world.updatedAt, timezone)], ['诊断时区', timezone], ['世界保存时区', text(world.timezone) || '未记录'], ['快照性质', '运行时解析快照，非历史请求'],
  ]
  return <section className="debug-now-workbench" data-testid="debug-evidence-now">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('now', '')}>返回当前领域列表</ActionButton>}
    {scope && onRoleChange && <div className="debug-now-toolbar debug-focused-scope"><label>人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label></div>}
    {error && <div className="debug-now-state" role="alert"><p>{result ? '刷新失败，保留上次快照；下方不是最新结果。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-now-state" role="status">正在读取状态…</p>}
    {result?.issues.map((issue, index) => <p className="debug-now-state" role="status" key={index}>{issue}</p>)}
    {result?.state === 'ready' ? record ? <>
      {record.truncated && <p className="debug-now-state" role="status">正文或结构已截断。</p>}
      <NowStateReading id={record.id} title={record.title} activity={text(world.currentActivity)} location={text(world.currentLocation)} updated={snapshotTime(world.updatedAt, timezone)} timezone={timezone} warning={warning} pauseNotice={pauseNotice} fields={fields} catchupSummary={text(record.data.catchup_summary)} expanded={expanded} onToggle={() => setExpanded(!expanded)}
        related={<><ActionButton variant="plain" onClick={() => onEvidence('location', '')}>查看位置快照<ArrowUpRight size={14} /></ActionButton><ActionButton variant="plain" onClick={() => onEvidence('schedule', '')}>查看今日计划<ArrowUpRight size={14} /></ActionButton></>}
        source={<details className="debug-prompt-provenance"><summary>记录标识与原始来源</summary><p>{record.source} · {record.id} · {record.roleId}</p><p>{result.boundary} · 解析快照不等于已保存原文，未暂停不证明推进健康。</p><pre>{JSON.stringify(record.data, null, 2)}</pre></details>} />
    </> : <p className="debug-now-state" role="status">{targetId ? '引用状态未在该人物范围找到，未选择替代快照。' : '该人物没有状态记录；未补造默认世界。'}</p> : result && <p className="debug-now-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}

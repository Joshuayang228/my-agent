import type { ReactNode } from 'react'
import { ActionButton } from '../foundation/ActionButton'

export const snapshotTime = (value: unknown, timezone: string) => typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isFinite(new Date(value).getTime())
  ? new Intl.DateTimeFormat('zh-CN', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(value) : '未记录'

/** 背景：当前快照不适合事件列表，默认字段堆叠曾遮住活动和位置。
 * 意图：候选和生产共用两项摘要及完整状态阅读，查询、解析和来源由调用方持有。
 * 约束：时间不补当前值，数值不转换为人格判断，展开本身不推进生活或写入状态。
 */
export function NowStateReading({ id, title, activity, location, updated, timezone, warning, pauseNotice, fields, catchupSummary, expanded, onToggle, related, source }: {
  id: string; title: string; activity: string; location: string; updated: string; timezone: string; warning?: string; pauseNotice?: string
  fields: readonly (readonly [string, string])[]; catchupSummary?: string; expanded: boolean; onToggle: () => void; related: ReactNode; source: ReactNode
}) {
  return <>
    {warning && <p className="debug-now-state debug-now-warning" role="status">{warning}</p>}
    {pauseNotice && <p className="debug-now-state debug-now-warning" role="status">{pauseNotice}</p>}
    <div className="debug-now-summary" data-record-id={id}>
      <dl><div><dt>当前活动</dt><dd className="debug-now-activity">{activity || '未记录'}</dd></div><div><dt>当前位置</dt><dd>{location || '未设定'}</dd></div></dl>
      <p className="debug-now-meta">运行时解析快照 · {updated === '未记录' ? '更新时间未记录' : `更新于 ${updated}`} · {timezone}</p>
      <ActionButton variant="plain" aria-label={`${title} · 完整状态`} aria-expanded={expanded} onClick={onToggle}>完整状态</ActionButton>
    </div>
    {expanded && <article className="debug-now-detail" aria-label="领域证据详情">
      <h3>诊断字段</h3><dl className="debug-candidate-facts">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {catchupSummary && <section><h3>生活补叙</h3><p className="debug-now-body">{catchupSummary}</p></section>}
      <h3>相关诊断</h3>{related}{source}
    </article>}
  </>
}

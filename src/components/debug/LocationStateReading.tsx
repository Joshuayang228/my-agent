import type { ReactNode } from 'react'
import { ActionButton } from '../foundation/ActionButton'

/** 背景：位置快照被通用记录卡包裹，地点与原始证据难以分层。
 * 意图：正式与候选共享地点、细节、活动及展开后的字段和来源。
 * 约束：只渲染所属来源的值，更新时间不解释为到达，当前位置不证明旅行或访问历史。
 */
export function LocationStateReading({ id, title, location, detail, activity, updated, timezone, warning, expanded, onToggle, fields, related, source }: {
  id: string; title: string; location: string; detail: string; activity: string; updated: string; timezone: string; warning?: string
  expanded: boolean; onToggle: () => void; fields: readonly (readonly [string, string])[]; related: ReactNode; source: ReactNode
}) {
  return <>
    {warning && <p className="debug-location-state debug-location-warning" role="status">{warning}</p>}
    <div className="debug-location-summary" data-record-id={id}>
      <p className="debug-location-place">{location || '未设定'}</p>
      {detail ? <p className="debug-location-body">{detail}</p> : <p className="debug-location-meta">位置细节未记录</p>}
      <dl className="debug-location-facts"><div><dt>当前活动</dt><dd>{activity || '未记录'}</dd></div></dl>
      <p className="debug-location-meta">世界更新时间{updated === '未记录' ? '未记录' : ` ${updated}`} · {timezone}</p>
      <ActionButton variant="plain" aria-label={`${title} · 完整快照`} aria-expanded={expanded} onClick={onToggle}>完整快照</ActionButton>
    </div>
    {expanded && <article className="debug-location-detail" aria-label="领域证据详情">
      <h3>位置字段</h3><dl className="debug-candidate-facts">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="debug-location-meta">位置与活动来自当前世界解析快照；更新时间不是到达时间，当前位置不证明旅行或访问历史。</p>
      <div className="debug-location-related">{related}</div>{source}
    </article>}
  </>
}

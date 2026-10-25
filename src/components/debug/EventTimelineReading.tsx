import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'

export interface EventTimelineItem { id: string; title: string; time: string; status: string; locationText?: string; owner?: string }

/** 背景：事项清单与详情必须在候选和正式页保持相同比例，而数据来源各自独立。
 * 意图：只共享阅读与返回焦点，具体字段及证据由调用方渲染。
 * 约束：时间和状态保持来源语义，不推断执行；选中身份由调用方提供，不按标题替换。
 */
export function EventTimelineReading<T extends EventTimelineItem>({ items, selectedId, onSelect, renderDetail }: {
  items: readonly T[]; selectedId?: string; onSelect: (id: string | undefined) => void; renderDetail: (item: T) => ReactNode
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const detail = useRef<HTMLElement>(null)
  const selected = items.find(item => item.id === selectedId)
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedId, Boolean(selected)])
  return <>
    <div className="debug-reading debug-reading-timeline" data-reading-layout="timeline" data-detail-open={Boolean(selected)}>
      {items.map(item => <article key={item.id} className="debug-reading-entry" data-record-id={item.id}>
        <time className="debug-recent-time">{item.time}</time><div className="debug-recent-summary">
          <ActionButton ref={node => { if (node) buttons.current.set(item.id, node); else buttons.current.delete(item.id) }} variant="plain" className="debug-recent-title" aria-label={item.title} aria-expanded={selected?.id === item.id} onClick={() => onSelect(item.id)}>{item.title}</ActionButton>
          <p><span>{item.status}</span>{item.locationText && <span>{item.locationText}</span>}{item.owner && <span>{item.owner}</span>}</p>
        </div>
      </article>)}
    </div>
    {selected && <article ref={detail} className="debug-candidate-detail debug-reading-detail" aria-label="领域证据详情">
      <ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => buttons.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} /> 返回列表</ActionButton>
      <div className="debug-candidate-detail-heading"><h3>{selected.title}</h3><Badge>{selected.status}</Badge></div>
      {renderDetail(selected)}
    </article>}
  </>
}

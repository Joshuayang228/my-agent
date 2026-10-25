import { useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

export interface ScheduleReadingItem { id: string; time: string; activity: string; location: string; notice?: string; sourceRecordId?: string }

/** 背景：正式日程按整天套卡，与已确认的一行一时段候选分离。
 * 意图：共享时间列、活动、地点及单条详情；调用方负责事实投影和筛选。
 * 约束：只展示计划，不推导执行状态；返回恢复同一行焦点，标识由所属来源提供。
 */
export function ScheduleReading<T extends ScheduleReadingItem>({ items, selectedId, onSelect, renderDetail }: {
  items: readonly T[]; selectedId?: string; onSelect: (id: string | undefined) => void; renderDetail: (item: T) => ReactNode
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const selected = items.find(item => item.id === selectedId)
  return <>
    <div className="debug-schedule-list" data-reading-layout="schedule" data-detail-open={Boolean(selected)} aria-label="计划时段列表">
      {items.map(item => <article key={item.id} data-record-id={item.id} data-source-record-id={item.sourceRecordId}>
        <ActionButton ref={node => { if (node) buttons.current.set(item.id, node); else buttons.current.delete(item.id) }} variant="plain" className="debug-schedule-row" aria-label={`${item.time} · ${item.activity}`} aria-expanded={selectedId === item.id} onClick={() => onSelect(item.id)}>
          <time>{item.time}</time><span className="debug-schedule-activity">{item.activity}<span className="debug-schedule-location">{item.location}</span>{item.notice && <span className="debug-schedule-notice" role="status">{item.notice}</span>}</span>
        </ActionButton>
      </article>)}
    </div>
    {selected && <article className="debug-schedule-detail" aria-label="领域证据详情">
      <ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => buttons.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} /> 返回列表</ActionButton>
      <h3>{selected.time} · {selected.activity}</h3>
      {renderDetail(selected)}
    </article>}
  </>
}

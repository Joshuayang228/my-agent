import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { runtimeEventTime, type RuntimeEventReading } from './runtime-events'

/** 背景：运行事件清单只适合扫描，长摘要和关联标识需要独立阅读。
 * 意图：正式与候选共用时间线 / 单条详情，原始已保存结构按需展开。
 * 约束：事件不等于行动完成；只显示提供的关联，新增记录不改变选中身份，不补完整正文或未知时间。
 */
export function EventReading({ events, allEvents, selectedId, onSelect, afterList, identityLabel = '事件标识', renderActions }: {
  events: readonly RuntimeEventReading[]; allEvents: readonly RuntimeEventReading[]; selectedId?: string; onSelect: (id: string | undefined) => void; afterList?: ReactNode; identityLabel?: string; renderActions?: (event: RuntimeEventReading) => ReactNode
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>()), detail = useRef<HTMLElement>(null)
  const selected = allEvents.find(event => event.id === selectedId)
  const formatTime = (time?: number) => runtimeEventTime(time, Intl.DateTimeFormat().resolvedOptions().timeZone)
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedId, Boolean(selected)])
  return <>
    {events.length > 0 && <div className="debug-events-timeline">{events.map(event => <article key={event.id} className="debug-event-row" data-record-id={event.id}><time>{formatTime(event.time)}</time><div><ActionButton ref={node => { if (node) buttons.current.set(event.id, node); else buttons.current.delete(event.id) }} variant="plain" className="debug-event-title" style={{ color: 'var(--text-primary)' }} aria-expanded={selectedId === event.id} onClick={() => onSelect(event.id)}>{event.title || '类型未记录'}</ActionButton><p>{event.status} · {event.type}</p></div></article>)}</div>}
    {afterList}
    {selected && <article key={selected.id} ref={detail} className="debug-events-detail" aria-label="运行事件详情"><ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => buttons.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} />返回事件</ActionButton><h3>{selected.title || '类型未记录'}</h3><p className="debug-events-body">{selected.body || '已保存摘要为空；未补完整事件正文。'}</p><dl><dt>{identityLabel}</dt><dd><code>{selected.id}</code></dd><dt>类型</dt><dd>{selected.type || '未记录'}</dd><dt>时间</dt><dd>{formatTime(selected.time)}</dd><dt>会话</dt><dd><code>{selected.sessionId || '未关联'}</code></dd><dt>Span</dt><dd><code>{selected.spanId || '未关联'}</code></dd></dl>{renderActions?.(selected)}<details className="debug-events-source"><summary>已保存记录</summary><pre>{JSON.stringify(selected.raw ?? selected, null, 2)}</pre></details></article>}
  </>
}

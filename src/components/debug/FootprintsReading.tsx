import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

export type FootprintGroup = 'actual' | 'planned' | 'cancelled' | 'place' | 'unknown'
export interface FootprintReadingItem {
  id: string; title: string; group: FootprintGroup; dateLabel: string; sortDate: string; destination: string; statusLabel: string
  issue: string | null; story: string; stops: Array<{ key: string; date?: string; name: string; story: string }>
}
const GROUPS: Array<{ id: FootprintGroup; label: string }> = [{ id: 'actual', label: '实际旅行' }, { id: 'planned', label: '旅行计划 · 尚未出发' }, { id: 'cancelled', label: '已取消计划' }, { id: 'place', label: '地点资料 · 非旅行' }, { id: 'unknown', label: '旅行状态未识别' }]

/** 背景：足迹候选与正式页曾分别维护清单，实际正文和停留资料挤满首屏。
 * 意图：共用按已存状态分组的短清单与单条详情，容器提供真实来源和分页。
 * 约束：不推断出发日期或补造旅行，坏资料保留提示；同 ID 刷新保留展开，返回恢复该行焦点。
 */
export function FootprintsReading<T extends FootprintReadingItem>({ items, allItems, selectedId, onSelect, afterList, renderDetail }: {
  items: readonly T[]; allItems: readonly T[]; selectedId?: string; onSelect: (id: string | undefined) => void; afterList?: ReactNode; renderDetail: (item: T) => ReactNode
}) {
  const rows = useRef(new Map<string, HTMLButtonElement>())
  const detail = useRef<HTMLElement>(null)
  const selected = allItems.find(item => item.id === selectedId)
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedId, Boolean(selected)])
  return <>
    {items.length > 0 && <div className="debug-travel-list" data-reading-layout="travel">{GROUPS.map(group => {
      const entries = items.filter(item => item.group === group.id).sort((a, b) => b.sortDate.localeCompare(a.sortDate) || a.id.localeCompare(b.id))
      return entries.length > 0 && <section key={group.id} data-travel-group={group.id}><h3>{group.label} · {entries.length}</h3>{entries.map(item => <article key={item.id} data-record-id={item.id} className="debug-travel-row">
        <ActionButton ref={node => { if (node) rows.current.set(item.id, node); else rows.current.delete(item.id) }} variant="plain" className="debug-travel-name" style={{ color: 'var(--text-primary)' }} aria-label={item.title} aria-expanded={selectedId === item.id} onClick={() => onSelect(item.id)}>{item.title}</ActionButton>
        <p className="debug-travel-meta"><span>{item.dateLabel}</span>{group.id === 'actual' && <span>{item.statusLabel}</span>}{item.destination && <span>{item.destination}</span>}</p>
        {item.issue && <p className="debug-travel-state">资料不完整：{item.issue}</p>}
      </article>)}</section>
    })}</div>}
    {afterList}
    {selected && <article key={selected.id} ref={detail} className="debug-travel-detail" aria-label="领域证据详情">
      <ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => rows.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} />返回列表</ActionButton><h3>{selected.title}</h3>
      <p className="debug-travel-state">{selected.issue ? '资料不完整，以下为已读原始记录；不据此确认实际出发。' : selected.group === 'actual' ? '明确记录为已出发旅行；创建时间不作为访问日期。' : selected.group === 'place' ? '地点资料不自动转换为旅行；访问日期未记录。' : '未确认实际出发，不纳入实际旅行。'}</p>
      {selected.story ? <p className="debug-travel-body">{selected.story}</p> : <p className="debug-travel-meta">{selected.group === 'place' ? '地点说明未提供' : '旅行经历正文未提供'}</p>}
      {selected.stops.map(stop => <section className="debug-travel-stop" key={stop.key}><h4>{stop.date ?? '日期未提供'} · {stop.name}</h4><p className="debug-travel-body">{stop.story}</p></section>)}
      {renderDetail(selected)}
    </article>}
  </>
}

import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

export interface RelationsReadingItem {
  id: string; personId: string; name: string; truncated: boolean; issue?: string
  edges: Array<{ from: string; to: string; type: string; note: string }>
  experiences?: Array<{ id?: string; title: string; at: string; location: string; body: string; issue?: string }>
  experienceIssue?: string
}

/** 背景：关系边有方向，首条摘要和有限共同事件不能解释成完整交往历史。
 * 意图：正式与候选共用短人物清单和分方向详情，共同事件按需展开。
 * 约束：按稳定 ID 选择，不按姓名合并；无明确事件 ID 不跳转，不推断关系评分、忙闲或里程碑。
 */
export function RelationsReading<T extends RelationsReadingItem>({ items, allItems, selectedId, roleId, roleName, onSelect, onEvent, renderDetail }: {
  items: readonly T[]; allItems: readonly T[]; selectedId?: string; roleId: string; roleName: string
  onSelect: (id: string | undefined) => void; onEvent: (id: string) => void; renderDetail: (item: T) => ReactNode
}) {
  const rows = useRef(new Map<string, HTMLButtonElement>())
  const detail = useRef<HTMLElement>(null)
  const selected = allItems.find(item => item.id === selectedId)
  const endpoint = (id: string) => id === roleId ? roleName : id === selected?.personId ? selected.name : id || '端点未提供'
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedId, Boolean(selected)])
  return <>
    {items.length > 0 && <div className="debug-relations-list">{items.map(item => <article key={item.id} className="debug-relations-row" data-record-id={item.id}><ActionButton ref={node => { if (node) rows.current.set(item.id, node); else rows.current.delete(item.id) }} variant="plain" className="debug-relations-name" style={{ color: 'var(--text-primary)' }} aria-label={`查看人物：${item.name}`} aria-expanded={selectedId === item.id} onClick={() => onSelect(item.id)}>{item.name}</ActionButton><p className="debug-relations-meta">{item.edges[0]?.note ? item.edges[0].note.slice(0, 120) + (item.edges[0].note.length > 120 ? '…' : '') : '关系说明未提供'}{item.edges.length > 1 && ` · ${item.edges.length} 条方向定义`}</p>{item.issue && <p className="debug-relations-state">{item.issue}</p>}{item.truncated && <p className="debug-relations-state">关系资料读取有截断，不保证完整。</p>}{item.name === item.personId && <p className="debug-relations-meta">姓名未登记，保留人物标识。</p>}</article>)}</div>}
    {selected && <article key={selected.id} ref={detail} className="debug-relations-detail" aria-label="领域证据详情"><ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => rows.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} />返回列表</ActionButton><h3>{selected.name}</h3>{selected.truncated && <p className="debug-relations-state">关系资料读取有截断，以下仅含已返回内容。</p>}
      <section className="debug-relations-definitions"><h4>关系定义</h4>{selected.issue && <p className="debug-relations-state">{selected.issue}</p>}{selected.edges.map((edge, index) => <section key={index} className="debug-relations-definition"><p className="debug-relations-meta">{endpoint(edge.from)} → {endpoint(edge.to)} · 类型 <code>{edge.type || '未提供'}</code></p><p className="debug-relations-body">{edge.note || '此方向未提供关系说明。'}</p></section>)}</section>
      <details className="debug-prompt-provenance debug-relations-experiences"><summary>共同在场的事件</summary><p className="debug-relations-meta">仅含显式共同在场关联与当前已读范围；不是完整交往历史、召唤聊天或活动完成证明。</p>{selected.experienceIssue && <p className="debug-relations-state">{selected.experienceIssue}</p>}{selected.experiences === undefined ? <p className="debug-relations-state">本次查询未提供共同经历，数量未知。</p> : selected.experiences.length ? selected.experiences.map((event, index) => <section key={`${event.id}:${index}`} className="debug-relations-experience"><h4>{event.title}</h4><p className="debug-relations-meta">事件计划时间：{event.at}{event.location && ` · ${event.location}`}</p><p className="debug-relations-body">{event.body || '经历正文未提供。'}</p>{event.issue && <p className="debug-relations-state">{event.issue}</p>}{event.id && <ActionButton variant="plain" onClick={() => onEvent(event.id!)}>查看共同事件来源<ArrowUpRight size={14} /></ActionButton>}</section>) : <p className="debug-relations-state">本次已读范围没有共同在场事件，不推断从未共同活动。</p>}</details>
      {renderDetail(selected)}
    </article>}
  </>
}

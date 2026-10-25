import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

export interface WardrobeReadingItem {
  id: string; ownerId: string; title: string; kind: 'wear-state' | 'outfit' | 'garment' | 'unknown'; category: string
  meta: string; description: string; truncated: boolean; issue: string | null; slots?: Array<{ slot: string; id: string; label: string }>
}
const GROUPS = [{ kind: 'wear-state', label: '穿搭状态记录' }, { kind: 'outfit', label: '套装' }, { kind: 'garment', label: '衣物' }, { kind: 'unknown', label: '未识别记录' }] as const

/** 背景：衣物、套装与穿搭共用资产表，分页和搜索不能改变保存引用的含义。
 * 意图：正式与候选共用短分组清单与单条详情，槽位始终参考完整已读范围。
 * 约束：只关联同人物原始 ID，未读不判不存在，冲突状态不自行选定，返回恢复行焦点。
 */
export function WardrobeReading<T extends WardrobeReadingItem>({ items, allItems, selectedId, onSelect, onReference, afterList, renderDetail }: {
  items: readonly T[]; allItems: readonly T[]; selectedId?: string; onSelect: (id: string | undefined) => void; onReference: (id: string) => void; afterList?: ReactNode; renderDetail: (item: T) => ReactNode
}) {
  const rows = useRef(new Map<string, HTMLButtonElement>())
  const detail = useRef<HTMLElement>(null)
  const selected = allItems.find(item => item.id === selectedId)
  const states = allItems.filter(item => item.kind === 'wear-state')
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedId, Boolean(selected)])
  return <>
    {allItems.length > 0 && states.length !== 1 && <p className="debug-wardrobe-state" role="status">{states.length > 1 ? '已读到多条穿搭状态，存在冲突；不推断哪条生效。' : '当前已读范围未包含穿搭状态，不能判断当前穿着。'}</p>}
    {items.length > 0 && <div className="debug-wardrobe-list">{GROUPS.map(group => {
      const entries = items.filter(item => item.kind === group.kind)
      return entries.length > 0 && <section key={group.kind} data-wardrobe-group={group.kind}><h3>{group.label}</h3>{entries.map(item => <article key={item.id} className="debug-wardrobe-row" data-record-id={item.id}><ActionButton ref={node => { if (node) rows.current.set(item.id, node); else rows.current.delete(item.id) }} variant="plain" className="debug-wardrobe-name" style={{ color: 'var(--text-primary)' }} aria-label={item.title} aria-expanded={selectedId === item.id} onClick={() => onSelect(item.id)}>{item.title}</ActionButton><p className="debug-wardrobe-meta">{item.meta}</p>{item.truncated && <p className="debug-wardrobe-state">此记录读取有截断，不保证完整。</p>}</article>)}</section>
    })}</div>}
    {afterList}
    {selected && <article key={selected.id} ref={detail} className="debug-wardrobe-detail" aria-label="领域证据详情"><ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => rows.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} />返回列表</ActionButton><h3>{selected.title}</h3>{selected.issue && <p className="debug-wardrobe-state">资料不完整：{selected.issue}</p>}{selected.truncated && <p className="debug-wardrobe-state">以下仅含已返回内容，记录存在截断。</p>}{selected.description && <p className="debug-wardrobe-body">{selected.description}</p>}
      {['outfit', 'wear-state'].includes(selected.kind) && <section className="debug-wardrobe-slots"><h4>已保存槽位</h4>{selected.slots ? selected.slots.map(({ slot, id, label }) => {
        const target = allItems.find(item => item.id === id && item.ownerId === selected.ownerId)
        const mismatch = target && (target.kind !== 'garment' || target.category !== slot)
        return <div key={slot}><span>{label}</span>{target ? <><ActionButton variant="plain" onClick={() => onReference(target.id)}>{target.title}</ActionButton>{mismatch && <p className="debug-wardrobe-state">已读目标的记录类型或分类与槽位不匹配。</p>}</> : <p>{id} · 未在当前已读范围，不能判定不存在。</p>}</div>
      }) : <p className="debug-wardrobe-state">槽位结构不可解析，原始记录保留。</p>}<p className="debug-wardrobe-meta">槽位仅按同人物已读 ID 关联，不按名称或图片补全穿搭。</p></section>}
      {renderDetail(selected)}
    </article>}
  </>
}

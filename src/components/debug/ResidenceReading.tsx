import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

export interface ResidenceReadingItem {
  id: string; ownerId: string; title: string; kind: 'residence' | 'space' | 'object' | 'unknown'; parentId?: string
  description: string; displayInHome?: boolean; displayIssue?: string; parentIssue?: string; notice?: string; ownerLabel?: string
}
/** 背景：已读清单可能含跨人物或类型错误的引用，同名 / 同 ID 命中不足以证明归属。
 * 意图：列表说明和详情导航共用同一关系判定。
 * 约束：只认同人物且类型匹配的已读父级；未命中不升级为全局不存在。
 */
export function residenceParent<T extends ResidenceReadingItem>(item: T, allItems: readonly T[]): T | undefined {
  const expected = item.kind === 'space' ? 'residence' : item.kind === 'object' ? 'space' : undefined
  return expected ? allItems.find(parent => parent.id === item.parentId && parent.ownerId === item.ownerId && parent.kind === expected) : undefined
}

/** 背景：家居由显式资产关系组成，候选与正式页需要相同的轻层级和单条阅读。
 * 意图：只组织已读记录；搜索后仍用完整已读范围判断父级，详情由所属容器提供。
 * 约束：不按名称归置、不跨人物嵌套，不把未知类型或陈列字段当成正常状态，返回恢复同一条焦点。
 */
export function ResidenceReading<T extends ResidenceReadingItem>({ items, allItems, selectedId, query, onSelect, renderDetail, afterList }: {
  items: readonly T[]; allItems: readonly T[]; selectedId?: string; query: string; onSelect: (id: string | undefined) => void; renderDetail: (item: T) => ReactNode; afterList?: ReactNode
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const detail = useRef<HTMLElement>(null)
  const selected = allItems.find(item => item.id === selectedId)
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedId, Boolean(selected)])
  const row = (item: T) => {
    const parent = residenceParent(item, allItems)
    const wrongType = !parent && Boolean(item.parentId && allItems.some(target => target.id === item.parentId && target.ownerId === item.ownerId))
    return <article className="debug-home-entry" key={item.id} data-record-id={item.id}>
      <ActionButton ref={node => { if (node) buttons.current.set(item.id, node); else buttons.current.delete(item.id) }} variant="plain" style={{ color: 'var(--text-primary)' }} className="debug-home-name" aria-label={item.title} aria-expanded={selectedId === item.id} onClick={() => onSelect(item.id)}>{item.title}</ActionButton>
      {item.description && <p className="debug-home-description">{item.description.slice(0, 90)}{item.description.length > 90 ? '…' : ''}</p>}
      <p className="debug-home-meta">{item.kind === 'object' && <span>{item.displayIssue || (item.displayInHome === undefined ? '陈列标记未记录' : item.displayInHome ? '标记为陈列' : '未陈列')}</span>}{item.parentIssue ? <span>{item.parentIssue}</span> : item.parentId && !parent ? <span>{wrongType ? '父级类型不符，未建立归属' : '父级未在当前已读范围'}</span> : null}{query && parent && <span>归属：{parent.title}</span>}{!item.parentId && !item.parentIssue && item.kind === 'object' && <span>未归置</span>}{item.kind === 'unknown' && <span>未知记录类型，原始字段保留</span>}{item.notice && <span>{item.notice}</span>}{item.ownerLabel && <span>{item.ownerLabel}</span>}</p>
    </article>
  }
  const used = new Set<string>()
  const homes = items.filter(item => item.kind === 'residence').map(home => {
    used.add(home.id)
    const spaces = items.filter(item => item.kind === 'space' && item.parentId === home.id && item.ownerId === home.ownerId)
    return <section key={home.id} className="debug-home-residence">{row(home)}{spaces.map(space => {
      used.add(space.id)
      const objects = items.filter(item => item.kind === 'object' && item.parentId === space.id && item.ownerId === space.ownerId)
      objects.forEach(item => used.add(item.id))
      return <section className="debug-home-space" key={space.id}>{row(space)}<div className="debug-home-objects">{objects.map(row)}</div></section>
    })}</section>
  })
  const independent = items.filter(item => !used.has(item.id))
  return <>
    {items.length > 0 && <div className="debug-home-list" data-reading-layout="home">{homes}{independent.length > 0 && <section><h3>其他已读记录</h3>{independent.map(row)}</section>}</div>}
    {afterList}
    {selected && <article key={selected.id} ref={detail} className="debug-home-detail" aria-label="领域证据详情">
      <ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => buttons.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} />返回列表</ActionButton><h3>{selected.title}</h3>
      {renderDetail(selected)}
    </article>}
  </>
}

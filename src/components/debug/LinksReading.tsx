import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

export const LINK_TARGET_TYPES = [{ id: 'all', label: '全部类型' }, { id: 'asset', label: '资产' }, { id: 'image', label: '图片' }, { id: 'cast', label: '卡司' }, { id: 'person', label: '人物' }, { id: 'unknown', label: '未识别' }]
const compactId = (id: string) => id.length > 36 ? `${id.slice(0, 20)}…${id.slice(-8)}` : id
const targetLabel = (type: string) => LINK_TARGET_TYPES.find(item => item.id === type && !['all', 'unknown'].includes(item.id))?.label ?? '未识别'
export interface LinksReadingItem { id: string; ownerId: string; eventId: string; targetId: string; targetType: string; relation: string; title: string; metadata: Record<string, unknown> | null; truncated: boolean }

/** 背景：一条关联边不是完整故事，保存名称也不是已解析的当前实体名。
 * 意图：正式与候选共用事件分组和单边阅读，完整 ID 与元数据可按需核对。
 * 约束：分组包含人物作用域，未记录来源不合并成同一事件；不推断目标删除，不自动生成预览或跳转。
 */
export function LinksReading<T extends LinksReadingItem>({ items, allItems, selectedId, onSelect, afterList, renderDetail }: {
  items: readonly T[]; allItems: readonly T[]; selectedId?: string; onSelect: (id: string | undefined) => void; afterList?: ReactNode; renderDetail: (item: T) => ReactNode
}) {
  const rows = useRef(new Map<string, HTMLButtonElement>())
  const detail = useRef<HTMLElement>(null)
  const selected = allItems.find(item => item.id === selectedId)
  const groups = new Map<string, T[]>()
  for (const item of items) { const key = JSON.stringify([item.ownerId, item.eventId ? 'event' : 'unassigned', item.eventId || item.id]); groups.set(key, [...groups.get(key) ?? [], item]) }
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedId, Boolean(selected)])
  return <>
    {items.length > 0 && <div className="debug-links-list">{Array.from(groups).map(([key, entries]) => <section key={key} data-event-key={entries[0].eventId || `unassigned:${entries[0].id}`}><h3>来源事件 · <code title={entries[0].eventId}>{compactId(entries[0].eventId || '未记录')}</code></h3>{entries.map(item => <article key={item.id} className="debug-links-row" data-record-id={item.id}><ActionButton ref={node => { if (node) rows.current.set(item.id, node); else rows.current.delete(item.id) }} variant="plain" className="debug-links-name" style={{ color: 'var(--text-primary)' }} aria-label={item.title} aria-expanded={selectedId === item.id} onClick={() => onSelect(item.id)}>{item.title}</ActionButton><p className="debug-links-meta">目标{targetLabel(item.targetType)} · <code title={item.targetId}>{compactId(item.targetId || '未记录')}</code></p>{!item.metadata && <p className="debug-links-state">元数据不是对象，原始值保留。</p>}{item.truncated && <p className="debug-links-state">此关联读取有截断，元数据不保证完整。</p>}</article>)}</section>)}</div>}
    {afterList}
    {selected && <article key={selected.id} ref={detail} className="debug-links-detail" aria-label="领域证据详情"><ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => rows.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} />返回列表</ActionButton><h3>{selected.title}</h3>{!selected.metadata && <p className="debug-links-state">元数据不是对象，原始值保留。</p>}<dl className="debug-links-edge"><dt>来源事件</dt><dd><code>{selected.eventId || '未记录'}</code></dd><dt>目标标识</dt><dd><code>{selected.targetId || '未记录'}</code></dd><dt>已保存关系</dt><dd>{selected.relation || '未记录'} · {targetLabel(selected.targetType)}</dd></dl>{selected.truncated && <p className="debug-links-state">以下仅含已返回资料，不能认定元数据完整。</p>}{typeof selected.metadata?.name === 'string' && <section><h4>保存名称</h4><p className="debug-links-body">{selected.metadata.name}</p></section>}{typeof selected.metadata?.note === 'string' && <section><h4>关联备注</h4><p className="debug-links-body">{selected.metadata.note}</p></section>}
      {renderDetail(selected)}
    </article>}
  </>
}

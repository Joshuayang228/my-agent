import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

export const CULTURE_CATEGORIES = [{ id: 'all', label: '全部' }, { id: 'reading', label: '书籍' }, { id: 'film', label: '影视' }, { id: 'music', label: '音乐' }, { id: 'photography', label: '摄影' }, { id: 'unknown', label: '未识别' }]
export interface CultureReadingItem {
  id: string; title: string; type: string; status: string; creator: string; archived: boolean; truncated: boolean; issue: string | null; body: string
  notesIssue: boolean; emptyNotes: string; notes: Array<{ id: string; text: string; at: string; page?: number; chapter?: string }>
}

/** 背景：文化记录类型不同，作品说明与多条笔记不能被通用摘要替代。
 * 意图：正式与候选共用名称 / 状态清单和完整正文，保留独立笔记及其时间含义。
 * 约束：归档不静默过滤，坏 / 空笔记数组不回退旧 note，收录时间不补体验或笔记时间。
 */
export function CultureReading<T extends CultureReadingItem>({ items, allItems, category, selectedId, onSelect, afterList, renderDetail }: {
  items: readonly T[]; allItems: readonly T[]; category: string; selectedId?: string; onSelect: (id: string | undefined) => void; afterList?: ReactNode; renderDetail: (item: T) => ReactNode
}) {
  const rows = useRef(new Map<string, HTMLButtonElement>())
  const detail = useRef<HTMLElement>(null)
  const selected = allItems.find(item => item.id === selectedId)
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedId, Boolean(selected)])
  return <>
    {items.length > 0 && <div className="debug-culture-list">{items.map(item => <article key={item.id} className="debug-culture-row" data-record-id={item.id}><ActionButton ref={node => { if (node) rows.current.set(item.id, node); else rows.current.delete(item.id) }} variant="plain" className="debug-culture-name" style={{ color: 'var(--text-primary)' }} aria-label={item.title} aria-expanded={selectedId === item.id} onClick={() => onSelect(item.id)}>{item.title}</ActionButton><p className="debug-culture-meta">{[category === 'all' ? CULTURE_CATEGORIES.find(value => value.id === item.type)?.label : '', item.status, item.creator, item.archived ? '已归档记录' : ''].filter(Boolean).join(' · ')}</p>{(item.truncated || item.issue || item.notesIssue) && <p className="debug-culture-state">{item.truncated ? '记录读取有截断，原始资料不保证完整。' : item.notesIssue ? '笔记结构异常，详情保留原始资料。' : '资料进度不一致，详情保留原始资料。'}</p>}</article>)}</div>}
    {afterList}
    {selected && <article key={selected.id} ref={detail} className="debug-culture-detail" aria-label="领域证据详情"><ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => rows.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} />返回列表</ActionButton><h3>{selected.title}</h3><p className="debug-culture-meta">{selected.status}{selected.creator && ` · ${selected.creator}`}</p>{selected.issue && <p className="debug-culture-state">资料不完整：{selected.issue}</p>}{selected.truncated && <p className="debug-culture-state">以下仅含已返回资料，不能认定为完整作品与笔记。</p>}<p className="debug-culture-body">{selected.body || '本记录未提供作品说明或感受正文。'}</p>
      {selected.type === 'reading' && <section className="debug-culture-notes"><h4>阅读笔记</h4>{selected.notesIssue ? <p className="debug-culture-state">笔记结构无效；保留原始数据，不用旧笔记替代。</p> : selected.notes.length ? <><p className="debug-culture-meta">{selected.notes.length} 条已读笔记</p>{selected.notes.map(note => <section key={note.id} data-note-id={note.id}><p className="debug-culture-meta">{note.at}{note.page !== undefined && ` · 第 ${note.page} 页`}{note.chapter && ` · ${note.chapter}`}</p><p className="debug-culture-body">{note.text}</p></section>)}</> : <p className="debug-culture-meta">{selected.emptyNotes}</p>}</section>}
      {renderDetail(selected)}
    </article>}
  </>
}

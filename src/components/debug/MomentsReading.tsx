import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import type { MomentCastInteractionView } from '../../shared/moment-user-interactions'

export interface MomentsReadingItem {
  id: string; text: string; preview: string; publishedAt: string; sortTime: number; location: string; truncated: boolean
  cast: MomentCastInteractionView[]; castIssue?: string; userIssue?: string
  userInteractions?: Array<{ actor: string; kind: string; at: string; text: string }>
}

/** 背景：动态正文、发布事实和两类互动曾混在通用卡，难以分清资料来源。
 * 意图：正式页与候选共用正文预览、单条阅读及分来源互动，原始证据由外层提供。
 * 约束：发布不证明活动完成；互动未知 / 空范围分开，不写赞评、不补图片或全量统计。
 */
export function MomentsReading<T extends MomentsReadingItem>({ items, allItems, selectedId, onSelect, afterList, renderDetail }: {
  items: readonly T[]; allItems: readonly T[]; selectedId?: string; onSelect: (id: string | undefined) => void; afterList?: ReactNode; renderDetail: (item: T) => ReactNode
}) {
  const rows = useRef(new Map<string, HTMLButtonElement>())
  const detail = useRef<HTMLElement>(null)
  const selected = allItems.find(item => item.id === selectedId)
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedId, Boolean(selected)])
  return <>
    {items.length > 0 && <div className="debug-moments-list">{items.slice().sort((a, b) => b.sortTime - a.sortTime || b.id.localeCompare(a.id)).map(item => <article key={item.id} className="debug-moments-row" data-record-id={item.id}><ActionButton ref={node => { if (node) rows.current.set(item.id, node); else rows.current.delete(item.id) }} className="debug-moments-preview" style={{ color: 'var(--text-primary)' }} variant="plain" aria-label={`查看动态：${item.preview}`} aria-expanded={selectedId === item.id} onClick={() => onSelect(item.id)}>{item.preview}</ActionButton><p className="debug-moments-meta">发布：{item.publishedAt}{item.location && ` · ${item.location}`}</p>{item.truncated && <p className="debug-moments-state">此记录已被读取边界截断，正文和互动均不保证完整。</p>}</article>)}</div>}
    {afterList}
    {selected && <article key={selected.id} ref={detail} className="debug-moments-detail" aria-label="领域证据详情"><ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => rows.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} />返回列表</ActionButton><h3>动态正文</h3><p className="debug-moments-body">{selected.text || '此动态正文为空；未补事件文案。'}</p><p className="debug-moments-meta">发布：{selected.publishedAt}。发布不证明活动完成。</p>{selected.truncated && <p className="debug-moments-state">记录读取有截断；以下仅含本次已返回内容，互动总数未知。</p>}
      <details className="debug-prompt-provenance debug-moments-interactions"><summary>互动记录</summary>
        <section><h4>卡司投影</h4>{selected.cast.length ? selected.cast.map((entry, index) => <div key={index} className="debug-moments-interaction"><p className="debug-moments-meta">{entry.castName} · {entry.kind === 'coframe' ? '同框记录' : '评论'}</p>{entry.kind === 'comment' && <p className="debug-moments-body">{entry.text || '评论正文未提供'}</p>}</div>) : <p className="debug-moments-meta">未记录可识别的卡司互动。</p>}{selected.castIssue && <p className="debug-moments-state">{selected.castIssue}</p>}</section>
        <section><h4>用户保存的互动</h4>{selected.userIssue && <p className="debug-moments-state">{selected.userIssue}</p>}{selected.userInteractions === undefined ? <p className="debug-moments-meta">本次查询未提供用户互动，数量未知。</p> : selected.userInteractions.length ? selected.userInteractions.map((entry, index) => <div key={index} className="debug-moments-interaction"><p className="debug-moments-meta">{entry.actor} · {entry.kind} · {entry.at}</p>{entry.text && <p className="debug-moments-body">{entry.text}</p>}</div>) : <p className="debug-moments-meta">本次已读范围没有用户互动。</p>}</section>
        <p className="debug-moments-meta">卡司投影与用户保存记录分开；不据此推断关系或全量互动数。</p>
      </details>
      {renderDetail(selected)}
    </article>}
  </>
}

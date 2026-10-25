import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

export interface GrowthReadingItem {
  id: string; key: string; title: string; kind: 'current' | 'default' | 'history' | 'reflection' | 'unknown'; body: string; version?: number
  at: string; sortTime: number; summary: string; lastRunAt: string; issue?: string
  runs: Array<{ at: string; sortTime: number; changed?: boolean; summary: string }>
}

/** 背景：成长覆盖和反思同用人物 ID，普通 ID 选择会把结果混成一份。
 * 意图：共享当前正文、历史清单与反思摘要阅读，详情按来源身份选中。
 * 约束：不从摘要推断门闸或隐藏思维，空覆盖不回退默认正文，刷新同来源保留展开。
 */
export function GrowthReading<T extends GrowthReadingItem>({ items, selectedKey, onSelect, reflectionIssue, afterHistory, renderDetail }: {
  items: readonly T[]; selectedKey?: string; onSelect: (key: string | undefined) => void; reflectionIssue?: string; afterHistory?: ReactNode; renderDetail: (item: T) => ReactNode
}) {
  const rows = useRef(new Map<string, HTMLButtonElement>())
  const detail = useRef<HTMLElement>(null)
  const selected = items.find(item => item.key === selectedKey)
  const current = items.filter(item => item.kind === 'current' || item.kind === 'default')
  const history = items.filter(item => item.kind === 'history').sort((a, b) => b.sortTime - a.sortTime || (b.version ?? 0) - (a.version ?? 0) || a.key.localeCompare(b.key))
  const reflections = items.filter(item => item.kind === 'reflection')
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedKey, Boolean(selected)])
  const name = (item: T) => <ActionButton ref={node => { if (node) rows.current.set(item.key, node); else rows.current.delete(item.key) }} variant="plain" className="debug-growth-name" style={{ color: 'var(--text-primary)' }} aria-label={item.title} aria-expanded={selectedKey === item.key} onClick={() => onSelect(item.key)}>{item.title}</ActionButton>
  return <>
    {current.map(item => <section key={item.key} className="debug-growth-current" data-record-id={item.id} data-source-key={item.key}>{name(item)}<p className="debug-growth-body">{item.body ? `${item.body.slice(0, 180)}${item.body.length > 180 ? '…' : ''}` : '当前覆盖正文为空；未改用默认正文。'}</p><p className="debug-growth-meta">{item.kind === 'default' ? '已读 Role Pack 默认定义 · 不是用户覆盖' : `用户成长覆盖 · v${item.version ?? '未记录'} · ${item.at}`}{item.body.length > 180 && ' · 正文预览，完整正文在详情'}</p></section>)}
    <section className="debug-growth-history"><h3>已保存版本</h3>{history.length ? <><p className="debug-growth-meta">{history.length} 项已读历史 · 总数未知</p>{history.map(item => <article className="debug-growth-row" key={item.key} data-record-id={item.id} data-source-key={item.key}>{name(item)}<p className="debug-growth-meta">{item.at} · {item.summary || '摘要未提供'}</p></article>)}</> : <p className="debug-growth-meta">当前已读范围没有历史版本。</p>}{afterHistory}</section>
    <section className="debug-growth-reflection"><h3>反思结果</h3>{reflectionIssue && <p className="debug-growth-state" role="status">{reflectionIssue}</p>}{reflections.map(item => <article className="debug-growth-row" key={item.key} data-record-id={item.id} data-source-key={item.key}>{name(item)}<p className="debug-growth-meta">最后运行：{item.lastRunAt}</p><p className="debug-growth-summary">{item.runs.slice().sort((a, b) => a.sortTime - b.sortTime).at(-1)?.summary || '已读取反思状态，未保存运行结果。'}</p>{item.issue && <p className="debug-growth-state">{item.issue}</p>}</article>)}{!reflectionIssue && !reflections.length && <p className="debug-growth-meta">当前已读范围没有反思状态。</p>}</section>
    {items.filter(item => item.kind === 'unknown').map(item => <article key={item.key} className="debug-growth-row" data-record-id={item.id} data-source-key={item.key}>{name(item)}<p className="debug-growth-state">来源未识别，原始记录保留。</p></article>)}
    {selected && <article key={selected.key} ref={detail} className="debug-growth-detail" aria-label="领域证据详情"><ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => rows.current.get(selected.key)?.focus()) }}><ArrowLeft size={14} />返回列表</ActionButton><h3>{selected.title}</h3>
      {selected.kind === 'reflection' ? <><p className="debug-growth-meta">只读已保存的结果，不是隐藏思维；不据此推断当前门闸。</p>{selected.issue && <p className="debug-growth-state">{selected.issue}</p>}{selected.runs.slice().sort((a, b) => b.sortTime - a.sortTime).map((run, index) => <section key={index}><p className="debug-growth-meta">{run.at} · {run.changed === undefined ? '变更状态未记录' : run.changed ? '覆盖已变更' : '未改变'}</p><p className="debug-growth-body">{run.summary || '摘要未提供'}</p></section>)}</> : <p className="debug-growth-body">{selected.body || '该记录正文为空；未补默认正文。'}</p>}
      {renderDetail(selected)}
    </article>}
  </>
}

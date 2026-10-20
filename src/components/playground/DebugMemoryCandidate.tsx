import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { DEBUG_EVIDENCE_PAGES, type DebugEvidencePageId } from './debug-evidence-fixtures'
import { DEBUG_ROLES } from './debug-experience-fixtures'

export type MemoryPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'long' | 'missing' | 'unknown-time' | 'paged' | 'partial' | 'invalid' | 'truncated'
interface MemoryRecord { id: string; role: string; category: string; content: string; updatedAt?: number; scope: string }
interface Props { empty?: boolean; previewState: MemoryPreviewState; snapshotState: MemoryPreviewState; initialSelectedId?: string; onRetry: () => void; onPage: (page: DebugEvidencePageId) => void }

const MEMORY_FIXTURES: readonly MemoryRecord[] = [
  { id: 'demo-memory-lin', role: 'lin', category: 'feedback', content: '【记忆样张】用户明确表示希望先听短结论，再查看依据。', updatedAt: Date.parse('2026-10-13T14:30:00+08:00'), scope: '人物分桶 · 林' },
  { id: 'demo-memory-shared', role: '', category: 'preference', content: '【共享记忆样张】用户希望日常交流使用简体中文。', updatedAt: Date.parse('2026-10-13T14:29:00+08:00'), scope: '显式共享' },
  { id: 'demo-memory-yu', role: 'yu', category: 'preference', content: '【记忆样张】用户与予交流时希望先浏览资料目录。', updatedAt: Date.parse('2026-10-13T14:28:00+08:00'), scope: '人物分桶 · 予' },
  { id: 'demo-memory-identity', role: '', category: 'identity', content: '【身份样张】用户正在整理长期旅行资料。', updatedAt: Date.parse('2026-10-13T14:27:00+08:00'), scope: '全局' },
]
const CATEGORY_LABELS: Record<string, string> = { identity: '身份与事实', fact: '身份与事实', workflow: '协作方式', feedback: '协作方式', voice: '表达偏好', preference: '表达偏好' }

/**
 * 背景：旧记忆页把样张当作画像摘要，无法区分共享与人物反馈。
 * 意图：先显示真实记忆条目，再按类别、范围和更新时间查看原文。
 * 约束：共享条目不复制到人物桶；缺失、截断和凭据过滤只按读取契约表达，不推断实际注入。
 */
export function DebugMemoryCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onPage }: Props) {
  const [role, setRole] = useState('lin')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [moreLoaded, setMoreLoaded] = useState(false)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const detailRef = useRef<HTMLElement>(null)
  const state = previewState === 'refresh-error' ? snapshotState : previewState
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  useEffect(() => setMoreLoaded(false), [state, role, category])
  useEffect(() => { if (selectedId) detailRef.current?.scrollIntoView({ block: 'start' }) }, [selectedId])
  let entries = empty ? [] : [...MEMORY_FIXTURES]
  if (state === 'partial') entries = entries.filter(entry => entry.id !== 'demo-memory-identity')
  if (state === 'unknown-time') entries = entries.map(entry => ({ ...entry, updatedAt: undefined }))
  if (state === 'long') entries = entries.map(entry => entry.id === 'demo-memory-lin' ? { ...entry, content: '【长记忆正文样张】保留用户原始表达、适用范围、确认时间和例外说明，不把长期记忆改写成人物设定。\n\n'.repeat(55) } : entry)
  if (state === 'invalid') entries = entries.map(entry => entry.id === 'demo-memory-lin' ? { ...entry, content: '【结构异常样张】原始内容仍保留，解析字段不完整。' } : entry)
  const scoped = entries.filter(entry => entry.role === '' || entry.role === role).filter(entry => category === 'all' || CATEGORY_LABELS[entry.category] === CATEGORY_LABELS[category]).filter(entry => `${entry.id} ${entry.category} ${entry.content}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const records = state === 'paged' && !moreLoaded && !initialSelectedId ? scoped.slice(0, 2) : scoped
  const selected = records.find(entry => entry.id === selectedId)
  const missing = state === 'missing' || Boolean(initialSelectedId && !selected)
  const close = () => { setSelectedId(undefined); requestAnimationFrame(() => selectedId && buttons.current.get(selectedId)?.focus()) }
  const row = (entry: MemoryRecord) => <div className="debug-memory-row" data-record-id={entry.id} key={entry.id}><ActionButton ref={node => { if (node) buttons.current.set(entry.id, node); else buttons.current.delete(entry.id) }} variant="plain" className="debug-memory-text" style={{ color: 'var(--text-primary)' }} aria-expanded={selectedId === entry.id} onClick={() => setSelectedId(entry.id)}>{entry.content.length > 180 ? `${entry.content.slice(0, 180)}…` : entry.content}<ChevronRight size={13} /></ActionButton><p className="debug-memory-caption">{CATEGORY_LABELS[entry.category] ?? entry.category} · {entry.scope}{entry.updatedAt ? ` · ${new Date(entry.updatedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}` : ' · 时间未记录'}</p></div>
  return <section className="debug-memory-workbench" data-testid="debug-evidence-memories">
    <div className="debug-memory-toolbar"><label>范围<SelectField aria-label="记忆人物范围" value={role} disabled={!available} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setRole(event.target.value); setSelectedId(undefined) }}><option value="lin">林 · 样张</option><option value="yu">予 · 样张</option></SelectField></label><label>类别<SelectField aria-label="记忆类别" value={category} disabled={!available} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setCategory(event.target.value); setSelectedId(undefined) }}><option value="all">全部类别</option><option value="identity">身份与事实</option><option value="workflow">协作方式</option><option value="voice">表达偏好</option></SelectField></label><TextField appearance="outlined" aria-label="搜索记忆" placeholder="搜索已读记忆" value={query} disabled={!available} onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setSelectedId(undefined) }} /></div>
    {!available ? <div className="debug-memory-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '记忆尚未读取' : previewState === 'loading' ? '正在读取记忆…' : previewState === 'unavailable' ? '需要桌面诊断连接才能读取记忆。' : '记忆读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取记忆样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-memory-state" role="alert"><p>刷新失败，保留原范围、筛选、选中和已读记录；下方不是最新记忆。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {state === 'partial' && <p className="debug-memory-state" role="status">部分记忆未返回，其余来源保留，不能认定列表完整。</p>}
      {state === 'invalid' && <p className="debug-memory-state" role="status">一条记忆结构异常，原始内容仍保留。</p>}
      {missing && <p className="debug-memory-state" role="status">引用记忆未在当前人物范围返回，未选择其他条目代替。</p>}
      {!records.length ? <p className="debug-memory-state" role="status">当前查询没有已读记忆，不代表系统没有长期记忆。</p> : <><p className="debug-memory-caption">{records.length} 条当前已读记忆 · 总数未知；共享条目会随人物范围保留。</p><div className="debug-memory-list">{['身份与事实', '协作方式', '表达偏好', '其他类别'].map(group => { const groupRows = records.filter(entry => (CATEGORY_LABELS[entry.category] ?? '其他类别') === group); return groupRows.length ? <section key={group} aria-label={group}><h3>{group}</h3>{groupRows.map(row)}</section> : null })}</div></>}
      {records.length < scoped.length && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页记忆样张</ActionButton>}
      {selected && !missing && <article ref={detailRef} className="debug-memory-detail" aria-label="记忆详情"><ActionButton variant="plain" onClick={close}><ArrowLeft size={14} />返回记忆列表</ActionButton><h3>{CATEGORY_LABELS[selected.category] ?? selected.category}</h3><p className="debug-memory-body">{selected.content}</p><p className="debug-memory-caption">{selected.scope} · {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '更新时间未记录'}</p><details className="debug-memory-source"><summary>来源与完整结构</summary><p>来源：memories。含凭据内容由生产读取层排除；存储记录不证明此次已经被模型召回或注入。</p><pre>{JSON.stringify(selected, null, 2)}</pre></details></article>}
      <details className="debug-memory-source"><summary>查询边界与关联入口</summary><p>按人物查询包含显式共享条目；反馈按人物分桶，其他类别仍是全局来源。当前页不改写记忆，不把内容升级为用户画像或人物设定。</p><ActionButton variant="plain" onClick={() => onPage('profile')}>查看用户画像摘要</ActionButton><ActionButton variant="plain" onClick={() => onPage('context')}>查看请求保存范围</ActionButton></details>
    </>}
  </section>
}

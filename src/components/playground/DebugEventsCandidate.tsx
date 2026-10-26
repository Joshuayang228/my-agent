import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { EventReading } from '../debug/EventReading'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'

export type EventsPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'truncated' | 'unknown-time' | 'missing' | 'paged' | 'long'
interface RuntimeEvent { id: string; time?: number; title: string; type: string; status: string; sessionId?: string; spanId?: string; body: string }
interface Props { empty?: boolean; previewState: EventsPreviewState; snapshotState: EventsPreviewState; initialSelectedId?: string; onRetry: () => void; onPage: (page: 'traces' | 'runs') => void; onSpan: (id: string) => void }

const EVENT_FIXTURES: readonly RuntimeEvent[] = [
  { id: 'demo-runtime-asset', time: Date.parse('2026-10-13T14:31:56+08:00'), title: '资产证据已绑定', type: 'asset-usage', status: '已收到', sessionId: 'demo-session-01', spanId: 'demo-span-02', body: '本次调用记录了一个明确的资产使用关联。' },
  { id: 'demo-runtime-error', time: Date.parse('2026-10-13T14:32:08+08:00'), title: '模型服务失败', type: 'llm-error', status: '失败', sessionId: 'demo-session-01', spanId: 'demo-span-03', body: '模型服务暂时不可用，本次请求未获得回复。' },
  { id: 'demo-runtime-unlinked', time: Date.parse('2026-10-13T14:30:00+08:00'), title: '窗口恢复', type: 'window-resumed', status: '已收到', body: '当前事件没有会话或 Span 标识，不能按时间猜测关联调用。' },
]

/** 背景：运行事件是窗口内的有界诊断快照；意图：时间线优先，关联 Span / 调用按显式入口展开。
 * 约束：事件时间不代替执行时间，未关联事件不自动拼接调用链，截断不补全历史。
 */
export function DebugEventsCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onPage, onSpan }: Props) {
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [status, setStatus] = useState('all')
  const [more, setMore] = useState(false)
  const state = previewState === 'refresh-error' ? snapshotState : previewState
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  let events = empty ? [] : [...EVENT_FIXTURES]
  if (state === 'unknown-time') events = events.map(event => ({ ...event, time: undefined }))
  if (state === 'long') events = events.map(event => event.id === 'demo-runtime-error' ? { ...event, title: '【长事件标题样张】'.repeat(20), body: '【长事件正文样张】'.repeat(100) } : event)
  if (state === 'missing') events = events.filter(event => event.id !== 'demo-runtime-asset')
  const loaded = state === 'paged' && !more && !initialSelectedId ? events.slice(0, 2) : events
  const rows = loaded.filter(event => status === 'all' || event.status === status)
  const selected = loaded.find(event => event.id === selectedId)
  const missing = Boolean(initialSelectedId && !selected)
  return <section className="debug-events-workbench" data-testid="debug-evidence-events">
    <div className="debug-events-toolbar"><span>当前窗口事件 · 总数未知</span><label>状态<SelectField aria-label="事件状态筛选" value={status} disabled={!available} onChange={event => { setStatus(event.target.value); setSelectedId(undefined) }}><option value="all">全部</option><option value="已收到">已收到</option><option value="失败">失败</option></SelectField></label></div>
    {!available ? <div className="debug-events-state" role={['error','unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '实时事件尚未读取' : previewState === 'loading' ? '正在读取实时事件…' : previewState === 'unavailable' ? '需要桌面诊断连接才能读取事件。' : '实时事件读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取事件样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-events-state" role="alert"><p>刷新失败，保留原事件、筛选、选中和展开；下方不是最新窗口状态。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {state === 'truncated' && <p className="debug-events-state" role="status">仅展示有界窗口事件，不能证明更早事件不存在。</p>}
      {state === 'missing' && <p className="debug-events-state" role="status">引用事件未在当前窗口返回，未选择其他事件代替。</p>}
      {!rows.length && <p className="debug-events-state" role="status">当前查询没有已读事件，不代表运行时没有发生事件。</p>}
      <EventReading events={rows} allEvents={missing ? [] : loaded} selectedId={selectedId} onSelect={setSelectedId} afterList={loaded.length < events.length && <ActionButton onClick={() => setMore(true)}>读取下一页事件样张</ActionButton>} renderActions={event => event.spanId && <ActionButton variant="plain" onClick={() => onSpan(event.spanId!)}>查看调用链 <ArrowUpRight size={13} /></ActionButton>} />
      <details className="debug-events-source"><summary>来源与诊断边界</summary><p>来源：运行窗口事件快照。事件类型、时间和关联标识分别保留；没有会话或 Span 时不按时间拼接。事件不等于行动完成、永久账本或模型隐藏思维。</p><ActionButton variant="plain" onClick={() => onPage('runs')}>查看调用记录</ActionButton></details>
    </>}
  </section>
}

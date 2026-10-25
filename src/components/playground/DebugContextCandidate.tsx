import { useState } from 'react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { DEBUG_CONTEXT_CALLS } from './debug-context-fixtures'
import { SavedContextContent } from '../debug/SavedContextContent'

export type ContextPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'detail-error' | 'missing' | 'malformed' | 'legacy' | 'long' | 'no-system' | 'truncated' | 'empty-input'
interface Props {
  empty?: boolean; previewState: ContextPreviewState; snapshotState: ContextPreviewState
  initialSelectedId?: string; onRetry: () => void; onRecord: (id: string) => void
}

/**
 * 背景：旧候选把装配预览与历史输入混在一起，真实新日志只留元数据。
 * 意图：调用选择后按消息、工具、参数阅读保存范围，避免重复调用管理台。
 * 约束：全局范围，无人物推断；详情失败不替换调用；不请求 IPC、模型或写盘。
 */
export function DebugContextCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onRecord }: Props) {
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? DEBUG_CONTEXT_CALLS[0].id)
  const [view, setView] = useState('messages')
  const [allMessages, setAllMessages] = useState(false)
  const state = previewState === 'refresh-error' ? snapshotState : previewState
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  const calls = empty ? [] : DEBUG_CONTEXT_CALLS
  const original = calls.find(call => call.id === selectedId)
  const detail = original ? { ...original } : undefined
  if (detail && state === 'malformed') detail.requestMessages = { unexpected: '【结构异常样张】数组未返回' }
  if (detail && state === 'empty-input') { detail.requestMessages = []; detail.requestTools = [] }
  if (detail && state === 'no-system') detail.requestMessages = [{ role: 'user', content: '（正文未持久化）', contentLength: 12 }]
  if (detail && (state === 'legacy' || state === 'long')) detail.requestMessages = [{ role: 'system', content: '【历史内容样张】这是旧记录中返回的虚构文字，不是当前提示词。\n'.repeat(state === 'long' ? 90 : 1), custom: '原字段保留' }]
  const missing = state === 'missing' || Boolean(calls.length && !detail)
  return <section className="debug-context-workbench" data-testid="debug-evidence-context">
    <p className="debug-context-caption">全局调用范围 · 新日志不保存消息正文，当前定义不能还原历史输入。</p>
    {!available ? <div className="debug-context-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '调用清单尚未读取' : previewState === 'loading' ? '正在读取调用清单…' : previewState === 'unavailable' ? '需要桌面诊断连接才能读取调用清单。' : '调用清单读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取上下文样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-context-state" role="alert"><p>刷新失败，保留上次调用、阅读位置及展开内容；不代表最新输入。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {!calls.length ? <p className="debug-context-state" role="status">当前查询没有调用记录。</p> : <>
        <label className="debug-context-picker">调用<SelectField aria-label="选择保存的调用" value={selectedId} onChange={event => { setSelectedId(event.target.value); setAllMessages(false) }}>{!detail && <option value={selectedId}>引用调用未找到</option>}{calls.map(call => <option key={call.id} value={call.id}>{new Date(call.startedAt).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })} · {call.caller} · {call.model} · {call.id}</option>)}</SelectField></label>
        {missing ? <p className="debug-context-state" role="status">引用调用未返回详情，未选择其他调用代替。</p> : state === 'detail-error' ? <div className="debug-context-state" role="alert"><p>选中调用的详情读取失败；清单仍可选择。</p><ActionButton onClick={onRetry}>重试详情样张</ActionButton></div> : detail && <SavedContextContent key={detail.id} detail={detail} view={view} onViewChange={setView} allMessages={allMessages} onShowAll={() => setAllMessages(true)} onRecord={onRecord} truncated={state === 'truncated'} />}
      </>}
    </>}
  </section>
}

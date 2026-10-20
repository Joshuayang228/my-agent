import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TabStrip } from '../foundation/TabStrip'
import { DEBUG_CONTEXT_CALLS, messageScope, savedMessages } from './debug-context-fixtures'

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
  const messages = detail ? savedMessages(detail.requestMessages) : null
  const shown = allMessages || !messages || messages.length <= 8 ? messages : [messages[0], ...messages.slice(-7)]
  const missing = state === 'missing' || Boolean(calls.length && !detail)
  return <section className="debug-context-workbench" data-testid="debug-evidence-context">
    <p className="debug-context-caption">全局调用范围 · 新日志不保存消息正文，当前定义不能还原历史输入。</p>
    {!available ? <div className="debug-context-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '调用清单尚未读取' : previewState === 'loading' ? '正在读取调用清单…' : previewState === 'unavailable' ? '需要桌面诊断连接才能读取调用清单。' : '调用清单读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取上下文样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-context-state" role="alert"><p>刷新失败，保留上次调用、阅读位置及展开内容；不代表最新输入。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {!calls.length ? <p className="debug-context-state" role="status">当前查询没有调用记录。</p> : <>
        <label className="debug-context-picker">调用<SelectField aria-label="选择保存的调用" value={selectedId} onChange={event => { setSelectedId(event.target.value); setAllMessages(false) }}>{!detail && <option value={selectedId}>引用调用未找到</option>}{calls.map(call => <option key={call.id} value={call.id}>{new Date(call.startedAt).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })} · {call.caller} · {call.model} · {call.id}</option>)}</SelectField></label>
        {missing ? <p className="debug-context-state" role="status">引用调用未返回详情，未选择其他调用代替。</p> : state === 'detail-error' ? <div className="debug-context-state" role="alert"><p>选中调用的详情读取失败；清单仍可选择。</p><ActionButton onClick={onRetry}>重试详情样张</ActionButton></div> : detail && <article aria-label="上下文保存范围" className="debug-context-detail" key={detail.id}>
          <div className="debug-context-heading"><code>{detail.id}</code><ActionButton variant="plain" onClick={() => onRecord(detail.id)}>查看这次调用</ActionButton></div>
          {state === 'truncated' && <p className="debug-context-state">历史保留范围有界，不代表全部调用历史；不补齐未保存内容。</p>}
          <TabStrip label="上下文内容" variant="underline" items={[{ id: 'messages', label: '消息' }, { id: 'tools', label: '工具' }, { id: 'extra', label: '请求参数' }]} activeId={view} onSelect={setView} />
          {view === 'messages' && <section aria-label="保存的消息">
            {messages === null ? <p className="debug-context-state">消息结构不是数组；原始值保留在来源中，不显示为零条消息。</p> : <>
              <p className="debug-context-caption">{messages.length} 条已保存消息结构{!messages.some(message => message.role === 'system') ? ' · 未返回独立 System 消息' : ''}</p>
              {messages.length > (shown?.length ?? 0) && <ActionButton variant="plain" onClick={() => setAllMessages(true)}>显示其余 {messages.length - (shown?.length ?? 0)} 条消息</ActionButton>}
              {shown?.map((message, index) => <details key={index} className="debug-context-message"><summary><ChevronRight size={13} className="debug-context-chevron" /><span>{messages.indexOf(message) + 1} · {typeof message.role === 'string' ? message.role : 'unknown'}</span><span>{messageScope(message)}</span></summary>{typeof message.content === 'string' && message.content !== '（正文未持久化）' && <p className="debug-context-body">{message.content || '（已保存空字符串）'}</p>}<details><summary>完整消息结构</summary><pre>{JSON.stringify(message, null, 2)}</pre></details></details>)}
            </>}
          </section>}
          {view === 'tools' && <section aria-label="保存的工具"><p className="debug-context-caption">仅为当次日志保存的工具定义，不代表当前可执行权限。</p>{Array.isArray(detail.requestTools) && !detail.requestTools.length ? <p>已保存工具列表为空。</p> : <pre className="debug-context-json">{JSON.stringify(detail.requestTools, null, 2)}</pre>}</section>}
          {view === 'extra' && <section aria-label="保存的请求参数"><p className="debug-context-caption">仅为已保存参数，不用当前配置或当前资产正文补写历史。</p><pre className="debug-context-json">{JSON.stringify(detail.requestExtra, null, 2)}</pre></section>}
          <details className="debug-context-source"><summary>来源与完整保存结构</summary><p>来源为 llm_debug_logs 的保存投影。消息正文占位、长度和工具定义各有保存范围；空数组也可能来自读取回退，不能据此证明请求未携带输入。当前编译预览与历史请求不同。</p><p>调用者：{detail.caller} · 模型：{detail.model} · 会话：{detail.sessionId || '未记录'}</p><pre>{JSON.stringify({ id: detail.id, requestMessages: detail.requestMessages, requestTools: detail.requestTools, requestExtra: detail.requestExtra }, null, 2)}</pre></details>
        </article>}
      </>}
    </>}
  </section>
}

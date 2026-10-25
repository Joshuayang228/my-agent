import { useEffect, useRef, useState } from 'react'
import type { LLMCallDetail, LLMCallSummary } from '../../shared/types'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { SavedContextContent } from './SavedContextContent'

/** 背景：正式上下文复用调用管理台，重复操作和技术筛选淹没输入阅读。
 * 意图：仅通过既有只读日志接口加载有界清单与选中详情，共用已批准的候选阅读结构。
 * 约束：全局范围不依赖人物；刷新失败保留成功快照，迟到响应不跨选择，缺失 ID 不选其他调用代替。
 */
export function ContextInspectorPanel({ revision = 0, onRecord }: { revision?: number; onRecord: (id: string) => void }) {
  const [calls, setCalls] = useState<LLMCallSummary[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<LLMCallDetail | null>(null)
  const [view, setView] = useState('messages')
  const [allMessages, setAllMessages] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [reload, setReload] = useState(0)
  const [detailRevision, setDetailRevision] = useState(0)
  const selectedRef = useRef('')

  useEffect(() => {
    let current = true
    const debug = window.electronAPI?.debug
    if (!debug?.llmLogsQuery) { setError('需要桌面诊断连接才能读取调用清单。'); return }
    setLoading(true); setError('')
    debug.llmLogsQuery({ limit: 40, order: 'desc' }).then(result => {
      if (!current) return
      setCalls(result.records)
      if (!selectedRef.current) {
        selectedRef.current = result.records[0]?.id ?? ''
        setSelectedId(selectedRef.current)
      }
      setDetailRevision(value => value + 1)
    }).catch(() => { if (current) setError('调用清单读取失败；已有调用与阅读状态保留。') }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [revision, reload])

  useEffect(() => {
    if (!selectedId) return
    let current = true
    setDetailLoading(true); setDetailError('')
    window.electronAPI.debug.llmLogGet(selectedId).then(next => {
      if (current) setDetail(next)
    }).catch(() => { if (current) setDetailError('选中调用的详情读取失败；如有旧内容则保留，清单仍可选择。') }).finally(() => { if (current) setDetailLoading(false) })
    return () => { current = false }
  }, [selectedId, detailRevision])

  const selected = detail?.id === selectedId ? detail : null
  return <section className="debug-context-workbench" data-testid="debug-evidence-context">
    <p className="debug-context-caption">全局调用范围 · 新日志不保存消息正文，当前定义不能还原历史输入。</p>
    {error && <div className="debug-context-state" role="alert"><p>{error}</p><ActionButton onClick={() => setReload(value => value + 1)}>重试读取调用清单</ActionButton></div>}
    {loading && <p className="debug-context-state" role="status">正在读取调用清单…</p>}
    {calls && <>
      <p className="debug-context-caption">{calls.length} 条已读调用 · 最多 40 条，不代表全部调用历史。</p>
      {!calls.length && !selectedId ? <p className="debug-context-state" role="status">当前查询没有调用记录。</p> : <>
        <label className="debug-context-picker">调用<SelectField aria-label="选择保存的调用" value={selectedId} onChange={event => { selectedRef.current = event.target.value; setSelectedId(event.target.value); setAllMessages(false) }}>
          {!calls.some(call => call.id === selectedId) && <option value={selectedId}>引用调用未在当前清单返回 · {selectedId}</option>}
          {calls.map(call => <option key={call.id} value={call.id}>{new Date(call.startedAt).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })} · {call.caller} · {call.model} · {call.id}</option>)}
        </SelectField></label>
        {detailLoading && <p className="debug-context-state" role="status">正在读取选中调用的保存范围…</p>}
        {detailError && <div className="debug-context-state" role="alert"><p>{detailError}</p><ActionButton onClick={() => setDetailRevision(value => value + 1)}>重试详情</ActionButton></div>}
        {!detailLoading && !detailError && !selected && <p className="debug-context-state" role="status">引用调用未返回详情，未选择其他调用代替。</p>}
        {selected && <SavedContextContent key={selected.id} detail={selected} view={view} onViewChange={setView} allMessages={allMessages} onShowAll={() => setAllMessages(true)} onRecord={onRecord} />}
      </>}
    </>}
  </section>
}

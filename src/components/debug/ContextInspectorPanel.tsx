/**
 * Debug 上下文检查器。
 *
 * 背景：即时重组的 System Prompt 预览无法代表某一次真实请求最终发送的 messages。
 * 设计意图：直接读取 llm_debug_logs 的最近调用，把实际 System / messages / tools 作为生产真相。
 * 关键约束：只读；不重新 assemble，不把请求正文写回设置或会话。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import type { LLMCallDetail, LLMCallSummary } from '../../shared/types'
import { formatDebugValue, normalizeDebugMessages } from './debug-format'

type ContextView = 'system' | 'messages' | 'tools' | 'extra'

function callLabel(call: LLMCallSummary): string {
  const time = new Date(call.startedAt).toLocaleString('zh-CN', { hour12: false })
  return `${time} · ${call.caller || 'system'} · ${call.model || 'unknown'}`
}

export function ContextInspectorPanel() {
  const [calls, setCalls] = useState<LLMCallSummary[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<LLMCallDetail | null>(null)
  const [view, setView] = useState<ContextView>('system')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const selectedIdRef = useRef('')

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  const loadCalls = useCallback(async (preserveSelection = true) => {
    const debug = window.electronAPI?.debug
    if (!debug) {
      setError('需要 Electron 环境才能读取真实请求')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await debug.llmLogsQuery({ limit: 40, order: 'desc' })
      setCalls(result.records)
      const currentSelection = selectedIdRef.current
      const currentStillExists = preserveSelection && result.records.some((call) => call.id === currentSelection)
      const nextId = currentStillExists
        ? currentSelection
        : (result.records.find((call) => call.caller === 'main') ?? result.records[0])?.id ?? ''
      setSelectedId(nextId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCalls(false)
    const unsubscribe = window.electronAPI?.debug?.onLLMCallEvent((event) => {
      if (event.type === 'ended' || event.type === 'cleared') void loadCalls(true)
    })
    return unsubscribe
  }, [loadCalls])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    setDetail(null)
    let active = true
    void window.electronAPI?.debug.llmLogGet(selectedId).then((next) => {
      if (active) setDetail(next)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause))
    })
    return () => { active = false }
  }, [selectedId])

  const messages = useMemo(() => normalizeDebugMessages(detail?.requestMessages), [detail])
  const systemMessages = messages.filter((message) => message.role === 'system')
  const tools = Array.isArray(detail?.requestTools) ? detail.requestTools : []
  const views: Array<{ id: ContextView; label: string; count?: number }> = [
    { id: 'system', label: 'System', count: systemMessages.length },
    { id: 'messages', label: '完整消息', count: messages.length },
    { id: 'tools', label: 'Tools', count: tools.length },
    { id: 'extra', label: '请求参数' },
  ]

  const copyCurrent = async () => {
    if (!detail) return
    const value = view === 'system'
      ? systemMessages.map((message) => message.content).join('\n\n')
      : view === 'messages'
        ? formatDebugValue(detail.requestMessages)
        : view === 'tools'
          ? formatDebugValue(detail.requestTools)
          : formatDebugValue(detail.requestExtra)
    await navigator.clipboard?.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="space-y-4" data-testid="context-inspector-panel">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>上下文</h2>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            来自真实 LLM 请求快照；这里展示的是实际发送内容，不是即时重组预览。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCalls(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={13} />
          刷新
        </button>
      </header>

      <select
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
        className="theme-input h-10 w-full rounded-lg border px-3 text-xs"
        aria-label="选择真实 LLM 请求"
      >
        {calls.map((call) => <option key={call.id} value={call.id}>{callLabel(call)}</option>)}
      </select>

      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      {loading && calls.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>读取真实请求中…</p>}
      {!loading && calls.length === 0 && !error && (
        <div className="rounded-lg border p-5 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          暂无 LLM 调用记录。发送一次真实对话后，这里会显示最终请求。
        </div>
      )}

      {detail && (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            <Metric label="调用者" value={detail.caller || 'system'} />
            <Metric label="模型" value={detail.model || 'unknown'} />
            <Metric label="输入 Token" value={String(detail.promptTokens)} />
            <Metric label="请求组成" value={`${messages.length} messages / ${tools.length} tools`} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
            {views.map((item) => {
              const active = view === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium"
                  style={{
                    color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                    background: active ? 'var(--accent-subtle)' : 'transparent',
                  }}
                >
                  {item.label}{item.count !== undefined ? ` ${item.count}` : ''}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => void copyCurrent()}
              className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-[10px]"
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
            >
              <Copy size={11} />
              {copied ? '已复制' : '复制'}
            </button>
          </div>

          {view === 'system' && <MessageList messages={systemMessages} empty="本次请求没有独立 System message。" />}
          {view === 'messages' && <MessageList messages={messages} empty="本次请求没有 messages。" />}
          {view === 'tools' && <JsonBlock value={tools} empty="本次请求未携带工具。" />}
          {view === 'extra' && <JsonBlock value={detail.requestExtra} empty="本次请求没有额外参数。" />}
        </>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="mt-1 truncate font-mono text-xs" style={{ color: 'var(--text-primary)' }} title={value}>{value}</div>
    </div>
  )
}

function MessageList({ messages, empty }: { messages: ReturnType<typeof normalizeDebugMessages>; empty: string }) {
  if (messages.length === 0) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{empty}</p>
  return (
    <div className="space-y-2">
      {messages.map((message, index) => (
        <article key={`${message.id ?? index}-${index}`} className="rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between border-b px-3 py-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="font-mono text-[10px] font-semibold" style={{ color: roleColor(message.role) }}>{message.role}</span>
            <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{message.content.length} chars</span>
          </div>
          <pre className="scrollbar-hover max-h-[46vh] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {message.content || '（空）'}
          </pre>
        </article>
      ))}
    </div>
  )
}

function JsonBlock({ value, empty }: { value: unknown; empty: string }) {
  const text = formatDebugValue(value)
  if (!text || text === '[]' || text === '{}') return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{empty}</p>
  return (
    <pre className="scrollbar-hover max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-[11px] leading-relaxed" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
      {text}
    </pre>
  )
}

function roleColor(role: string): string {
  if (role === 'system') return 'var(--accent)'
  if (role === 'user') return 'var(--warning)'
  if (role === 'assistant') return 'var(--success)'
  return 'var(--text-muted)'
}

/**
 * 对话内 Debug 右侧栏（M32-G7）：LLM 调用链摘要。
 * 与全页 Debug Console 无关；打开后贴在 Chat 右侧。
 *
 * 侧栏只展示一次模型调用一行，流式 text/thinking 等高频事件仍留给全页
 * Debug Console，避免产品侧栏被实现细节淹没。
 */

import { useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Check,
  ChevronRight,
  Copy,
  Download,
  LoaderCircle,
  Trash2,
  X,
} from 'lucide-react'
import type { LLMCallDetail, LLMCallSummary } from '../../shared/types'
import {
  formatDuration,
  formatTokenK,
  type ConversationDebugCall,
} from './conversation-debug'

function splitModel(model: string): { provider: string; name: string } {
  const separator = model.indexOf('/')
  if (separator <= 0) return { provider: 'LLM', name: model }
  return { provider: model.slice(0, separator), name: model.slice(separator + 1) }
}

function StatusIcon({ status }: { status: ConversationDebugCall['status'] }) {
  if (status === 'running') {
    return <LoaderCircle size={12} className="animate-spin" style={{ color: 'var(--warning)' }} />
  }
  if (status === 'error') {
    return <AlertCircle size={12} style={{ color: 'var(--danger)' }} />
  }
  return <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
}

function statusLabel(status: ConversationDebugCall['status']): string {
  if (status === 'running') return '运行中…'
  if (status === 'error') return '失败'
  return '成功'
}

function fromStoredCall(record: LLMCallSummary): ConversationDebugCall {
  return {
    id: record.id,
    startedAt: record.startedAt,
    finishedAt: record.endedAt,
    durationMs: record.durationMs,
    model: record.provider ? `${record.provider}/${record.model}` : record.model,
    caller: record.caller,
    status: record.status === 'pending' ? 'running' : record.status,
    promptTokens: record.promptTokens,
    completionTokens: record.completionTokens,
    toolCount: record.toolCallCount,
    toolNames: [],
    error: record.error,
  }
}

function DetailRow({
  label,
  value,
  multiline = false,
}: {
  label: string
  value: string
  /** 长正文：与元数据同行排版，可滚动，不另起「卡片块」 */
  multiline?: boolean
}) {
  return (
    <div className="flex gap-3 text-[10px] leading-relaxed">
      <span className="w-12 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span
        className={`min-w-0 flex-1 break-all select-text ${multiline ? 'max-h-32 overflow-auto whitespace-pre-wrap scrollbar-hover' : ''}`}
        style={{ color: 'var(--text-secondary)' }}
      >
        {value}
      </span>
    </div>
  )
}

function CallRow({
  call,
  index,
  expanded,
  onToggle,
  detail,
  detailLoading,
}: {
  call: ConversationDebugCall
  index: number
  expanded: boolean
  onToggle: () => void
  detail?: LLMCallDetail | null
  detailLoading: boolean
}) {
  const model = splitModel(call.model)
  const [copied, setCopied] = useState(false)
  const timestamp = new Date(call.startedAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div
      className="border-b transition-colors"
      style={{ borderColor: 'var(--border-subtle)', background: expanded ? 'var(--hover-overlay)' : undefined }}
      data-testid="conversation-debug-call"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-3 py-2 text-left"
      >
        <span className="w-4 shrink-0 pt-0.5 text-right font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {index + 1}
        </span>
        <span className="shrink-0 pt-0.5">
          <StatusIcon status={call.status} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }}
            >
              {call.caller === 'main' ? '主对话' : (call.caller || '辅助调用')}
            </span>
            <ChevronRight
              size={10}
              className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
              style={{ color: 'var(--text-muted)' }}
            />
            <span className="truncate font-mono text-[11px]" style={{ color: 'var(--text-primary)' }} title={call.model}>
              {model.name}
            </span>
            <span className="ml-auto shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>{timestamp}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span>{model.provider}</span>
            {call.status !== 'running' && (
              <>
                <span>·</span>
                <span className="font-mono">
                  ↑{formatTokenK(call.promptTokens)} ↓{formatTokenK(call.completionTokens)}
                </span>
                <span>·</span>
                <span>{formatDuration(call.durationMs)}</span>
              </>
            )}
            {(call.toolCount ?? call.toolNames.length) > 0 && (
              <>
                <span>·</span>
                <span>{call.toolCount ?? call.toolNames.length} 个工具</span>
              </>
            )}
          </span>
        </span>
      </button>

      {expanded && (
        <div
          className="space-y-1.5 border-t px-3 pb-2.5 pl-12 pt-2"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
        >
          <DetailRow label="模型" value={call.model} />
          <DetailRow label="调用者" value={call.caller === 'main' ? '主对话 (main)' : (call.caller || '辅助调用')} />
          <DetailRow label="状态" value={statusLabel(call.status)} />
          {call.status !== 'running' && (
            <>
              <DetailRow label="耗时" value={formatDuration(call.durationMs)} />
              <DetailRow label="输入" value={`${formatTokenK(call.promptTokens)} tokens`} />
              <DetailRow label="输出" value={`${formatTokenK(call.completionTokens)} tokens`} />
            </>
          )}
          {(call.toolCount ?? call.toolNames.length) > 0 && (
            <DetailRow
              label="工具"
              value={call.toolNames.length > 0 ? call.toolNames.join('、') : `${call.toolCount} 次工具调用`}
            />
          )}
          {call.error && (
            <div
              className="mt-1 rounded px-2 py-1.5 text-[10px] leading-relaxed"
              style={{
                color: 'var(--danger)',
                background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--danger) 18%, transparent)',
              }}
            >
              {call.error}
            </div>
          )}
          {detailLoading && <DetailRow label="详情" value="正在读取 Debug 正文…" />}
          {detail && (
            <>
              <DetailRow
                label="请求"
                value={`${Array.isArray(detail.requestMessages) ? detail.requestMessages.length : 0} 条消息 · ${Array.isArray(detail.requestTools) ? detail.requestTools.length : 0} 个工具`}
              />
              {detail.responseReasoning && (
                <DetailRow label="思考" value={detail.responseReasoning} multiline />
              )}
              {detail.responseContent ? (
                <DetailRow label="正文" value={detail.responseContent} multiline />
              ) : detail.status === 'success' && detail.responseReasoning ? (
                <DetailRow label="正文" value="（空 — 可能被 thinking 占满 max_tokens）" />
              ) : null}
              <div className="mt-1 flex gap-1.5">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px]"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                  onClick={() => {
                    void navigator.clipboard?.writeText(JSON.stringify(detail, null, 2)).then(() => {
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 1200)
                    }).catch(() => {})
                  }}
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  {copied ? '已复制' : '复制 JSON'}
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-[10px]"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                  onClick={() => { void window.electronAPI?.debug.llmLogExport(call.id) }}
                >
                  导出 JSON
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function ConversationDebugAside({
  sessionId,
  persistedCalls,
  persistedLoading = false,
  onClose,
}: {
  sessionId?: string | null
  persistedCalls: LLMCallSummary[]
  persistedLoading?: boolean
  onClose: () => void
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [details, setDetails] = useState<Record<string, LLMCallDetail | null>>({})
  const [detailLoadingIds, setDetailLoadingIds] = useState<Set<string>>(() => new Set())
  const storedIds = useMemo(() => new Set(persistedCalls.map((call) => call.id)), [persistedCalls])
  const calls = useMemo(
    () => persistedCalls.map(fromStoredCall),
    [persistedCalls],
  )
  const runningCount = calls.filter((call) => call.status === 'running').length
  const errorCount = calls.filter((call) => call.status === 'error').length
  const totalTokens = calls.reduce(
    (sum, call) => sum + call.promptTokens + call.completionTokens,
    0,
  )
  const totalDuration = calls.reduce((sum, call) => sum + (call.durationMs ?? 0), 0)

  const toggleCall = (id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    if (!expandedIds.has(id) && storedIds.has(id) && details[id] === undefined && !detailLoadingIds.has(id)) {
      setDetailLoadingIds((previous) => new Set(previous).add(id))
      void window.electronAPI?.debug.llmLogGet(id).then((detail) => {
        setDetails((previous) => ({ ...previous, [id]: detail }))
        setDetailLoadingIds((previous) => {
          const next = new Set(previous)
          next.delete(id)
          return next
        })
      }).catch(() => {
        setDetails((previous) => ({ ...previous, [id]: null }))
        setDetailLoadingIds((previous) => {
          const next = new Set(previous)
          next.delete(id)
          return next
        })
      })
    }
  }

  return (
    <aside
      className="flex h-full w-full min-h-0 flex-col select-text"
      style={{ background: 'var(--bg-secondary)' }}
      data-testid="conversation-debug-aside"
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <Activity size={14} style={{ color: 'var(--accent)' }} />
        <span className="flex-1 text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          LLM 调用链
        </span>
        {runningCount > 0 ? (
          <span className="rounded-full px-1.5 py-0.5 font-mono text-[10px]" style={{ color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 14%, transparent)' }}>
            {runningCount} 运行中
          </span>
        ) : calls.length > 0 ? (
          <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{calls.length} 次</span>
        ) : null}
        {sessionId && (
          <>
            <button
              type="button"
              className="rounded p-1"
              style={{ color: 'var(--text-muted)' }}
              title="导出当前会话 Debug JSONL"
              onClick={() => { void window.electronAPI?.debug.llmLogsExport({ sessionId, includeSubagents: true }) }}
            >
              <Download size={13} />
            </button>
            {calls.length > 0 && (
              <button
                type="button"
                className="rounded p-1"
                style={{ color: 'var(--text-muted)' }}
                title="清空当前会话 Debug 记录"
                onClick={() => {
                  if (!window.confirm('只清空当前会话的 Debug 记录，不影响聊天消息。继续吗？')) return
                  void window.electronAPI?.debug.llmLogsClear(sessionId)
                }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 transition"
          style={{ color: 'var(--text-muted)' }}
          title="关闭对话 Debug"
        >
          <X size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto scrollbar-hover">
        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
            <Activity size={26} strokeWidth={1.3} />
            <span className="text-[11px]">{persistedLoading ? '读取 Debug 记录…' : '等待 LLM 调用…'}</span>
          </div>
        ) : (
          calls.map((call, index) => (
            <CallRow
              key={call.id}
              call={call}
              index={index}
              expanded={expandedIds.has(call.id)}
              onToggle={() => toggleCall(call.id)}
              detail={details[call.id]}
              detailLoading={detailLoadingIds.has(call.id)}
            />
          ))
        )}
      </div>

      {calls.length > 0 && (
        <div
          className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 border-t px-3 py-2 text-[10px]"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        >
          <span>共 {calls.length} 次</span>
          {totalTokens > 0 && <span>{formatTokenK(totalTokens)} tokens</span>}
          {totalDuration > 0 && <span>{formatDuration(totalDuration)}</span>}
          {errorCount > 0 && <span style={{ color: 'var(--danger)' }}>{errorCount} 次错误</span>}
        </div>
      )}
    </aside>
  )
}

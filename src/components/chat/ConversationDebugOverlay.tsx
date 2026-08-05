/**
 * 对话内 debug 叠加层（M32-G7）：token 条 + 可折叠事件日志。
 * 与全页 Debug Console 无关；仅在 conversationDebugMode 打开时渲染。
 */

import { useState } from 'react'
import { ChevronRight, Activity } from 'lucide-react'
import {
  filterDebugEvents,
  formatTokenK,
  tokenUsageRatio,
} from './conversation-debug'

export interface ConversationDebugEvent {
  time: number
  type: string
  detail: string
}

export function ConversationDebugOverlay({
  usage,
  maxTokens,
  events,
}: {
  usage: { promptTokens: number; completionTokens: number } | null
  /** 会话/模型预算；0 = 无上限，只显示绝对用量 */
  maxTokens: number
  events: ConversationDebugEvent[]
}) {
  const [logOpen, setLogOpen] = useState(false)
  const shown = filterDebugEvents(events)
  const total = usage
    ? usage.promptTokens + usage.completionTokens
    : 0
  const ratio = usage
    ? tokenUsageRatio(usage.promptTokens, usage.completionTokens, maxTokens)
    : 0
  const barColor =
    ratio >= 0.85
      ? 'var(--danger)'
      : ratio >= 0.7
        ? 'var(--warning)'
        : 'var(--accent)'

  return (
    <div
      className="mb-2 rounded-md border px-2.5 py-2"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      data-testid="conversation-debug-overlay"
    >
      <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <Activity size={12} style={{ color: 'var(--accent)' }} />
        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
          对话调试
        </span>
        {usage ? (
          <span className="ml-auto font-mono" style={{ color: 'var(--text-secondary)' }}>
            ↑{formatTokenK(usage.promptTokens)} ↓{formatTokenK(usage.completionTokens)} Σ
            {formatTokenK(total)}
            {maxTokens > 0 ? ` · ${Math.round(ratio * 100)}%` : ''}
          </span>
        ) : (
          <span className="ml-auto">本轮尚无 usage</span>
        )}
      </div>

      {usage && maxTokens > 0 && (
        <div
          className="mt-1.5 h-1 overflow-hidden rounded-full"
          style={{ background: 'var(--border-subtle)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.round(ratio * 100)}%`, background: barColor }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setLogOpen((v) => !v)}
        className="mt-2 flex w-full items-center gap-1 text-[11px]"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronRight
          size={12}
          className={`transition-transform ${logOpen ? 'rotate-90' : ''}`}
        />
        事件 ({shown.length}
        {events.length > shown.length ? ` / ${events.length}` : ''})
      </button>

      {logOpen && (
        <ul
          className="mt-1 max-h-36 space-y-0.5 overflow-auto font-mono text-[10px] leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          {shown.length === 0 && <li>（暂无事件）</li>}
          {shown.map((ev, i) => (
            <li key={`${ev.time}-${i}`}>
              <span style={{ color: 'var(--text-secondary)' }}>{ev.type}</span>
              {ev.detail ? ` ${ev.detail}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

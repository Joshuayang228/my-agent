/**
 * 对话内 Debug 右侧栏（M32-G7）：token + 事件流。
 * 与全页 Debug Console 无关；打开后贴在 Chat 右侧。
 */

import { useState } from 'react'
import { Activity, ChevronRight, X } from 'lucide-react'
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

export function ConversationDebugAside({
  usage,
  maxTokens,
  events,
  onClose,
}: {
  usage: { promptTokens: number; completionTokens: number } | null
  maxTokens: number
  events: ConversationDebugEvent[]
  onClose: () => void
}) {
  const [logOpen, setLogOpen] = useState(true)
  const shown = filterDebugEvents(events)
  const total = usage ? usage.promptTokens + usage.completionTokens : 0
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
    <aside
      className="flex w-[280px] shrink-0 flex-col border-l"
      style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
      data-testid="conversation-debug-aside"
    >
      <div
        className="flex shrink-0 items-center justify-between border-b px-3 py-2.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
          <Activity size={13} style={{ color: 'var(--accent)' }} />
          对话调试
        </div>
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

      <div className="shrink-0 space-y-2 border-b px-3 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
        {usage ? (
          <>
            <div className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              ↑{formatTokenK(usage.promptTokens)} ↓{formatTokenK(usage.completionTokens)} Σ
              {formatTokenK(total)}
              {maxTokens > 0 ? ` · ${Math.round(ratio * 100)}%` : ''}
            </div>
            {maxTokens > 0 && (
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--border-subtle)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.round(ratio * 100)}%`, background: barColor }}
                />
              </div>
            )}
          </>
        ) : (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>本轮尚无 usage</p>
        )}
        <p className="text-[10px] leading-snug" style={{ color: 'var(--text-muted)' }}>
          叠加层信息密度；全页透视请用侧栏 Debug。
        </p>
      </div>

      <button
        type="button"
        onClick={() => setLogOpen((v) => !v)}
        className="flex shrink-0 items-center gap-1 px-3 py-2 text-[11px]"
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
          className="min-h-0 flex-1 space-y-1 overflow-auto px-3 pb-3 font-mono text-[10px] leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          {shown.length === 0 && <li>（暂无事件）</li>}
          {shown.map((ev, i) => (
            <li key={`${ev.time}-${i}`} className="rounded px-1.5 py-1" style={{ background: 'var(--hover-overlay)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{ev.type}</span>
              {ev.detail ? ` ${ev.detail}` : ''}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

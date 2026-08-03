/**
 * Reasoning 通道 UI：思考过程 Start/Progress/Complete。
 * phase=active 时显示脉冲点；complete 可折叠查看全文。
 */

import { ChevronRight } from 'lucide-react'
import type { ReasoningChunk } from './types'
import { reasoningPhase } from './types'

export function ReasoningCallback({
  chunks,
  expanded,
  onToggle,
  streaming,
  className = '',
}: {
  chunks: ReasoningChunk[]
  expanded: boolean
  onToggle: () => void
  streaming: boolean
  className?: string
}) {
  if (chunks.length === 0) return null
  const phase = reasoningPhase(chunks, streaming)

  return (
    <div
      className={`rounded-md border px-3 py-2 ${className}`}
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      data-callback="reasoning"
      data-phase={phase}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 text-[11px] font-medium"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <span>思考过程</span>
        {phase === 'active' && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--accent)' }} />
        )}
        {phase === 'complete' && !expanded && (
          <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>已完成</span>
        )}
      </button>
      {expanded && (
        <pre
          className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {chunks.map((t) => t.content).join('')}
        </pre>
      )}
    </div>
  )
}

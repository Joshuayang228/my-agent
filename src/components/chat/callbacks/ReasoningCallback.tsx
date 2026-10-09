/**
 * Reasoning 通道 UI：思考过程 Start/Progress/Complete。
 * phase=active 时显示脉冲点；complete 可折叠查看全文。
 */

import { ChevronRight } from 'lucide-react'
import type { ReasoningChunk } from './types'
import { reasoningPhase } from './types'
import { ActionButton } from '../../foundation/ActionButton'

export function ReasoningCallback({
  chunks,
  expanded,
  onToggle,
  streaming,
  className = '',
  presentation = 'default',
}: {
  chunks: ReasoningChunk[]
  expanded: boolean
  onToggle: () => void
  streaming: boolean
  className?: string
  /** 正式主聊天显式采用稳定标题槽与渐显；其他调用方仍保留默认展示。 */
  presentation?: 'default' | 'stable'
}) {
  if (chunks.length === 0) return null
  const phase = reasoningPhase(chunks, streaming)

  return (
    <div
      className={`rounded-md border px-3 py-2 ${presentation === 'stable' ? 'reasoning-callback-stable' : ''} ${className}`}
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      data-callback="reasoning"
      data-phase={phase}
    >
      <ActionButton
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full !min-h-0 !justify-start gap-2 rounded-none border-0 !px-0 !py-0 text-[11px] font-medium hover:bg-[var(--hover-overlay)]"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <span>思考过程</span>
        {phase === 'active' && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--accent)' }} />
        )}
        <span className="ml-auto min-w-[3.5rem] text-right text-[10px]" style={{ color: 'var(--text-muted)', visibility: phase === 'complete' && !expanded ? 'visible' : 'hidden' }}>已完成</span>
      </ActionButton>
      <div aria-hidden={!expanded} className={presentation === 'stable' ? `reasoning-callback-content ${expanded ? 'reasoning-callback-content-open' : ''}` : expanded ? 'block' : 'hidden'}>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {chunks.map((t) => t.content).join('')}
        </pre>
      </div>
    </div>
  )
}

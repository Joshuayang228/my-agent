/**
 * Reasoning 通道 UI：思考过程 Start/Progress/Complete（极简 `xxx >` + 展开直接可读无框留白）。
 *
 * 背景：带灰绿标题栏与横线的手风琴表格过重；用户展开过程时只想安静扫一眼思考文字。
 * 设计意图：独立展示时以一行极轻 `思考中… >` / `已思考 >` 呈现，展开后直接显示柔和灰色思考段落；
 * 内嵌在多轮过程区时（`embedded=true`）直接平铺思考文字，不再套第二层折叠。
 * 关键约束：保留 `data-callback="reasoning"`、`data-phase` 与 Foundation `ActionButton`（名称含「思考过程」）。
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
  embedded = false,
}: {
  chunks: ReasoningChunk[]
  expanded: boolean
  onToggle: () => void
  streaming: boolean
  className?: string
  /** 正式主聊天显式采用稳定标题槽与渐显；其他调用方仍保留默认展示。 */
  presentation?: 'default' | 'stable'
  /** 内嵌在多轮过程展开区内时，直接平铺思考文字，不再套第二层折叠。 */
  embedded?: boolean
}) {
  if (chunks.length === 0) return null
  const phase = reasoningPhase(chunks, streaming)
  const isActive = phase === 'active'
  const fullText = chunks.map((t) => t.content).join('')

  if (embedded) {
    return (
      <div
        className={`scrollbar-thin max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-[12px] leading-6 opacity-85 ${className}`}
        style={{ color: 'var(--text-muted)' }}
        data-callback="reasoning"
        data-phase={phase}
      >
        {fullText}
      </div>
    )
  }

  return (
    <div
      className={`${presentation === 'stable' ? 'reasoning-callback-stable' : ''} ${className}`}
      data-callback="reasoning"
      data-phase={phase}
    >
      <ActionButton
        variant="plain"
        onClick={onToggle}
        aria-expanded={expanded}
        className="-mx-1.5 !min-h-0 !justify-start gap-1 rounded-[var(--radius-sm)] border-0 !px-1.5 !py-1 text-left text-[12px] hover:bg-[var(--hover-overlay)]"
      >
        <span style={{ color: 'var(--text-muted)' }}>
          {isActive ? '让我想想…' : '思考过程'}
        </span>
        <ChevronRight
          size={12}
          className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          style={{ color: 'var(--text-muted)' }}
        />
      </ActionButton>
      <div
        aria-hidden={!expanded}
        className={
          presentation === 'stable'
            ? `reasoning-callback-content ${expanded ? 'reasoning-callback-content-open' : ''}`
            : expanded ? 'block' : 'hidden'
        }
      >
        <div
          className="scrollbar-thin mt-1 mb-2.5 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-6 opacity-85"
          style={{ color: 'var(--text-muted)' }}
        >
          {fullText}
        </div>
      </div>
    </div>
  )
}

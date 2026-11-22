/**
 * Reasoning 通道 UI：思考过程 Start/Progress/Complete。
 *
 * 背景：此前思考卡使用等宽 `<pre>`、左侧箭头与全宽独立摆放，和同列中的工具卡、助手正文风格割裂且左边界错位。
 * 设计意图：与 `ToolCallbackList` 共用同一套轻量过程折叠卡皮肤（统一圆角、字号、右侧状态与右侧折叠箭头），
 * 正文改用自然 UI 字体阅读；调用方将其置于 `ChatMessageFrame` 助手列内，保证与正文、工具卡严格左对齐。
 * 关键约束：保留 `data-callback="reasoning"`、`data-phase` 与 Foundation `ActionButton`（名称含「思考过程」）。
 */

import { ChevronRight, Sparkles } from 'lucide-react'
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
  const isActive = phase === 'active'

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
        className="-mx-1.5 !min-h-0 !justify-start gap-1.5 rounded-[var(--radius-sm)] border-0 !px-1.5 !py-1 text-left text-[12px] hover:bg-[var(--hover-overlay)]"
      >
        <Sparkles size={12} className={`shrink-0 ${isActive ? 'animate-pulse' : ''}`} style={{ color: isActive ? 'var(--accent-fg)' : 'var(--text-muted)' }} />
        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
          {isActive ? '思考中…' : '思考过程'}
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
          className="mt-1 mb-1.5 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] px-3 py-2 text-[12px] leading-6"
          style={{
            background: 'color-mix(in srgb, var(--bg-secondary) 60%, transparent)',
            color: 'var(--text-muted)',
          }}
        >
          {chunks.map((t) => t.content).join('')}
        </div>
      </div>
    </div>
  )
}

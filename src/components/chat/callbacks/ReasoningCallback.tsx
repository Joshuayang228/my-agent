/**
 * Reasoning 通道 UI：思考过程 Start/Progress/Complete（与 ToolCallbackList 同源行 + 74% 轻磨砂限高展开卡）。
 *
 * 背景：真实任务中的思考过程常达数百上千字，无框全铺会顶飞工具列表，无框截断又缺乏滚动边界提示。
 * 设计意图：思考与工具步骤采用完全一致的交互文法——单行轻入口（带常驻右侧 `w-4` hover `>` 槽位，零跳动），
 * 点开后在正下方左对齐滑出 74% 轻磨砂圆角限高滚动卡（与工具详情块同材质），短思考轻盈、长思考不炸屏。
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
  embedded = false,
}: {
  chunks: ReasoningChunk[]
  expanded: boolean
  onToggle: () => void
  streaming: boolean
  className?: string
  /** 正式主聊天显式采用稳定标题槽与渐显；其他调用方仍保留默认展示。 */
  presentation?: 'default' | 'stable'
  /** 内嵌在多轮过程列表中时，采用与工具行一致的图标 + 标题 + 单行预览 + 右侧常驻箭头槽位。 */
  embedded?: boolean
}) {
  if (chunks.length === 0) return null
  const phase = reasoningPhase(chunks, streaming)
  const isActive = phase === 'active'
  const fullText = chunks.map((t) => t.content).join('')
  const preview = fullText.replace(/\s+/g, ' ').trim()

  if (embedded) {
    return (
      <div
        className={className}
        data-callback="reasoning"
        data-phase={phase}
      >
        <div className="group/row flex items-center gap-1.5">
          <ActionButton
            variant="plain"
            onClick={onToggle}
            aria-expanded={expanded}
            className="-mx-1.5 min-w-0 flex-1 !min-h-0 !justify-start gap-2 rounded-[var(--radius-sm)] border-0 !px-1.5 !py-1 text-left text-[12px] hover:bg-[var(--hover-overlay)]"
          >
            <Sparkles
              size={12}
              className={`shrink-0 ${isActive ? 'animate-pulse' : ''}`}
              style={{ color: isActive ? 'var(--accent-fg)' : 'var(--text-muted)' }}
            />
            <span className="shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {isActive ? '让我想想…' : '思考过程'}
            </span>
            {!expanded && preview && (
              <span className="min-w-0 truncate text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {preview}
              </span>
            )}
            <span
              className={`ml-auto flex h-4 w-4 shrink-0 items-center justify-center transition-opacity ${
                expanded
                  ? 'opacity-100'
                  : 'opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100'
              }`}
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </span>
          </ActionButton>
        </div>
        {expanded && (
          <div
            className="scrollbar-thin mt-1 mb-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] border px-3 py-2.5 text-[12px] leading-6 backdrop-blur-[2px]"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'color-mix(in srgb, var(--card-bg) 40%, transparent)',
              color: 'var(--text-secondary)',
            }}
          >
            {fullText}
          </div>
        )}
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
          className="scrollbar-thin mt-1 mb-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] border px-3 py-2.5 text-[12px] leading-6 backdrop-blur-[2px]"
          style={{
            borderColor: 'var(--border-subtle)',
            background: 'color-mix(in srgb, var(--card-bg) 40%, transparent)',
            color: 'var(--text-secondary)',
          }}
        >
          {fullText}
        </div>
      </div>
    </div>
  )
}

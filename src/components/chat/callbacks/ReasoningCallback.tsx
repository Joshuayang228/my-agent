/**
 * Reasoning 通道 UI：思考过程 Start/Progress/Complete（双段实底小胶囊 + 点击弹详情弹窗）。
 *
 * 背景：在对话流里原地展开大段思考文本会打断阅读节奏，而在带壁纸的背景下半透明无框块又容易发虚。
 * 设计意图：与 `ToolCallbackList` 采用同一双段实底小胶囊样式，并复用 `ProcessDetailModal`，
 * 在对话流中仅展示一枚紧凑双段胶囊（图标 + 思考过程 + 单行预览），点击后在居中弹窗中舒适阅读完整思考内容。
 * 关键约束：保留 `data-callback="reasoning"`、`data-phase` 与 Foundation `ActionButton`（名称含「思考过程」）。
 */

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { ReasoningChunk } from './types'
import { reasoningPhase } from './types'
import { ActionButton } from '../../foundation/ActionButton'
import { ProcessDetailModal } from './ToolCallbackList'

export function ReasoningCallback({
  chunks,
  expanded,
  onToggle,
  streaming,
  className = '',
  presentation = 'default',
}: {
  chunks: ReasoningChunk[]
  expanded?: boolean
  onToggle?: () => void
  streaming: boolean
  className?: string
  /** 保留兼容属性，供外部稳定容器识别 */
  presentation?: 'default' | 'stable'
}) {
  const [modalOpen, setModalOpen] = useState(false)
  if (chunks.length === 0) return null

  const phase = reasoningPhase(chunks, streaming)
  const isActive = phase === 'active'
  const fullText = chunks.map((t) => t.content).join('')
  const compact = fullText.replace(/\s+/g, ' ').trim()
  const preview = isActive
    ? (compact.length > 48 ? `…${compact.slice(-48)}` : compact)
    : (compact.length > 48 ? `${compact.slice(0, 48)}…` : compact)

  return (
    <div
      className={`inline-flex max-w-full items-stretch overflow-hidden rounded-[15px] border transition-colors ${presentation === 'stable' ? 'reasoning-callback-stable' : ''} ${className}`}
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}
      data-callback="reasoning"
      data-phase={phase}
    >
      <ActionButton
        variant="plain"
        onClick={() => {
          onToggle?.()
          setModalOpen(true)
        }}
        title={compact || '思考过程'}
        className="min-w-0 !min-h-0 !justify-start gap-0 rounded-none border-0 !p-0 text-left hover:brightness-[0.97]"
      >
        <span
          className="inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
        >
          <Sparkles
            size={12}
            className={`shrink-0 ${isActive ? 'animate-pulse' : ''}`}
            style={{ color: isActive ? 'var(--accent-fg)' : 'var(--text-muted)' }}
          />
          <span className="whitespace-nowrap">思考过程</span>
        </span>
        {(preview || isActive) && (
          <span className="inline-flex min-w-0 items-center gap-2 px-2.5 py-1 text-[12px]">
            {preview && (
              <span className="min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>
                {preview}
              </span>
            )}
            {isActive && (
              <span className="shrink-0 text-[11px]" style={{ color: 'var(--accent-fg)' }}>
                思考中…
              </span>
            )}
          </span>
        )}
      </ActionButton>
      <ProcessDetailModal
        open={modalOpen || Boolean(expanded && !onToggle)}
        title="思考过程"
        icon={<Sparkles size={14} />}
        statusText={isActive ? '思考中…' : '已完成'}
        onClose={() => setModalOpen(false)}
      >
        <div
          className="whitespace-pre-wrap break-words text-[13px] leading-7"
          style={{ color: 'var(--text-secondary)' }}
        >
          {fullText}
        </div>
      </ProcessDetailModal>
    </div>
  )
}

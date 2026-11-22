/**
 * Content 通道相位指示（正文仍在消息气泡里增量渲染）。
 * streaming 且尚无首字时显示轻量脉冲提示；结束后由父级卸载。
 */

import type { CallbackPhase } from './types'

/**
 * 正文 Progress 只在「已开流、尚无首字」时亮起；有正文后靠气泡光标表示 Progress，避免双指示。
 */
export function contentPhase(hasAssistantText: boolean, streaming: boolean): CallbackPhase {
  if (streaming && !hasAssistantText) return 'active'
  if (!streaming && hasAssistantText) return 'complete'
  return 'idle'
}

export function ContentCallbackCue({
  phase,
}: {
  phase: CallbackPhase
}) {
  if (phase !== 'active') return null
  return (
    <div
      className="flex items-center gap-1 py-1.5"
      data-callback="content"
      data-phase={phase}
      role="status"
      aria-label="正在输入"
      aria-live="polite"
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--text-muted)', animationDelay: '0ms' }} />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--text-muted)', animationDelay: '180ms' }} />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--text-muted)', animationDelay: '360ms' }} />
    </div>
  )
}

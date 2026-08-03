/**
 * Content 通道相位指示（正文仍在消息气泡里增量渲染）。
 * streaming 且已有正文时显示 Progress；结束后由父级卸载。
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
      className="mt-2 flex items-center gap-1.5 text-[11px]"
      style={{ color: 'var(--text-muted)' }}
      data-callback="content"
      data-phase={phase}
      aria-live="polite"
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--accent)' }} />
      <span>回复生成中…</span>
    </div>
  )
}

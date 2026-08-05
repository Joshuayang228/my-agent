/**
 * Playground 独立全页 — 与 Debug 分离，不共用双页壳。
 */

import { FlaskConical, X } from 'lucide-react'
import { PlaygroundShell } from './playground'

export function PlaygroundPage({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col" data-testid="playground-page">
      <div
        className="flex shrink-0 items-center justify-between border-b px-5 py-3"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            <FlaskConical size={16} style={{ color: 'var(--accent)' }} />
            Playground
          </span>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            组件展厅 + 隔离试验（不写全局设置；非 Storybook 工程）。
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 transition"
          style={{ color: 'var(--text-muted)' }}
          title="返回聊天"
        >
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <PlaygroundShell />
      </div>
    </div>
  )
}

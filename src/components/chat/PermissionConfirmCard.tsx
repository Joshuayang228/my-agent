/**
 * 权限确认卡片（静态/可交互）。
 * 主聊天遮罩层与 Playground 故事矩阵共用视觉。
 */

import { AlertTriangle } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

export function PermissionConfirmCard({
  toolName,
  args,
  queueLength,
  onDeny,
  onAllow,
}: {
  toolName: string
  args: Record<string, unknown>
  queueLength?: number
  onDeny?: () => void
  onAllow?: () => void
}) {
  return (
    <div
      className="w-full max-w-md rounded-lg border p-5 shadow-2xl"
      style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
      data-testid="permission-confirm-card"
    >
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--warning)' }}>
        <AlertTriangle size={14} /> 操作确认
        {queueLength != null && queueLength > 1 && (
          <span className="ml-auto text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
            队列 {queueLength}
          </span>
        )}
      </h3>
      <p className="mb-3 text-[13px]" style={{ color: 'var(--text-secondary)' }}>AI 请求执行以下操作：</p>
      <div className="mb-4 rounded-md border px-3 py-2" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
        <div className="font-mono text-[13px]" style={{ color: 'var(--accent)' }}>{toolName}</div>
        <pre className="mt-1.5 max-h-36 overflow-auto text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {JSON.stringify(args, null, 2)}
        </pre>
      </div>
      <div className="flex justify-end gap-2">
        <ActionButton
          onClick={onDeny}
          className="!min-h-0 rounded-md px-3 py-1.5 text-[13px] hover:bg-[var(--hover-overlay)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
        >
          拒绝
        </ActionButton>
        <ActionButton
          tone="accent"
          onClick={onAllow}
          className="!min-h-0 rounded-md px-3 py-1.5 text-[13px] font-medium hover:!opacity-90"
          style={{ background: 'var(--warning)', color: 'var(--bg-primary)', borderColor: 'var(--warning)' }}
        >
          允许执行
        </ActionButton>
      </div>
    </div>
  )
}

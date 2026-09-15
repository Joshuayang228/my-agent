import type { ReactNode } from 'react'
import { ActionButton } from './ActionButton'

interface ConfirmPanelProps {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  icon?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Background: product actions such as deleting a life asset or forcing a summon need an in-app decision surface.
 * Intent: keep confirmation inside the themed shell so keyboard focus, copy, and pending state match Foundation controls.
 * Constraint: the panel must not call browser dialogs or change layout when pending; both action slots remain reserved.
 */
export function ConfirmPanel({ title, description, confirmLabel, cancelLabel = '取消', busy = false, icon, onConfirm, onCancel }: ConfirmPanelProps) {
  return <section role="alertdialog" aria-label={title} className="rounded-[var(--radius-md)] border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
    <div className="flex min-w-0 gap-3">
      {icon && <span className="mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} aria-hidden="true">{icon}</span>}
      <div className="min-w-0 flex-1"><div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{title}</div><p className="mt-1 whitespace-pre-wrap text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{description}</p></div>
    </div>
    <div className="mt-3 flex justify-end gap-2"><ActionButton size="sm" onClick={onCancel} disabled={busy}>{cancelLabel}</ActionButton><ActionButton size="sm" tone="danger" onClick={onConfirm} disabled={busy}>{busy ? '处理中…' : confirmLabel}</ActionButton></div>
  </section>
}

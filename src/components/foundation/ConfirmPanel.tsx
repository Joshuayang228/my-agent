import { useId, type ReactNode } from 'react'
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
  const descriptionId = useId()
  return <section role="group" aria-label={title} aria-describedby={descriptionId} aria-busy={busy} className="rounded-[var(--radius-md)] border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
    <div className="flex min-w-0 gap-3">
      {icon && <span className="mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} aria-hidden="true">{icon}</span>}
      <div className="min-w-0 flex-1"><div className="break-words text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{title}</div><p id={descriptionId} className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{description}</p></div>
    </div>
    <div className="mt-3 flex flex-wrap justify-end gap-2"><ActionButton size="sm" onClick={onCancel} disabled={busy}>{cancelLabel}</ActionButton><ActionButton size="sm" tone="danger" aria-label={confirmLabel} onClick={onConfirm} disabled={busy}><span className="grid"><span className="col-start-1 row-start-1" style={{ visibility: busy ? 'hidden' : 'visible' }}>{confirmLabel}</span><span aria-hidden="true" className="col-start-1 row-start-1" style={{ visibility: busy ? 'visible' : 'hidden' }}>处理中…</span></span></ActionButton></div>
  </section>
}

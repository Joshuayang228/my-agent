import type { ReactNode } from 'react'
import { ActionButton } from '../foundation/ActionButton'

export function SettingCard({ children, testId }: { children: ReactNode; testId?: string }) {
  return <section className="rounded-[var(--radius-lg)] border p-4 sm:p-5" data-testid={testId}
    style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>{children}</section>
}

export function ScopeBadge({ label }: { label: string }) {
  return <span className="shrink-0 rounded-full border px-2 py-0.5 text-[9px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>{label}</span>
}

export function SettingRow({ children, description, icon, label, scope, stacked = false }: {
  children: ReactNode; description?: string; icon?: ReactNode; label: string; scope?: string; stacked?: boolean
}) {
  return <div className={`flex gap-4 ${stacked ? 'flex-col' : 'flex-wrap items-start justify-between'}`}>
    <div className="flex min-w-0 gap-3">
      {icon && <span className="mt-0.5 shrink-0" style={{ color: 'var(--accent-fg)' }} aria-hidden="true">{icon}</span>}
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}><span>{label}</span>{scope && <ScopeBadge label={scope} />}</div>
        {description && <p className="mt-1 max-w-xl text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      </div>
    </div>
    <div className={stacked ? 'min-w-0' : 'min-w-0 max-w-full'}>{children}</div>
  </div>
}

/** 设置行承载业务标签；固定大小的开关轨道与基础按钮的布局不会随选中或悬停改变。 */
export function SettingSwitch({ checked, compact = false, description, label, onChange, scope, testId, disabled = false }: {
  checked: boolean; compact?: boolean; description: string; label: string; onChange: (checked: boolean) => void; scope?: string; testId: string; disabled?: boolean
}) {
  return <ActionButton role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
    className={compact ? 'h-5 w-9 min-h-0 border-0 p-0' : 'w-full gap-4 rounded-[var(--radius-md)] px-3 py-3 text-left'}
    style={{ borderColor: 'var(--border-subtle)', background: !compact && checked ? 'var(--accent-subtle)' : 'transparent' }} data-testid={testId}>
    {!compact && <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}{scope && <ScopeBadge label={scope} />}</span><span className="mt-0.5 block text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>{description}</span></span>}
    <span className="relative block h-5 w-9 shrink-0 rounded-full transition" style={{ background: checked ? 'var(--accent)' : 'var(--bg-tertiary)' }} aria-hidden="true">
      <span className="absolute top-0.5 h-4 w-4 rounded-full shadow-sm transition" style={{ background: 'var(--input-bg)', left: checked ? 'calc(100% - 1.125rem)' : '0.125rem' }} />
    </span>
  </ActionButton>
}

export function SettingsPageHeader({ description, title, icon, eyebrow, badge }: {
  description?: string
  title: string
  icon?: ReactNode
  eyebrow?: string
  badge?: string
}) {
  return <header className={`mb-5 ${icon || eyebrow || badge ? 'flex items-start justify-between gap-4' : ''}`}>
    <div className="min-w-0">
      {(icon || eyebrow) && <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em]" style={{ color: 'var(--accent-fg)' }}><span aria-hidden="true">{icon}</span>{eyebrow}</div>}
      <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {description && <p className="mt-1 max-w-2xl text-[12px] leading-5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
    </div>
    {badge && <span className="shrink-0 rounded-full border px-2.5 py-1 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>{badge}</span>}
  </header>
}

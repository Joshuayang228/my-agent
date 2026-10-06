import type { ReactNode } from 'react'

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'danger' }) {
  const colors = tone === 'accent' ? { background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }
    : tone === 'success' || tone === 'danger' ? { background: `color-mix(in srgb, var(--${tone}) 15%, transparent)`, color: `var(--${tone})` }
      : { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }
  return <span data-foundation="badge" className="inline-flex min-h-5 max-w-full items-center rounded-full px-2 py-0.5 text-[10px]" style={colors}>{children}</span>
}

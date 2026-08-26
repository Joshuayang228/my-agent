/**
 * Playground 统一布局原语：所有一级页面共享同一页头、内容宽度和故事筛选节奏。
 * 设计意图：减少每个面板自行发明 max-width、标题和 Tab 样式造成的视觉漂移。
 */

import type { ReactNode } from 'react'

export interface PlaygroundStoryGroup {
  label: string
  items: readonly { id: string; label: string }[]
}

export function PlaygroundPageHeader({
  title,
  description,
  meta,
  descriptionInline = false,
}: {
  title: string
  description: string
  meta?: ReactNode
  descriptionInline?: boolean
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b pb-4" data-testid="playground-page-header">
      <div className="min-w-0">
        <div className={descriptionInline ? 'flex flex-wrap items-baseline gap-x-3 gap-y-1' : undefined} data-testid="playground-page-title-row">
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{title}</h1>
          {descriptionInline && (
            <p className="text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{description}</p>
          )}
        </div>
        {!descriptionInline && (
          <p className="mt-1 max-w-2xl text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{description}</p>
        )}
        {meta}
      </div>
    </header>
  )
}

export function PlaygroundStoryTabs({
  groups,
  value,
  onChange,
  ariaLabel,
}: {
  groups: readonly PlaygroundStoryGroup[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <div className="mb-4 min-w-0" data-testid="playground-story-nav">
      <div className="sr-only" aria-live="polite">当前故事：{value}</div>
      <div className="scrollbar-hover min-w-0 overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-0.5 rounded-lg border p-1" role="tablist" aria-label={ariaLabel} style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          {groups.flatMap((group) => group.items).map((item) => {
            const selected = item.id === value
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onChange(item.id)}
                className="rounded-md px-2.5 py-1.5 text-[11px] transition"
                style={{
                  color: selected ? 'var(--accent-fg)' : 'var(--text-secondary)',
                  background: selected ? 'var(--accent-subtle)' : 'transparent',
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

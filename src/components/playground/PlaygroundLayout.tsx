/**
 * Playground 统一布局原语：所有一级页面共享同一页头、内容宽度和故事筛选节奏。
 * 设计意图：减少每个面板自行发明 max-width、标题和 Tab 样式造成的视觉漂移。
 */


export interface PlaygroundStoryGroup {
  label: string
  items: readonly { id: string; label: string }[]
}

export function PlaygroundPageHeader({
  groupLabel,
  title,
  description,
}: {
  groupLabel: string
  title: string
  description: string
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b pb-4" data-testid="playground-page-header">
      <div className="min-w-0">
        <div className="mb-1 text-[10px] font-medium tracking-wide" style={{ color: 'var(--accent-fg)' }}>{groupLabel}</div>
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        <p className="mt-1 max-w-2xl text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>
      <span className="rounded-full border px-2 py-1 text-[9px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>隔离实验</span>
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
    <div className="mb-4 space-y-1.5" data-testid="playground-story-nav">
      <div className="sr-only" aria-live="polite">当前故事：{value}</div>
      {groups.map((group) => (
        <div key={group.label} className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5" role="tablist" aria-label={`${ariaLabel} · ${group.label}`}>
          <span className="w-16 shrink-0 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{group.label}</span>
          <div className="flex min-w-max gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            {group.items.map((item) => {
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
      ))}
    </div>
  )
}

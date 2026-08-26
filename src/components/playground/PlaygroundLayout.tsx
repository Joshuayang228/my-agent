/**
 * Playground 统一布局原语：所有一级页面共享同一页头、内容宽度和故事筛选节奏。
 * 设计意图：减少每个面板自行发明 max-width、标题和 Tab 样式造成的视觉漂移。
 */

import type { ReactNode } from 'react'

const PLAYGROUND_SOURCE_WIDTH_CLASS = 'w-[18rem] max-w-full'

/**
 * 统一显示 Playground 来源证据：来源是给开发者定位实现的辅助信息，不应撑开页头或制造额外层级。
 * 固定宽度让不同一级 Tab 的页头保持同一节奏；title 保留完整值，窄屏和长路径只在视觉上省略。
 */
export function PlaygroundSourcePath({ sourcePaths, testId = 'playground-source' }: { sourcePaths: readonly string[]; testId?: string }) {
  if (sourcePaths.length === 0) return null
  const source = sourcePaths.join(' · ')
  return (
    <code
      className={`ml-auto block min-w-0 ${PLAYGROUND_SOURCE_WIDTH_CLASS} truncate text-right font-mono text-[10px]`}
      data-testid={testId}
      title={source}
      style={{ color: 'var(--text-muted)' }}
    >
      {source}
    </code>
  )
}

export interface PlaygroundStoryGroup {
  label: string
  items: readonly { id: string; label: string }[]
}

export function PlaygroundPageHeader({
  title,
  description,
  meta,
  descriptionInline = true,
}: {
  title: string
  description: string
  meta?: ReactNode
  descriptionInline?: boolean
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b pb-4" data-testid="playground-page-header">
      <div className="w-full min-w-0">
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

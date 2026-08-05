/**
 * 故事格外壳：标题 + 源路径 + 边缘标记 + 预览区。
 */

import type { ReactNode } from 'react'

export function StoryBlock({
  title,
  source,
  edge,
  children,
}: {
  title: string
  source: string
  edge?: boolean
  children: ReactNode
}) {
  return (
    <section
      className="space-y-2 rounded-lg border p-3"
      style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
      data-edge={edge ? 'true' : undefined}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
          {title}
          {edge && (
            <span
              className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-normal"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}
            >
              边缘
            </span>
          )}
        </h4>
        <code className="max-w-full truncate font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {source}
        </code>
      </div>
      <div>{children}</div>
    </section>
  )
}

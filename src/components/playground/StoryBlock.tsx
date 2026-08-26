/**
 * 故事格外壳：标题、可选头部操作、来源证据、状态标记与预览区。
 * 来源仍由调用方保留在代码与注册资产中；仅在需要帮助开发者定位实现时展示。
 */

import type { ReactNode } from 'react'
import { AdoptionMark } from './AdoptionMark'

export function StoryBlock({
  title,
  source,
  adopted,
  edge,
  titleExtra,
  headerActions,
  showSource = true,
  children,
}: {
  title: string
  source: string
  adopted?: boolean
  edge?: boolean
  titleExtra?: ReactNode
  headerActions?: ReactNode
  showSource?: boolean
  children: ReactNode
}) {
  return (
    <section
      className="space-y-2 rounded-lg border p-3"
      style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
      data-edge={edge ? 'true' : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2" data-testid="story-block-header">
        <h4 className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
          <span className="truncate">{title}</span>
          {adopted && <AdoptionMark />}
          {titleExtra}
          {edge && (
            <span
              className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-normal"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}
            >
              边缘
            </span>
          )}
        </h4>
        <div className="flex min-w-0 items-center gap-2">
          {headerActions}
          {showSource && source && (
            <code className="max-w-full truncate font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {source}
            </code>
          )}
        </div>
      </div>
      <div>{children}</div>
    </section>
  )
}

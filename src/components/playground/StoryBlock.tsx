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
      className="playground-story-block space-y-3 rounded-xl border p-4 transition-colors"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}
      data-edge={edge ? 'true' : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2" data-testid="story-block-header">
        <h4 className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          <span className="truncate">{title}</span>
          {adopted && <AdoptionMark />}
          {titleExtra}
          {edge && <span className="sr-only">边缘态</span>}
        </h4>
        <div className="flex min-w-0 items-center gap-2">
          {headerActions}
          {showSource && source && (
            <code className="block w-[18rem] shrink-0 truncate text-right font-mono text-[10px]" title={source} data-testid="story-source" style={{ color: 'var(--text-muted)' }}>
              {source}
            </code>
          )}
        </div>
      </div>
      <div>{children}</div>
    </section>
  )
}

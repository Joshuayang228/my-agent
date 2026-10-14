import type { ReactNode } from 'react'

/** 背景：展厅与生产页头需要同一文字阶梯，不能让业务 CSS 各自定义标题。
 * 意图：共享纯呈现结构，展厅来源与生产操作由调用方传入。
 * 约束：不读取业务数据，不携带实验状态；旧展厅 wrapper 保留原有测试标识。
 */
export function PageHeader({ title, description, meta, descriptionInline = true, metaInline = false, className = '', testId, titleRowTestId }: {
  title: string; description: string; meta?: ReactNode; descriptionInline?: boolean; metaInline?: boolean;
  className?: string; testId?: string; titleRowTestId?: string;
}) {
  return <header className={`workspace-page-header ${className} mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-4`} data-testid={testId}>
    <div className="w-full min-w-0">
      <div className="flex min-w-0 items-baseline gap-3" data-testid={titleRowTestId}>
        <div className={descriptionInline ? 'flex min-w-0 flex-1 items-baseline gap-x-3 gap-y-1' : 'min-w-0 flex-1'}>
          <h1 className="shrink-0 text-[1.05rem] font-semibold tracking-[-0.015em]" style={{ color: 'var(--text-primary)' }}>{title}</h1>
          {descriptionInline && <p className="min-w-0 truncate text-[11px] leading-5 tracking-[0.01em]" style={{ color: 'var(--text-muted)' }}>{description}</p>}
        </div>
        {metaInline && meta}
      </div>
      {!descriptionInline && <p className="mt-1 max-w-2xl text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      {!metaInline && meta}
    </div>
  </header>
}

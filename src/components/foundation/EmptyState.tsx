import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
  className?: string
}

/**
 * 背景：正式工作区和人物架在没有数据时都需要解释原因并给出下一步，不能各自维护一块空白提示。
 * 设计意图：基础层只负责稳定的文本层级和操作槽，业务层注入真实动作；不在组件里推断数据来源或伪造可用能力。
 * 关键约束：操作槽始终保留固定高度，长文只能在内容区域换行，不能让空态在有无按钮之间改变外部布局。
 */
export function EmptyState({ title, description, action, className = '' }: EmptyStateProps) {
  return <section className={`flex min-h-28 flex-col items-center justify-center rounded-xl border px-6 py-8 text-center ${className}`}
    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }} aria-label={title}>
    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
    <p className="mt-1 max-w-xl whitespace-pre-wrap break-words text-[12px] leading-5" style={{ color: 'var(--text-muted)' }}>{description}</p>
    <div className="mt-4 flex min-h-7 items-center justify-center gap-2">{action}</div>
  </section>
}

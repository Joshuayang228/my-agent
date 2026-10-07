import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
  className?: string
  centerWithoutAction?: boolean
}

/**
 * 背景：正式工作区和人物架在没有数据时都需要解释原因并给出下一步，不能各自维护一块空白提示。
 * 设计意图：基础层负责稳定的文本和操作槽；显式无按钮居中时把原预留等分上下，避免空操作区将文字顶高。
 * 关键约束：默认布局不变；居中只用于无操作，22px 两份等于原 mt-4 加 min-h-7 的 44px，不能改变框体高度。
 */
export function EmptyState({ title, description, action, className = '', centerWithoutAction = false }: EmptyStateProps) {
  const balanced = centerWithoutAction && !action
  return <section className={`flex min-h-28 flex-col items-center justify-center rounded-xl border px-6 py-8 text-center ${className}`}
    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }} aria-label={title}>
    {balanced && <div aria-hidden="true" className="h-[22px] shrink-0" />}
    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
    <p className="mt-1 max-w-xl whitespace-pre-wrap break-words text-[12px] leading-5" style={{ color: 'var(--text-muted)' }}>{description}</p>
    {balanced ? <div aria-hidden="true" className="h-[22px] shrink-0" /> : <div className="mt-4 flex min-h-7 items-center justify-center gap-2">{action}</div>}
  </section>
}

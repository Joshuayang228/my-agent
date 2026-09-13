import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ActionButtonTone = 'accent' | 'neutral' | 'danger'

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  tone?: ActionButtonTone
  size?: 'sm' | 'md'
}

/**
 * 背景：正式工作区的失败恢复和外部打开动作曾各自声明文字按钮，导致 hover、主题和窄宽几何漂移。
 * 设计意图：Foundation 只统一文字动作的固定操作槽和语义色，业务层继续决定文案、回调与真实数据路径；不把业务流程塞进基础层。
 * 关键约束：按钮的最小高度、内边距和字号在 hover、focus、disabled 时保持不变，危险色只能由调用方明确选择，不能靠位置猜测。
 */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton({ children, tone = 'neutral', size = 'sm', className = '', style, ...props }, ref) {
  const colors = tone === 'accent'
    ? { color: 'var(--accent-fg)', background: 'var(--accent-subtle)', borderColor: 'transparent' }
    : tone === 'danger'
      ? { color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--danger) 35%, transparent)' }
      : { color: 'var(--text-secondary)', background: 'transparent', borderColor: 'var(--border-color)' }
  return <button {...props} ref={ref} type={props.type ?? 'button'}
    className={`inline-flex shrink-0 items-center justify-center rounded border text-[11px] transition disabled:cursor-not-allowed disabled:opacity-45 ${size === 'md' ? 'min-h-8 px-3' : 'min-h-7 px-2.5'} ${className}`}
    style={{ ...colors, ...style }}>
    {children}
  </button>
})

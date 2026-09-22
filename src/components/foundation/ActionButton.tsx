import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ActionButtonTone = 'accent' | 'neutral' | 'danger'
export type ActionButtonVariant = 'default' | 'plain'

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  tone?: ActionButtonTone
  size?: 'sm' | 'md'
  variant?: ActionButtonVariant
}

/**
 * 背景：正式工作区、设置和 Playground 曾各自声明文字按钮，导致导航动作的 hover、主题和窄宽几何漂移。
 * 设计意图：Foundation 统一文字动作的固定操作槽与两种明确表面：默认操作按钮和低强调导航按钮；业务层继续决定文案、回调与真实数据路径。
 * 关键约束：按钮的最小高度、内边距和字号在 hover、focus、disabled 时保持不变；plain 变体不显示边框但必须保留 hover 背景和完整操作槽；危险色只能由调用方明确选择。
 */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton({ children, tone = 'neutral', size = 'sm', variant = 'default', className = '', style, ...props }, ref) {
  const colors = tone === 'accent'
    ? { color: 'var(--accent-fg)', background: 'var(--accent-subtle)', borderColor: 'transparent' }
    : tone === 'danger'
      ? { color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--danger) 35%, transparent)' }
      : variant === 'plain'
        ? { color: 'var(--text-secondary)', borderColor: 'transparent' }
        : { color: 'var(--text-secondary)', background: 'transparent', borderColor: 'var(--border-color)' }
  return <button {...props} ref={ref} type={props.type ?? 'button'}
    className={`inline-flex shrink-0 items-center justify-center rounded border text-[11px] transition ${variant === 'plain' ? 'bg-transparent hover:bg-[var(--hover-overlay)] focus-visible:bg-[var(--hover-overlay)]' : ''} disabled:cursor-not-allowed disabled:opacity-45 ${size === 'md' ? 'min-h-8 px-3' : 'min-h-7 px-2.5'} ${className}`}
    style={{ ...colors, ...style }}>
    {children}
  </button>
})

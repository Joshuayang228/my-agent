import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ButtonTone = 'accent' | 'neutral' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  tone?: ButtonTone
  size?: 'sm' | 'md'
  busy?: boolean
  busyLabel?: string
}

/**
 * 背景：正式页面和 Foundation 故事都需要一个不依赖具体业务的通用文字按钮，避免各处在 hover、禁用和处理中状态重复写样式。
 * 设计意图：保留固定的操作槽，并把文案、回调和危险语义交给调用方；不把 ActionButton 的既有语义强行改成所有按钮的唯一形态。
 * 关键约束：busy 时隐藏原文但保留原文宽度，不能因状态变化导致布局跳动；按钮的尺寸只能由 size 改变，不能由状态或主题改变。
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ children, tone = 'neutral', size = 'sm', busy = false, busyLabel = '处理中…', className = '', style, disabled, ...props }, ref) {
  const colors = tone === 'accent'
    ? { color: 'var(--accent-fg)', background: 'var(--accent-subtle)', borderColor: 'transparent' }
    : tone === 'danger'
      ? { color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--danger) 35%, transparent)' }
      : { color: 'var(--text-secondary)', background: 'transparent', borderColor: 'var(--border-color)' }

  return <button {...props} ref={ref} type={props.type ?? 'button'} disabled={disabled || busy}
    className={`inline-flex shrink-0 items-center justify-center rounded border text-[11px] transition disabled:cursor-not-allowed disabled:opacity-45 ${size === 'md' ? 'min-h-8 px-3' : 'min-h-7 px-2.5'} ${className}`}
    style={{ ...colors, ...style }}>
    <span className="grid">
      <span className="col-start-1 row-start-1" style={{ visibility: busy ? 'hidden' : 'visible' }}>{children}</span>
      <span aria-hidden="true" className="col-start-1 row-start-1 whitespace-nowrap" style={{ visibility: busy ? 'visible' : 'hidden' }}>{busyLabel}</span>
    </span>
  </button>
})

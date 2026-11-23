import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'

export type SurfaceCardPadding = 'none' | 'sm' | 'md' | 'lg'

const PADDING_CLASSES: Record<SurfaceCardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6 sm:p-8',
}

export interface SurfaceCardProps {
  as?: 'div' | 'article' | 'button'
  padding?: SurfaceCardPadding
  interactive?: boolean
  className?: string
  style?: CSSProperties
  onClick?: MouseEventHandler<HTMLElement>
  'aria-label'?: string
  'data-testid'?: string
  children: ReactNode
}

/**
 * 统一纸白卡片容器（Foundation 原语）。
 *
 * 背景：人物世界、日记、礼物、文化角等页面此前各自手写 rounded / border / card-bg / hover，
 * 导致圆角、内边距与悬停反馈发生漂移。
 * 设计意图：收口全站静态与可交互卡片的圆角、边框、底色与焦点轮廓，不夹带业务语义。
 * 关键约束：仅负责容器呈现，交互行为由调用方注入；可交互卡片固定保留焦点可见轮廓。
 */
export function SurfaceCard({
  as = 'div',
  padding = 'md',
  interactive = as === 'button',
  className = '',
  style,
  onClick,
  'aria-label': ariaLabel,
  'data-testid': testId,
  children,
}: SurfaceCardProps) {
  const interactiveClass = interactive
    ? 'transition-colors hover:bg-[var(--hover-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-fg)]'
    : ''
  const classes = `min-w-0 overflow-hidden rounded-[var(--radius-card)] border ${PADDING_CLASSES[padding]} ${interactiveClass} ${className}`.trim()
  const mergedStyle: CSSProperties = {
    borderColor: 'var(--border-subtle)',
    background: 'var(--card-bg)',
    ...style,
  }

  if (as === 'button') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        data-testid={testId}
        className={`flex flex-col text-left ${classes}`}
        style={mergedStyle}
      >
        {children}
      </button>
    )
  }

  if (as === 'article') {
    return (
      <article
        onClick={onClick}
        aria-label={ariaLabel}
        data-testid={testId}
        className={classes}
        style={mergedStyle}
      >
        {children}
      </article>
    )
  }

  return (
    <div
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={testId}
      className={classes}
      style={mergedStyle}
    >
      {children}
    </div>
  )
}

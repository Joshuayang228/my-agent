import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string
  children: ReactNode
  size?: 24 | 28 | 32
}

/**
 * 背景：工作区的低频操作在 hover 时会显示或强化图标，若按钮尺寸由内容决定会推动标签和正文。
 * 设计意图：基础层统一操作槽的几何与无障碍名称，业务层只提供图标、语义和回调；不复制一套按钮皮肤。
 * 关键约束：label 必须同时作为 aria-label 和默认 title；尺寸只能使用固定阶梯，disabled/hover 不得改变布局盒子。
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, children, size = 28, className = '', title, style, ...props }, ref) {
  return <button {...props} type={props.type ?? 'button'} aria-label={label} title={title ?? label}
    ref={ref}
    className={`inline-flex shrink-0 items-center justify-center rounded ${className}`}
    style={{ width: size, height: size, ...style }}>
    {children}
  </button>
})

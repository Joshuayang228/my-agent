import type { ReactNode } from 'react'

interface ErrorStateProps {
  title: string
  description: string
  action?: ReactNode
  className?: string
}

/**
 * 背景：真实 IPC、网络和权限失败都必须给用户可执行的恢复路径，同时避免把内部错误细节泄露到产品界面。
 * 设计意图：基础层统一错误层级和恢复操作槽，调用方提供经过转换的用户文案及真实重试回调；不在组件内吞掉失败。
 * 关键约束：恢复入口区域始终占位，长错误文案可换行，错误态不能因有无按钮而改变容器几何或挤压相邻内容。
 */
export function ErrorState({ title, description, action, className = '' }: ErrorStateProps) {
  return <section className={`flex min-h-28 flex-col items-center justify-center rounded-xl border px-6 py-8 text-center ${className}`}
    style={{ borderColor: 'color-mix(in srgb, var(--danger) 35%, var(--border-color))', background: 'var(--bg-secondary)' }}>
    <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{title}</p>
    <p role="alert" className="mt-1 max-w-xl whitespace-pre-wrap break-words text-[12px] leading-5" style={{ color: 'var(--text-secondary)' }}>{description}</p>
    <div className="mt-4 flex min-h-7 items-center justify-center gap-2">{action}</div>
  </section>
}

import type { ReactNode } from 'react'

export interface SegmentedControlItem {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
}

/**
 * 背景：同一内容区域的模式选择曾在文件预览中重复声明按钮皮肤，选中态和窄宽表现容易漂移。
 * 设计意图：Foundation 只统一模式按钮的语义、颜色和固定几何，业务层继续决定当前模式和切换副作用；不把页面级导航伪装成 Tabs。
 * 关键约束：每个选项始终占据稳定操作槽，hover、disabled 和选中态不改变宽高；必须使用 aria-pressed 表达当前模式。
 */
export function SegmentedControl({ items, value, onChange, ariaLabel, className = '' }: {
  items: readonly SegmentedControlItem[]
  value: string
  onChange: (id: string) => void
  ariaLabel: string
  className?: string
}) {
  return <div role="group" aria-label={ariaLabel} data-foundation="segmented-control"
    className={`inline-flex shrink-0 items-center rounded border p-0.5 ${className}`}
    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-tertiary)' }}>
    {items.map((item) => {
      const selected = item.id === value
      return <button key={item.id} type="button" aria-pressed={selected} disabled={item.disabled}
        className="inline-flex h-6 items-center justify-center gap-1 rounded px-2 text-[10px] transition disabled:opacity-40"
        style={{ color: selected ? 'var(--accent-fg)' : 'var(--text-muted)', background: selected ? 'var(--accent-subtle)' : undefined }}
        onClick={() => onChange(item.id)}>
        {item.icon && <span aria-hidden="true" className="flex shrink-0">{item.icon}</span>}
        {item.label}
      </button>
    })}
  </div>
}

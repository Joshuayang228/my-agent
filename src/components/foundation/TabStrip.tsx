import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export interface TabStripItem {
  id: string
  label: string
  icon?: ReactNode
  panelId?: string
  testId?: string
}

interface TabStripProps {
  label: string
  items: readonly TabStripItem[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose?: (id: string) => void
  itemTestId?: string
  variant?: 'underline' | 'surface'
}

/**
 * 背景：基础故事、工作区和文件预览曾各自实现标签，关闭位与键盘行为发生漂移。
 * 设计意图：基础层只拥有呈现和焦点；实例数据、关闭后的选择及资源释放由业务层负责。
 * 关键约束：关闭位固定且常驻；切换、hover 和焦点样式不改尺寸，不能嵌套 button。
 */
export function TabStrip({ label, items, activeId, onSelect, onClose, itemTestId, variant = 'surface' }: TabStripProps) {
  const prefix = useId()
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const list = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef(false)
  useLayoutEffect(() => {
    if (!restoreFocus.current) return
    restoreFocus.current = false
    const target = buttons.current.get(activeId ?? '') ?? buttons.current.get(items[0]?.id ?? '')
    ;(target ?? list.current)?.focus()
  }, [items, activeId])

  const close = (id: string) => {
    restoreFocus.current = true
    onClose?.(id)
  }
  return <div ref={list} role="tablist" aria-label={label} tabIndex={items.length ? -1 : 0}
    data-foundation="tabs" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
    {items.map((item, index) => {
      const active = item.id === activeId
      return <div key={item.id} role="presentation" data-testid={itemTestId}
        className="flex shrink-0 items-center rounded-md px-1 hover:bg-[var(--bg-secondary)]"
        style={{ background: variant === 'surface' && active ? 'var(--bg-secondary)' : undefined }}>
        <button ref={(node) => { if (node) buttons.current.set(item.id, node); else buttons.current.delete(item.id) }}
          id={prefix + '-tab-' + index} type="button" role="tab" aria-selected={active}
          aria-controls={item.panelId} tabIndex={active || (!items.some((entry) => entry.id === activeId) && index === 0) ? 0 : -1}
          title={item.label} data-testid={item.testId} data-instance-id={item.id}
          className="inline-flex h-8 min-w-0 max-w-52 items-center gap-2 rounded px-2 text-[12px] outline-offset-[-2px]"
          style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)', borderBottom: variant === 'underline' ? '2px solid' : undefined, borderColor: active ? 'var(--accent-fg)' : 'transparent' }}
          onClick={() => onSelect(item.id)}
          onKeyDown={(event) => {
            const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
            const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + offset + items.length) % items.length
            if (offset || event.key === 'Home' || event.key === 'End') {
              event.preventDefault()
              onSelect(items[nextIndex].id)
              buttons.current.get(items[nextIndex].id)?.focus()
            } else if (event.key === 'Delete' && onClose) {
              event.preventDefault()
              close(item.id)
            }
          }}>
          {item.icon && <span className="flex shrink-0" aria-hidden="true">{item.icon}</span>}
          <span className="truncate">{item.label}</span>
        </button>
        {onClose && <button type="button" aria-label={'关闭' + item.label} title={'关闭' + item.label}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-[var(--hover-overlay)]"
          style={{ color: 'var(--text-muted)' }} onClick={() => close(item.id)}><X size={14} /></button>}
      </div>
    })}
  </div>
}

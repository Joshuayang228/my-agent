import { useRef, useState, type ReactNode } from 'react'
import { IconButton } from './IconButton'

export interface WorkspaceToolMenuItem {
  id: string
  label: string
  icon: ReactNode
}

/**
 * 背景：正式右坞和 Playground 候选都需要新增工作区工具，重复实现会让键盘行为、焦点回收和操作槽逐渐漂移。
 * 设计意图：Foundation 只统一菜单行为和几何，调用方继续决定实例创建、隔离状态与真实资源生命周期；不把业务菜单数据写进基础层。
 * 关键约束：打开后首项可聚焦，ArrowUp/Down 循环，Escape 回到触发器；选择后关闭并恢复触发器焦点，触发器尺寸固定。
 */
export function WorkspaceToolMenu({ items, onSelect, testId }: {
  items: readonly WorkspaceToolMenuItem[]
  onSelect: (id: string) => void
  testId?: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const choose = (id: string) => {
    setOpen(false)
    onSelect(id)
    triggerRef.current?.focus()
  }
  return <div className="relative shrink-0" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); triggerRef.current?.focus() } }}>
    <IconButton ref={triggerRef} label="添加工作区内容" size={28} aria-haspopup="menu" aria-expanded={open}
      onClick={() => setOpen((value) => !value)} data-testid={testId}><span aria-hidden="true">+</span></IconButton>
    {open && <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-md border p-1 shadow-lg"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }} role="menu" aria-label="添加工作区内容"
      onKeyDown={(event) => {
        const menuItems = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]'))
        const index = menuItems.indexOf(document.activeElement as HTMLButtonElement)
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); menuItems[(index + (event.key === 'ArrowDown' ? 1 : menuItems.length - 1)) % menuItems.length]?.focus() }
      }}>
      {items.map((item, index) => <button key={item.id} autoFocus={index === 0} type="button" role="menuitem"
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] hover:bg-[var(--bg-secondary)] focus-visible:bg-[var(--bg-secondary)]"
        onClick={() => choose(item.id)}>{item.icon}{item.label}</button>)}
    </div>}
  </div>
}

/**
 * 统一主题化下拉选择框（SelectField）。
 *
 * 背景：原生 HTML `<select>` 在 Windows Chromium/Electron 下点击会弹出 Win32 原生蓝底（#0078D7）系统菜单，
 * 与应用的圆角、卡片底色及主题主色（--accent-subtle / --accent-fg）严重割裂。
 * 设计意图：保留真实 `<select>` 节点作为唯一顶层 DOM 元素（100% 兼容 Playwright `selectOption`、键盘导航、
 * `<label>` 包裹及父级 flex/grid 布局），同时在鼠标左键 `onMouseDown` 时 `preventDefault()` 拦截原生系统弹窗，
 * 改由 Portal 渲染符合当前主题 Token 的圆角浮层菜单；点选后通过原生 value setter + `change` 事件驱动 React 受控/非受控更新。
 * 关键约束：不引入外层包裹 div 以免破坏调用方 className 布局；组件卸载或外部点击/Escape/滚动时自动关闭浮层。
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type SelectHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'

interface ParsedOption {
  value: string
  label: string
  disabled: boolean
}

interface MenuRect {
  top: number
  left: number
  width: number
  openUpward: boolean
  maxHeight: number
}

const CHEVRON_SVG_DATA_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23787d82' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

export const SelectField = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ className = '', style, onMouseDown, onChange, disabled, ...props }, forwardedRef) {
    const innerRef = useRef<HTMLSelectElement | null>(null)
    useImperativeHandle(forwardedRef, () => innerRef.current as HTMLSelectElement)

    const menuRef = useRef<HTMLDivElement | null>(null)
    const [open, setOpen] = useState(false)
    const [options, setOptions] = useState<ParsedOption[]>([])
    const [currentValue, setCurrentValue] = useState<string>('')
    const [menuRect, setMenuRect] = useState<MenuRect | null>(null)

    const syncFromDom = useCallback(() => {
      const el = innerRef.current
      if (!el) return
      const list: ParsedOption[] = Array.from(el.options).map((opt) => ({
        value: opt.value,
        label: opt.text,
        disabled: opt.disabled,
      }))
      setOptions(list)
      setCurrentValue(el.value)
      const rect = el.getBoundingClientRect()
      const estimatedHeight = Math.min(280, Math.max(44, list.length * 32 + 12))
      const spaceBelow = window.innerHeight - rect.bottom - 12
      const spaceAbove = rect.top - 12
      const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow
      const maxHeight = Math.max(120, Math.min(280, openUpward ? spaceAbove : spaceBelow))
      setMenuRect({
        top: openUpward ? rect.top - 4 : rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 160) - 8)),
        width: Math.max(rect.width, 160),
        openUpward,
        maxHeight,
      })
    }, [])

    const handleMouseDown = (e: ReactMouseEvent<HTMLSelectElement>) => {
      onMouseDown?.(e)
      if (e.defaultPrevented || disabled || e.button !== 0) return
      // 阻止 Windows / Chromium 原生蓝底系统下拉菜单弹出，改用主题化浮层
      e.preventDefault()
      innerRef.current?.focus()
      if (open) {
        setOpen(false)
      } else {
        syncFromDom()
        setOpen(true)
      }
    }

    const selectValue = (nextVal: string) => {
      const el = innerRef.current
      setOpen(false)
      if (!el || el.value === nextVal) return
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
      if (nativeSetter) {
        nativeSetter.call(el, nextVal)
      } else {
        el.value = nextVal
      }
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }

    useEffect(() => {
      if (!open) return
      const handlePointerDown = (e: globalThis.MouseEvent) => {
        const target = e.target as Node | null
        if (!target) return
        if (innerRef.current?.contains(target) || menuRef.current?.contains(target)) return
        setOpen(false)
      }
      const handleKeyDown = (e: globalThis.KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Tab') {
          setOpen(false)
        }
      }
      const handleScrollOrResize = (e: Event) => {
        if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return
        setOpen(false)
      }
      document.addEventListener('mousedown', handlePointerDown)
      document.addEventListener('keydown', handleKeyDown)
      window.addEventListener('resize', handleScrollOrResize)
      window.addEventListener('scroll', handleScrollOrResize, true)
      return () => {
        document.removeEventListener('mousedown', handlePointerDown)
        document.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('resize', handleScrollOrResize)
        window.removeEventListener('scroll', handleScrollOrResize, true)
      }
    }, [open])

    return (
      <>
        <select
          {...props}
          ref={innerRef}
          disabled={disabled}
          onChange={onChange}
          onMouseDown={handleMouseDown}
          className={`theme-input h-9 min-w-0 w-full cursor-pointer appearance-none rounded-md border pl-2.5 pr-7 text-xs outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          style={{
            backgroundImage: CHEVRON_SVG_DATA_URL,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.55rem center',
            backgroundSize: '14px 14px',
            ...style,
          }}
        />
        {open && menuRect && typeof document !== 'undefined'
          ? createPortal(
              <div
                ref={menuRef}
                role="listbox"
                aria-label={props['aria-label'] || '下拉选项'}
                data-testid="select-field-popover"
                className="scrollbar-thin fixed z-[9999] overflow-y-auto rounded-[var(--radius-md)] border p-1 shadow-lg backdrop-blur-md"
                style={{
                  top: menuRect.openUpward ? undefined : menuRect.top,
                  bottom: menuRect.openUpward ? window.innerHeight - menuRect.top : undefined,
                  left: menuRect.left,
                  width: menuRect.width,
                  maxHeight: menuRect.maxHeight,
                  background: 'color-mix(in srgb, var(--dropdown-bg, var(--card-bg)) 97%, transparent)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {options.map((opt, idx) => {
                  const selected = opt.value === currentValue
                  return (
                    <button
                      key={`${opt.value}-${idx}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={opt.disabled}
                      onMouseDown={(e) => {
                        // 防止按钮抢走 select 焦点导致外层表单 blur
                        e.preventDefault()
                      }}
                      onClick={() => {
                        if (!opt.disabled) selectValue(opt.value)
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-xs transition hover:bg-[var(--hover-overlay)] disabled:cursor-not-allowed disabled:opacity-45"
                      style={{
                        background: selected ? 'var(--accent-subtle)' : undefined,
                        color: selected ? 'var(--accent-fg)' : 'var(--text-primary)',
                        fontWeight: selected ? 600 : 400,
                      }}
                    >
                      <span className="truncate">{opt.label}</span>
                      {selected && (
                        <Check
                          size={13}
                          strokeWidth={2.3}
                          className="shrink-0"
                          style={{ color: 'var(--accent-fg)' }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>,
              document.body,
            )
          : null}
      </>
    )
  },
)

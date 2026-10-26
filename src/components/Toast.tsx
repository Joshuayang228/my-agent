import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { Check, CircleAlert, Info, X, XCircle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
  onPresented?: () => void
}

export type ToastPreviewItem = ToastItem

interface ToastContextValue {
  toast: (message: string, type?: ToastType, options?: { onPresented?: () => void }) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info', options?: { onPresented?: () => void }) => {
    const id = ++nextId
    setItems(prev => [...prev, { id, message, type, onPresented: options?.onPresented }])
    setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex max-w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map(item => (
          <ToastBubble key={item.id} item={item} onDismiss={(id) => setItems(prev => prev.filter(t => t.id !== id))} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const TYPE_STYLES: Record<ToastType, { border: string; background: string; color: string }> = {
  success: { border: 'color-mix(in srgb, var(--success) 38%, var(--border-color))', background: 'color-mix(in srgb, var(--success) 10%, var(--card-bg))', color: 'var(--success)' },
  error: { border: 'color-mix(in srgb, var(--danger) 42%, var(--border-color))', background: 'color-mix(in srgb, var(--danger) 10%, var(--card-bg))', color: 'var(--danger)' },
  warning: { border: 'color-mix(in srgb, var(--warning) 42%, var(--border-color))', background: 'color-mix(in srgb, var(--warning) 10%, var(--card-bg))', color: 'var(--warning)' },
  info: { border: 'color-mix(in srgb, var(--accent) 38%, var(--border-color))', background: 'color-mix(in srgb, var(--accent) 9%, var(--card-bg))', color: 'var(--accent-fg)' },
}

const TYPE_ICONS: Record<ToastType, typeof Check> = {
  success: Check,
  error: XCircle,
  warning: CircleAlert,
  info: Info,
}

export function ToastBubble({ item, onDismiss, staticPreview = false }: { item: ToastItem; onDismiss: (id: number) => void; staticPreview?: boolean }) {
  const [visible, setVisible] = useState(staticPreview)
  const element = useRef<HTMLDivElement>(null)
  const presented = useRef(false)
  const Icon = TYPE_ICONS[item.type]
  const style = TYPE_STYLES[item.type]

  useEffect(() => {
    if (staticPreview) {
      setVisible(true)
      return
    }
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [staticPreview])

  /** 背景：加入 React 队列不代表提示已呈现，不能据此发送问候回执。
   * 意图：在可见样式提交后的绘制帧核对 DOM，回调只执行一次。
   * 约束：隐藏文档、已卸载或隔离静态样张不报呈现；回调不改变外观和关闭时机。
   */
  useEffect(() => {
    if (!visible || staticPreview || presented.current || !item.onPresented) return
    let frame = 0
    let cancelled = false
    const report = () => {
      frame = requestAnimationFrame(() => {
        const node = element.current
        if (cancelled || presented.current || !node?.isConnected || document.visibilityState !== 'visible' || !node.getBoundingClientRect().width || Number(getComputedStyle(node).opacity) <= 0) return
        presented.current = true
        item.onPresented?.()
      })
    }
    frame = requestAnimationFrame(report)
    document.addEventListener('visibilitychange', report)
    return () => { cancelled = true; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', report) }
  }, [visible, staticPreview, item])

  return (
    <div ref={element}
      className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3.5 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-300 ${staticPreview ? 'w-full' : ''} ${visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}
      style={{ borderColor: style.border, background: style.background, color: style.color }}
      role="status"
    >
      <Icon size={15} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 text-[12px] leading-5" style={{ color: 'var(--text-primary)' }}>{item.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className={`mt-0.5 shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${staticPreview ? 'ml-auto' : ''}`}
        style={{ color: 'var(--text-muted)' }}
        aria-label="关闭通知"
      >
        <X size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  )
}

/** Playground 只读预览：复用正式 ToastBubble，不触发全局通知。 */
export function ToastPreview({ items }: { items: ToastPreviewItem[] }) {
  const [visibleItems, setVisibleItems] = useState(items)

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      {visibleItems.map((item) => (
        <ToastBubble
          key={item.id}
          item={item}
          onDismiss={(id) => setVisibleItems((current) => current.filter((entry) => entry.id !== id))}
          staticPreview
        />
      ))}
    </div>
  )
}

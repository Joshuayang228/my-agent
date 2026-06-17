import { useState, useEffect, useCallback, createContext, useContext } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId
    setItems(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
        {items.map(item => (
          <ToastBubble key={item.id} item={item} onDismiss={(id) => setItems(prev => prev.filter(t => t.id !== id))} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200',
  error: 'border-red-500/40 bg-red-950/90 text-red-200',
  warning: 'border-amber-500/40 bg-amber-950/90 text-amber-200',
  info: 'border-cyan-500/40 bg-slate-800/95 text-slate-200',
}

const TYPE_ICONS: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  warning: '\u26A0',
  info: '\u2139',
}

function ToastBubble({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={`pointer-events-auto flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-300 ${TYPE_STYLES[item.type]} ${visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}
      onClick={() => onDismiss(item.id)}
    >
      <span className="text-sm font-medium">{TYPE_ICONS[item.type]}</span>
      <span className="text-sm">{item.message}</span>
    </div>
  )
}

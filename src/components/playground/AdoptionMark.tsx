import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { BadgeCheck } from 'lucide-react'

const ADOPTION_VISIBILITY_KEY = 'playground.show-adopted'

type AdoptionVisibilityContextValue = {
  showAdopted: boolean
  setShowAdopted: (visible: boolean) => void
}

const AdoptionVisibilityContext = createContext<AdoptionVisibilityContextValue>({
  showAdopted: true,
  setShowAdopted: () => undefined,
})

function readStoredVisibility() {
  if (typeof window === 'undefined') return true
  try {
    const stored = window.localStorage.getItem(ADOPTION_VISIBILITY_KEY)
    return stored !== 'false'
  } catch {
    return true
  }
}

/**
 * Playground 采用标记的唯一显示策略：默认全显，便于审计；用户选择写入本机偏好。
 * 这里只控制图标可见性，不改变任何故事的 adopted 事实或引入其他状态。
 */
export function AdoptionVisibilityProvider({ children }: { children: ReactNode }) {
  const [showAdopted, setShowAdopted] = useState(readStoredVisibility)

  useEffect(() => {
    try {
      window.localStorage.setItem(ADOPTION_VISIBILITY_KEY, String(showAdopted))
    } catch {
      /* localStorage may be unavailable in a restricted browser context. */
    }
  }, [showAdopted])

  return <AdoptionVisibilityContext.Provider value={{ showAdopted, setShowAdopted }}>{children}</AdoptionVisibilityContext.Provider>
}

export function useAdoptionVisibility() {
  return useContext(AdoptionVisibilityContext)
}

export function AdoptionVisibilityToggle() {
  const { showAdopted, setShowAdopted } = useAdoptionVisibility()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={showAdopted}
      onClick={() => setShowAdopted(!showAdopted)}
      className="inline-flex min-h-7 items-center gap-2 rounded-md px-1.5 py-1 text-[10px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      style={{
        color: showAdopted ? 'var(--success)' : 'var(--text-muted)',
        background: 'var(--bg-secondary)',
      }}
      title={showAdopted ? '隐藏所有已采用标记' : '显示所有已采用标记'}
    >
      <span>显示已采用</span>
      <span
        aria-hidden="true"
        className="relative h-4 w-7 shrink-0 rounded-full transition-colors"
        style={{ background: showAdopted ? 'var(--success)' : 'var(--border-color)' }}
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full transition-transform"
          style={{
            background: 'var(--bg-primary)',
            transform: showAdopted ? 'translateX(14px)' : 'translateX(2px)',
          }}
        />
      </span>
    </button>
  )
}

/** 只表达一个事实：该设计或组件已经进入正式产品。未显示时不推断其他状态。 */
export function AdoptionMark({ label = '已采用' }: { label?: string }) {
  const { showAdopted } = useAdoptionVisibility()
  if (!showAdopted) return null

  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
      style={{ color: 'var(--success)' }}
      title={label}
      aria-label={label}
      data-testid="adoption-mark"
    >
      <BadgeCheck size={13} strokeWidth={1.8} />
    </span>
  )
}

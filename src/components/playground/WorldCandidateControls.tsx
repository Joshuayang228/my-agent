import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'

export const PlaygroundCandidateControlsTarget = createContext<HTMLElement | null>(null)

/** 样张控制需留在产品框外；Portal 保留候选本地状态，独立故事仍在原位呈现，禁止连接生产数据。 */
export function PlaygroundCandidateControls({ children }: { children: ReactNode }) {
  const target = useContext(PlaygroundCandidateControlsTarget)
  return target ? createPortal(children, target) : children
}

export const WorldCandidateControlsTarget = PlaygroundCandidateControlsTarget
export const WorldCandidateControls = PlaygroundCandidateControls

export function WorldCandidateRefresh({ label }: { label: string }) {
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    if (!refreshing) return
    const timer = setTimeout(() => setRefreshing(false), 600)
    return () => clearTimeout(timer)
  }, [refreshing])
  return <IconButton label={label} disabled={refreshing} aria-busy={refreshing} onClick={() => setRefreshing(true)}>
    <RefreshCw size={14} className={refreshing ? 'animate-spin motion-reduce:animate-none' : undefined} />
  </IconButton>
}

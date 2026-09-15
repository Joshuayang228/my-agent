import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { IconButton } from './foundation/IconButton'
import { WorldCultureContent, WorldHomeContent, WorldFootprintsContent } from './world/WorldLivingContent'

type WorldDetailTab = 'culture' | 'home' | 'footprints'

interface WorldDetailsPanelProps {
  tab: WorldDetailTab
}

interface WorldDetailsState {
  roleName: string
  presence: string
  moments: Array<{ text: string; publishedAt: number; meta: Record<string, unknown> }>
  assets: Array<{ id: string; kind: string; name: string; payload: Record<string, unknown> }>
}

/**
 * 背景：人物世界的文化角、家居和足迹入口已在 Playground 验收；文化角需要真实的多类型生活资产，不能继续只读书架映射。
 * 设计意图：文化角、家居和足迹都复用 companion_assets 的 role_id 隔离资产链路；生活动态只补充足迹的近期发生记录。
 * 关键约束：三类资产必须由真实 IPC 返回；住所与常去地点只初始化一次，不因用户删空而重新制造。
 */
export function WorldDetailsPanel({ tab }: WorldDetailsPanelProps) {
  const [state, setState] = useState<WorldDetailsState | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    if (!window.electronAPI?.companion) {
      setError('生活面需要桌面连接，请重新打开应用后重试。')
      return
    }
    setLoading(true)
    setError('')
    try {
      const [active, presence, moments, assets] = await Promise.all([
        window.electronAPI.companion.getActive(),
        window.electronAPI.companion.catchupStatus(),
        window.electronAPI.companion.getMoments({ limit: 50 }),
        window.electronAPI.companion.getAssets(),
      ])
      if (requestId.current !== currentRequest) return
      // 背景：切换主角可能发生在并行 IPC 之间；不拼接不同主角的生活信息，保留显式重试入口。
      if ([presence.roleId, moments.roleId, assets.roleId].some((roleId) => roleId !== active.id)) {
        setState(null)
        throw new Error('ROLE_CHANGED')
      }
      setState({ roleName: active.name, presence: presence.presence, moments: moments.items, assets: assets.items })
    } catch {
      if (requestId.current === currentRequest) setError('生活面暂时无法加载，请重试。')
    } finally {
      if (requestId.current === currentRequest) setLoading(false)
    }
  }, [])

  useEffect(() => { void load(); return () => { requestId.current++ } }, [load])

  if (loading && !state) return <div className="p-5 text-xs" style={{ color: 'var(--text-muted)' }}>正在整理生活面…</div>
  if (error && !state) return <div role="alert" className="flex items-center gap-2 p-5 text-xs" style={{ color: 'var(--danger)' }}><span>{error}</span><IconButton label="重试生活面" size={32} onClick={() => void load()}><RefreshCw size={14} /></IconButton></div>
  if (!state) return null

  return <div className="min-w-0 space-y-3 p-5" data-testid="world-details">
    <div className="flex items-center justify-between gap-3"><div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{state.roleName}的{tab === 'culture' ? '文化角' : tab === 'home' ? '家居' : '足迹'}</div><IconButton label={error ? '重试生活面' : '刷新生活面'} size={32} onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /></IconButton></div>
    {error && <p role="alert" className="text-[11px]" style={{ color: 'var(--danger)' }}>{error}</p>}
    {tab === 'culture' && <WorldCultureContent assets={state.assets} />}
    {tab === 'home' && <WorldHomeContent assets={state.assets} presence={state.presence} />}
    {tab === 'footprints' && <WorldFootprintsContent assets={state.assets} moments={state.moments} />}
  </div>
}

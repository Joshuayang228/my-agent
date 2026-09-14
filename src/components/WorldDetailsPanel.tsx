import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Home, MapPin, RefreshCw } from 'lucide-react'

type WorldDetailTab = 'culture' | 'home' | 'footprints'

interface WorldDetailsPanelProps {
  tab: WorldDetailTab
}

interface WorldDetailsState {
  roleName: string
  presence: string
  moments: Array<{ text: string; publishedAt: number; meta: Record<string, unknown> }>
  assets: Array<{ kind: string; name: string; payload: Record<string, unknown> }>
}

/**
 * 背景：人物世界的文化角、家居和足迹入口已在 Playground 验收；文化角需要真实的多类型生活资产，不能继续只读书架映射。
 * 设计意图：文化角复用 companion_assets 的 role_id 隔离资产链路；家居和足迹继续读取已有世界状态与生活事件，避免创建第二份事实源。
 * 关键约束：文化资产必须带稳定类型并由真实 IPC 返回；家居/足迹尚无独立写入契约，不提供虚构编辑。
 */
export function WorldDetailsPanel({ tab }: WorldDetailsPanelProps) {
  const [state, setState] = useState<WorldDetailsState | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!window.electronAPI?.companion) return
    setLoading(true)
    setError('')
    try {
      const [active, presence, moments, assets] = await Promise.all([
        window.electronAPI.companion.getActive(),
        window.electronAPI.companion.catchupStatus(),
        window.electronAPI.companion.getMoments({ limit: 50 }),
        window.electronAPI.companion.getAssets(),
      ])
      setState({ roleName: active.name, presence: presence.presence, moments: moments.items, assets: assets.items })
    } catch {
      setError('生活面暂时无法加载，请重试。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading && !state) return <div className="p-5 text-xs" style={{ color: 'var(--text-muted)' }}>正在整理生活面…</div>
  if (error && !state) return <div className="flex items-center gap-2 p-5 text-xs" style={{ color: 'var(--danger)' }}><span>{error}</span><button type="button" onClick={() => void load()} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border" style={{ borderColor: 'var(--border-subtle)' }} title="重试"><RefreshCw size={13} /></button></div>
  if (!state) return null

  const culture = state.assets.filter((item) => item.kind === 'culture')
  const places = state.moments.map((item) => typeof item.meta.location === 'string' ? item.meta.location.trim() : '').filter(Boolean)
  const uniquePlaces = [...new Set(places)]

  return <div className="space-y-3 p-5">
    <div className="flex items-center justify-between gap-3"><div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{state.roleName}的{tab === 'culture' ? '文化角' : tab === 'home' ? '家居' : '足迹'}</div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border disabled:opacity-40" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }} title="刷新"><RefreshCw size={13} className={loading ? 'animate-spin' : undefined} /></button></div>
    {tab === 'culture' && <section className="rounded-[var(--radius-lg)] border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}><div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--accent-fg)' }}><BookOpen size={14} />文化记录</div>{culture.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{culture.map((item) => <div key={item.name} className="rounded-[var(--radius-md)] border px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}><div className="flex items-center justify-between gap-2"><div className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{item.name}</div><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{typeof item.payload.type === 'string' ? item.payload.type : '记录'}</span></div><div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{typeof item.payload.detail === 'string' ? item.payload.detail : typeof item.payload.note === 'string' ? item.payload.note : '来自伙伴文化角'}</div></div>)}</div> : <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>还没有可展示的文化记录。</p>}</section>}
    {tab === 'home' && <section className="rounded-[var(--radius-lg)] border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}><div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--accent-fg)' }}><Home size={14} />当前在场</div><div className="mt-2 text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{state.presence || '正在整理此刻的生活状态'}</div><p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>这里展示伙伴当前生活状态与已记录的生活物件；暂不提供虚构的家居编辑。</p></section>}
    {tab === 'footprints' && <section className="rounded-[var(--radius-lg)] border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}><div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--accent-fg)' }}><MapPin size={14} />生活地点</div>{uniquePlaces.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{uniquePlaces.map((place) => <div key={place} className="rounded-[var(--radius-md)] border px-3 py-2 text-[12px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>{place}</div>)}</div> : <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>还没有记录到生活地点。</p>}</section>}
  </div>
}

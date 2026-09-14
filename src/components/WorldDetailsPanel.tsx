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
 * 背景：人物世界的文化角、家居和足迹入口已在 Playground 验收，但生产端没有独立的三套存储。
 * 设计意图：先用已有真实世界状态、生活事件和资产 IPC 组合出只读生活面，不伪造可编辑数据或复制 Playground fixture。
 * 关键约束：每个展示字段必须来自真实 companion IPC；新增编辑、独立排序或持久化前必须先建立对应数据契约，不能把派生视图当作事实源。
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

  const books = state.assets.filter((item) => item.kind === 'bookshelf')
  const places = state.moments.map((item) => typeof item.meta.location === 'string' ? item.meta.location.trim() : '').filter(Boolean)
  const uniquePlaces = [...new Set(places)]

  return <div className="space-y-3 p-5">
    <div className="flex items-center justify-between gap-3"><div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{state.roleName}的{tab === 'culture' ? '文化角' : tab === 'home' ? '家居' : '足迹'}</div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border disabled:opacity-40" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }} title="刷新"><RefreshCw size={13} className={loading ? 'animate-spin' : undefined} /></button></div>
    {tab === 'culture' && <section className="rounded-[var(--radius-lg)] border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}><div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--accent-fg)' }}><BookOpen size={14} />书架</div>{books.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{books.map((book) => <div key={book.name} className="rounded-[var(--radius-md)] border px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}><div className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{book.name}</div><div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{typeof book.payload.note === 'string' ? book.payload.note : '来自伙伴书架'}</div></div>)}</div> : <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>还没有可展示的文化资产。</p>}</section>}
    {tab === 'home' && <section className="rounded-[var(--radius-lg)] border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}><div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--accent-fg)' }}><Home size={14} />当前在场</div><div className="mt-2 text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{state.presence || '正在整理此刻的生活状态'}</div><p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>这里展示伙伴当前生活状态与已记录的生活物件；暂不提供虚构的家居编辑。</p></section>}
    {tab === 'footprints' && <section className="rounded-[var(--radius-lg)] border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}><div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--accent-fg)' }}><MapPin size={14} />生活地点</div>{uniquePlaces.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{uniquePlaces.map((place) => <div key={place} className="rounded-[var(--radius-md)] border px-3 py-2 text-[12px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>{place}</div>)}</div> : <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>还没有记录到生活地点。</p>}</section>}
  </div>
}

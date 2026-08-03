/**
 * 活跃主角朋友圈时间线（生活面卡片）
 * 仅展示当前 activeRole 的 moments；切换主角后列表随 IPC 变。
 */

import { useCallback, useEffect, useState } from 'react'
import { Newspaper, RefreshCw, X } from 'lucide-react'

interface MomentItem {
  id: string
  roleId: string
  eventId: string
  publishedAt: number
  text: string
  meta: Record<string, unknown>
}

interface MomentsPanelProps {
  onClose: () => void
}

const TYPE_DOT: Record<string, string> = {
  daily: 'var(--companion-accent-warm)',
  social: 'var(--accent-fg)',
  work: 'var(--warning)',
  mood: 'var(--success)',
  outfit: '#a78bfa',
}

function formatWhen(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function typeColor(type: unknown): string {
  if (typeof type !== 'string' || !type) return 'var(--companion-accent-warm)'
  const key = type.toLowerCase()
  return TYPE_DOT[key] || 'var(--companion-accent-warm)'
}

interface MomentInteractionView {
  kind: string
  castName: string
  text?: string
}

function parseInteractions(meta: Record<string, unknown>): MomentInteractionView[] {
  const raw = meta.interactions
  if (!Array.isArray(raw)) return []
  const out: MomentInteractionView[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const castName = typeof r.castName === 'string' ? r.castName : ''
    const kind = typeof r.kind === 'string' ? r.kind : ''
    if (!castName || (kind !== 'coframe' && kind !== 'comment')) continue
    out.push({
      kind,
      castName,
      text: typeof r.text === 'string' ? r.text : undefined,
    })
  }
  return out
}

export function MomentsPanel({ onClose }: MomentsPanelProps) {
  const [roleId, setRoleId] = useState('')
  const [roleName, setRoleName] = useState('')
  const [items, setItems] = useState<MomentItem[]>([])
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!window.electronAPI?.companion) return
    setLoading(true)
    try {
      const [active, moments, status] = await Promise.all([
        window.electronAPI.companion.getActive(),
        window.electronAPI.companion.getMoments({ limit: 80 }),
        window.electronAPI.companion.catchupStatus(),
      ])
      setRoleId(moments.roleId)
      setRoleName(active.name)
      setItems(moments.items)
      setSummary(status.catchupSummary || '')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!window.electronAPI?.companion.onRoleChanged) return
    return window.electronAPI.companion.onRoleChanged(() => {
      void load()
    })
  }, [load])

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <Newspaper size={16} style={{ color: 'var(--companion-accent-warm)' }} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              朋友圈
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {roleName || roleId || '活跃主角'} · 生活广播（非日志表）
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => load()}
            className="rounded p-1.5 transition"
            style={{ color: 'var(--text-muted)' }}
            title="刷新"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 transition"
            style={{ color: 'var(--text-muted)' }}
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {summary ? (
          <div
            className="mb-4 rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed"
            style={{
              borderColor: 'var(--companion-catchup-border)',
              background: 'var(--companion-catchup-bg)',
              color: 'var(--text-secondary)',
            }}
          >
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--companion-accent-warm)' }}>
              Catch-up
            </div>
            {summary}
          </div>
        ) : null}

        {items.length === 0 && !loading ? (
          <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
            还没有动态。活跃主角生活 tick / Catch-up 后会出现在这里。
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((m) => {
              const type = typeof m.meta?.type === 'string' ? m.meta.type : ''
              const location = typeof m.meta?.location === 'string' ? m.meta.location : ''
              const interactions = parseInteractions(m.meta || {})
              const coframes = interactions.filter((i) => i.kind === 'coframe')
              const comments = interactions.filter((i) => i.kind === 'comment')
              return (
                <li
                  key={m.id}
                  className="companion-life-card rounded-xl border px-3.5 py-3"
                  style={{
                    borderColor: 'var(--card-border)',
                    background: 'var(--card-bg)',
                    boxShadow: 'var(--companion-shadow-card)',
                  }}
                >
                  <div className="mb-1.5 flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: typeColor(type) }}
                      aria-hidden
                    />
                    <span>{formatWhen(m.publishedAt)}</span>
                    {type ? <span>· {type}</span> : null}
                    {location ? <span>· {location}</span> : null}
                    {coframes.length ? (
                      <span>· 与{coframes.map((c) => c.castName).join('、')}同框</span>
                    ) : null}
                  </div>
                  <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {m.text}
                  </div>
                  {comments.length ? (
                    <ul className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                      {comments.map((c, idx) => (
                        <li
                          key={`${c.castName}-${idx}`}
                          className="text-[11px] leading-snug"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <span style={{ color: 'var(--companion-accent-warm)' }}>{c.castName}</span>
                          {'：'}
                          {c.text || '赞'}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

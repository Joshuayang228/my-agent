/**
 * 活跃主角朋友圈时间线（W3）
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

function formatWhen(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
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

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <Newspaper size={16} style={{ color: 'var(--accent-fg)' }} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              朋友圈
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {roleName || roleId || '活跃主角'} · 仅当前角色
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
            className="mb-4 rounded-md border px-3 py-2 text-[12px] leading-relaxed"
            style={{
              borderColor: 'var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
            }}
          >
            {summary}
          </div>
        ) : null}

        {items.length === 0 && !loading ? (
          <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
            还没有动态。活跃主角生活 tick / Catch-up 后会出现在这里。
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((m) => (
              <li
                key={m.id}
                className="rounded-md border px-3 py-2.5"
                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
              >
                <div className="mb-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {formatWhen(m.publishedAt)}
                  {typeof m.meta?.type === 'string' ? ` · ${m.meta.type}` : ''}
                </div>
                <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {m.text}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

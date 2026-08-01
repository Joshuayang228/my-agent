/**
 * 活跃主角衣柜等资产只读列表（W4）
 */

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Shirt, X } from 'lucide-react'

interface AssetItem {
  id: string
  roleId: string
  kind: string
  name: string
  payload: Record<string, unknown>
  acquiredAt: number
  sourceEventId: string | null
}

interface AssetsPanelProps {
  onClose: () => void
}

export function AssetsPanel({ onClose }: AssetsPanelProps) {
  const [roleId, setRoleId] = useState('')
  const [roleName, setRoleName] = useState('')
  const [items, setItems] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!window.electronAPI?.companion) return
    setLoading(true)
    try {
      const [active, assets] = await Promise.all([
        window.electronAPI.companion.getActive(),
        window.electronAPI.companion.getAssets({ kind: 'wardrobe' }),
      ])
      setRoleId(assets.roleId)
      setRoleName(active.name)
      setItems(assets.items)
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
          <Shirt size={16} style={{ color: 'var(--accent-fg)' }} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              衣柜
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
        {items.length === 0 && !loading ? (
          <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
            衣柜还是空的。
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5"
                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
              >
                <div>
                  <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                    {a.name}
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {a.kind}
                    {typeof a.payload.color === 'string' ? ` · ${a.payload.color}` : ''}
                    {typeof a.payload.style === 'string' ? ` · ${a.payload.style}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

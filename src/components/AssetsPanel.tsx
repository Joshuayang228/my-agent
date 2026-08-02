/**
 * 活跃主角衣柜（生活面）：穿着中主卡 + 库存网格 / 场合标签
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Shirt, Sparkles, X } from 'lucide-react'

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

function occasionTags(payload: Record<string, unknown>): string[] {
  const tags: string[] = []
  if (typeof payload.style === 'string' && payload.style.trim()) tags.push(payload.style.trim())
  if (typeof payload.occasion === 'string' && payload.occasion.trim()) tags.push(payload.occasion.trim())
  if (typeof payload.color === 'string' && payload.color.trim()) tags.push(payload.color.trim())
  return tags
}

export function AssetsPanel({ onClose }: AssetsPanelProps) {
  const [roleId, setRoleId] = useState('')
  const [roleName, setRoleName] = useState('')
  const [items, setItems] = useState<AssetItem[]>([])
  const [wearingId, setWearingId] = useState<string | null>(null)
  const [wearingHint, setWearingHint] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!window.electronAPI?.companion) return
    setLoading(true)
    try {
      const [active, assets, moments] = await Promise.all([
        window.electronAPI.companion.getActive(),
        window.electronAPI.companion.getAssets({ kind: 'wardrobe' }),
        window.electronAPI.companion.getMoments({ limit: 20 }),
      ])
      setRoleId(assets.roleId)
      setRoleName(active.name)
      setItems(assets.items)

      let foundId: string | null = null
      let hint = ''
      for (const m of moments.items) {
        const assetId = typeof m.meta?.assetId === 'string' ? m.meta.assetId : ''
        const outfit = typeof m.meta?.outfit === 'string' ? m.meta.outfit : ''
        if (assetId && assets.items.some((a) => a.id === assetId)) {
          foundId = assetId
          hint = typeof m.meta?.location === 'string' && m.meta.location
            ? `最近动态 · ${m.meta.location}`
            : '来自最近生活动态'
          break
        }
        if (outfit) {
          const byName = assets.items.find((a) => a.name === outfit)
          if (byName) {
            foundId = byName.id
            hint = '来自最近生活动态'
            break
          }
        }
      }
      setWearingId(foundId)
      setWearingHint(hint)
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

  const wearing = useMemo(
    () => (wearingId ? items.find((a) => a.id === wearingId) ?? null : null),
    [items, wearingId],
  )
  const inventory = useMemo(
    () => items.filter((a) => a.id !== wearing?.id),
    [items, wearing],
  )

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <Shirt size={16} style={{ color: 'var(--companion-accent-warm)' }} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              衣柜
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {roleName || roleId || '活跃主角'} · 叙事道具（非资产表）
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

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {/* 穿着中主卡 */}
        <section className="mb-5">
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--companion-accent-warm)' }}
          >
            穿着中
          </div>
          {wearing ? (
            <div
              className="companion-life-card rounded-xl border p-4"
              style={{
                borderColor: 'var(--companion-accent-warm)',
                background: 'var(--card-bg)',
                boxShadow: 'var(--companion-shadow-card)',
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: 'var(--companion-catchup-bg)',
                    color: 'var(--companion-accent-warm)',
                  }}
                >
                  <Sparkles size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {wearing.name}
                  </div>
                  {wearingHint ? (
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {wearingHint}
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {occasionTags(wearing.payload).map((t) => (
                      <span
                        key={t}
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          background: 'var(--companion-catchup-bg)',
                          color: 'var(--companion-accent-warm)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl border border-dashed px-4 py-5 text-center text-[12px]"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
            >
              暂无近期穿着记录。生活 tick 带上衣柜引用后，会显示在这里。
            </div>
          )}
        </section>

        {/* 库存网格 */}
        <section>
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            库存 {items.length ? `· ${items.length}` : ''}
          </div>
          {items.length === 0 && !loading ? (
            <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
              衣柜还是空的。
            </p>
          ) : (
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(9.5rem, 1fr))' }}
            >
              {(wearing ? inventory : items).map((a) => (
                <div
                  key={a.id}
                  className="companion-life-card rounded-xl border px-3 py-3"
                  style={{
                    borderColor: 'var(--card-border)',
                    background: 'var(--card-bg)',
                    boxShadow: 'var(--companion-shadow-card)',
                  }}
                >
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                    <Shirt size={16} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div className="truncate text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                    {a.name}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {occasionTags(a.payload).map((t) => (
                      <span
                        key={t}
                        className="rounded-full px-1.5 py-0.5 text-[10px]"
                        style={{
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

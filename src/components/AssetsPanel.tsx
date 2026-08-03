/**
 * 活跃主角物什（生活面）：衣柜 + 书架分栏；编辑/删除（M25-G1·G3）
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, Pencil, RefreshCw, Shirt, Sparkles, Trash2, X } from 'lucide-react'

type AssetTab = 'wardrobe' | 'bookshelf'

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
  for (const key of ['style', 'occasion', 'color', 'genre', 'author', 'note']) {
    const v = payload[key]
    if (typeof v === 'string' && v.trim()) tags.push(v.trim())
  }
  return tags.slice(0, 4)
}

function strField(payload: Record<string, unknown>, key: string): string {
  const v = payload[key]
  return typeof v === 'string' ? v : ''
}

export function AssetsPanel({ onClose }: AssetsPanelProps) {
  const [roleId, setRoleId] = useState('')
  const [roleName, setRoleName] = useState('')
  const [items, setItems] = useState<AssetItem[]>([])
  const [tab, setTab] = useState<AssetTab>('wardrobe')
  const [wearingId, setWearingId] = useState<string | null>(null)
  const [wearingHint, setWearingHint] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editA, setEditA] = useState('')
  const [editB, setEditB] = useState('')
  const [editC, setEditC] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    if (!window.electronAPI?.companion) return
    setLoading(true)
    try {
      const [active, assets, moments] = await Promise.all([
        window.electronAPI.companion.getActive(),
        window.electronAPI.companion.getAssets(),
        window.electronAPI.companion.getMoments({ limit: 20 }),
      ])
      setRoleId(assets.roleId)
      setRoleName(active.name)
      setItems(assets.items)

      const wardrobe = assets.items.filter((a) => a.kind === 'wardrobe')
      let foundId: string | null = null
      let hint = ''
      for (const m of moments.items) {
        const assetId = typeof m.meta?.assetId === 'string' ? m.meta.assetId : ''
        const outfit = typeof m.meta?.outfit === 'string' ? m.meta.outfit : ''
        if (assetId && wardrobe.some((a) => a.id === assetId)) {
          foundId = assetId
          hint = typeof m.meta?.location === 'string' && m.meta.location
            ? `最近动态 · ${m.meta.location}`
            : '来自最近生活动态'
          break
        }
        if (outfit) {
          const byName = wardrobe.find((a) => a.name === outfit)
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
      setEditingId(null)
      void load()
    })
  }, [load])

  const tabItems = useMemo(
    () => items.filter((a) => a.kind === tab),
    [items, tab],
  )
  const wearing = useMemo(
    () => (wearingId ? items.find((a) => a.id === wearingId) ?? null : null),
    [items, wearingId],
  )
  const inventory = useMemo(
    () => tabItems.filter((a) => a.id !== wearing?.id),
    [tabItems, wearing],
  )

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2200)
  }

  const startEdit = (a: AssetItem) => {
    setEditingId(a.id)
    setEditName(a.name)
    if (a.kind === 'bookshelf') {
      setEditA(strField(a.payload, 'author'))
      setEditB(strField(a.payload, 'genre'))
      setEditC(strField(a.payload, 'note'))
    } else {
      setEditA(strField(a.payload, 'color'))
      setEditB(strField(a.payload, 'style'))
      setEditC(strField(a.payload, 'occasion'))
    }
  }

  const saveEdit = async () => {
    if (!editingId || !window.electronAPI?.companion?.updateAsset) return
    const current = items.find((a) => a.id === editingId)
    const isBook = current?.kind === 'bookshelf'
    setBusy(true)
    try {
      const result = await window.electronAPI.companion.updateAsset(editingId, {
        name: editName,
        payload: isBook
          ? { author: editA, genre: editB, note: editC }
          : { color: editA, style: editB, occasion: editC },
      })
      if (!result.ok) {
        flash(result.error || '保存失败')
        return
      }
      setEditingId(null)
      flash('已保存')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const removeAsset = async (a: AssetItem) => {
    if (!window.electronAPI?.companion?.deleteAsset) return
    const hint = a.kind === 'bookshelf'
      ? '删除后历史引用会降级为无书名。'
      : '历史动态里的着装引用会降级为无着装。'
    if (!window.confirm(`删除「${a.name}」？${hint}`)) return
    setBusy(true)
    try {
      const result = await window.electronAPI.companion.deleteAsset(a.id)
      if (!result.ok) {
        flash(result.error || '删除失败')
        return
      }
      if (editingId === a.id) setEditingId(null)
      if (wearingId === a.id) setWearingId(null)
      flash('已删除')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const fieldLabels = tab === 'bookshelf'
    ? [
        { label: '作者', value: editA, set: setEditA },
        { label: '类型', value: editB, set: setEditB },
        { label: '备注', value: editC, set: setEditC },
      ]
    : [
        { label: '颜色', value: editA, set: setEditA },
        { label: '风格', value: editB, set: setEditB },
        { label: '场合', value: editC, set: setEditC },
      ]

  const renderEditForm = (a: AssetItem) => (
    <div className="mt-2 space-y-2 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <label className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {a.kind === 'bookshelf' ? '书名' : '名称'}
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="mt-0.5 w-full rounded border px-2 py-1 text-[12px]"
          style={{
            borderColor: 'var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
          }}
          maxLength={40}
        />
      </label>
      <div className="grid grid-cols-3 gap-1.5">
        {fieldLabels.map((f) => (
          <label key={f.label} className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {f.label}
            <input
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              className="mt-0.5 w-full rounded border px-1.5 py-1 text-[11px]"
              style={{
                borderColor: 'var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
              }}
              maxLength={24}
            />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !editName.trim()}
          onClick={() => void saveEdit()}
          className="rounded px-2.5 py-1 text-[11px] font-medium"
          style={{
            background: 'var(--companion-accent-warm)',
            color: 'var(--bg-primary)',
            opacity: busy || !editName.trim() ? 0.5 : 1,
          }}
        >
          保存
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditingId(null)}
          className="rounded px-2.5 py-1 text-[11px]"
          style={{ color: 'var(--text-muted)' }}
        >
          取消
        </button>
      </div>
    </div>
  )

  const assetActions = (a: AssetItem) => (
    <div className="mt-2 flex gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => startEdit(a)}
        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px]"
        style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}
        title="编辑"
      >
        <Pencil size={11} />
        编辑
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void removeAsset(a)}
        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px]"
        style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}
        title="删除"
      >
        <Trash2 size={11} />
        删除
      </button>
    </div>
  )

  const KindIcon = tab === 'bookshelf' ? BookOpen : Shirt

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <KindIcon size={16} style={{ color: 'var(--companion-accent-warm)' }} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              物什
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {roleName || roleId || '活跃主角'} · 衣柜 / 书架
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {toast ? (
            <span className="mr-1 text-[11px]" style={{ color: 'var(--companion-accent-warm)' }}>
              {toast}
            </span>
          ) : null}
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

      <div
        className="flex gap-1 border-b px-4 py-2"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {(
          [
            { id: 'wardrobe' as const, label: '衣柜', icon: Shirt },
            { id: 'bookshelf' as const, label: '书架', icon: BookOpen },
          ] as const
        ).map((t) => {
          const active = tab === t.id
          const Icon = t.icon
          const count = items.filter((a) => a.kind === t.id).length
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id)
                setEditingId(null)
              }}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium"
              style={{
                background: active ? 'var(--companion-catchup-bg)' : 'transparent',
                color: active ? 'var(--companion-accent-warm)' : 'var(--text-muted)',
              }}
            >
              <Icon size={12} />
              {t.label}
              {count ? ` · ${count}` : ''}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {tab === 'wardrobe' ? (
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
                    {editingId === wearing.id ? renderEditForm(wearing) : assetActions(wearing)}
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
        ) : (
          <section className="mb-4">
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              书架是角色拥有的书目真相；叙事里提到的读物应对得上这里的条目。
            </p>
          </section>
        )}

        <section>
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {tab === 'bookshelf' ? '藏书' : '库存'}
            {tabItems.length ? ` · ${tabItems.length}` : ''}
          </div>
          {tabItems.length === 0 && !loading ? (
            <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
              {tab === 'bookshelf' ? '书架还是空的。' : '衣柜还是空的。'}
            </p>
          ) : (
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(9.5rem, 1fr))' }}
            >
              {(tab === 'wardrobe' && wearing ? inventory : tabItems).map((a) => (
                <div
                  key={a.id}
                  className="companion-life-card rounded-xl border px-3 py-3"
                  style={{
                    borderColor: editingId === a.id
                      ? 'var(--companion-accent-warm)'
                      : 'var(--card-border)',
                    background: 'var(--card-bg)',
                    boxShadow: 'var(--companion-shadow-card)',
                  }}
                >
                  <div
                    className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: 'var(--bg-secondary)' }}
                  >
                    <KindIcon size={16} style={{ color: 'var(--text-secondary)' }} />
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
                  {editingId === a.id ? renderEditForm(a) : assetActions(a)}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

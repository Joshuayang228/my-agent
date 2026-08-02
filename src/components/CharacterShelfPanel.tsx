/**
 * 角色架：同宇宙 3 槽换角主入口（对齐单活跃 / 流式门控 / Catch-up）
 */

import { useCallback, useEffect, useState } from 'react'
import { LayoutGrid, RefreshCw, X } from 'lucide-react'
import { useToast } from './Toast'

interface Protagonist {
  id: string
  name: string
  description: string
}

interface CharacterShelfPanelProps {
  onClose: () => void
  /** 换角成功后通知父级刷新顶栏名称等 */
  onSwitched?: (role: Protagonist) => void
}

export function CharacterShelfPanel({ onClose, onSwitched }: CharacterShelfPanelProps) {
  const { toast } = useToast()
  const [list, setList] = useState<Protagonist[]>([])
  const [activeId, setActiveId] = useState('')
  const [loading, setLoading] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!window.electronAPI?.companion) return
    setLoading(true)
    try {
      const [pros, active] = await Promise.all([
        window.electronAPI.companion.listProtagonists(),
        window.electronAPI.companion.getActive(),
      ])
      setList(pros)
      setActiveId(active.id)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!window.electronAPI?.companion?.onRoleChanged) return
    return window.electronAPI.companion.onRoleChanged((payload) => {
      setActiveId(payload.roleId)
    })
  }, [])

  const handleSwitch = async (p: Protagonist) => {
    if (p.id === activeId || switchingId) return
    setSwitchingId(p.id)
    try {
      const result = await window.electronAPI?.companion.requestSwitch(p.id)
      if (!result) return
      if (result.ok) {
        setActiveId(p.id)
        onSwitched?.(p)
        toast(
          result.catchupQueued
            ? `已切换到${p.name}，正在追赶最近生活…`
            : `已切换到${p.name}`,
          'success',
        )
        return
      }
      if (result.code === 'SESSION_ACTIVE') {
        toast('对话进行中，请先结束或中断当前回复后再切换主角', 'error')
        return
      }
      if (result.code === 'ALREADY_ACTIVE') {
        setActiveId(p.id)
        return
      }
      toast('无法切换该主角', 'error')
    } finally {
      setSwitchingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} style={{ color: 'var(--companion-accent-warm)' }} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              角色架
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              同宇宙最多 3 位主角 · 同时仅一位活跃
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void load()}
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
        <p
          className="mb-4 rounded-lg border px-3 py-2 text-[12px] leading-relaxed"
          style={{
            borderColor: 'var(--companion-catchup-border)',
            background: 'var(--companion-catchup-bg)',
            color: 'var(--text-secondary)',
          }}
        >
          切换即完整换人：朋友圈与衣柜跟随新主角。非活跃会暂停生活世界；再次启用时 Catch-up
          最多追赶 7×24 小时。流式回复中不可切换；召唤名册角色 ≠ 换活跃主角。
        </p>

        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))' }}>
          {list.map((p) => {
            const active = p.id === activeId
            const busy = switchingId === p.id
            return (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => void handleSwitch(p)}
                className="companion-life-card rounded-xl border p-4 text-left transition"
                style={{
                  borderColor: active ? 'var(--companion-accent-warm)' : 'var(--card-border)',
                  background: 'var(--card-bg)',
                  boxShadow: active ? 'var(--companion-shadow-card)' : undefined,
                  opacity: busy ? 0.7 : 1,
                }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {p.name}
                  </span>
                  {active ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        background: 'var(--companion-catchup-bg)',
                        color: 'var(--companion-accent-warm)',
                      }}
                    >
                      活跃
                    </span>
                  ) : (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      暂停中
                    </span>
                  )}
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {p.description || '（暂无简介）'}
                </p>
                {!active && (
                  <p className="mt-3 text-[11px]" style={{ color: 'var(--companion-accent-warm)' }}>
                    {busy ? '切换中…' : '点击切换为此主角'}
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {list.length === 0 && !loading ? (
          <p className="py-10 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
            未找到主角 Pack。请检查宇宙资源是否已加载。
          </p>
        ) : null}
      </div>
    </div>
  )
}

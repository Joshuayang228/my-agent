/**
 * 名册 / 召唤摘要（W5 Surfaces）
 * 只读展示活跃主角相关卡司；召唤仅浅层 brief，不启用对方生活世界。
 */

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Users, X } from 'lucide-react'

interface RosterLine {
  otherId: string
  otherName: string
  relationType: string
  text: string
}

interface CastBrief {
  id: string
  name: string
  description: string
  summary: string
  canBeProtagonist: boolean
  summonHint: string
}

interface CastPanelProps {
  onClose: () => void
}

export function CastPanel({ onClose }: CastPanelProps) {
  const [roleId, setRoleId] = useState('')
  const [lines, setLines] = useState<RosterLine[]>([])
  const [cast, setCast] = useState<CastBrief[]>([])
  const [selected, setSelected] = useState<CastBrief | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!window.electronAPI?.companion.getRoster) return
    setLoading(true)
    try {
      const data = await window.electronAPI.companion.getRoster()
      setRoleId(data.roleId)
      setLines(data.lines)
      setCast(data.cast)
      setSelected(null)
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

  const summon = async (id: string) => {
    if (!window.electronAPI?.companion.summonBrief) return
    const r = await window.electronAPI.companion.summonBrief(id)
    if (r.ok) setSelected(r.brief)
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <Users size={16} style={{ color: 'var(--accent-fg)' }} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              名册
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              以 {roleId || '活跃主角'} 为视角 · 仅摘要
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
        <p className="mb-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          名册短句会注入主对话 Prompt。点「查看摘要」可召唤浅层信息；不会加载对方全文人设，也不会推进其生活世界。
        </p>

        {lines.length === 0 && !loading ? (
          <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
            暂无关系边。
          </p>
        ) : (
          <ul className="space-y-2">
            {lines.map((line) => {
              const brief = cast.find((c) => c.id === line.otherId)
              return (
                <li
                  key={`${line.otherId}-${line.relationType}`}
                  className="rounded-md border px-3 py-2.5"
                  style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
                >
                  <div className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
                    {line.text}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void summon(line.otherId)}
                      className="rounded px-2 py-0.5 text-[11px] transition"
                      style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }}
                    >
                      查看摘要
                    </button>
                    {brief?.canBeProtagonist ? (
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        可切换主角
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {selected ? (
          <div
            className="mt-4 rounded-md border px-3 py-3"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}
          >
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {selected.name}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {selected.summonHint || selected.summary || selected.description}
            </div>
            <p className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              召唤摘要（无 protected 全文 · 未启用生活世界）
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

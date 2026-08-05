/**
 * 伴侣状态条（展厅/故事用）。聊天主壳已收进侧栏「人物世界」，不再常驻顶栏。
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { LayoutGrid, Newspaper, Shirt, Users } from 'lucide-react'

interface CompanionStatusBarProps {
  roleName: string
  roleId: string
  onOpenMoments: () => void
  onOpenAssets: () => void
  onOpenShelf: () => void
  onOpenCast: () => void
}

export function CompanionStatusBar({
  roleName,
  roleId,
  onOpenMoments,
  onOpenAssets,
  onOpenShelf,
  onOpenCast,
}: CompanionStatusBarProps) {
  const [presence, setPresence] = useState('')
  const [catchup, setCatchup] = useState('')

  const load = useCallback(async () => {
    if (!window.electronAPI?.companion?.catchupStatus) return
    try {
      const status = await window.electronAPI.companion.catchupStatus()
      setPresence(status.presence || '')
      setCatchup(status.catchupSummary || '')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, roleId])

  useEffect(() => {
    if (!window.electronAPI?.companion?.onRoleChanged) return
    return window.electronAPI.companion.onRoleChanged(() => {
      void load()
    })
  }, [load])

  const statusLine = presence || catchup || '在线 · 生活世界运转中'

  return (
    <div
      className="companion-status-bar flex h-9 shrink-0 items-center gap-3 border-b px-4"
      style={{
        borderColor: 'var(--border-subtle)',
        background: 'var(--companion-surface)',
        backdropFilter: 'blur(var(--companion-blur))',
      }}
    >
      <div className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--text-secondary)' }}>
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {roleName || '主角'}
        </span>
        <span className="mx-1.5" style={{ color: 'var(--companion-accent-warm)' }}>
          ·
        </span>
        <span title={statusLine}>{statusLine}</span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <StatusChip icon={<Newspaper size={12} />} label="朋友圈" onClick={onOpenMoments} />
        <StatusChip icon={<Shirt size={12} />} label="物什" onClick={onOpenAssets} />
        <StatusChip icon={<Users size={12} />} label="名册" onClick={onOpenCast} />
        <StatusChip icon={<LayoutGrid size={12} />} label="角色架" onClick={onOpenShelf} />
      </div>
    </div>
  )
}

function StatusChip({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] transition"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--hover-overlay)'
        e.currentTarget.style.color = 'var(--companion-accent-warm)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = ''
        e.currentTarget.style.color = 'var(--text-muted)'
      }}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

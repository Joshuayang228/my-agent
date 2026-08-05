/**
 * 人物世界口袋 — 对齐 Alice `/moments`：一页多 tab，侧栏只留一个入口。
 */

import type { ReactNode } from 'react'
import { Newspaper, Shirt, Users, LayoutGrid, X } from 'lucide-react'
import { MomentsPanel } from '../MomentsPanel'
import { AssetsPanel } from '../AssetsPanel'
import { CastPanel } from '../CastPanel'
import { CharacterShelfPanel } from '../CharacterShelfPanel'
import type { ShellView } from './SecondaryNav'

export type WorldTab = 'moments' | 'assets' | 'cast' | 'shelf'

const WORLD_TABS: { id: WorldTab; label: string; icon: ReactNode }[] = [
  { id: 'moments', label: '朋友圈', icon: <Newspaper size={14} strokeWidth={1.5} /> },
  { id: 'assets', label: '物什', icon: <Shirt size={14} strokeWidth={1.5} /> },
  { id: 'cast', label: '名册', icon: <Users size={14} strokeWidth={1.5} /> },
  { id: 'shelf', label: '角色架', icon: <LayoutGrid size={14} strokeWidth={1.5} /> },
]

export function isWorldView(view: ShellView): boolean {
  return view === 'world' || view === 'moments' || view === 'assets' || view === 'cast' || view === 'shelf'
}

export function worldTabFromView(view: ShellView): WorldTab {
  if (view === 'assets' || view === 'cast' || view === 'shelf' || view === 'moments') return view
  return 'moments'
}

export function WorldHub({
  tab,
  onTabChange,
  onClose,
  onOpenSession,
  onSwitched,
  recentByRole,
}: {
  tab: WorldTab
  onTabChange: (tab: WorldTab) => void
  onClose: () => void
  onOpenSession: (sessionId: string) => void
  onSwitched: (p: { id: string; name: string; description: string }) => void
  recentByRole: Record<string, { sessionId: string; title: string; updatedAt: number }>
}) {
  return (
    <div className="flex h-full flex-col" data-testid="world-hub">
      <div
        className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="min-w-0">
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            人物世界
          </h1>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            朋友圈、物什、名册与角色架 — 一个口袋里的生活面。
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 transition"
          style={{ color: 'var(--text-muted)' }}
          title="返回聊天"
        >
          <X size={14} />
        </button>
      </div>

      <div
        className="flex shrink-0 gap-1 overflow-x-auto border-b px-4"
        style={{ borderColor: 'var(--border-subtle)' }}
        role="tablist"
        aria-label="人物世界分区"
      >
        {WORLD_TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(t.id)}
              className="flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12px] transition"
              style={{
                borderColor: active ? 'var(--companion-accent-warm)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: active ? 600 : 400,
              }}
            >
              <span style={{ color: active ? 'var(--companion-accent-warm)' : 'var(--text-muted)' }}>
                {t.icon}
              </span>
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {tab === 'moments' && <MomentsPanel onClose={onClose} />}
        {tab === 'assets' && <AssetsPanel onClose={onClose} />}
        {tab === 'cast' && (
          <CastPanel
            onClose={onClose}
            onOpenSession={onOpenSession}
            onOpenShelf={() => onTabChange('shelf')}
            recentByRole={recentByRole}
          />
        )}
        {tab === 'shelf' && (
          <CharacterShelfPanel onClose={onClose} onSwitched={onSwitched} />
        )}
      </div>
    </div>
  )
}

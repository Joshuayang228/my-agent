import type { ReactNode } from 'react'
import {
  Newspaper, Shirt, Users, LayoutGrid, Brain, Cpu, Bug, FlaskConical, Settings,
} from 'lucide-react'

export type ShellView =
  | 'chat'
  | 'skills'
  | 'memory'
  | 'moments'
  | 'assets'
  | 'cast'
  | 'shelf'
  | 'settings'
  | 'debug'
  | 'playground'

const GROUPS: {
  title: string
  items: { id: ShellView; label: string; icon: ReactNode }[]
}[] = [
  {
    title: '生活',
    items: [
      { id: 'moments', label: '朋友圈', icon: <Newspaper size={15} strokeWidth={1.5} /> },
      { id: 'assets', label: '物什', icon: <Shirt size={15} strokeWidth={1.5} /> },
      { id: 'cast', label: '名册', icon: <Users size={15} strokeWidth={1.5} /> },
      { id: 'shelf', label: '角色架', icon: <LayoutGrid size={15} strokeWidth={1.5} /> },
    ],
  },
  {
    title: '工具',
    items: [
      { id: 'memory', label: '记忆', icon: <Brain size={15} strokeWidth={1.5} /> },
      { id: 'skills', label: 'Skills', icon: <Cpu size={15} strokeWidth={1.5} /> },
      { id: 'settings', label: '设置', icon: <Settings size={15} strokeWidth={1.5} /> },
    ],
  },
  {
    title: '开发',
    items: [
      { id: 'debug', label: 'Debug', icon: <Bug size={15} strokeWidth={1.5} /> },
      { id: 'playground', label: 'Playground', icon: <FlaskConical size={15} strokeWidth={1.5} /> },
    ],
  },
]

/** chat / settings 全屏时不渲染二级列 */
export function shouldShowSecondaryNav(view: ShellView): boolean {
  return view !== 'chat' && view !== 'settings'
}

export function SecondaryNav({
  activeView,
  onNavigate,
}: {
  activeView: ShellView
  onNavigate: (view: ShellView) => void
}) {
  if (!shouldShowSecondaryNav(activeView)) return null

  return (
    <nav
      className="flex w-[200px] shrink-0 flex-col border-r py-4"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      data-testid="secondary-nav"
    >
      {GROUPS.map((g) => (
        <div key={g.title} className="mb-4 px-3">
          <div
            className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {g.title}
          </div>
          <div className="space-y-0.5">
            {g.items.map((item) => {
              const active = activeView === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-[13px] transition"
                  style={{
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: active ? 'var(--sidebar-active)' : 'transparent',
                    fontWeight: active ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = 'var(--sidebar-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ color: active ? 'var(--companion-accent-warm)' : 'var(--text-muted)' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

/**
 * 最左侧 48px 极窄图标导轨（NavigationRail）。
 *
 * 背景：原单层侧栏底部塞入 4 个功能按钮，挤压会话列表且无法一键直达「朋友圈 / 日记 / 礼物」等高频生活面。
 * 设计意图：对齐现代桌面端双层侧栏（最左极窄图标导轨 + 旁侧可折叠会话栏），顶部固定伙伴头像切换入口，
 * 中部提供「对话 + 用户可自定义的人物世界快捷入口 + 人物世界总入口 + 自定义开关浮层」，底部收敛系统与开发入口。
 * 关键约束：外层禁止 overflow-hidden 以免裁切自定义浮层；快捷入口清单持久化于 localStorage，不依赖主进程 schema 变更。
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  BookOpen,
  Bug,
  Check,
  Compass,
  FlaskConical,
  Gift,
  Home,
  Library,
  MapPin,
  MessageSquare,
  Settings,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react'
import type { ShellView } from './SecondaryNav'
import { isWorldView, type WorldTab } from './WorldHub'
import { CompanionAvatar } from '../CompanionAvatar'
import { IconButton } from '../foundation/IconButton'

export interface RailWorldShortcutOption {
  id: WorldTab
  label: string
  icon: ReactNode
}

export const RAIL_WORLD_SHORTCUT_OPTIONS: readonly RailWorldShortcutOption[] = [
  { id: 'moments', label: '朋友圈', icon: <Sparkles size={17} strokeWidth={1.6} /> },
  { id: 'journal', label: '日记', icon: <BookOpen size={17} strokeWidth={1.6} /> },
  { id: 'keepsakes', label: '礼物', icon: <Gift size={17} strokeWidth={1.6} /> },
  { id: 'wardrobe', label: '衣柜', icon: <Shirt size={17} strokeWidth={1.6} /> },
  { id: 'culture', label: '文化角', icon: <Library size={17} strokeWidth={1.6} /> },
  { id: 'home', label: '家居', icon: <Home size={17} strokeWidth={1.6} /> },
  { id: 'cast', label: '通讯录', icon: <Users size={17} strokeWidth={1.6} /> },
  { id: 'footprints', label: '足迹', icon: <MapPin size={17} strokeWidth={1.6} /> },
]

export const DEFAULT_RAIL_WORLD_SHORTCUTS: readonly WorldTab[] = ['moments', 'journal', 'keepsakes']
export const RAIL_WORLD_SHORTCUTS_STORAGE_KEY = 'my-agent:rail-world-shortcuts'

const VALID_WORLD_TABS = new Set<WorldTab>(RAIL_WORLD_SHORTCUT_OPTIONS.map((o) => o.id))

export function loadRailWorldShortcuts(): WorldTab[] {
  try {
    const raw = localStorage.getItem(RAIL_WORLD_SHORTCUTS_STORAGE_KEY)
    if (!raw) return [...DEFAULT_RAIL_WORLD_SHORTCUTS]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...DEFAULT_RAIL_WORLD_SHORTCUTS]
    const valid = parsed.filter((id): id is WorldTab => typeof id === 'string' && VALID_WORLD_TABS.has(id as WorldTab))
    return Array.from(new Set(valid))
  } catch {
    return [...DEFAULT_RAIL_WORLD_SHORTCUTS]
  }
}

export function saveRailWorldShortcuts(shortcuts: readonly WorldTab[]): void {
  try {
    localStorage.setItem(RAIL_WORLD_SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts))
  } catch {
    // 忽略受限环境存储失败
  }
}

export function NavigationRail({
  personaName,
  avatarSrc,
  activeView,
  activeWorldTab,
  worldShortcuts,
  onChangeWorldShortcuts,
  onOpenShelf,
  onNavigate,
  onOpenWorldTab,
  developerMode = false,
  unreadMomentsCount = 0,
  activeBgTaskCount = 0,
  frosted = false,
}: {
  personaName: string
  avatarSrc?: string | null
  activeView: ShellView
  activeWorldTab: WorldTab
  worldShortcuts: readonly WorldTab[]
  onChangeWorldShortcuts: (next: WorldTab[]) => void
  onOpenShelf: () => void
  onNavigate: (view: ShellView) => void
  onOpenWorldTab: (tab: WorldTab) => void
  developerMode?: boolean
  unreadMomentsCount?: number
  activeBgTaskCount?: number
  frosted?: boolean
}) {
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!customizeOpen) return
    const handlePointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setCustomizeOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCustomizeOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [customizeOpen])

  const shortcutItems = worldShortcuts
    .map((id) => RAIL_WORLD_SHORTCUT_OPTIONS.find((opt) => opt.id === id))
    .filter((item): item is RailWorldShortcutOption => Boolean(item))

  const hasMomentsShortcut = worldShortcuts.includes('moments')
  const inWorld = isWorldView(activeView)

  const toggleShortcut = (id: WorldTab) => {
    const exists = worldShortcuts.includes(id)
    const next = exists
      ? worldShortcuts.filter((item) => item !== id)
      : [...worldShortcuts, id]
    onChangeWorldShortcuts(next)
  }

  return (
    <nav
      aria-label="主导航导轨"
      data-testid="navigation-rail"
      className="relative z-30 flex w-12 shrink-0 flex-col items-center border-r py-3"
      style={{
        background: frosted
          ? 'color-mix(in srgb, var(--card-bg) 34%, transparent)'
          : 'color-mix(in srgb, var(--bg-primary) 58%, var(--card-bg))',
        backdropFilter: frosted ? 'blur(22px) saturate(1.45)' : undefined,
        WebkitBackdropFilter: frosted ? 'blur(22px) saturate(1.45)' : undefined,
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* 最顶部：当前伙伴头像（点击打开角色架切换伙伴） */}
      <button
        type="button"
        onClick={onOpenShelf}
        title={`${personaName || '伙伴'} · 切换伙伴`}
        aria-label={`切换伙伴（当前：${personaName || '伙伴'}）`}
        data-testid="rail-avatar-button"
        className="flex h-9 w-9 items-center justify-center rounded-full transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-fg)]"
      >
        <CompanionAvatar
          src={avatarSrc}
          name={personaName || '伙伴'}
          role="assistant"
          size="sm"
        />
      </button>

      <div className="my-2.5 h-px w-5" style={{ background: 'var(--border-subtle)' }} />

      {/* 核心导航区：对话 + 用户自定义生活快捷入口 + 人物世界总入口 + 自定义开关 */}
      <div className="flex flex-col items-center gap-1">
        <RailIconBtn
          active={activeView === 'chat'}
          label="对话"
          onClick={() => onNavigate('chat')}
          testId="rail-nav-chat"
        >
          <MessageSquare size={17} strokeWidth={1.7} />
        </RailIconBtn>

        {shortcutItems.length > 0 && (
          <div className="my-1 h-px w-4" style={{ background: 'var(--border-subtle)' }} />
        )}

        {shortcutItems.map((item) => {
          const active = inWorld && activeWorldTab === item.id
          const showBadge = item.id === 'moments' && unreadMomentsCount > 0
          return (
            <RailIconBtn
              key={item.id}
              active={active}
              label={item.label}
              onClick={() => onOpenWorldTab(item.id)}
              testId={`rail-shortcut-${item.id}`}
              badgeCount={showBadge ? unreadMomentsCount : 0}
            >
              {item.icon}
            </RailIconBtn>
          )
        })}

        <RailIconBtn
          active={inWorld && !worldShortcuts.includes(activeWorldTab)}
          label="人物世界"
          onClick={() => onNavigate('world')}
          testId="rail-nav-world"
          badgeCount={!hasMomentsShortcut && unreadMomentsCount > 0 ? unreadMomentsCount : 0}
        >
          <Compass size={17} strokeWidth={1.6} />
        </RailIconBtn>

        {/* 自定义快捷入口浮层 */}
        <div className="relative" ref={popoverRef}>
          <IconButton
            size={32}
            label="自定义快捷入口"
            title="自定义左侧快捷入口"
            data-testid="rail-customize-shortcuts"
            onClick={() => setCustomizeOpen((open) => !open)}
            className="mt-0.5 rounded-[var(--radius-md)] transition hover:bg-[var(--sidebar-hover)]"
            style={{
              color: customizeOpen ? 'var(--accent-fg)' : 'var(--text-muted)',
              background: customizeOpen ? 'var(--accent-subtle)' : 'transparent',
            }}
          >
            <SlidersHorizontal size={14} strokeWidth={1.7} />
          </IconButton>

          {customizeOpen && (
            <div
              role="dialog"
              aria-label="自定义左侧快捷入口"
              data-testid="rail-shortcuts-popover"
              className="absolute left-full top-0 z-50 ml-2 w-48 rounded-[var(--radius-md)] border p-2 shadow-lg backdrop-blur-md"
              style={{
                background: 'color-mix(in srgb, var(--dropdown-bg, var(--card-bg)) 96%, transparent)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="mb-1.5 flex items-center justify-between px-1.5">
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                  左侧快捷入口
                </span>
                <button
                  type="button"
                  onClick={() => onChangeWorldShortcuts([...DEFAULT_RAIL_WORLD_SHORTCUTS])}
                  className="text-[10px] transition hover:underline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  恢复默认
                </button>
              </div>
              <div className="flex flex-col gap-0.5">
                {RAIL_WORLD_SHORTCUT_OPTIONS.map((opt) => {
                  const checked = worldShortcuts.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleShortcut(opt.id)}
                      data-testid={`rail-shortcut-toggle-${opt.id}`}
                      className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[12px] transition hover:bg-[var(--hover-overlay)]"
                      style={{
                        color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span style={{ color: checked ? 'var(--accent-fg)' : 'var(--text-muted)' }}>
                          {opt.icon}
                        </span>
                        <span>{opt.label}</span>
                      </span>
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded border"
                        style={{
                          borderColor: checked ? 'var(--accent-fg)' : 'var(--border-color)',
                          background: checked ? 'var(--accent-subtle)' : 'transparent',
                          color: 'var(--accent-fg)',
                        }}
                      >
                        {checked && <Check size={11} strokeWidth={2.4} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 中间弹性留白 */}
      <div className="flex-1" />

      {/* 底部系统与开发入口 */}
      <div className="flex flex-col items-center gap-1">
        {activeBgTaskCount > 0 && (
          <span
            title={`${activeBgTaskCount} 个后台任务运行中`}
            aria-label={`${activeBgTaskCount} 个后台任务运行中`}
            className="mb-1 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: 'var(--accent-subtle)' }}
          >
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: 'var(--accent)' }} />
          </span>
        )}
        {developerMode && (
          <>
            <RailIconBtn
              active={activeView === 'debug'}
              label="Debug"
              onClick={() => onNavigate(activeView === 'debug' ? 'chat' : 'debug')}
              testId="rail-nav-debug"
            >
              <Bug size={16} strokeWidth={1.6} />
            </RailIconBtn>
            <RailIconBtn
              active={activeView === 'playground'}
              label="Playground"
              onClick={() => onNavigate(activeView === 'playground' ? 'chat' : 'playground')}
              testId="rail-nav-playground"
            >
              <FlaskConical size={16} strokeWidth={1.6} />
            </RailIconBtn>
          </>
        )}
        <RailIconBtn
          active={activeView === 'settings'}
          label="设置"
          onClick={() => onNavigate(activeView === 'settings' ? 'chat' : 'settings')}
          testId="rail-nav-settings"
        >
          <Settings size={17} strokeWidth={1.6} />
        </RailIconBtn>
      </div>
    </nav>
  )
}

function RailIconBtn({
  active,
  label,
  onClick,
  testId,
  badgeCount = 0,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  testId?: string
  badgeCount?: number
  children: ReactNode
}) {
  return (
    <div className="relative">
      <IconButton
        size={32}
        label={label}
        title={label}
        data-testid={testId}
        onClick={onClick}
        className="rounded-[var(--radius-md)] transition hover:bg-[var(--sidebar-hover)]"
        style={{
          color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
          background: active ? 'var(--accent-subtle)' : 'transparent',
        }}
      >
        {children}
      </IconButton>
      {badgeCount > 0 && (
        <span
          data-testid="world-unread-badge"
          className="pointer-events-none absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow-sm"
          style={{ background: 'var(--danger, #ef4444)' }}
          aria-label={`有 ${badgeCount} 条未读动态`}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </div>
  )
}

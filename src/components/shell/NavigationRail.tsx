/**
 * 最左侧 52px 极窄图标导轨（NavigationRail）。
 *
 * 背景：原单层侧栏底部塞入 4 个功能按钮，挤压会话列表且无法一键直达「朋友圈 / 日记 / 礼物」等高频生活面。
 * 设计意图：对齐 ChatGPT / Codex 双层侧栏质感：
 *   1. 顶部固定 36×36 伙伴头像切换入口，图标与行间距舒展透气；
 *   2. 消除内联 transparent 覆盖 hover 的缺陷，悬停即时亮起圆角底色并在右侧 0 延迟浮现胶囊 Tooltip；
 *   3. 「人物世界」回归标志性 Sparkles 图标，各生活切面图标与 WorldHub 保持统一几何极简语言。
 * 关键约束：外层禁止 overflow-hidden 以免裁切自定义浮层与悬浮提示；快捷入口清单持久化于 localStorage。
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Aperture,
  BookOpen,
  Bug,
  Check,
  FileText,
  FlaskConical,
  Gift,
  Home,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Settings,
  Shirt,
  Sparkles,
  Users,
} from 'lucide-react'
import type { ShellView } from './SecondaryNav'
import { isWorldView, type WorldTab } from './WorldHub'
import { CompanionAvatar } from '../CompanionAvatar'

export interface RailWorldShortcutOption {
  id: WorldTab
  label: string
  icon: ReactNode
}

export const RAIL_WORLD_SHORTCUT_OPTIONS: readonly RailWorldShortcutOption[] = [
  { id: 'moments', label: '朋友圈', icon: <Aperture size={18} strokeWidth={1.65} /> },
  { id: 'journal', label: '日记', icon: <FileText size={18} strokeWidth={1.65} /> },
  { id: 'keepsakes', label: '礼物', icon: <Gift size={18} strokeWidth={1.65} /> },
  { id: 'wardrobe', label: '衣柜', icon: <Shirt size={18} strokeWidth={1.65} /> },
  { id: 'culture', label: '文化角', icon: <BookOpen size={18} strokeWidth={1.65} /> },
  { id: 'home', label: '家居', icon: <Home size={18} strokeWidth={1.65} /> },
  { id: 'cast', label: '通讯录', icon: <Users size={18} strokeWidth={1.65} /> },
  { id: 'footprints', label: '足迹', icon: <MapPin size={18} strokeWidth={1.65} /> },
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
  showRightBorder = false,
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
  /** 旁侧会话栏展开时不画中间分割竖线，两栏同底色自然融为一体；仅在会话栏收起时显式画右边界 */
  showRightBorder?: boolean
}) {
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [avatarHovered, setAvatarHovered] = useState(false)
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
      className={`relative z-30 flex w-[52px] shrink-0 flex-col items-center py-3.5 ${showRightBorder ? 'border-r' : ''}`}
      style={{
        background: frosted
          ? 'color-mix(in srgb, var(--card-bg) 22%, transparent)'
          : 'color-mix(in srgb, var(--bg-primary) 42%, var(--card-bg))',
        backdropFilter: frosted ? 'blur(20px) saturate(1.45)' : undefined,
        WebkitBackdropFilter: frosted ? 'blur(20px) saturate(1.45)' : undefined,
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* 最顶部：当前伙伴头像（36×36 饱满尺寸 + 悬停光圈与即时标签） */}
      <div
        className="relative mb-3.5"
        onMouseEnter={() => setAvatarHovered(true)}
        onMouseLeave={() => setAvatarHovered(false)}
      >
        <button
          type="button"
          onClick={onOpenShelf}
          aria-label={`切换伙伴（当前：${personaName || '伙伴'}）`}
          data-testid="rail-avatar-button"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-fg)]"
          style={{
            background: avatarHovered ? 'var(--sidebar-hover)' : undefined,
          }}
        >
          <CompanionAvatar
            src={avatarSrc}
            name={personaName || '伙伴'}
            role="assistant"
            size="md"
          />
        </button>
        {avatarHovered && <RailTooltip label={`${personaName || '伙伴'} · 切换伙伴`} />}
      </div>

      {/* 核心导航区：36×36 圆角热区 + 8px 舒展纵向间距 + Codex 级主入口实心锚点 */}
      <div className="flex flex-col items-center gap-2">
        <RailIconBtn
          active={activeView === 'chat'}
          label="对话"
          onClick={() => onNavigate('chat')}
          testId="rail-nav-chat"
        >
          <MessageCircle
            size={18}
            strokeWidth={activeView === 'chat' ? 2 : 1.65}
            fill={activeView === 'chat' ? 'currentColor' : 'none'}
          />
        </RailIconBtn>

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

        {/* 人物世界总入口：归还标志性 Sparkles 图标 */}
        <RailIconBtn
          active={inWorld && !worldShortcuts.includes(activeWorldTab)}
          label="人物世界"
          onClick={() => onNavigate('world')}
          testId="rail-nav-world"
          badgeCount={!hasMomentsShortcut && unreadMomentsCount > 0 ? unreadMomentsCount : 0}
        >
          <Sparkles size={18} strokeWidth={1.65} />
        </RailIconBtn>

        {/* 自定义快捷入口浮层（采用 Codex 同款 ··· 图标） */}
        <div className="relative" ref={popoverRef}>
          <RailIconBtn
            active={customizeOpen}
            label="自定义快捷入口"
            onClick={() => setCustomizeOpen((open) => !open)}
            testId="rail-customize-shortcuts"
            hideTooltip={customizeOpen}
          >
            <MoreHorizontal size={18} strokeWidth={1.75} />
          </RailIconBtn>

          {customizeOpen && (
            <div
              role="dialog"
              aria-label="自定义左侧快捷入口"
              data-testid="rail-shortcuts-popover"
              className="absolute left-full top-0 z-50 ml-2.5 w-48 rounded-[var(--radius-md)] border p-2 shadow-lg backdrop-blur-md"
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
                  className="cursor-pointer text-[10px] transition hover:underline"
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
                      className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[12px] transition hover:bg-[var(--hover-overlay)]"
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
      <div className="flex flex-col items-center gap-2">
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
              <Bug size={17} strokeWidth={1.65} />
            </RailIconBtn>
            <RailIconBtn
              active={activeView === 'playground'}
              label="Playground"
              onClick={() => onNavigate(activeView === 'playground' ? 'chat' : 'playground')}
              testId="rail-nav-playground"
            >
              <FlaskConical size={17} strokeWidth={1.65} />
            </RailIconBtn>
          </>
        )}
        <RailIconBtn
          active={activeView === 'settings'}
          label="设置"
          onClick={() => onNavigate(activeView === 'settings' ? 'chat' : 'settings')}
          testId="rail-nav-settings"
        >
          <Settings size={18} strokeWidth={1.65} />
        </RailIconBtn>
      </div>
    </nav>
  )
}

function RailTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] font-medium shadow-md backdrop-blur-md"
      style={{
        background: 'color-mix(in srgb, var(--dropdown-bg, var(--card-bg)) 96%, transparent)',
        borderColor: 'var(--border-color)',
        color: 'var(--text-primary)',
      }}
    >
      {label}
    </span>
  )
}

function RailIconBtn({
  active,
  label,
  onClick,
  testId,
  badgeCount = 0,
  hideTooltip = false,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  testId?: string
  badgeCount?: number
  hideTooltip?: boolean
  children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={label}
        data-testid={testId}
        onClick={onClick}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] transition-all duration-150 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-fg)]"
        style={{
          color: active || hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: active
            ? 'var(--sidebar-active)'
            : hovered
              ? 'var(--sidebar-hover)'
              : undefined,
        }}
      >
        {children}
      </button>
      {hovered && !hideTooltip && <RailTooltip label={label} />}
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

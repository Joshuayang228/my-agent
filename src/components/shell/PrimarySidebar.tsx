/**
 * Primary 侧栏：品牌区 + 大号新对话 + 会话列表 + 底部开发 / 产品入口（Alice 壳）。
 * Debug / Playground 与人物世界 / 设置位于底部稳定入口区；生活面收进「人物世界」。
 */

import type { RefObject, ReactNode, MouseEvent, ChangeEvent, KeyboardEvent } from 'react'
import {
  Plus, Search, X, Pin, Sparkles, Settings,
  Bug, FlaskConical, PanelLeftClose,
} from 'lucide-react'
import type { ShellView } from './SecondaryNav'
import { isWorldView } from './WorldHub'
import { formatSessionPreview, formatSessionStamp } from './session-format'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import { TextField } from '../foundation/TextField'
import { CompanionAvatar } from '../CompanionAvatar'

export interface SidebarSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  roleId?: string
  sessionKind?: 'main' | 'summon'
}

const DOCK: { id: ShellView; label: string; icon: ReactNode }[] = [
  { id: 'world', label: '人物世界', icon: <Sparkles size={18} strokeWidth={1.5} /> },
  { id: 'settings', label: '设置', icon: <Settings size={18} strokeWidth={1.5} /> },
]

export function PrimarySidebar({
  personaName,
  personaBlurb,
  avatarSrc,
  activeView,
  activeSessionId,
  sessionGroups,
  sessionPreviews,
  pinnedIds,
  bgStreamingSessionId,
  activeBgTaskCount,
  sidebarSearchOpen,
  sessionFilter,
  sessionFilterRef,
  renamingId,
  renameValue,
  onOpenShelf,
  onCreateSession,
  onToggleSearch,
  onSessionFilterChange,
  onCloseSearch,
  onSelectSession,
  onStartRename,
  onRenameChange,
  onCommitRename,
  onCancelRename,
  onDeleteSession,
  onContextMenu,
  onNavigate,
  onCollapse,
  width,
  developerMode = false,
  collapseFooterDivider = true,
  collapseControlPlacement = 'toolbar',
  unreadMomentsCount = 0,
  frosted = false,
  showFooter = true,
  showBrandAvatar = true,
}: {
  personaName: string
  personaBlurb: string
  avatarSrc?: string | null
  activeView: ShellView
  activeSessionId: string | null
  sessionGroups: { label: string; items: SidebarSession[] }[]
  sessionPreviews: Record<string, string>
  pinnedIds: string[]
  bgStreamingSessionId: string | null
  activeBgTaskCount: number
  sidebarSearchOpen: boolean
  sessionFilter: string
  sessionFilterRef: RefObject<HTMLInputElement | null>
  renamingId: string | null
  renameValue: string
  onOpenShelf: () => void
  onCreateSession: () => void
  onToggleSearch: () => void
  onSessionFilterChange: (v: string) => void
  onCloseSearch: () => void
  onSelectSession: (id: string) => void
  onStartRename: (id: string, title: string) => void
  onRenameChange: (v: string) => void
  onCommitRename: () => void
  onCancelRename: () => void
  onDeleteSession: (id: string) => void
  onContextMenu: (e: MouseEvent, sessionId: string) => void
  onNavigate: (view: ShellView) => void
  onCollapse: () => void
  /** 可拖宽度；默认 248 */
  width?: number
  developerMode?: boolean
  /** 正式与样张共用一条底栏外边界；显式 false 可保留独立分隔布局。 */
  collapseFooterDivider?: boolean
  /** 顶部工具槽仅供已明确选择的候选调用方；正式默认入口不变。 */
  collapseControlPlacement?: 'toolbar' | 'header'
  /** 朋友圈新回复或新动态未读计数 */
  unreadMomentsCount?: number
  /** 仅在 Chat 存在氛围壁纸时启用高雾度毛玻璃透色，保持文字清晰同时与底图柔和呼应 */
  frosted?: boolean
  /** 双层侧栏启用 NavigationRail 时隐藏重复底栏，把完整垂直空间留给会话列表 */
  showFooter?: boolean
  /** 双层侧栏顶部导轨已展示伙伴头像时，会话栏头部可隐藏重复头像 */
  showBrandAvatar?: boolean
}) {
  return (
    <aside
      className={`chat-shape-scope flex shrink-0 flex-col border-r ${collapseControlPlacement === 'header' ? 'relative' : ''}`}
      style={{
        width: width ?? 248,
        background: frosted
          ? 'color-mix(in srgb, var(--card-bg) 22%, transparent)'
          : 'color-mix(in srgb, var(--bg-primary) 42%, var(--card-bg))',
        backdropFilter: frosted ? 'blur(20px) saturate(1.45)' : undefined,
        WebkitBackdropFilter: frosted ? 'blur(20px) saturate(1.45)' : undefined,
        borderColor: 'var(--border-subtle)',
      }}
      data-testid="primary-sidebar"
    >
      <div className={collapseControlPlacement === 'header' ? 'flex shrink-0 items-center justify-between gap-1 px-3 pt-3' : 'contents'}>
      {/* 品牌 / 主角：干净展示主角名（不加误导性的下拉小箭头），右侧放置收起侧栏按钮 */}
      <ActionButton
        onClick={onOpenShelf}
        size="sm"
        className={`w-auto justify-start gap-2.5 border-0 px-2 py-1.5 text-left transition hover:bg-[var(--sidebar-hover)] ${collapseControlPlacement === 'header' ? 'min-w-0 flex-1' : 'mx-3 mt-4'}`}
        title="打开角色架"
      >
        {showBrandAvatar && (
          <CompanionAvatar
            src={avatarSrc}
            name={personaName}
            role="assistant"
            size="md"
            className="shrink-0"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {personaName || '伙伴'}
          </span>
          {showBrandAvatar && personaBlurb && (
            <span className="mt-0.5 block truncate text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
              {personaBlurb}
            </span>
          )}
        </span>
      </ActionButton>
      {collapseControlPlacement === 'header' && (
        <IconButton
          size={32}
          onClick={onCollapse}
          label="收起侧栏"
          title="收起侧栏 Ctrl+B"
          className="rounded-[var(--radius-md)] transition hover:bg-[var(--sidebar-hover)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <PanelLeftClose size={16} strokeWidth={1.7} />
        </IconButton>
      )}
      </div>

      {/* 新对话 / 搜索：保留柔和浅绿胶囊大按钮 + 右侧搜索图标，修复 hover 亮度与底色反馈 */}
      <div className="mt-2.5 flex items-center gap-1.5 px-3" data-testid="sidebar-toolbar">
        {sidebarSearchOpen ? (
          <div
            className="flex h-9 min-w-0 flex-1 self-start items-center gap-2 rounded-[var(--radius-lg)] border px-2.5 focus-within:outline-1 focus-within:outline-[var(--accent)]"
            style={{
              background: 'var(--input-bg)',
              borderColor: 'var(--input-border)',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <TextField
              appearance="embedded"
              ref={sessionFilterRef}
              value={sessionFilter}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onSessionFilterChange(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Escape') onCloseSearch()
              }}
              placeholder="搜索对话..."
              aria-label="搜索对话"
              data-testid="sidebar-session-search"
              className="min-w-0 flex-1 text-xs"
            />
            <IconButton
              size={24}
              onClick={onCloseSearch}
              className="transition hover:bg-[var(--sidebar-hover)]"
              style={{ color: 'var(--text-muted)' }}
              label="关闭搜索"
            >
              <X size={13} />
            </IconButton>
          </div>
        ) : (
          <ActionButton
            size="md"
            onClick={onCreateSession}
            className="h-10 min-w-0 flex-1 gap-1.5 rounded-[var(--radius-lg)] border-0 text-[13px] font-medium transition hover:brightness-95 active:scale-[0.99]"
            style={{
              background: 'var(--accent-subtle)',
              color: 'var(--accent-fg)',
            }}
            title="新对话 Ctrl+N"
          >
            <Plus size={16} strokeWidth={2} />
            <span>新对话</span>
          </ActionButton>
        )}
        {!sidebarSearchOpen && (
          <IconButton
            size={40}
            onClick={onToggleSearch}
            className="rounded-[var(--radius-lg)] transition hover:bg-[var(--sidebar-hover)]"
            style={{ color: 'var(--text-muted)' }}
            label="搜索会话"
            title="搜索会话"
          >
            <Search size={16} strokeWidth={1.7} />
          </IconButton>
        )}
        {collapseControlPlacement === 'toolbar' && (
          <IconButton
            size={40}
            onClick={onCollapse}
            className="rounded-[var(--radius-lg)] transition hover:bg-[var(--sidebar-hover)]"
            style={{ color: 'var(--text-muted)' }}
            label="收起侧栏"
            title="收起侧栏 Ctrl+B"
          >
            <PanelLeftClose size={16} />
          </IconButton>
        )}
      </div>

      {/* 会话列表：对齐 Codex / ChatGPT 单行极简目录（常规字重、去重复时间戳第二行、紧凑行高） */}
      <div className="scrollbar-hover mt-2 flex-1 overflow-y-auto px-2 pb-5 [mask-image:linear-gradient(to_bottom,black_calc(100%-18px),transparent)]" data-testid="sidebar-session-list">
        {sessionGroups.map((group) => (
          <div key={group.label}>
            <div
              className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-normal"
              style={{ color: 'var(--text-muted)' }}
            >
              {group.label}
            </div>
            {group.items.map((s) => {
              const active = s.id === activeSessionId && activeView === 'chat'
              const preview = sessionPreviews[s.id]
              const hoverTitle = `${s.title}\n${formatSessionStamp(s.updatedAt)}${preview ? ` · ${formatSessionPreview(preview)}` : ''}`
              return (
                <div
                  key={s.id}
                  title={hoverTitle}
                  className="group mb-1 cursor-pointer rounded-[var(--radius-md)] px-2.5 py-2 transition"
                  style={{
                    background: active ? 'var(--sidebar-active)' : 'transparent',
                  }}
                  onClick={() => onSelectSession(s.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    onStartRename(s.id, s.title)
                  }}
                  onContextMenu={(e) => onContextMenu(e, s.id)}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--sidebar-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                >
                  {renamingId === s.id ? (
                    <TextField
                      className="w-full rounded border px-1.5 py-0.5 text-[13px]"
                      value={renameValue}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => onRenameChange(e.target.value)}
                      onBlur={onCommitRename}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') onCommitRename()
                        if (e.key === 'Escape') onCancelRename()
                      }}
                      autoFocus
                      onClick={(e: MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {bgStreamingSessionId === s.id && s.id !== activeSessionId && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
                          style={{ background: 'var(--accent)' }}
                        />
                      )}
                      {pinnedIds.includes(s.id) && (
                        <Pin size={10} className="shrink-0" style={{ color: 'var(--accent)' }} />
                      )}
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] leading-5 ${active ? 'font-medium' : 'font-normal'}`}
                        style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      >
                        {s.title}
                      </span>
                      <IconButton
                        size={24}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteSession(s.id)
                        }}
                        className="invisible -mr-1 !h-5 !w-5 shrink-0 transition group-hover:visible focus-visible:visible"
                        style={{ color: 'var(--text-muted)' }}
                        label="删除会话"
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <X size={12} />
                      </IconButton>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        {sessionGroups.length === 0 && (
          <p className="px-2 pt-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            暂无会话
          </p>
        )}
      </div>

      {/* 底栏：双层侧栏启用 NavigationRail 时隐藏，保留默认渲染以兼容独立预览与测试。 */}
      {showFooter && (
      <div className="border-t px-3 py-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
        {activeBgTaskCount > 0 && (
          <div
            className="mb-2 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--accent)' }} />
            {activeBgTaskCount} 个后台任务
          </div>
        )}
        {developerMode && <div data-testid="sidebar-developer-nav">
          <div className="grid grid-cols-2 gap-1">
            <DockTextBtn
              active={activeView === 'debug'}
              onClick={() => onNavigate(activeView === 'debug' ? 'chat' : 'debug')}
              icon={<Bug size={14} />}
              label="Debug"
            />
            <DockTextBtn
              active={activeView === 'playground'}
              onClick={() => onNavigate(activeView === 'playground' ? 'chat' : 'playground')}
              icon={<FlaskConical size={14} />}
              label="Playground"
            />
          </div>
        </div>}
        <div className={`mt-2 pt-2 ${collapseFooterDivider ? '' : 'border-t'}`} style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="grid grid-cols-2 gap-1">
            {DOCK.map((item) => {
              const active = item.id === 'world' ? isWorldView(activeView) : activeView === item.id
              const hasBadge = item.id === 'world' && unreadMomentsCount > 0
              return (
                <ActionButton
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  size="sm"
                  className="w-full flex-col gap-1 border-0 px-1 py-2 text-[10px] leading-none"
                  style={{
                    color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                    background: active ? 'var(--accent-subtle)' : 'transparent',
                  }}
                  onMouseEnter={(event) => { if (!active) event.currentTarget.style.background = 'var(--sidebar-hover)' }}
                  onMouseLeave={(event) => { if (!active) event.currentTarget.style.background = 'transparent' }}
                  title={item.label}
                >
                  <div className="relative flex items-center justify-center">
                    {item.icon}
                    {hasBadge && (
                      <span
                        data-testid="world-unread-badge"
                        className="absolute -right-2.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow-sm"
                        style={{ background: 'var(--danger, #ef4444)' }}
                        aria-label={`有 ${unreadMomentsCount} 条未读动态`}
                      >
                        {unreadMomentsCount > 99 ? '99+' : unreadMomentsCount}
                      </span>
                    )}
                  </div>
                  <span>{item.label}</span>
                </ActionButton>
              )
            })}
          </div>
        </div>
      </div>
      )}
    </aside>
  )
}

function DockTextBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <ActionButton
      onClick={onClick}
      size="sm"
      className="w-full border-0 py-1.5 text-[11px]"
      style={{
        color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
        background: active ? 'var(--accent-subtle)' : 'transparent',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(event) => { if (!active) event.currentTarget.style.background = 'var(--sidebar-hover)' }}
      onMouseLeave={(event) => { if (!active) event.currentTarget.style.background = 'transparent' }}
    >
      {icon}
      {label}
    </ActionButton>
  )
}

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
}: {
  personaName: string
  personaBlurb: string
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
}) {
  return (
    <aside
      className="flex shrink-0 flex-col border-r"
      style={{
        width: width ?? 248,
        background: 'var(--sidebar-bg)',
        borderColor: 'var(--border-color)',
      }}
      data-testid="primary-sidebar"
    >
      {/* 品牌 / 主角 */}
      <button
        type="button"
        onClick={onOpenShelf}
        className="mx-3 mt-4 flex items-center gap-3 rounded-[var(--radius-lg)] px-2 py-2.5 text-left transition"
        style={{ background: 'transparent' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sidebar-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        title="打开角色架"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
          style={{ background: 'var(--accent-subtle)', color: 'var(--companion-accent-warm)' }}
        >
          {(personaName || '?').slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {personaName || '伙伴'}
          </span>
          <span className="mt-0.5 block truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {personaBlurb || '越探索，越着迷。'}
          </span>
        </span>
      </button>

      {/* 新对话 / 搜索：搜索在同一行展开，避免把会话列表再向下挤一层。 */}
      <div className="mt-3 flex items-center gap-1.5 px-3" data-testid="sidebar-toolbar">
        {sidebarSearchOpen ? (
          <div
            className="flex h-10 min-w-0 flex-1 self-start items-center gap-2 rounded-[var(--radius-lg)] border px-2.5"
            style={{
              background: 'var(--input-bg)',
              borderColor: 'var(--input-border)',
            }}
          >
            <Search size={15} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <TextField
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
              <X size={14} />
            </IconButton>
          </div>
        ) : (
          <ActionButton
            size="md"
            onClick={onCreateSession}
            className="h-10 min-w-0 flex-1 gap-1.5 rounded-[var(--radius-lg)] text-[13px] font-medium"
            style={{
              background: 'var(--accent-subtle)',
              color: 'var(--accent-fg)',
            }}
            title="新对话 Ctrl+N"
          >
            <Plus size={16} />
            新对话
          </ActionButton>
        )}
        {!sidebarSearchOpen && (
          <IconButton
            size={40}
            onClick={onToggleSearch}
            className="rounded-[var(--radius-lg)] transition hover:bg-[var(--sidebar-hover)]"
            style={{ color: 'var(--text-muted)' }}
            label="搜索会话"
          >
            <Search size={16} />
          </IconButton>
        )}
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
      </div>

      {/* 会话列表 */}
      <div className="scrollbar-thin mt-3 flex-1 overflow-y-auto px-2 pb-2" data-testid="sidebar-session-list">
        {sessionGroups.map((group) => (
          <div key={group.label}>
            <div
              className="px-2.5 pb-1.5 pt-3 text-[10px] font-medium tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {group.label}
            </div>
            {group.items.map((s) => {
              const active = s.id === activeSessionId && activeView === 'chat'
              const preview = sessionPreviews[s.id]
              return (
                <div
                  key={s.id}
                  className="group mb-0.5 cursor-pointer rounded-[var(--radius-md)] px-2.5 py-2 transition"
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
                    <>
                      <div className="flex items-start gap-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            {bgStreamingSessionId === s.id && s.id !== activeSessionId && (
                              <span
                                className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
                                style={{ background: 'var(--accent)' }}
                              />
                            )}
                            {pinnedIds.includes(s.id) && (
                              <Pin size={10} style={{ color: 'var(--accent)' }} />
                            )}
                            <span
                              className="truncate text-[13px] font-medium"
                              style={{ color: active ? 'var(--accent-fg)' : 'var(--text-primary)' }}
                            >
                              {s.title}
                            </span>
                          </div>
                          <div
                            className="mt-0.5 truncate text-[11px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {formatSessionStamp(s.updatedAt)}
                            {preview ? ` · ${formatSessionPreview(preview)}` : ''}
                          </div>
                        </div>
                        <IconButton
                          size={24}
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteSession(s.id)
                          }}
                          className="invisible mt-0.5 shrink-0 transition group-hover:visible focus-visible:visible"
                          style={{ color: 'var(--text-muted)' }}
                          label="删除会话"
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <X size={12} />
                        </IconButton>
                      </div>
                    </>
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

      {/* 底栏：开发入口固定在产品入口上方，两个区块共同占用稳定底部空间。 */}
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
        <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="grid grid-cols-2 gap-1">
            {DOCK.map((item) => {
              const active = item.id === 'world' ? isWorldView(activeView) : activeView === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className="flex flex-col items-center gap-1 rounded-[var(--radius-md)] px-1 py-2 transition"
                  style={{
                    color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                    background: active ? 'var(--accent-subtle)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = 'var(--sidebar-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = 'transparent'
                  }}
                  title={item.label}
                >
                  {item.icon}
                  <span className="text-[10px] leading-none">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
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
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] py-1.5 text-[11px] transition"
      style={{
        color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
        background: active ? 'var(--accent-subtle)' : 'transparent',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--sidebar-hover)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon}
      {label}
    </button>
  )
}

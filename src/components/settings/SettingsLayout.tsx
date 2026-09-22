import type { ReactNode } from 'react'
import { ArrowLeft, Brain, ChevronRight, CircleHelp, Cloud, Database, Heart, Link2, Palette, ShieldCheck, Wrench } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { TabStrip } from '../foundation/TabStrip'

export type SettingsPageId = 'appearance' | 'companion' | 'model' | 'memory' | 'data' | 'permissions' | 'skills' | 'mcp' | 'about'

interface SettingsNavItem { id: SettingsPageId; label: string; icon: ReactNode }

export const SETTINGS_NAV_GROUPS: readonly { group: string; items: readonly SettingsNavItem[] }[] = [
  { group: '日常', items: [
    { id: 'appearance', label: '外观与界面', icon: <Palette size={15} /> },
    { id: 'companion', label: '伙伴与相处', icon: <Heart size={15} /> },
    { id: 'model', label: '模型', icon: <Cloud size={15} /> },
    { id: 'memory', label: '记忆', icon: <Brain size={15} /> },
    { id: 'data', label: '数据与隐私', icon: <Database size={15} /> },
  ] },
  { group: '高级', items: [
    { id: 'permissions', label: '权限与自动化', icon: <ShieldCheck size={15} /> },
    { id: 'skills', label: 'Skills', icon: <Wrench size={15} /> },
    { id: 'mcp', label: 'MCP', icon: <Link2 size={15} /> },
  ] },
]
const ABOUT: SettingsNavItem = { id: 'about', label: '关于 My Agent', icon: <CircleHelp size={15} /> }
export const SETTINGS_NAV_ITEMS = [...SETTINGS_NAV_GROUPS.flatMap((group) => group.items), ABOUT]

interface SettingsLayoutProps {
  activeSection: SettingsPageId
  onSelect: (section: SettingsPageId) => void
  onClose?: () => void
  children: ReactNode
  prefix?: string
  /** 嵌入的管理面板拥有自己的滚动区，外壳不能再增加第二个页面滚动区。 */
  panelOwnsScroll?: boolean
}

/**
 * 背景：候选设置与正式设置曾各自维护导航，验收后的 IA 没有进入正式入口。
 * 设计意图：共享业务导航与布局，基础交互复用 ActionButton / TabStrip；数据和保存仍由调用方管理。
 * 关键约束：此组件不读写 IPC 或设置，候选与正式只隔离内容；所有导航项始终预留指示图标空间。
 */
export function SettingsLayout({ activeSection, onSelect, onClose, children, prefix = 'settings', panelOwnsScroll = false }: SettingsLayoutProps) {
  const renderItem = (item: SettingsNavItem) => {
    const active = item.id === activeSection
    return <ActionButton key={item.id} size="md" aria-current={active ? 'page' : undefined}
      aria-controls={`${prefix}-panel-${item.id}`} title={item.label} onClick={() => onSelect(item.id)}
      data-testid={`${prefix}-nav-${item.id}`}
      className="settings-nav-item w-full gap-2 border-0 text-left hover:bg-[var(--hover-overlay)]"
      style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)', background: active ? 'var(--hover-overlay)' : undefined }}
      onMouseEnter={(event) => { if (!active) event.currentTarget.style.background = 'var(--hover-overlay)' }}
      onMouseLeave={(event) => { if (!active) event.currentTarget.style.background = 'transparent' }}>
      <span className="shrink-0" aria-hidden="true" style={{ color: active ? 'var(--accent-fg)' : 'var(--text-muted)' }}>{item.icon}</span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <ChevronRight size={12} className="shrink-0" aria-hidden="true" style={{ opacity: active ? 1 : 0 }} />
    </ActionButton>
  }
  return <div className="flex h-full min-h-0 w-full min-w-0 flex-1" data-settings-layout="shared">
    <aside className="scrollbar-thin hidden w-[198px] shrink-0 flex-col overflow-y-auto border-r px-3 py-4 md:flex"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }} data-testid="settings-nav">
      <div className="mb-5 px-2">
        {onClose ? <ActionButton onClick={onClose} title="返回聊天" data-testid="settings-back" variant="plain" className="min-h-8 w-full justify-start gap-1.5 rounded-lg px-2.5 py-2 text-left text-[12px]"><ArrowLeft size={15} strokeWidth={1.75} />返回</ActionButton> : null}
        <h2 className="mt-2 text-[13px] font-semibold">设置</h2>
      </div>
      <nav className="flex-1 space-y-5" aria-label="设置导航">
        {SETTINGS_NAV_GROUPS.map((group) => <div key={group.group}>
          <div className="mb-1 px-2 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{group.group}</div>
          <div className="space-y-0.5">{group.items.map(renderItem)}</div>
        </div>)}
      </nav>
      <div className="mt-5 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>{renderItem(ABOUT)}</div>
    </aside>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-w-0 border-b px-3 py-2 md:hidden" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        {onClose && <ActionButton onClick={onClose} title="返回" data-testid="settings-back-mobile" variant="plain" className="mb-2 min-h-8 justify-start gap-1.5 rounded-lg px-2.5 py-2 text-left text-[12px]"><ArrowLeft size={15} strokeWidth={1.75} />返回</ActionButton>}
        <div data-testid={`${prefix}-mobile-nav`}>
          <TabStrip label="设置导航" items={SETTINGS_NAV_ITEMS.map((item) => ({ id: item.id, label: item.id === 'about' ? '关于' : item.label, panelId: `${prefix}-panel-${item.id}` }))}
            activeId={activeSection} onSelect={(id) => { const item = SETTINGS_NAV_ITEMS.find((entry) => entry.id === id); if (item) onSelect(item.id) }} />
        </div>
      </div>
      <main className={`min-h-0 min-w-0 flex-1 px-4 py-5 sm:px-6 ${panelOwnsScroll ? 'overflow-hidden' : 'scrollbar-thin overflow-y-auto'}`} data-testid="settings-main">
        <div key={activeSection} id={`${prefix}-panel-${activeSection}`} role="tabpanel"
          aria-label={SETTINGS_NAV_ITEMS.find((item) => item.id === activeSection)?.label}
          className={`view-transition mx-auto w-full min-w-0 max-w-3xl ${panelOwnsScroll ? 'h-full min-h-0' : ''}`} data-testid={`${prefix}-content`}>
          {children}
        </div>
      </main>
    </div>
  </div>
}

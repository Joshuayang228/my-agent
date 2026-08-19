/**
 * Playground 壳：单一侧栏 + 一级实验入口，内容区直接渲染当前故事。
 * 设计意图：像 Settings 一样让每个可独立验收的实验成为一级目的地，避免页面内再套二级导航。
 */

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Blocks,
  Brain,
  BriefcaseBusiness,
  FileCode2,
  FlaskConical,
  Image,
  MessageSquare,
  Newspaper,
  Palette,
  PanelRight,
  Settings2,
  TerminalSquare,
  TestTube2,
  type LucideIcon,
} from 'lucide-react'
import { PLAYGROUND_GROUPS, PLAYGROUND_TABS, type PlaygroundTabId } from './catalog'
import { DesignSystemPanel } from './DesignSystemPanel'
import { UiControlsPanel } from './UiControlsPanel'
import { FoundationComponentsPanel } from './FoundationComponentsPanel'
import { BusinessStatesPanel } from './BusinessStatesPanel'
import { SurfaceBaselinePanel } from './SurfaceBaselinePanel'
import { PromptLabPanel } from './PromptLabPanel'
import { ToolRunPanel, type PlaygroundToolInfo } from './ToolRunPanel'
import { ModelTestPanel } from './ModelTestPanel'
import { AdoptionVisibilityProvider, AdoptionVisibilityToggle } from './AdoptionMark'

const TAB_STORAGE_KEY = 'playground.active-tab'

const ICONS: Partial<Record<PlaygroundTabId, LucideIcon>> = {
  'design-tokens': Palette,
  'visual-assets': Image,
  'foundation-components': Blocks,
  chat: MessageSquare,
  world: Newspaper,
  memory: Brain,
  settings: Settings2,
  workspace: PanelRight,
  'business-states': BriefcaseBusiness,
  'chat-lab': MessageSquare,
  'model-test': TestTube2,
  tools: TerminalSquare,
}


function readInitialTab(): PlaygroundTabId {
  if (typeof window === 'undefined') return 'design-system'
  const stored = window.localStorage.getItem(TAB_STORAGE_KEY) as PlaygroundTabId | null
  return PLAYGROUND_TABS.some((tab) => tab.id === stored && tab.status !== 'archived') ? stored! : 'design-system'
}



export function PlaygroundShell({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<PlaygroundTabId>(readInitialTab)
  const [tools, setTools] = useState<PlaygroundToolInfo[]>([])

  const loadTools = useCallback(async () => {
    if (!window.electronAPI?.debug?.tools) return
    try {
      setTools(await window.electronAPI.debug.tools())
    } catch {
      /* 工具清单失败只影响工具手测，不阻塞设计实验。 */
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(TAB_STORAGE_KEY, tab)
    if (tab === 'tools') void loadTools()
  }, [tab, loadTools])

  const activeTabs = PLAYGROUND_TABS.filter((item) => item.status !== 'archived')

  return (
    <AdoptionVisibilityProvider>
      <div className="flex h-full min-h-0" data-testid="playground-shell">
        <nav
          className="flex w-[214px] shrink-0 flex-col overflow-y-auto border-r px-3 py-3"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
          aria-label="Playground 一级导航"
          data-testid="playground-nav"
        >
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] transition"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                title="返回聊天"
              >
                <ArrowLeft size={14} strokeWidth={1.75} />
                返回
              </button>
            ) : <span />}
            <FlaskConical size={15} style={{ color: 'var(--accent)' }} aria-hidden="true" />
          </div>

          <div className="mb-4 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
            <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              <FlaskConical size={14} style={{ color: 'var(--accent)' }} />
              Playground
            </div>
            <p className="mt-1 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>
              基础、产品体验和 Agent 能力的隔离实验室
            </p>
          </div>

          <div className="space-y-5">
            {PLAYGROUND_GROUPS.map((group) => {
              const tabs = activeTabs.filter((item) => item.group === group.id)
              return (
                <section key={group.id} aria-label={group.label}>
                  <div className="mb-1.5 px-1 text-[10px] font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {tabs.map((item) => {
                      const active = tab === item.id
                      const Icon = ICONS[item.id] ?? FileCode2
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setTab(item.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition-all"
                          style={active ? { background: 'var(--accent-subtle)', color: 'var(--accent-fg)', fontWeight: 600 } : { color: 'var(--text-secondary)' }}
                          onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
                          onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                          data-active={active ? 'true' : undefined}
                        >
                          <Icon size={14} strokeWidth={1.7} aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </nav>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto mb-4 flex max-w-5xl items-center justify-end gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <AdoptionVisibilityToggle />
          </div>
          {tab === 'design-tokens' && <DesignSystemPanel />}
          {tab === 'visual-assets' && <UiControlsPanel initialSub="icons" />}
          {tab === 'foundation-components' && <FoundationComponentsPanel />}
          {tab === 'chat' && <SurfaceBaselinePanel initialSurface="chat" />}
          {tab === 'world' && <SurfaceBaselinePanel initialSurface="world" />}
          {tab === 'memory' && <SurfaceBaselinePanel initialSurface="memory" />}
          {tab === 'settings' && <SurfaceBaselinePanel initialSurface="settings" />}
          {tab === 'workspace' && <SurfaceBaselinePanel initialSurface="dock" />}
          {tab === 'business-states' && <BusinessStatesPanel />}
          {tab === 'chat-lab' && <PromptLabPanel />}
          {tab === 'model-test' && <ModelTestPanel />}
          {tab === 'tools' && <ToolRunPanel tools={tools} />}
        </div>
      </div>
    </AdoptionVisibilityProvider>
  )
}

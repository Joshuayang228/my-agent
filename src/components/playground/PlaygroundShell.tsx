/**
 * Playground 全屏壳：与设置页共用“单一左栏 + 右侧内容”的一级工作区结构。
 * 设计意图：进入 Playground 后不再叠加产品 Primary Sidebar，避免出现两层侧栏和重复返回路径。
 */

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Blocks,
  Brain,
  BriefcaseBusiness,
  FileCode2,
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
import { ProductExperienceDependencies } from './ProductExperienceDependencies'
import type { ProductExperienceTabId } from '../../shared/product-experience-registry'
import { SurfaceBaselinePanel } from './SurfaceBaselinePanel'
import { PromptLabPanel } from './PromptLabPanel'
import { ToolRunPanel, type PlaygroundToolInfo } from './ToolRunPanel'
import { ModelTestPanel } from './ModelTestPanel'
import { PlaygroundPageHeader, PlaygroundSourcePath } from './PlaygroundLayout'
import { findPlaygroundPersona } from '../../shared/playground-journey-fixtures'

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
  if (typeof window === 'undefined') return 'design-tokens'
  const stored = window.localStorage.getItem(TAB_STORAGE_KEY) as PlaygroundTabId | null
  return PLAYGROUND_TABS.some((tab) => tab.id === stored && tab.status !== 'archived') ? stored! : 'design-tokens'
}

export function PlaygroundShell({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<PlaygroundTabId>(readInitialTab)
  const [tools, setTools] = useState<PlaygroundToolInfo[]>([])
  const [personaId, setPersonaId] = useState('lin')
  const [settingsScenario, setSettingsScenario] = useState<'settings' | 'role-shelf'>('settings')
  const persona = findPlaygroundPersona(personaId)

  const navigateTo = (nextTab: PlaygroundTabId) => {
    if (nextTab === 'settings') setSettingsScenario('settings')
    setTab(nextTab)
  }

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
  const activeTab = activeTabs.find((item) => item.id === tab) ?? activeTabs[0]
  const activeGroup = PLAYGROUND_GROUPS.find((item) => item.id === activeTab.group) ?? PLAYGROUND_GROUPS[0]

  const experienceTabId = ((): ProductExperienceTabId | undefined => {
    switch (tab) {
      case 'chat':
      case 'world':
      case 'memory':
      case 'settings':
      case 'workspace':
      case 'business-states':
        return tab
      default:
        return undefined
    }
  })()

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1" data-testid="playground-shell">
      <aside
        className="playground-nav flex w-[208px] shrink-0 flex-col overflow-y-auto border-r px-3 py-5"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
        aria-label="Playground 一级导航"
        data-testid="playground-nav"
      >
        {onClose && (
          <div className="mb-4">
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] transition"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--hover-overlay)')}
              onMouseLeave={(event) => (event.currentTarget.style.background = '')}
              title="返回聊天"
              data-testid="playground-back"
            >
              <ArrowLeft size={15} strokeWidth={1.75} />
              返回
            </button>
          </div>
        )}

        {PLAYGROUND_GROUPS.map((group) => {
          const tabs = activeTabs.filter((item) => item.group === group.id)
          return (
            <section key={group.id} className="mb-5" aria-label={group.label}>
              <div className="mb-2 px-2 text-[10px] font-semibold tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
                {group.label}
              </div>
              {tabs.map((item) => {
                const active = tab === item.id
                const Icon = ICONS[item.id] ?? FileCode2
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] transition ${active ? 'font-medium' : ''}`}
                    style={{
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: active ? 'var(--hover-overlay)' : undefined,
                    }}
                    onMouseEnter={(event) => { if (!active) event.currentTarget.style.background = 'var(--hover-overlay)' }}
                    onMouseLeave={(event) => { if (!active) event.currentTarget.style.background = '' }}
                    data-active={active ? 'true' : undefined}
                  >
                    <Icon size={15} strokeWidth={1.7} style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }} aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </section>
          )
        })}
      </aside>

      <main className="playground-main min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-8" data-testid="playground-main">
        <div className="mx-auto w-full max-w-6xl">
          <PlaygroundPageHeader
            title={activeTab.label}
            description={activeTab.description ?? activeGroup.description}
            descriptionInline
            metaInline={!experienceTabId}
            meta={experienceTabId
              ? <ProductExperienceDependencies tabId={experienceTabId} showSource />
              : <PlaygroundSourcePath sourcePaths={activeTab.sourcePaths ?? []} />}
          />
          <div className="view-transition" key={tab}>
            {tab === 'design-tokens' && <DesignSystemPanel />}
            {tab === 'visual-assets' && <UiControlsPanel initialSub="icons" />}
            {tab === 'foundation-components' && <FoundationComponentsPanel />}
            {tab === 'chat' && <SurfaceBaselinePanel initialSurface="chat" persona={persona} onPersonaChange={setPersonaId} settingsScenario={settingsScenario} onSettingsScenarioChange={setSettingsScenario} onNavigate={navigateTo} />}
            {tab === 'world' && <SurfaceBaselinePanel initialSurface="world" persona={persona} onPersonaChange={setPersonaId} settingsScenario={settingsScenario} onSettingsScenarioChange={setSettingsScenario} onNavigate={navigateTo} />}
            {tab === 'memory' && <SurfaceBaselinePanel initialSurface="memory" persona={persona} onPersonaChange={setPersonaId} settingsScenario={settingsScenario} onSettingsScenarioChange={setSettingsScenario} onNavigate={navigateTo} />}
            {tab === 'settings' && <SurfaceBaselinePanel initialSurface="settings" persona={persona} onPersonaChange={setPersonaId} settingsScenario={settingsScenario} onSettingsScenarioChange={setSettingsScenario} onNavigate={navigateTo} />}
            {tab === 'workspace' && <SurfaceBaselinePanel initialSurface="dock" />}
            {tab === 'business-states' && <BusinessStatesPanel />}
            {tab === 'chat-lab' && <PromptLabPanel />}
            {tab === 'model-test' && <ModelTestPanel />}
            {tab === 'tools' && <ToolRunPanel tools={tools} />}
          </div>
        </div>
      </main>
    </div>
  )
}

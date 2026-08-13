
/**
 * Playground 壳：按开发者任务分组，叶子页面仍复用现有隔离实验面板。
 * 设计意图：降低入口认知负担，同时保留每个实验的独立 URL-less 状态。
 */

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FlaskConical } from 'lucide-react'
import { PLAYGROUND_GROUPS, PLAYGROUND_TABS, type PlaygroundTabId } from './catalog'
import { DesignSystemPanel } from './DesignSystemPanel'
import { UiControlsPanel } from './UiControlsPanel'
import { SurfaceBaselinePanel } from './SurfaceBaselinePanel'
import { PromptLabPanel } from './PromptLabPanel'
import { ToolRunPanel, type PlaygroundToolInfo } from './ToolRunPanel'
import { ModelTestPanel } from './ModelTestPanel'
import { AdoptionVisibilityProvider, AdoptionVisibilityToggle } from './AdoptionMark'

const TAB_STORAGE_KEY = 'playground.active-tab'

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
          className="flex w-[190px] shrink-0 flex-col overflow-y-auto border-r px-2 py-3"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
          aria-label="Playground 分组"
        >
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="mb-2 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] transition"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              title="返回聊天"
            >
              <ArrowLeft size={15} strokeWidth={1.75} />
              返回
            </button>
          )}
          <div className="mb-3 flex items-center gap-1.5 px-2.5 pb-2 text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            <FlaskConical size={13} style={{ color: 'var(--accent)' }} />
            Playground
          </div>
          <div className="space-y-3">
            {PLAYGROUND_GROUPS.map((group) => {
              const tabs = activeTabs.filter((item) => item.group === group.id)
              return (
                <section key={group.id} aria-label={group.label}>
                  <div className="px-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{group.label}</div>
                  <p className="px-2.5 pt-1 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>{group.description}</p>
                  <div className="mt-1 space-y-0.5">
                    {tabs.map((item) => {
                      const active = tab === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setTab(item.id)}
                          className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-all"
                          style={active ? { background: 'var(--accent-subtle)', color: 'var(--accent-fg)', fontWeight: 500 } : { color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
                          onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                          data-active={active ? 'true' : undefined}
                        >
                          {item.label}
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
          {tab === 'design-system' && <DesignSystemPanel />}
          {tab === 'ui-controls' && <UiControlsPanel />}
          {tab === 'surface-baseline' && <SurfaceBaselinePanel />}
          {tab === 'chat-lab' && <PromptLabPanel />}
          {tab === 'model-test' && <ModelTestPanel />}
          {tab === 'tools' && <ToolRunPanel tools={tools} />}
        </div>
      </div>
    </AdoptionVisibilityProvider>
  )
}

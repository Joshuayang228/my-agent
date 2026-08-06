/**
 * Playground 壳 — 左侧活目录 + 右侧展示/编辑区（对齐 Alice Debug 左右栏）。
 */

import { useCallback, useEffect, useState } from 'react'
import { PLAYGROUND_TABS, type PlaygroundTabId } from './catalog'
import { DesignSystemPanel } from './DesignSystemPanel'
import { UiControlsPanel } from './UiControlsPanel'
import { PromptCatalogPanel } from './PromptCatalogPanel'
import { PromptLabPanel } from './PromptLabPanel'
import { ToolRunPanel, type PlaygroundToolInfo } from './ToolRunPanel'
import { FixturesPanel } from './FixturesPanel'

export function PlaygroundShell() {
  const [tab, setTab] = useState<PlaygroundTabId>('design-system')
  const [tools, setTools] = useState<PlaygroundToolInfo[]>([])

  const loadTools = useCallback(async () => {
    if (!window.electronAPI?.debug?.tools) return
    try {
      setTools(await window.electronAPI.debug.tools())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (tab === 'tools') void loadTools()
  }, [tab, loadTools])

  const activeTabs = PLAYGROUND_TABS.filter((t) => t.status !== 'archived')

  return (
    <div className="flex h-full min-h-0" data-testid="playground-shell">
      <nav
        className="flex w-[156px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r px-2 py-3"
        style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
        aria-label="Playground 分区"
      >
        {activeTabs.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="w-full rounded-lg px-2.5 py-2 text-left text-sm transition-all"
              style={
                active
                  ? { background: 'var(--accent-subtle)', color: 'var(--accent-fg)', fontWeight: 500 }
                  : { color: 'var(--text-muted)' }
              }
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'var(--sidebar-hover)'
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent'
              }}
              data-active={active ? 'true' : undefined}
            >
              {t.label}
            </button>
          )
        })}
      </nav>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6">
        {tab === 'design-system' && <DesignSystemPanel />}
        {tab === 'ui-controls' && <UiControlsPanel />}
        {tab === 'prompts' && <PromptCatalogPanel onOpenChatLab={() => setTab('chat-lab')} />}
        {tab === 'chat-lab' && <PromptLabPanel />}
        {tab === 'tools' && <ToolRunPanel tools={tools} />}
        {tab === 'fixtures' && <FixturesPanel />}
      </div>
    </div>
  )
}

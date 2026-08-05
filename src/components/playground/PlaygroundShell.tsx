/**
 * Playground 壳 — Alice 式顶栏活目录 + 居中内容。
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
    <div className="flex h-full flex-col" data-testid="playground-shell">
      <div
        className="flex-shrink-0 overflow-x-auto border-b px-4 py-1.5"
        style={{ borderColor: 'var(--border-color)', scrollbarWidth: 'none' }}
      >
        <div className="flex items-center gap-0.5">
          {activeTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-all"
              style={
                tab === t.id
                  ? { background: 'var(--accent-subtle)', color: 'var(--accent-fg)', fontWeight: 500 }
                  : { color: 'var(--text-muted)' }
              }
              data-active={tab === t.id ? 'true' : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
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

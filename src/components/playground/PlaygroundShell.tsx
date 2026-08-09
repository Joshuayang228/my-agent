/**
 * Playground 壳 — 左侧返回 + 活目录，右侧展示/编辑区。
 */

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FlaskConical } from 'lucide-react'
import { PLAYGROUND_TABS, type PlaygroundTabId } from './catalog'
import { DesignSystemPanel } from './DesignSystemPanel'
import { UiControlsPanel } from './UiControlsPanel'
import { SurfaceBaselinePanel } from './SurfaceBaselinePanel'
import { PromptLabPanel } from './PromptLabPanel'
import { ToolRunPanel, type PlaygroundToolInfo } from './ToolRunPanel'
import { FixturesPanel } from './FixturesPanel'
import { ModelTestPanel } from './ModelTestPanel'
import { AdoptionMark } from './AdoptionMark'

export function PlaygroundShell({ onClose }: { onClose?: () => void }) {
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
        <div className="mb-2 flex items-center gap-1.5 px-2.5 pb-2 text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          <FlaskConical size={13} style={{ color: 'var(--accent)' }} />
          Playground
        </div>
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
        <div className="mx-auto mb-4 flex max-w-5xl items-center justify-end gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <AdoptionMark label="已用于正式产品" />
          已用于正式产品
        </div>
        {tab === 'design-system' && <DesignSystemPanel />}
        {tab === 'ui-controls' && <UiControlsPanel />}
        {tab === 'surface-baseline' && <SurfaceBaselinePanel />}
        {tab === 'chat-lab' && <PromptLabPanel />}
        {tab === 'model-test' && <ModelTestPanel />}
        {tab === 'tools' && <ToolRunPanel tools={tools} />}
        {tab === 'fixtures' && <FixturesPanel />}
      </div>
    </div>
  )
}

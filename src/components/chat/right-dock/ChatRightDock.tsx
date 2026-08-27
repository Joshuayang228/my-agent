/**
 * Chat 右侧能力坞 — 文件 / 预览 / 审阅 / 终端；Debug 调用链盖上层（Alice 式）。
 * Playground 可通过显式模式验收按需添加 Tab，不改变生产默认工具可见性。
 */

import { useEffect, useRef, useState } from 'react'
import { Eye, FileCode2, FileText, GitCompare, Plus, TerminalSquare, X } from 'lucide-react'
import { FileBrowser, type FileBrowserPreviewData, type FileBrowserPreviewState } from '../../FileBrowser'
import { ReviewPanel } from './ReviewPanel'
import { TerminalPanel } from './TerminalPanel'
import { ConversationDebugAside } from '../ConversationDebugAside'
import type { LLMCallSummary } from '../../../shared/types'

export type RightDockTab = 'files' | 'preview' | 'review' | 'terminal'

type RightDockTabMeta = { id: RightDockTab; label: string; icon: typeof FileText }
type RightDockTabInstance = { instanceId: string; kind: RightDockTab }

interface ChatRightDockProps {
  projectPath: string | null
  sessionId: string | null
  showFiles: boolean
  conversationDebug: boolean
  persistedCalls: LLMCallSummary[]
  persistedLoading: boolean
  /** 可拖宽度；默认 380 */
  width?: number
  /** Playground / 测试专用只读文件样张。 */
  filesPreview?: FileBrowserPreviewData
  /** 显式启用 Playground Tab 按需添加候选；生产默认不传。 */
  playgroundTabs?: boolean
  /** 正式工作坞采用预览默认、其余 Tab 通过 + 添加；不改变审阅 / 终端真实能力。 */
  deferredTabs?: boolean
  onCloseFiles: () => void
  onCloseDebug: () => void
}

const TABS: readonly RightDockTabMeta[] = [
  { id: 'preview', label: '预览', icon: Eye },
  { id: 'files', label: '文件', icon: FileText },
  { id: 'review', label: '审阅', icon: GitCompare },
  { id: 'terminal', label: '终端', icon: TerminalSquare },
]

function DockFixture({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid={`dock-fixture-${title}`}>
      <div className="border-b px-3 py-2 text-[11px] font-medium" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {title} · 隔离样张
      </div>
      <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] leading-5" style={{ color: 'var(--text-muted)' }}>
        {body}
      </div>
    </div>
  )
}

export function ChatRightDock({
  projectPath,
  sessionId,
  showFiles,
  conversationDebug,
  persistedCalls,
  persistedLoading,
  width = 380,
  filesPreview,
  playgroundTabs = false,
  deferredTabs = false,
  onCloseFiles,
  onCloseDebug,
}: ChatRightDockProps) {
  const [sharedPreview, setSharedPreview] = useState<FileBrowserPreviewState>(null)
  const deferredTabMode = playgroundTabs || deferredTabs
  const nextInstance = useRef(2)
  const initialInstance = (kind: RightDockTab): RightDockTabInstance => ({ instanceId: `${kind}-1`, kind })
  const [activeTabId, setActiveTabId] = useState(deferredTabMode ? 'preview-1' : 'files-1')
  const [openTabs, setOpenTabs] = useState<RightDockTabInstance[]>(deferredTabMode
    ? [initialInstance('preview')]
    : [initialInstance('files'), initialInstance('review'), initialInstance('terminal')])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const open = showFiles || conversationDebug
  useEffect(() => {
    if (!deferredTabMode) return
    nextInstance.current = 2
    setActiveTabId('preview-1')
    setOpenTabs([initialInstance('preview')])
    setAddMenuOpen(false)
  }, [deferredTabMode])

  if (!open) return null

  const showWorkbench = showFiles
  const visibleTabs = deferredTabMode
    ? openTabs.map((instance, index) => {
        const meta = TABS.find((item) => item.id === instance.kind)!
        const sameKindBefore = openTabs.slice(0, index).filter((item) => item.kind === instance.kind).length
        return { instance, meta, label: sameKindBefore > 0 ? `${meta.label} ${sameKindBefore + 1}` : meta.label }
      })
    : TABS.filter((item) => item.id !== 'preview').map((meta) => ({ instance: initialInstance(meta.id), meta, label: meta.label }))
  const addableTabs = TABS
  const activeInstance = openTabs.find((instance) => instance.instanceId === activeTabId) ?? openTabs[0]
  const activeKind = activeInstance?.kind ?? 'preview'

  const addTab = (next: RightDockTab) => {
    const instanceId = `${next}-${nextInstance.current++}`
    setOpenTabs((current) => [...current, { instanceId, kind: next }])
    setActiveTabId(instanceId)
    setAddMenuOpen(false)
  }

  const closeTab = () => {
    if (!deferredTabMode) {
      onCloseFiles()
      return
    }
    const currentIndex = openTabs.findIndex((item) => item.instanceId === activeTabId)
    const remaining = openTabs.filter((item) => item.instanceId !== activeTabId)
    setOpenTabs(remaining)
    if (remaining.length === 0) onCloseFiles()
    else setActiveTabId(remaining[Math.max(0, currentIndex - 1)]?.instanceId ?? remaining[remaining.length - 1].instanceId)
  }

  return (
    <div
      className="relative flex shrink-0 flex-col overflow-hidden border-l"
      style={{ width, borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
      data-testid="chat-right-dock"
    >
      {showWorkbench && (
        <div className="flex h-full min-h-0 flex-col">
          <div
            className="relative flex shrink-0 items-center gap-0.5 border-b px-1.5 py-1"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {visibleTabs.map(({ instance, meta, label }) => {
              const Icon = meta.icon
              const active = activeTabId === instance.instanceId
              return (
                <button
                  key={instance.instanceId}
                  type="button"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition"
                  style={{
                    color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                    background: active ? 'var(--accent-subtle)' : undefined,
                  }}
                  onClick={() => setActiveTabId(instance.instanceId)}
                  data-testid={`right-dock-tab-${instance.kind}`}
                  data-instance-id={instance.instanceId}
                >
                  <Icon size={12} />
                  {label}
                </button>
              )
            })}
            {deferredTabMode ? (
              <>
                <button
                  type="button"
                  className="ml-auto rounded p-1"
                  style={{ color: addMenuOpen ? 'var(--accent-fg)' : 'var(--text-muted)', background: addMenuOpen ? 'var(--accent-subtle)' : undefined }}
                  title="添加右坞 Tab"
                  onClick={() => setAddMenuOpen((current) => !current)}
                  data-testid="right-dock-add-tab"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  className="rounded p-1"
                  style={{ color: 'var(--text-muted)' }}
                  title="关闭当前 Tab"
                  onClick={closeTab}
                  data-testid="right-dock-close-tab"
                >
                  <X size={14} />
                </button>
                {addMenuOpen && (
                  <div
                    className="absolute right-1 top-9 z-30 min-w-[116px] rounded-lg border p-1 shadow-lg"
                    style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }}
                    role="menu"
                    aria-label="添加右坞 Tab"
                  >
                    {addableTabs.map((item) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px]"
                          style={{ color: 'var(--text-secondary)' }}
                          onClick={() => addTab(item.id)}
                          role="menuitem"
                        >
                          <Icon size={12} />
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                className="ml-auto rounded p-1"
                style={{ color: 'var(--text-muted)' }}
                title="关闭右坞"
                onClick={onCloseFiles}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {activeKind === 'files' && (
              <FileBrowser
                projectPath={projectPath}
                onClose={onCloseFiles}
                embedded
                previewData={filesPreview}
                mode={deferredTabMode ? 'files' : 'split'}
                previewState={deferredTabs && !playgroundTabs ? sharedPreview : undefined}
                onPreviewStateChange={deferredTabs && !playgroundTabs ? setSharedPreview : undefined}
              />
            )}
            {activeKind === 'preview' && (
              <FileBrowser
                projectPath={projectPath}
                onClose={onCloseFiles}
                embedded
                previewData={filesPreview}
                mode="preview"
                previewState={deferredTabs && !playgroundTabs ? sharedPreview : undefined}
                onPreviewStateChange={deferredTabs && !playgroundTabs ? setSharedPreview : undefined}
              />
            )}
            {activeKind === 'review' && (
              playgroundTabs
                ? <DockFixture title="审阅" body="这里预留 Review 结果的独立工作区；正式接入前不读取真实会话。" />
                : <ReviewPanel sessionId={sessionId} />
            )}
            {activeKind === 'terminal' && (
              playgroundTabs
                ? <DockFixture title="终端" body="这里预留 Terminal 工具的独立工作区；正式接入前不执行命令。" />
                : <TerminalPanel projectPath={projectPath} />
            )}
          </div>
        </div>
      )}

      {conversationDebug && (
        <div
          className={
            showWorkbench
              ? 'absolute inset-0 z-20 flex flex-col border-l shadow-lg'
              : 'flex h-full min-h-0 flex-col'
          }
          style={{
            borderColor: showWorkbench ? 'var(--border-subtle)' : undefined,
            background: showWorkbench
              ? 'color-mix(in srgb, var(--bg-secondary) 92%, transparent)'
              : 'var(--bg-secondary)',
            backdropFilter: showWorkbench ? 'blur(8px)' : undefined,
          }}
        >
          <ConversationDebugAside
            sessionId={sessionId}
            persistedCalls={persistedCalls}
            persistedLoading={persistedLoading}
            onClose={onCloseDebug}
          />
        </div>
      )}
    </div>
  )
}

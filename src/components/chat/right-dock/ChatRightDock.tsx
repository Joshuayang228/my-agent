/**
 * Chat 右侧能力坞 — 文件 / 预览 / 审阅 / 终端。
 * Playground 可通过显式模式验收按需添加 Tab，不改变生产默认工具可见性。
 */

import { useEffect, useRef, useState } from 'react'
import { Eye, FileCode2, FileText, GitCompare, Plus, TerminalSquare, X } from 'lucide-react'
import { FileBrowser, type FileBrowserPreviewData, type FileBrowserPreviewState } from '../../FileBrowser'
import { ReviewPanel } from './ReviewPanel'
import { TerminalPanel } from './TerminalPanel'
import { TabStrip } from '../../foundation/TabStrip'

export type RightDockTab = 'files' | 'preview' | 'review' | 'terminal'

type RightDockTabMeta = { id: RightDockTab; label: string; icon: typeof FileText }
type RightDockTabInstance = { instanceId: string; kind: RightDockTab; ordinal: number }

interface ChatRightDockProps {
  projectPath: string | null
  sessionId: string | null
  showFiles: boolean
  /** 折叠只隐藏面板，不卸载右坞，以保留 Tab 与预览状态。 */
  collapsed?: boolean
  /** 可拖宽度；默认 380 */
  width?: number
  /** Playground / 测试专用只读文件样张。 */
  filesPreview?: FileBrowserPreviewData
  /** 显式启用 Playground Tab 按需添加候选；生产默认不传。 */
  playgroundTabs?: boolean
  /** 正式工作坞采用预览默认、其余 Tab 通过 + 添加；不改变审阅 / 终端真实能力。 */
  deferredTabs?: boolean
  onCloseFiles: () => void
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
  width = 380,
  filesPreview,
  playgroundTabs = false,
  deferredTabs = false,
  collapsed = false,
  onCloseFiles,
}: ChatRightDockProps) {
  const [sharedPreview, setSharedPreview] = useState<FileBrowserPreviewState>(null)
  const deferredTabMode = playgroundTabs || deferredTabs
  const nextInstance = useRef(2)
  const initialInstance = (kind: RightDockTab): RightDockTabInstance => ({ instanceId: `${kind}-1`, kind, ordinal: 1 })
  const [activeTabId, setActiveTabId] = useState(deferredTabMode ? 'preview-1' : 'files-1')
  const [openTabs, setOpenTabs] = useState<RightDockTabInstance[]>(deferredTabMode
    ? [initialInstance('preview')]
    : [initialInstance('files'), initialInstance('review'), initialInstance('terminal')])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const open = showFiles && !collapsed
  useEffect(() => {
    if (!deferredTabMode) return
    nextInstance.current = 2
    setActiveTabId('preview-1')
    setOpenTabs([initialInstance('preview')])
    setAddMenuOpen(false)
  }, [deferredTabMode])

  // 收起时必须保留子面板，否则终端输入、输出订阅和文件树状态会被卸载重置。
  const showWorkbench = showFiles
  const visibleTabs = deferredTabMode
    ? openTabs.map((instance) => {
        const meta = TABS.find((item) => item.id === instance.kind)!
        return { instance, meta, label: instance.ordinal > 1 ? meta.label + ' ' + instance.ordinal : meta.label }
      })
    : TABS.filter((item) => item.id !== 'preview').map((meta) => ({ instance: initialInstance(meta.id), meta, label: meta.label }))
  const addableTabs = TABS
  const activeInstance = openTabs.find((instance) => instance.instanceId === activeTabId) ?? openTabs[0]
  const activeKind = activeInstance?.kind ?? 'preview'

  const addTab = (next: RightDockTab) => {
    const instanceId = `${next}-${nextInstance.current++}`
    setOpenTabs((current) => [...current, { instanceId, kind: next, ordinal: Math.max(0, ...current.filter((item) => item.kind === next).map((item) => item.ordinal)) + 1 }])
    setActiveTabId(instanceId)
    setAddMenuOpen(false)
  }

  const closeTab = (instanceId: string) => {
    if (!deferredTabMode) {
      onCloseFiles()
      return
    }
    const currentIndex = openTabs.findIndex((item) => item.instanceId === instanceId)
    const remaining = openTabs.filter((item) => item.instanceId !== instanceId)
    setOpenTabs(remaining)
    if (remaining.length === 0) onCloseFiles()
    else if (instanceId === activeTabId) setActiveTabId(remaining[Math.max(0, currentIndex - 1)]?.instanceId ?? remaining[remaining.length - 1].instanceId)
  }

  return (
    <div
      className="relative flex shrink-0 flex-col overflow-hidden border-l"
      id="chat-right-dock"
      style={{ display: open ? undefined : 'none', width, borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
      data-testid="chat-right-dock"
    >
      {showWorkbench && (
        <div className="flex h-full min-h-0 flex-col">
          <div
            className="relative flex shrink-0 items-center gap-0.5 border-b px-1.5 py-1"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <TabStrip label="已打开的工作区" activeId={activeTabId} itemTestId="right-dock-tab-item"
              items={visibleTabs.map(({ instance, meta, label }) => { const Icon = meta.icon; return { id: instance.instanceId, label, icon: <Icon size={14} />, testId: 'right-dock-tab-' + instance.kind } })}
              onSelect={setActiveTabId} onClose={deferredTabMode ? closeTab : undefined} />
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

    </div>
  )
}

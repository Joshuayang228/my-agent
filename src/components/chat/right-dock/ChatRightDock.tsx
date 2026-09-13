/** 正式 Chat 工作区。文件内部预览不再作为顶层工具；Debug 保持独立。 */
import { useRef, useState } from 'react'
import { FileText, GitCompare, Globe, MessageCircle, Plus, TerminalSquare } from 'lucide-react'
import { ReviewPanel } from './ReviewPanel'
import { TerminalPanel } from './TerminalPanel'
import { WorkspaceFilesPanel } from './WorkspaceFilesPanel'
import { TabStrip } from '../../foundation/TabStrip'
import { BrowserPanel } from './BrowserPanel'
import { SideChatPanel } from './SideChatPanel'

export type RightDockTab = 'files' | 'review' | 'terminal' | 'browser' | 'chat'
type RightDockTabInstance = { instanceId: string; kind: RightDockTab; ordinal: number }

interface ChatRightDockProps {
  projectPath: string | null
  sessionId: string | null
  showFiles: boolean
  collapsed?: boolean
  width?: number
  onCloseFiles: () => void
}

const TABS = [
  { id: 'review', label: '审阅', icon: GitCompare },
  { id: 'browser', label: '浏览器', icon: Globe },
  { id: 'files', label: '文件', icon: FileText },
  { id: 'terminal', label: '终端', icon: TerminalSquare },
  { id: 'chat', label: '侧边聊天', icon: MessageCircle },
] as const

export function ChatRightDock({ projectPath, sessionId, showFiles, width = 380, collapsed = false, onCloseFiles }: ChatRightDockProps) {
  const nextInstance = useRef(2)
  const addButton = useRef<HTMLButtonElement>(null)
  const [activeTabId, setActiveTabId] = useState('files-1')
  const [openTabs, setOpenTabs] = useState<RightDockTabInstance[]>([{ instanceId: 'files-1', kind: 'files', ordinal: 1 }])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const visibleTabs = openTabs.map((instance) => {
    const meta = TABS.find((item) => item.id === instance.kind)!
    return { instance, meta, label: instance.ordinal > 1 ? meta.label + ' ' + instance.ordinal : meta.label }
  })
  const addTab = (kind: RightDockTab) => {
    const instanceId = kind + '-' + nextInstance.current++
    setOpenTabs((current) => [...current, { instanceId, kind, ordinal: Math.max(0, ...current.filter((item) => item.kind === kind).map((item) => item.ordinal)) + 1 }])
    setActiveTabId(instanceId)
    setAddMenuOpen(false)
    addButton.current?.focus()
  }
  const closeTab = (instanceId: string) => {
    const currentIndex = openTabs.findIndex((item) => item.instanceId === instanceId)
    const remaining = openTabs.filter((item) => item.instanceId !== instanceId)
    setOpenTabs(remaining)
    if (!remaining.length) onCloseFiles()
    else if (instanceId === activeTabId) setActiveTabId(remaining[Math.max(0, currentIndex - 1)].instanceId)
  }

  return <div id="chat-right-dock" className="relative flex shrink-0 flex-col overflow-hidden border-l"
    style={{ display: showFiles && !collapsed ? undefined : 'none', width, borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }} data-testid="chat-right-dock">
    <div className="relative flex shrink-0 items-center gap-1 border-b p-2" style={{ borderColor: 'var(--border-subtle)' }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAddMenuOpen(false) }}
      onKeyDown={(event) => { if (event.key === 'Escape' && addMenuOpen) { event.stopPropagation(); setAddMenuOpen(false); addButton.current?.focus() } }}>
      <TabStrip label="已打开的工作区" activeId={activeTabId} itemTestId="right-dock-tab-item"
        items={visibleTabs.map(({ instance, meta, label }) => { const Icon = meta.icon; return { id: instance.instanceId, label, icon: <Icon size={14} />, panelId: 'dock-panel-' + instance.instanceId, testId: 'right-dock-tab-' + instance.kind } })}
        onSelect={setActiveTabId} onClose={closeTab} />
      <button ref={addButton} type="button" className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
        style={{ color: 'var(--text-secondary)' }} title="添加工作区内容" aria-label="添加工作区内容" aria-haspopup="menu" aria-expanded={addMenuOpen}
        onClick={() => setAddMenuOpen((current) => !current)} data-testid="right-dock-add-tab"><Plus size={16} /></button>
      {addMenuOpen && <div className="absolute right-2 top-full z-30 mt-1 w-40 rounded-md border p-1 shadow-lg"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }} role="menu" aria-label="添加工作区内容"
        onKeyDown={(event) => {
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]'))
          const index = items.indexOf(document.activeElement as HTMLButtonElement)
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus() }
        }}>
        {TABS.map(({ id, label, icon: Icon }, index) => <button key={id} autoFocus={index === 0} type="button" role="menuitem"
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] hover:bg-[var(--bg-secondary)] focus-visible:bg-[var(--bg-secondary)]"
          onClick={() => addTab(id)}><Icon size={14} />{label}</button>)}
      </div>}
    </div>
    {/* 实例在后台继续持有状态与事件订阅；关闭标签才卸载，不能把选中态当作资源生命周期。 */}
    {visibleTabs.map(({ instance, label }) => <div key={instance.instanceId} id={'dock-panel-' + instance.instanceId} role="tabpanel" aria-label={label}
      hidden={activeTabId !== instance.instanceId} className={activeTabId === instance.instanceId ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'hidden'}>
      {instance.kind === 'files' && <WorkspaceFilesPanel projectPath={projectPath} />}
      {instance.kind === 'review' && <ReviewPanel key={sessionId} sessionId={sessionId} />}
      {instance.kind === 'terminal' && <TerminalPanel projectPath={projectPath} />}
      {instance.kind === 'browser' && <BrowserPanel />}
      {instance.kind === 'chat' && <SideChatPanel />}
    </div>)}
  </div>
}

/** 正式 Chat 工作区。文件内部预览不再作为顶层工具；Debug 保持独立。 */
import { useRef, useState } from 'react'
import type { WorkspaceChatFocus } from '../../../shared/types'
import { FileText, GitCompare, Globe, MessageCircle, TerminalSquare } from 'lucide-react'
import { ReviewPanel } from './ReviewPanel'
import { TerminalPanel } from './TerminalPanel'
import { WorkspaceFilesPanel } from './WorkspaceFilesPanel'
import { TabStrip } from '../../foundation/TabStrip'
import { WorkspaceToolMenu } from '../../foundation/WorkspaceToolMenu'
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
  const [activeTabId, setActiveTabId] = useState('files-1')
  const [openTabs, setOpenTabs] = useState<RightDockTabInstance[]>([{ instanceId: 'files-1', kind: 'files', ordinal: 1 }])
  const [workspaceFocus, setWorkspaceFocus] = useState<WorkspaceChatFocus | undefined>()
  const visibleTabs = openTabs.map((instance) => {
    const meta = TABS.find((item) => item.id === instance.kind)!
    return { instance, meta, label: instance.ordinal > 1 ? meta.label + ' ' + instance.ordinal : meta.label }
  })
  const addTab = (kind: RightDockTab) => {
    const instanceId = kind + '-' + nextInstance.current++
    setOpenTabs((current) => [...current, { instanceId, kind, ordinal: Math.max(0, ...current.filter((item) => item.kind === kind).map((item) => item.ordinal)) + 1 }])
    setActiveTabId(instanceId)
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
    <div className="relative flex shrink-0 items-center gap-1 border-b p-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <TabStrip label="已打开的工作区" activeId={activeTabId} itemTestId="right-dock-tab-item"
        items={visibleTabs.map(({ instance, meta, label }) => { const Icon = meta.icon; return { id: instance.instanceId, label, icon: <Icon size={14} />, panelId: 'dock-panel-' + instance.instanceId, testId: 'right-dock-tab-' + instance.kind } })}
        onSelect={setActiveTabId} onClose={closeTab} />
      <WorkspaceToolMenu testId="right-dock-add-tab" items={TABS.map(({ id, label, icon: Icon }) => ({ id, label, icon: <Icon size={14} /> }))} onSelect={(id) => addTab(id as RightDockTab)} />
    </div>
    {/* 实例在后台继续持有状态与事件订阅；关闭标签才卸载，不能把选中态当作资源生命周期。 */}
    {visibleTabs.map(({ instance, label }) => <div key={instance.instanceId} id={'dock-panel-' + instance.instanceId} role="tabpanel" aria-label={label}
      hidden={activeTabId !== instance.instanceId} className={activeTabId === instance.instanceId ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'hidden'}>
      {instance.kind === 'files' && <WorkspaceFilesPanel projectPath={projectPath} onContextChange={setWorkspaceFocus} />}
      {instance.kind === 'review' && <ReviewPanel key={sessionId} sessionId={sessionId} onContextChange={setWorkspaceFocus} />}
      {instance.kind === 'terminal' && <TerminalPanel projectPath={projectPath} />}
      {instance.kind === 'browser' && <BrowserPanel />}
      {/* 侧聊依附主会话：与审阅一样整体重建，避免只换后端 ID 却留下旧正文/确认；同会话隐藏不重建。 */}
      {instance.kind === 'chat' && <SideChatPanel key={sessionId} parentSessionId={sessionId} projectPath={projectPath} workspaceFocus={workspaceFocus} />}
    </div>)}
  </div>
}

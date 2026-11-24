/** 正式 Chat 右侧工作区：融合版 1 单排顶栏（文件直出 + 悬浮目录抽屉 + 紧凑工具图标 + 加宽阅读）。 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WorkspaceChatFocus } from '../../../shared/types'
import {
  ChevronDown,
  FileText,
  FolderOpen,
  GitCompare,
  Globe,
  Maximize2,
  MessageCircle,
  Minimize2,
  PanelLeft,
  TerminalSquare,
  X,
} from 'lucide-react'
import { ReviewPanel } from './ReviewPanel'
import { TerminalPanel } from './TerminalPanel'
import { WorkspaceFilesPanel, useWorkspaceFilesState } from './WorkspaceFilesPanel'
import { ActionButton } from '../../foundation/ActionButton'
import { IconButton } from '../../foundation/IconButton'
import { TabStrip, type TabStripItem } from '../../foundation/TabStrip'
import { WorkspaceToolMenu } from '../../foundation/WorkspaceToolMenu'
import { layoutProfileStyle } from '../../../shared/content-layout'
import { BrowserPanel } from './BrowserPanel'
import { SideChatPanel } from './SideChatPanel'

export type RightDockTab = 'files' | 'review' | 'terminal' | 'browser' | 'chat'
type ToolKind = Exclude<RightDockTab, 'files'>
type ToolTabInstance = { instanceId: string; kind: ToolKind; ordinal: number }

interface ChatRightDockProps {
  projectPath: string | null
  sessionId: string | null
  showFiles: boolean
  collapsed?: boolean
  width?: number
  wide?: boolean
  onToggleWide?: () => void
  onCloseFiles: () => void
  onTakeToChat?: (opts: { text: string }) => void
  /** 向外暴露未保存修改拦截器，供切项目/关闭项目前统一弹三态确认 */
  onRegisterUnsavedGuard?: (guard: ((actionLabel: string, onProceed: () => void) => void) | null) => void
  /** 通知外层当前未保存文件数，供收起态工作区入口显示小圆点提示 */
  onDirtyCountChange?: (count: number) => void
}

const TOOL_TABS = [
  { id: 'review', label: '审阅', icon: GitCompare },
  { id: 'browser', label: '浏览器', icon: Globe },
  { id: 'terminal', label: '终端', icon: TerminalSquare },
  { id: 'chat', label: '侧边聊天', icon: MessageCircle },
] as const

const MENU_TABS = [
  { id: 'review', label: '审阅', icon: GitCompare },
  { id: 'browser', label: '浏览器', icon: Globe },
  { id: 'files', label: '文件', icon: FileText },
  { id: 'terminal', label: '终端', icon: TerminalSquare },
  { id: 'chat', label: '侧边聊天', icon: MessageCircle },
] as const

function fileBasename(path: string): string {
  return path.split(/[/\\]/).pop() || path
}

/**
 * 背景：原有两排嵌套标签（工具 Tab 套文件 Tab）加 32% 常驻分屏树，在 500px 右坞里严重挤压中文阅读与长文件名。
 * 设计意图：采用融合版 1 单排架构：最左 `[◧]` 控制悬浮目录抽屉，最近 2~3 份已开文档直接上浮，多余收进 `▾ +N` 列表，工具未激活时收成图标，右侧常驻 `+` 与 `⤢` 加宽阅读切换。
 * 关键约束：后台工具面板隐藏而不卸载以保留终端 draft 与审阅订阅；文件选择与关闭必须精确同步 `workspaceFocus` 传给侧边聊天。
 */
export function ChatRightDock({
  projectPath,
  sessionId,
  showFiles,
  width = 440,
  collapsed = false,
  wide = false,
  onToggleWide,
  onCloseFiles,
  onTakeToChat,
  onRegisterUnsavedGuard,
  onDirtyCountChange,
}: ChatRightDockProps) {
  const nextInstance = useRef(2)
  const [filesHomeOpen, setFilesHomeOpen] = useState(true)
  const [toolTabs, setToolTabs] = useState<ToolTabInstance[]>([])
  const [activeTabId, setActiveTabId] = useState('files-home')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [moreDocsOpen, setMoreDocsOpen] = useState(false)
  const [contextSource, setContextSource] = useState<string | null>('files')
  const [contexts, setContexts] = useState<Record<string, { sessionId: string | null; focus?: WorkspaceChatFocus }>>({})

  const handleFilesContextChange = useCallback(
    (focus: WorkspaceChatFocus | undefined) => {
      setContexts((current) => ({ ...current, files: { sessionId, focus } }))
    },
    [sessionId],
  )

  const rawFilesState = useWorkspaceFilesState({
    projectPath,
    onContextChange: handleFilesContextChange,
    onTakeToChat,
  })

  const rawOpenFile = rawFilesState.openFile
  const openFileFromDock = useCallback(
    (path: string, retry = false) => {
      setFilesHomeOpen(true)
      setActiveTabId('file:' + path)
      setContextSource('files')
      setDrawerOpen(false)
      setMoreDocsOpen(false)
      rawOpenFile(path, retry)
    },
    [rawOpenFile],
  )

  useEffect(() => {
    onDirtyCountChange?.(rawFilesState.dirtyPaths.length)
  }, [rawFilesState.dirtyPaths.length, onDirtyCountChange])

  useEffect(() => {
    if (!onRegisterUnsavedGuard) return
    const guard = (actionLabel: string, onProceed: () => void) => {
      rawFilesState.requestGuard(rawFilesState.dirtyPaths, actionLabel, onProceed)
    }
    onRegisterUnsavedGuard(guard)
    return () => onRegisterUnsavedGuard(null)
  }, [onRegisterUnsavedGuard, rawFilesState.requestGuard, rawFilesState.dirtyPaths])

  const filesState = useMemo(
    () => ({ ...rawFilesState, openFile: openFileFromDock }),
    [rawFilesState, openFileFromDock],
  )

  // 背景：隐藏面板仍接收异步结果；按实例保存但只使用最后选中的来源，避免后台响应抢焦点；审阅上下文还必须匹配当前会话。
  const reviewContextCallbacks = useMemo(
    () =>
      Object.fromEntries(
        toolTabs
          .filter((item) => item.kind === 'review')
          .map(({ instanceId }) => [
            instanceId,
            (focus: WorkspaceChatFocus | undefined) =>
              setContexts((current) => ({ ...current, [instanceId]: { sessionId, focus } })),
          ]),
      ),
    [toolTabs, sessionId],
  )

  const context = contextSource ? contexts[contextSource] : undefined
  const workspaceFocus = context?.focus?.kind === 'review' && context.sessionId !== sessionId ? undefined : context?.focus

  const isFilesAreaActive = activeTabId === 'files-home' || activeTabId.startsWith('file:')
  const maxVisibleDocs = wide || width >= 620
    ? 3
    : (toolTabs.length > 0 && width < 520)
      ? 1
      : 2

  const { visibleDocs, overflowDocs } = useMemo(() => {
    const all = filesState.files
    if (all.length <= maxVisibleDocs) {
      return { visibleDocs: all, overflowDocs: [] as typeof all }
    }
    const visibleSet = new Set<string>()
    if (filesState.activePath && all.some((f) => f.path === filesState.activePath)) {
      visibleSet.add(filesState.activePath)
    }
    for (const path of filesState.recentOrder) {
      if (visibleSet.size >= maxVisibleDocs) break
      if (all.some((f) => f.path === path)) visibleSet.add(path)
    }
    for (const file of all) {
      if (visibleSet.size >= maxVisibleDocs) break
      visibleSet.add(file.path)
    }
    return {
      visibleDocs: all.filter((f) => visibleSet.has(f.path)),
      overflowDocs: all.filter((f) => !visibleSet.has(f.path)),
    }
  }, [filesState.files, filesState.activePath, filesState.recentOrder, maxVisibleDocs])

  const docTabItems: TabStripItem[] = useMemo(() => {
    if (filesState.files.length === 0) {
      if (!filesHomeOpen) return []
      return [
        {
          id: 'files-home',
          label: '文件',
          icon: <FolderOpen size={13} />,
          panelId: 'dock-panel-files',
          testId: 'right-dock-tab-files',
        },
      ]
    }
    return visibleDocs.map((file) => {
      const name = fileBasename(file.path)
      const isDirty = rawFilesState.dirtyPaths.includes(file.path)
      return {
        id: 'file:' + file.path,
        label: isDirty ? `• ${name}` : name,
        icon: <FileText size={13} />,
        panelId: 'dock-panel-files',
        testId: 'workspace-file-preview-tab',
      }
    })
  }, [filesState.files.length, filesHomeOpen, visibleDocs, rawFilesState.dirtyPaths])

  const toolTabItems: TabStripItem[] = useMemo(
    () =>
      toolTabs.map((instance, idx) => {
        const meta = TOOL_TABS.find((item) => item.id === instance.kind)!
        const Icon = meta.icon
        return {
          id: instance.instanceId,
          label: instance.ordinal > 1 ? `${meta.label} ${instance.ordinal}` : meta.label,
          icon: <Icon size={14} />,
          panelId: 'dock-panel-' + instance.instanceId,
          testId: 'right-dock-tab-' + instance.kind,
          separatorBefore: idx === 0 && docTabItems.length > 0,
          compactWhenInactive: true,
        }
      }),
    [toolTabs, docTabItems.length],
  )

  const allTabItems = useMemo(() => [...docTabItems, ...toolTabItems], [docTabItems, toolTabItems])

  const selectTab = (id: string) => {
    setMoreDocsOpen(false)
    setActiveTabId(id)
    if (id.startsWith('file:')) {
      const path = id.slice(5)
      filesState.selectPath(path)
      setContextSource('files')
      return
    }
    if (id === 'files-home') {
      setContextSource('files')
      return
    }
    const tool = toolTabs.find((item) => item.instanceId === id)
    if (tool?.kind === 'review') setContextSource(id)
  }

  const closeDocPath = (path: string) => {
    rawFilesState.requestGuard([path], '关闭文档', () => {
      const remaining = filesState.files.filter((file) => file.path !== path)
      const fallbackPath =
        rawFilesState.recentOrder.find((p) => p !== path && remaining.some((f) => f.path === p))
        ?? remaining.at(-1)?.path
        ?? null
      rawFilesState.forceCloseFile(path)
      if (remaining.length === 0) {
        setDrawerOpen(false)
        setMoreDocsOpen(false)
        setFilesHomeOpen(true)
        setActiveTabId('files-home')
        setContextSource('files')
      } else if (activeTabId === 'file:' + path && fallbackPath) {
        setActiveTabId('file:' + fallbackPath)
        setContextSource('files')
      }
    })
  }

  const closeTab = (id: string) => {
    setMoreDocsOpen(false)
    if (id.startsWith('file:')) {
      closeDocPath(id.slice(5))
      return
    }
    if (id === 'files-home') {
      const proceedCloseFilesHome = () => {
        setFilesHomeOpen(false)
        setContexts((current) => {
          const next = { ...current }
          delete next.files
          return next
        })
        if (contextSource === 'files') setContextSource(null)
        if (toolTabs.length === 0) {
          onCloseFiles()
        } else if (activeTabId === 'files-home') {
          const next = toolTabs[0]
          setActiveTabId(next.instanceId)
          if (next.kind === 'review') setContextSource(next.instanceId)
        }
      }
      if (rawFilesState.dirtyPaths.length > 0 && toolTabs.length === 0) {
        rawFilesState.requestGuard(rawFilesState.dirtyPaths, '关闭工作区', proceedCloseFilesHome)
      } else {
        proceedCloseFilesHome()
      }
      return
    }
    const currentIndex = toolTabs.findIndex((item) => item.instanceId === id)
    const remainingTools = toolTabs.filter((item) => item.instanceId !== id)
    setToolTabs(remainingTools)
    setContexts((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    if (contextSource === id) setContextSource(null)
    if (remainingTools.length === 0 && !filesHomeOpen && filesState.files.length === 0) {
      onCloseFiles()
      return
    }
    if (activeTabId === id) {
      if (remainingTools.length > 0) {
        const nextTool = remainingTools[Math.max(0, currentIndex - 1)]
        setActiveTabId(nextTool.instanceId)
        if (nextTool.kind === 'review') setContextSource(nextTool.instanceId)
      } else if (filesState.activePath) {
        setActiveTabId('file:' + filesState.activePath)
        setContextSource('files')
      } else {
        setFilesHomeOpen(true)
        setActiveTabId('files-home')
        setContextSource('files')
      }
    }
  }

  const addTab = (kind: RightDockTab) => {
    setMoreDocsOpen(false)
    if (kind === 'files') {
      setFilesHomeOpen(true)
      setContextSource('files')
      if (filesState.files.length > 0) {
        const target = filesState.activePath ?? filesState.files[0].path
        setActiveTabId('file:' + target)
        setDrawerOpen(true)
      } else {
        setActiveTabId('files-home')
      }
      return
    }
    const instanceId = kind + '-' + nextInstance.current++
    setToolTabs((current) => [
      ...current,
      {
        instanceId,
        kind,
        ordinal: Math.max(0, ...current.filter((item) => item.kind === kind).map((item) => item.ordinal)) + 1,
      },
    ])
    setActiveTabId(instanceId)
    setDrawerOpen(false)
    if (kind === 'review') setContextSource(instanceId)
  }

  const handleToggleDirectory = () => {
    setMoreDocsOpen(false)
    setFilesHomeOpen(true)
    setContextSource('files')
    if (filesState.files.length === 0) {
      setActiveTabId('files-home')
      return
    }
    if (!isFilesAreaActive) {
      const target = filesState.activePath ?? filesState.files[0].path
      setActiveTabId('file:' + target)
      setDrawerOpen(true)
      return
    }
    setDrawerOpen((prev) => !prev)
  }

  const hasFilesArea = filesHomeOpen || filesState.files.length > 0
  const filesPanelAriaLabel = filesState.activeFile ? fileBasename(filesState.activeFile.path) : '文件'

  return (
    <div
      id="chat-right-dock"
      className="chat-shape-scope relative flex shrink-0 flex-col overflow-hidden border-l"
      style={{
        ...layoutProfileStyle('workspace'),
        display: showFiles && !collapsed ? undefined : 'none',
        width,
        borderColor: 'var(--border-subtle)',
        background: 'color-mix(in srgb, var(--bg-primary) 55%, var(--bg-secondary))',
      }}
      data-testid="chat-right-dock"
    >
      <div
        className="relative flex h-11 shrink-0 select-none items-center gap-1 border-b px-2"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <IconButton
          size={28}
          label="文件目录"
          title={filesState.files.length > 0 ? (drawerOpen ? '收起文件目录' : '展开文件目录抽屉') : '文件目录'}
          aria-expanded={filesState.files.length > 0 ? drawerOpen : isFilesAreaActive}
          data-testid="workspace-directory-toggle"
          onClick={handleToggleDirectory}
          style={{
            color: (filesState.files.length > 0 ? drawerOpen : isFilesAreaActive) ? 'var(--accent-fg)' : 'var(--text-muted)',
            background: (filesState.files.length > 0 && drawerOpen) ? 'var(--accent-subtle)' : undefined,
          }}
        >
          <PanelLeft size={14} />
        </IconButton>

        <TabStrip
          label="已打开的工作区"
          activeId={activeTabId}
          itemTestId="right-dock-tab-item"
          items={allTabItems}
          onSelect={selectTab}
          onClose={closeTab}
        />

        {overflowDocs.length > 0 && (
          <div
            className="relative shrink-0"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setMoreDocsOpen(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && moreDocsOpen) {
                event.stopPropagation()
                setMoreDocsOpen(false)
              }
            }}
          >
            <ActionButton
              variant="plain"
              size="sm"
              aria-label="更多已打开文件"
              aria-haspopup="menu"
              aria-expanded={moreDocsOpen}
              data-testid="workspace-more-docs-button"
              className="!min-h-7 shrink-0 gap-0.5 !border-0 !px-1.5 !text-[11px] font-medium tabular-nums"
              style={{ color: moreDocsOpen ? 'var(--accent-fg)' : 'var(--text-muted)' }}
              onClick={() => setMoreDocsOpen((prev) => !prev)}
            >
              <span>+{overflowDocs.length}</span>
              {overflowDocs.some((doc) => rawFilesState.dirtyPaths.includes(doc.path)) && (
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--warning)' }} aria-label="溢出文件包含未保存修改" />
              )}
              <ChevronDown size={11} aria-hidden="true" />
            </ActionButton>

            {moreDocsOpen && (
              <div
                role="menu"
                aria-label="已打开文件列表"
                className="absolute right-0 top-full z-40 mt-1 w-60 rounded-lg border p-1 shadow-lg"
                style={{ borderColor: 'var(--border-color)', background: 'var(--dropdown-bg)' }}
              >
                <div className="px-2.5 pb-1 pt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  已打开文档（{filesState.files.length}）
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto scrollbar-hover">
                  {filesState.files.map((file) => {
                    const name = fileBasename(file.path)
                    const current = isFilesAreaActive && activeTabId === 'file:' + file.path
                    const isDirty = rawFilesState.dirtyPaths.includes(file.path)
                    return (
                      <div key={file.path} className="flex items-center gap-1">
                        <ActionButton
                          variant="plain"
                          size="sm"
                          role="menuitem"
                          className="!min-h-7 min-w-0 flex-1 !justify-start gap-1.5 !border-0 !px-2 !text-[12px]"
                          style={{
                            color: current ? 'var(--accent-fg)' : 'var(--text-secondary)',
                            background: current ? 'var(--accent-subtle)' : undefined,
                          }}
                          title={file.path}
                          onClick={() => selectTab('file:' + file.path)}
                        >
                          <FileText size={12} className="shrink-0" aria-hidden="true" />
                          <span className="truncate">{name}</span>
                          {isDirty && (
                            <span
                              className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: 'var(--warning)' }}
                              title="有未保存修改"
                            />
                          )}
                        </ActionButton>
                        <IconButton
                          size={24}
                          label={`关闭${name}`}
                          style={{ color: 'var(--text-muted)' }}
                          onClick={() => closeDocPath(file.path)}
                        >
                          <X size={12} />
                        </IconButton>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <WorkspaceToolMenu
          testId="right-dock-add-tab"
          items={MENU_TABS.map(({ id, label, icon: Icon }) => ({ id, label, icon: <Icon size={14} /> }))}
          onSelect={(id) => addTab(id as RightDockTab)}
        />

        {onToggleWide && (
          <IconButton
            size={28}
            label={wide ? '还原右坞宽度' : '加宽阅读'}
            title={wide ? '还原右坞宽度' : '加宽阅读'}
            aria-pressed={wide}
            data-testid="right-dock-wide-toggle"
            style={{ color: wide ? 'var(--accent-fg)' : 'var(--text-muted)' }}
            onClick={onToggleWide}
          >
            {wide ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </IconButton>
        )}
      </div>

      {hasFilesArea && (
        <div
          id="dock-panel-files"
          role="tabpanel"
          aria-label={filesPanelAriaLabel}
          hidden={!isFilesAreaActive}
          className={isFilesAreaActive ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'hidden'}
        >
          <WorkspaceFilesPanel
            projectPath={projectPath}
            externalState={filesState}
            headless
            drawerOpen={drawerOpen}
            onDrawerOpenChange={setDrawerOpen}
            onTakeToChat={onTakeToChat}
          />
        </div>
      )}

      {/* 工具实例在后台继续持有状态与事件订阅；关闭标签才卸载，不能把选中态当作资源生命周期。 */}
      {toolTabs.map((instance) => {
        const meta = TOOL_TABS.find((item) => item.id === instance.kind)!
        const label = instance.ordinal > 1 ? `${meta.label} ${instance.ordinal}` : meta.label
        const isActive = activeTabId === instance.instanceId
        return (
          <div
            key={instance.instanceId}
            id={'dock-panel-' + instance.instanceId}
            role="tabpanel"
            aria-label={label}
            hidden={!isActive}
            className={isActive ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'hidden'}
          >
            {instance.kind === 'review' && (
              <ReviewPanel
                key={sessionId}
                sessionId={sessionId}
                onContextChange={reviewContextCallbacks[instance.instanceId]}
                onTakeToChat={onTakeToChat}
              />
            )}
            {instance.kind === 'terminal' && <TerminalPanel projectPath={projectPath} onTakeToChat={onTakeToChat} />}
            {instance.kind === 'browser' && <BrowserPanel />}
            {/* 侧聊依附主会话：与审阅一样整体重建，避免只换后端 ID 却留下旧正文/确认；同会话隐藏不重建。 */}
            {instance.kind === 'chat' && (
              <SideChatPanel
                key={sessionId}
                parentSessionId={sessionId}
                projectPath={projectPath}
                workspaceFocus={workspaceFocus}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

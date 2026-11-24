import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { WorkspaceChatFocus } from '../../../shared/types'
import { FileBrowser, readFilePreview, type FileBrowserPreviewData, type FileBrowserPreviewFile } from '../../FileBrowser'
import { IconButton } from '../../foundation/IconButton'
import { ActionButton } from '../../foundation/ActionButton'
import { TabStrip } from '../../foundation/TabStrip'
import { AnnotationQueueDrawer } from './preview/AnnotationQueueDrawer'
import { formatAnnotationQueueForChat, type AnnotationQueueItem } from './preview/annotation-format'

export interface WorkspaceFilesStateOptions {
  projectPath: string | null
  previewData?: FileBrowserPreviewData
  onContextChange?: (focus: WorkspaceChatFocus | undefined) => void
  onTakeToChat?: (opts: { text: string }) => void
}

/**
 * 背景：融合版 1 把已打开的文档直接上浮到右坞顶栏并与文件浏览/批注状态解耦复用；旧版组件内部状态外部无法感知。
 * 设计意图：抽离 useWorkspaceFilesState 统一管理打开文档列表、最近访问顺序（recentOrder）、竞态安全异步读取与跨文件批注草稿篮。
 * 关键约束：同一路径后发先至读取不得被旧请求覆盖；关闭文档立即令在途请求失效；activeFile 派生焦点同步不可延迟到完成回调。
 */
export function useWorkspaceFilesState({
  projectPath,
  previewData,
  onContextChange,
  onTakeToChat,
}: WorkspaceFilesStateOptions) {
  const initial = previewData?.initialPath ? previewData.files[previewData.initialPath] : undefined
  const [files, setFiles] = useState<FileBrowserPreviewFile[]>(() => (initial ? [initial] : []))
  const [activePath, setActivePath] = useState<string | null>(() => initial?.path ?? null)
  const [recentOrder, setRecentOrder] = useState<string[]>(() => (initial ? [initial.path] : []))
  const [annotationQueue, setAnnotationQueue] = useState<AnnotationQueueItem[]>([])
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const [dirtyPaths, setDirtyPaths] = useState<string[]>([])
  const [externalChangedPath, setExternalChangedPath] = useState<string | null>(null)
  const filesRef = useRef(files)
  const activePathRef = useRef(activePath)
  const recentOrderRef = useRef(recentOrder)
  filesRef.current = files
  activePathRef.current = activePath
  recentOrderRef.current = recentOrder

  const requests = useRef(new Map<string, number>())
  const sequence = useRef(0)
  const queueSequence = useRef(1)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    requests.current.clear()
    clearTimeout(copyTimer.current)
    const nextInitial = previewData?.initialPath ? previewData.files[previewData.initialPath] : undefined
    const nextFiles = nextInitial ? [nextInitial] : []
    const nextPath = nextInitial?.path ?? null
    const nextOrder = nextInitial ? [nextInitial.path] : []
    filesRef.current = nextFiles
    activePathRef.current = nextPath
    recentOrderRef.current = nextOrder
    setFiles(nextFiles)
    setActivePath(nextPath)
    setRecentOrder(nextOrder)
    setAnnotationQueue([])
    setCopiedPath(null)
    setDirtyPaths([])
    setExternalChangedPath(null)
  }, [projectPath, previewData])

  useEffect(() => () => {
    requests.current.clear()
    clearTimeout(copyTimer.current)
  }, [])

  const selectPath = useCallback((path: string | null) => {
    activePathRef.current = path
    setActivePath(path)
    if (path) {
      const nextOrder = [path, ...recentOrderRef.current.filter((item) => item !== path)]
      recentOrderRef.current = nextOrder
      setRecentOrder(nextOrder)
    }
  }, [])

  const openFile = useCallback((path: string, retry = false) => {
    selectPath(path)
    const existing = filesRef.current.find((file) => file.path === path)
    if (existing && existing.kind !== 'error' && !retry) {
      return
    }
    const request = ++sequence.current
    requests.current.set(path, request)
    setFiles((current) => {
      const next = current.some((file) => file.path === path)
        ? current.map((file) => (file.path === path ? { path, kind: 'loading' as const } : file))
        : [...current, { path, kind: 'loading' as const }]
      filesRef.current = next
      return next
    })
    void readFilePreview(path, previewData).then((result) => {
      if (requests.current.get(path) !== request) return
      requests.current.delete(path)
      setFiles((latest) => {
        const next = latest.map((file) => (file.path === path ? result : file))
        filesRef.current = next
        return next
      })
    })
  }, [previewData, selectPath])

  useEffect(() => {
    if (previewData || !window.electronAPI?.project.onFileChanged) return
    const unsubscribe = window.electronAPI.project.onFileChanged((event) => {
      if (!filesRef.current.some((file) => file.path === event.filePath)) return
      if (dirtyPaths.includes(event.filePath)) setExternalChangedPath(event.filePath)
      else openFile(event.filePath, true)
    })
    const paths = filesRef.current.map((file) => file.path)
    void Promise.all(paths.map((path) => window.electronAPI?.project.watchFile(path)))
    return () => {
      unsubscribe()
      void Promise.all(paths.map((path) => window.electronAPI?.project.unwatchFile(path)))
    }
  }, [previewData, dirtyPaths, openFile, files.length])

  const closeFile = useCallback((path: string) => {
    if (dirtyPaths.includes(path) && !window.confirm('该文件有未保存修改，确定放弃并关闭吗？')) return
    requests.current.delete(path)
    const remaining = filesRef.current.filter((file) => file.path !== path)
    const nextOrder = recentOrderRef.current.filter((item) => item !== path)
    const nextActive = activePathRef.current === path
      ? (nextOrder[0] ?? remaining.at(-1)?.path ?? null)
      : activePathRef.current
    filesRef.current = remaining
    recentOrderRef.current = nextOrder
    activePathRef.current = nextActive
    setFiles(remaining)
    setRecentOrder(nextOrder)
    setActivePath(nextActive)
    setDirtyPaths((current) => current.filter((item) => item !== path))
    setExternalChangedPath((current) => current === path ? null : current)
  }, [dirtyPaths])

  const markDirty = useCallback((path: string, dirty: boolean) => {
    setDirtyPaths((current) => dirty
      ? current.includes(path) ? current : [...current, path]
      : current.filter((item) => item !== path))
  }, [])

  const activeFile = files.find((file) => file.path === activePath) ?? null

  const handleCopyActiveFile = useCallback(async () => {
    if (!activeFile || activeFile.kind !== 'text') return
    try {
      await navigator.clipboard.writeText(activeFile.content)
      setCopiedPath(activeFile.path)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => {
        setCopiedPath((current) => (current === activeFile.path ? null : current))
      }, 1200)
    } catch { /* ignore */ }
  }, [activeFile])

  const handleOpenActiveExternal = useCallback(async () => {
    if (previewData || !activeFile?.path) return
    await window.electronAPI?.project.openExternal?.(activeFile.path)
  }, [previewData, activeFile])

  const handleQueueAnnotation = onTakeToChat
    ? (item: Omit<AnnotationQueueItem, 'id' | 'createdAt'>) => {
        const id = `wf-ann-${queueSequence.current++}`
        setAnnotationQueue((prev) => [...prev, { ...item, id, createdAt: Date.now() }])
      }
    : undefined

  const removeQueuedAnnotation = useCallback((id: string) => {
    setAnnotationQueue((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearAnnotationQueue = useCallback(() => {
    setAnnotationQueue([])
  }, [])

  const handleSendQueue = useCallback(() => {
    if (!onTakeToChat || annotationQueue.length === 0) return
    const merged = formatAnnotationQueueForChat(annotationQueue)
    if (merged) onTakeToChat({ text: merged })
    setAnnotationQueue([])
  }, [onTakeToChat, annotationQueue])

  // 背景：后台读取可能晚于当前文件完成；由选中项派生而非由每次完成回调发布，缓存切换与关闭也必须同步上下文。
  useEffect(() => {
    onContextChange?.(activeFile
      ? { kind: 'file', path: activeFile.path, content: activeFile.kind === 'text' ? activeFile.content.slice(0, 12_000) : '' }
      : undefined)
  }, [activeFile, onContextChange])

  return {
    files,
    activePath,
    recentOrder,
    activeFile,
    annotationQueue,
    copiedPath,
    selectPath,
    openFile,
    closeFile,
    handleCopyActiveFile,
    handleOpenActiveExternal,
    handleQueueAnnotation,
    removeQueuedAnnotation,
    clearAnnotationQueue,
    handleSendQueue,
    dirtyPaths,
    externalChangedPath,
    setExternalChangedPath,
    markDirty,
  }
}

export type WorkspaceFilesState = ReturnType<typeof useWorkspaceFilesState>

interface WorkspaceFilesPanelProps {
  projectPath: string | null
  previewData?: FileBrowserPreviewData
  onContextChange?: (focus: WorkspaceChatFocus | undefined) => void
  onTakeToChat?: (opts: { text: string }) => void
  /** 由上层融合顶栏托管标签与目录抽屉开关时传入共享状态 */
  externalState?: WorkspaceFilesState
  /** 为 true 时隐藏面板内置标签条，由外部融合顶栏承载 */
  headless?: boolean
  drawerOpen?: boolean
  onDrawerOpenChange?: (open: boolean) => void
}

/** 项目切换建立新的文件工作区，旧请求和旧预览不能跨项目继续显示。 */
export function WorkspaceFilesPanel(props: WorkspaceFilesPanelProps) {
  if (props.externalState) {
    return <FilesWorkspaceContent {...props} state={props.externalState} />
  }
  return <StandaloneFilesWorkspace key={props.projectPath ?? 'isolated'} {...props} />
}

function StandaloneFilesWorkspace(props: WorkspaceFilesPanelProps) {
  const state = useWorkspaceFilesState({
    projectPath: props.projectPath,
    previewData: props.previewData,
    onContextChange: props.onContextChange,
    onTakeToChat: props.onTakeToChat,
  })
  return <FilesWorkspaceContent {...props} state={state} />
}

/**
 * 背景：用户原来需要在 32% 常驻分屏树和双层套娃 Tab 中阅读文件，既截断长中文文件名又压窄文档与表格。
 * 设计意图：未开文件时 100% 全宽浏览目录；点开文件后进入 100% 全宽阅读纸面，目录降维为按需滑出的悬浮抽屉，选完自动收起。
 * 关键约束：代码文件已有 CodeBlock 内置复制按钮，顶部动作不再重复渲染第二个复制；抽屉支持点遮罩与 Escape 关闭。
 */
function FilesWorkspaceContent({
  projectPath,
  previewData,
  onTakeToChat,
  state,
  headless = false,
  drawerOpen: controlledDrawerOpen,
  onDrawerOpenChange,
}: WorkspaceFilesPanelProps & { state: WorkspaceFilesState }) {
  const [internalDrawerOpen, setInternalDrawerOpen] = useState(false)
  const drawerOpen = controlledDrawerOpen ?? internalDrawerOpen
  const setDrawerOpen = useCallback((next: boolean) => {
    if (onDrawerOpenChange) onDrawerOpenChange(next)
    else setInternalDrawerOpen(next)
  }, [onDrawerOpenChange])

  const prefix = useId()
  const {
    files,
    activePath,
    activeFile,
    annotationQueue,
    copiedPath,
    selectPath,
    openFile,
    closeFile,
    handleCopyActiveFile,
    handleOpenActiveExternal,
    handleQueueAnnotation,
    removeQueuedAnnotation,
    clearAnnotationQueue,
    handleSendQueue,
    dirtyPaths,
    externalChangedPath,
    setExternalChangedPath,
    markDirty,
  } = state

  useEffect(() => {
    if (!drawerOpen || files.length === 0) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen, files.length, setDrawerOpen])

  const handleDirectSend = onTakeToChat
    ? (text: string) => onTakeToChat({ text })
    : undefined

  const handleSelectFromTree = (path: string) => {
    openFile(path)
    setDrawerOpen(false)
  }

  // CodeBlock 自带右上角复制按钮，代码文件外层不再重复显示第二个复制图标
  const canCopyMarkdown = Boolean(activeFile && activeFile.kind === 'text' && activeFile.languageHint === 'markdown')
  const canOpenExternal = Boolean(activeFile?.path && !previewData)
  const isRichPreview = Boolean(
    activeFile && (
      activeFile.kind === 'spreadsheet'
      || activeFile.kind === 'docx'
      || activeFile.kind === 'pdf'
      || activeFile.kind === 'pptx'
      || (activeFile.kind === 'text' && activeFile.languageHint === 'html')
    ),
  )

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col" data-testid="workspace-files-layout">
      {files.length === 0 ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="workspace-file-tree">
          <FileBrowser
            projectPath={projectPath}
            embedded
            mode="files"
            previewData={previewData}
            previewState={activeFile}
            onFileSelect={handleSelectFromTree}
            onClose={() => {}}
          />
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="workspace-file-preview">
          {!headless && (
            <div className="flex h-10 shrink-0 select-none items-center gap-1 border-b px-2" style={{ borderColor: 'var(--border-subtle)' }}>
              <IconButton
                size={28}
                label={drawerOpen ? '收起文件目录' : '展开文件目录'}
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(!drawerOpen)}
                style={{ color: drawerOpen ? 'var(--accent-fg)' : 'var(--text-muted)' }}
              >
                {drawerOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
              </IconButton>
              <TabStrip
                label="文件预览"
                itemTestId="workspace-file-preview-tab"
                activeId={activePath}
                items={files.map((file, index) => ({
                  id: file.path,
                  label: file.path.split(/[/\\]/).pop() || file.path,
                  panelId: prefix + '-file-' + index,
                }))}
                onSelect={selectPath}
                onClose={closeFile}
              />
              {(canCopyMarkdown || canOpenExternal) && (
                <div className="flex shrink-0 items-center gap-0.5 pl-1">
                  {canCopyMarkdown && activeFile && (
                    <IconButton
                      label="复制正文"
                      title={copiedPath === activeFile.path ? '已复制' : '复制正文'}
                      size={24}
                      style={{ color: copiedPath === activeFile.path ? 'var(--success)' : 'var(--text-muted)' }}
                      onClick={() => { void handleCopyActiveFile() }}
                    >
                      {copiedPath === activeFile.path ? <Check size={12} /> : <Copy size={12} />}
                    </IconButton>
                  )}
                  {canOpenExternal && (
                    <IconButton
                      label="用系统应用打开"
                      size={24}
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => { void handleOpenActiveExternal() }}
                    >
                      <ExternalLink size={12} />
                    </IconButton>
                  )}
                </div>
              )}
            </div>
          )}

          {headless && !isRichPreview && (canCopyMarkdown || canOpenExternal) && activeFile && (
            <div
              className="flex h-8 shrink-0 select-none items-center justify-between gap-2 px-4 text-[11px]"
              style={{ background: 'var(--card-bg)', color: 'var(--text-muted)' }}
            >
              <span className="min-w-0 truncate" title={activeFile.path}>
                {/[/\\]/.test(activeFile.path) ? activeFile.path.replace(/[/\\][^/\\]+$/, '/') : ''}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                {canCopyMarkdown && (
                  <IconButton
                    label="复制正文"
                    title={copiedPath === activeFile.path ? '已复制' : '复制正文'}
                    size={24}
                    style={{ color: copiedPath === activeFile.path ? 'var(--success)' : 'var(--text-muted)' }}
                    onClick={() => { void handleCopyActiveFile() }}
                  >
                    {copiedPath === activeFile.path ? <Check size={12} /> : <Copy size={12} />}
                  </IconButton>
                )}
                {canOpenExternal && (
                  <IconButton
                    label="用系统应用打开"
                    size={24}
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => { void handleOpenActiveExternal() }}
                  >
                    <ExternalLink size={12} />
                  </IconButton>
                )}
              </div>
            </div>
          )}

          <AnnotationQueueDrawer
            items={annotationQueue}
            onRemove={removeQueuedAnnotation}
            onClear={clearAnnotationQueue}
            onSendAll={handleSendQueue}
          />

          {externalChangedPath && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 text-[11px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--warning-subtle)', color: 'var(--text-secondary)' }}>
              <span className="truncate">文件已被外部修改：{externalChangedPath.split(/[/\\]/).pop()}</span>
              <div className="flex shrink-0 gap-1">
                <ActionButton size="sm" variant="plain" onClick={() => { setExternalChangedPath(null); openFile(externalChangedPath, true) }}>加载磁盘最新</ActionButton>
                <ActionButton size="sm" variant="plain" onClick={() => setExternalChangedPath(null)}>保留我的编辑</ActionButton>
              </div>
            </div>
          )}

          {files.map((file, index) => {
            const isCurrent = file.path === activePath
            return (
              <div
                key={file.path}
                id={!headless ? prefix + '-file-' + index : undefined}
                role={!headless ? 'tabpanel' : undefined}
                aria-label={!headless ? (file.path.split(/[/\\]/).pop() || file.path) : undefined}
                hidden={!isCurrent}
                className={isCurrent ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'hidden'}
              >
                <FileBrowser
                  projectPath={projectPath}
                  embedded
                  mode="preview"
                  hideProjectHeader
                  hidePreviewClose
                  hidePreviewHeader
                  previewData={previewData}
                  previewState={file}
                  onClose={() => closeFile(file.path)}
                  onPreviewStateChange={(next) => { if (!next) closeFile(file.path) }}
                  onRetry={() => openFile(file.path, true)}
                  onTakeToChat={handleDirectSend}
                  onQueueAnnotation={handleQueueAnnotation}
                  onDirtyChange={(dirty) => markDirty(file.path, dirty)}
                />
              </div>
            )
          })}
        </div>
      )}

      {files.length > 0 && drawerOpen && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 z-20 bg-black/15 transition-opacity"
            data-testid="workspace-file-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            aria-label="文件目录抽屉"
            data-testid="workspace-file-tree-drawer"
            className="absolute inset-y-0 left-0 z-30 flex w-[268px] max-w-[82%] flex-col border-r shadow-xl"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col" data-testid="workspace-file-tree">
              <FileBrowser
                projectPath={projectPath}
                embedded
                mode="files"
                previewData={previewData}
                previewState={activeFile}
                onFileSelect={handleSelectFromTree}
                onClose={() => setDrawerOpen(false)}
                treeHeaderActions={
                  <IconButton
                    size={24}
                    label="收起文件目录"
                    onClick={() => setDrawerOpen(false)}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <PanelLeftClose size={13} />
                  </IconButton>
                }
              />
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

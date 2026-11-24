import { useEffect, useId, useRef, useState } from 'react'
import type { WorkspaceChatFocus } from '../../../shared/types'
import { FileBrowser, readFilePreview, type FileBrowserPreviewData, type FileBrowserPreviewFile } from '../../FileBrowser'
import { TabStrip } from '../../foundation/TabStrip'
import { AnnotationQueueDrawer } from './preview/AnnotationQueueDrawer'
import { formatAnnotationQueueForChat, type AnnotationQueueItem } from './preview/annotation-format'

interface WorkspaceFilesPanelProps {
  projectPath: string | null
  previewData?: FileBrowserPreviewData
  onContextChange?: (focus: WorkspaceChatFocus | undefined) => void
  onTakeToChat?: (opts: { text: string }) => void
}

/** 项目切换建立新的文件工作区，旧请求和旧预览不能跨项目继续显示。 */
export function WorkspaceFilesPanel(props: WorkspaceFilesPanelProps) {
  return <FilesWorkspace key={props.projectPath ?? 'isolated'} {...props} />
}

/**
 * 背景：用户需要左树右多预览，且切换工作区工具时保留文件上下文与跨文件批注草稿篮。
 * 设计意图：组合已有文件树／预览与 Foundation 标签；每路径独立读取，不维护候选专用渲染器。
 * 关键约束：读取完成只更新其文件，不能抢当前焦点；关闭或重开必须使旧请求失效。
 */
function FilesWorkspace({ projectPath, previewData, onContextChange, onTakeToChat }: WorkspaceFilesPanelProps) {
  const initial = previewData?.initialPath ? previewData.files[previewData.initialPath] : undefined
  const [files, setFiles] = useState<FileBrowserPreviewFile[]>(initial ? [initial] : [])
  const [activePath, setActivePath] = useState<string | null>(initial?.path ?? null)
  const [annotationQueue, setAnnotationQueue] = useState<AnnotationQueueItem[]>([])
  const requests = useRef(new Map<string, number>())
  const sequence = useRef(0)
  const queueSequence = useRef(1)
  const prefix = useId()
  useEffect(() => () => { requests.current.clear() }, [])

  const openFile = (path: string, retry = false) => {
    setActivePath(path)
    const existing = files.find((file) => file.path === path)
    if (existing && existing.kind !== 'error' && !retry) return
    const request = ++sequence.current
    requests.current.set(path, request)
    setFiles((current) => current.some((file) => file.path === path)
      ? current.map((file) => file.path === path ? { path, kind: 'loading' } : file)
      : [...current, { path, kind: 'loading' }])
    void readFilePreview(path, previewData).then((result) => {
      if (requests.current.get(path) !== request) return
      requests.current.delete(path)
      setFiles((current) => current.map((file) => file.path === path ? result : file))
    })
  }

  const closeFile = (path: string) => {
    requests.current.delete(path)
    const remaining = files.filter((file) => file.path !== path)
    setFiles(remaining)
    setActivePath((current) => current === path ? remaining.at(-1)?.path ?? null : current)
  }

  const handleDirectSend = onTakeToChat
    ? (text: string) => onTakeToChat({ text })
    : undefined

  const handleQueueAnnotation = onTakeToChat
    ? (item: Omit<AnnotationQueueItem, 'id' | 'createdAt'>) => {
        const id = `wf-ann-${queueSequence.current++}`
        setAnnotationQueue((prev) => [...prev, { ...item, id, createdAt: Date.now() }])
      }
    : undefined

  const handleSendQueue = () => {
    if (!onTakeToChat || annotationQueue.length === 0) return
    const merged = formatAnnotationQueueForChat(annotationQueue)
    if (merged) onTakeToChat({ text: merged })
    setAnnotationQueue([])
  }

  const activeFile = files.find((file) => file.path === activePath) ?? null
  // 背景：后台读取可能晚于当前文件完成；由选中项派生而非由每次完成回调发布，缓存切换与关闭也必须同步上下文。
  useEffect(() => {
    onContextChange?.(activeFile ? { kind: 'file', path: activeFile.path, content: activeFile.kind === 'text' ? activeFile.content.slice(0, 12_000) : '' } : undefined)
  }, [activeFile, onContextChange])
  return <div className="flex h-full min-h-0 min-w-0 flex-1" data-testid="workspace-files-layout">
    <div className="min-w-0 shrink-0 overflow-hidden border-r"
      style={{ width: files.length ? '32%' : '100%', borderColor: 'var(--border-subtle)' }} data-testid="workspace-file-tree">
      <FileBrowser projectPath={projectPath} embedded mode="files" previewData={previewData}
        previewState={activeFile} onFileSelect={openFile} onClose={() => {}} />
    </div>
    {files.length > 0 && <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="workspace-file-preview">
      <div className="flex shrink-0 items-center border-b px-2 py-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
        <TabStrip label="文件预览" itemTestId="workspace-file-preview-tab" activeId={activePath}
          items={files.map((file, index) => ({ id: file.path, label: file.path.split(/[/\\]/).pop() || file.path, panelId: prefix + '-file-' + index }))}
          onSelect={setActivePath} onClose={closeFile} />
      </div>
      <AnnotationQueueDrawer
        items={annotationQueue}
        onRemove={(id) => setAnnotationQueue((prev) => prev.filter((item) => item.id !== id))}
        onClear={() => setAnnotationQueue([])}
        onSendAll={handleSendQueue}
      />
      {files.map((file, index) => <div key={file.path} id={prefix + '-file-' + index} role="tabpanel"
        aria-label={file.path.split(/[/\\]/).pop() || file.path} hidden={file.path !== activePath}
        className={file.path === activePath ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'hidden'}>
        <FileBrowser projectPath={projectPath} embedded mode="preview" hideProjectHeader hidePreviewClose
          previewData={previewData} previewState={file} onClose={() => closeFile(file.path)}
          onPreviewStateChange={(next) => { if (!next) closeFile(file.path) }} onRetry={() => openFile(file.path, true)}
          onTakeToChat={handleDirectSend} onQueueAnnotation={handleQueueAnnotation} />
      </div>)}
    </div>}
  </div>
}

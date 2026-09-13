import { useEffect, useId, useRef, useState } from 'react'
import type { WorkspaceChatFocus } from '../../../shared/types'
import { FileBrowser, readFilePreview, type FileBrowserPreviewData, type FileBrowserPreviewFile } from '../../FileBrowser'
import { TabStrip } from '../../foundation/TabStrip'

interface WorkspaceFilesPanelProps {
  projectPath: string | null
  previewData?: FileBrowserPreviewData
  onContextChange?: (focus: WorkspaceChatFocus) => void
}

/** 项目切换建立新的文件工作区，旧请求和旧预览不能跨项目继续显示。 */
export function WorkspaceFilesPanel(props: WorkspaceFilesPanelProps) {
  return <FilesWorkspace key={props.projectPath ?? 'isolated'} {...props} />
}

/**
 * 背景：用户需要左树右多预览，且切换工作区工具时保留文件上下文。
 * 设计意图：组合已有文件树／预览与 Foundation 标签；每路径独立读取，不维护候选专用渲染器。
 * 关键约束：读取完成只更新其文件，不能抢当前焦点；关闭或重开必须使旧请求失效。
 */
function FilesWorkspace({ projectPath, previewData, onContextChange }: WorkspaceFilesPanelProps) {
  const initial = previewData?.initialPath ? previewData.files[previewData.initialPath] : undefined
  const [files, setFiles] = useState<FileBrowserPreviewFile[]>(initial ? [initial] : [])
  const [activePath, setActivePath] = useState<string | null>(initial?.path ?? null)
  const requests = useRef(new Map<string, number>())
  const sequence = useRef(0)
  const prefix = useId()
  useEffect(() => () => { requests.current.clear() }, [])

  const openFile = (path: string, retry = false) => {
    setActivePath(path)
    onContextChange?.({ kind: 'file', path, content: '正在读取文件内容。' })
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
      if (result.kind === 'text') onContextChange?.({ kind: 'file', path, content: result.content.slice(0, 12_000) })
    })
  }

  const closeFile = (path: string) => {
    requests.current.delete(path)
    const remaining = files.filter((file) => file.path !== path)
    setFiles(remaining)
    setActivePath((current) => current === path ? remaining.at(-1)?.path ?? null : current)
  }
  const activeFile = files.find((file) => file.path === activePath) ?? null
  return <div className="flex h-full min-h-0 min-w-0 flex-1" data-testid="workspace-files-layout">
    <div className="min-w-0 shrink-0 overflow-hidden border-r"
      style={{ width: files.length ? '32%' : '100%', borderColor: 'var(--border-subtle)' }} data-testid="workspace-file-tree">
      <FileBrowser projectPath={projectPath} embedded mode="files" previewData={previewData}
        previewState={activeFile} onFileSelect={openFile} onClose={() => {}} />
    </div>
    {files.length > 0 && <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="workspace-file-preview">
      <div className="flex shrink-0 items-center border-b p-1" style={{ borderColor: 'var(--border-subtle)' }}>
        <TabStrip label="文件预览" itemTestId="workspace-file-preview-tab" activeId={activePath}
          items={files.map((file, index) => ({ id: file.path, label: file.path.split(/[/\\]/).pop() || file.path, panelId: prefix + '-file-' + index }))}
          onSelect={setActivePath} onClose={closeFile} />
      </div>
      {files.map((file, index) => <div key={file.path} id={prefix + '-file-' + index} role="tabpanel"
        aria-label={file.path.split(/[/\\]/).pop() || file.path} hidden={file.path !== activePath}
        className={file.path === activePath ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'hidden'}>
        <FileBrowser projectPath={projectPath} embedded mode="preview" hideProjectHeader hidePreviewClose
          previewData={previewData} previewState={file} onClose={() => closeFile(file.path)}
          onPreviewStateChange={(next) => { if (!next) closeFile(file.path) }} onRetry={() => openFile(file.path, true)} />
      </div>)}
    </div>}
  </div>
}

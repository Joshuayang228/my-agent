/**
 * 项目文件浏览器 + 预览（对齐 Alice 右栏：树上、预览下）
 *
 * 背景：原先只把任意文件当 UTF-8 文本塞进 <pre>，图片会乱码，Office 也硬读。
 * 设计意图：按扩展名分流 text / image / unsupported；html 用沙箱 iframe 预览；docx/pdf 等太重则外开。
 * 关键约束：依赖 project:readFile / openExternal；预览体积受主进程上限约束。
 */

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Copy,
  ExternalLink,
  File,
  FileQuestion,
  Folder,
  FolderOpen,
  Search,
  RefreshCw,
  X,
} from 'lucide-react'
import { CodeBlock, MarkdownRenderer } from './MarkdownRenderer'
import { ResizeHandle } from './shell/ResizeHandle'
import { LAYOUT_BOUNDS, LAYOUT_KEYS, usePersistedNumber } from '../shared/panel-layout'
import { IconButton } from './foundation/IconButton'
import { ActionButton } from './foundation/ActionButton'
import { EmptyState } from './foundation/EmptyState'
import { ErrorState } from './foundation/ErrorState'
import { TextField } from './foundation/TextField'
import { ImagePreviewImage } from './foundation/ImagePreviewImage'
import { SpreadsheetPreview } from './chat/right-dock/preview/SpreadsheetPreview'
import { HtmlAnnotatePreview } from './chat/right-dock/preview/HtmlAnnotatePreview'
import { DocxPreview } from './chat/right-dock/preview/DocxPreview'
import { PdfPreview, type PdfPreviewPage } from './chat/right-dock/preview/PdfPreview'
import { PptxPreview } from './chat/right-dock/preview/PptxPreview'
import type { AnnotationQueueItem, PptxSlideData, SpreadsheetSheetData } from './chat/right-dock/preview/annotation-format'

export interface FileBrowserPreviewEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileBrowserPreviewEntry[]
}

export type FileBrowserPreviewFile =
  | { path: string; kind: 'text'; content: string; languageHint?: string; size?: number }
  | { path: string; kind: 'image'; dataUrl: string; mimeType?: string; size?: number }
  | { path: string; kind: 'spreadsheet'; sheets: SpreadsheetSheetData[]; size?: number; mtimeMs?: number }
  | { path: string; kind: 'docx'; html: string; notices?: string[]; size?: number; mtimeMs?: number; nativePdfAvailable?: boolean }
  | { path: string; kind: 'pdf'; pages: PdfPreviewPage[]; pdfBase64?: string; size?: number; mtimeMs?: number }
  | { path: string; kind: 'pptx'; slides: PptxSlideData[]; size?: number; mtimeMs?: number; nativePdfAvailable?: boolean }
  | { path: string; kind: 'unsupported'; reason: string; size?: number }
  | { path: string; kind: 'error'; message: string }
  | { path: string; kind: 'loading' }

export interface FileBrowserPreviewData {
  projectLabel: string
  tree: FileBrowserPreviewEntry[]
  files: Record<string, FileBrowserPreviewFile>
  initialPath?: string
}

type FileEntry = FileBrowserPreviewEntry
export type FileBrowserPreviewState = FileBrowserPreviewFile | null

interface FileBrowserProps {
  projectPath: string | null
  onClose: () => void
  /** 嵌在右坞 Tab 内时隐藏「项目文件」顶栏关闭钮（坞壳已有） */
  embedded?: boolean
  /** Playground / 测试专用只读样张；存在时完全跳过 project IPC。 */
  previewData?: FileBrowserPreviewData
  /** files 只展示文件树，preview 只展示当前预览，split 保持生产双 pane。 */
  mode?: 'files' | 'preview' | 'split'
  /** 正式 Right Dock 的文件 / 预览 Tab 共用当前预览；未传入时保持内部状态。 */
  previewState?: FileBrowserPreviewState
  onPreviewStateChange?: (preview: FileBrowserPreviewState) => void
  /** 多文件工作区接管读取与每路径生命周期；未传入时保持单文件行为。 */
  onFileSelect?: (path: string) => void
  hideProjectHeader?: boolean
  hidePreviewClose?: boolean
  /** 多文件预览 Tab 栏已承接标题和动作时，隐藏内部冗余文件操作栏 */
  hidePreviewHeader?: boolean
  /** 嵌入模式左树顶栏右侧附加操作槽（例如收起文件树） */
  treeHeaderActions?: ReactNode
  onRetry?: () => void
  onTakeToChat?: (text: string) => void
  onQueueAnnotation?: (item: Omit<AnnotationQueueItem, 'id' | 'createdAt'>) => void
  onDirtyChange?: (dirty: boolean) => void
}

/**
 * 背景：单文件浏览器与多文件工作区读取相同的项目预览 IPC。
 * 设计意图：只在此转换载荷和友好错误，不让两个入口分叉格式判断。
 * 关键约束：fixture 完全隔离；生产路径授权与大小限制仍由主进程执行。
 */
export async function readFilePreview(path: string, data?: FileBrowserPreviewData): Promise<FileBrowserPreviewFile> {
  if (data) return data.files[path] ?? { path, kind: 'error', message: '样张中没有这个文件的预览内容' }
  try {
    const result = await window.electronAPI?.project.readFile(path)
    if (!result) return { path, kind: 'error', message: '读取失败，请重试' }
    if (result.error && !result.kind) return { path, kind: 'error', message: result.error }
    if (result.kind === 'image' && result.dataUrl) return { path, kind: 'image', dataUrl: result.dataUrl, mimeType: result.mimeType, size: result.size }
    if (result.kind === 'spreadsheet' && result.sheets) return { path, kind: 'spreadsheet', sheets: result.sheets, size: result.size, mtimeMs: result.mtimeMs }
    if (result.kind === 'docx' && result.html !== undefined) return { path, kind: 'docx', html: result.html, notices: result.notices, size: result.size, mtimeMs: result.mtimeMs, nativePdfAvailable: result.nativePdfAvailable }
    if (result.kind === 'pdf' && result.pages) return { path, kind: 'pdf', pages: result.pages, pdfBase64: result.pdfBase64, size: result.size, mtimeMs: result.mtimeMs }
    if (result.kind === 'pptx' && result.slides) return { path, kind: 'pptx', slides: result.slides, size: result.size, mtimeMs: result.mtimeMs, nativePdfAvailable: result.nativePdfAvailable }
    if (result.kind === 'unsupported') return { path, kind: 'unsupported', reason: result.reason || result.error || '无法预览', size: result.size }
    if (result.content !== undefined) return { path, kind: 'text', content: result.content, languageHint: result.languageHint, size: result.size }
    return { path, kind: 'error', message: result.error || '无法预览' }
  } catch {
    return { path, kind: 'error', message: '读取文件失败，请重试' }
  }
}

function initialPreview(data?: FileBrowserPreviewData): FileBrowserPreviewState {
  if (!data?.initialPath) return null
  return data.files[data.initialPath] ?? null
}

export function FileBrowser({ projectPath, onClose, embedded = false, previewData, mode = 'split', previewState, onPreviewStateChange, onFileSelect, hideProjectHeader = false, hidePreviewClose = false, hidePreviewHeader = false, treeHeaderActions, onRetry, onTakeToChat, onQueueAnnotation, onDirtyChange }: FileBrowserProps) {
  const [tree, setTree] = useState<FileEntry[]>(() => previewData?.tree ?? [])
  const [filter, setFilter] = useState('')
  const [internalPreview, setInternalPreview] = useState<FileBrowserPreviewState>(() => initialPreview(previewData))
  const isPreviewControlled = previewState !== undefined
  const preview = isPreviewControlled ? previewState : internalPreview
  const setPreview = (next: FileBrowserPreviewState) => {
    if (isPreviewControlled) onPreviewStateChange?.(next)
    else setInternalPreview(next)
  }
  const [loading, setLoading] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const readVersion = useRef(0)
  const treeVersion = useRef(0)
  const [copied, setCopied] = useState(false)
  const [treeRatio, setTreeRatio] = usePersistedNumber(
    LAYOUT_KEYS.fileTreeRatio,
    LAYOUT_BOUNDS.fileTreeRatio.fallback,
    LAYOUT_BOUNDS.fileTreeRatio,
  )
  const splitRef = useRef<HTMLDivElement>(null)
  const displayProjectPath = previewData?.projectLabel ?? projectPath
  const showTree = mode !== 'preview'
  const showPreview = mode !== 'files'

  const loadTree = useCallback(async () => {
    if (mode === 'preview') return
    const version = ++treeVersion.current
    setTreeError(null)
    if (previewData) {
      setTree(previewData.tree)
      if (!onFileSelect) setPreview(initialPreview(previewData))
      setLoading(false)
      return
    }
    if (!projectPath || !window.electronAPI) { setTree([]); return }
    setLoading(true)
    try {
      const files = await window.electronAPI.project.listFiles(projectPath, 3)
      if (version === treeVersion.current) setTree(files as FileEntry[])
    } catch {
      if (version === treeVersion.current) setTreeError('无法读取目录，请刷新重试')
    } finally {
      if (version === treeVersion.current) setLoading(false)
    }
  }, [mode, previewData, projectPath])

  useEffect(() => {
    void loadTree()
    return () => { treeVersion.current++; readVersion.current++ }
  }, [loadTree])

  const handleFileClick = async (entry: FileEntry) => {
    if (entry.isDir) return
    if (onFileSelect) { onFileSelect(entry.path); return }
    const version = ++readVersion.current
    setPreview({ path: entry.path, kind: 'loading' })
    const next = await readFilePreview(entry.path, previewData)
    if (version !== readVersion.current) return
    setPreview(next)
  }

  const openExternal = async () => {
    if (previewData || !preview?.path) return
    await window.electronAPI?.project.openExternal?.(preview.path)
  }

  const copyText = async () => {
    if (!preview || preview.kind !== 'text') return
    try {
      await navigator.clipboard.writeText(preview.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch { /* ignore */ }
  }

  const filteredTree = filter
    ? filterTree(tree, filter.toLowerCase())
    : tree

  const fileName = preview?.path.split(/[/\\]/).pop() || ''

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="file-browser">
      {!embedded && (
        <Header
          projectPath={displayProjectPath}
          onClose={onClose}
          onRefresh={() => void loadTree()}
          loading={loading}
        />
      )}
      {embedded && !hideProjectHeader && (
        <div
          className="flex h-10 shrink-0 select-none items-center gap-1 border-b px-3"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium" style={{ color: 'var(--text-primary)' }} title={displayProjectPath || undefined}>
            {displayProjectPath ? (displayProjectPath.split(/[/\\]/).filter(Boolean).pop() || displayProjectPath) : '未选择项目'}
          </span>
          <IconButton label="刷新" size={24} style={{ color: 'var(--text-muted)' }} onClick={() => { void loadTree() }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : undefined} />
          </IconButton>
          {treeHeaderActions}
        </div>
      )}

      {!displayProjectPath ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <EmptyState variant="minimal" icon={<FolderOpen size={18} />} title="未选择项目" description="请先选择一个项目目录" />
        </div>
      ) : (
        <>
          {showTree && <div className="border-b px-2.5 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <div
              className="flex items-center gap-2 rounded-[var(--radius-input)] border px-2.5 py-1.5 transition focus-within:border-[var(--accent)]"
              style={{ borderColor: 'color-mix(in srgb, var(--border-color) 75%, transparent)', background: 'color-mix(in srgb, var(--card-bg) 85%, transparent)' }}
            >
              <Search size={12} className="shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              <TextField
                appearance="embedded"
                aria-label="搜索文件名"
                value={filter}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
                placeholder="搜索文件名..."
                className="w-full text-xs"
              />
            </div>
          </div>}

          {/* Alice 式：树上、预览下；中间可拖 */}
          <div ref={splitRef} className="flex min-h-0 flex-1 flex-col">
            {showTree && <div
              className={`min-h-0 overflow-y-auto px-2 py-1.5 scrollbar-hover ${showPreview && preview ? 'shrink-0 space-y-0.5' : 'flex flex-1 flex-col gap-0.5'}`}
              style={showPreview && preview ? { height: `${Math.round(treeRatio * 100)}%` } : undefined}
              data-testid="file-browser-tree"
            >
              {treeError && <ErrorState className="m-1 min-h-24 px-4 py-5" title="无法读取目录" description={treeError} action={<ActionButton tone="accent" onClick={() => { void loadTree() }}>刷新重试</ActionButton>} />}
              {filteredTree.length === 0 && !loading && !treeError && (
                <EmptyState
                  variant="minimal"
                  icon={filter ? <Search size={18} /> : <FolderOpen size={18} />}
                  title={filter ? '没有匹配项' : '暂无文件'}
                  description={filter ? '无匹配文件，请尝试其他关键词' : '目录为空'}
                />
              )}
              {filteredTree.map((entry) => (
                <TreeNode
                  key={entry.path}
                  entry={entry}
                  depth={0}
                  onFileClick={(e) => { void handleFileClick(e) }}
                  selectedPath={preview?.path}
                />
              ))}
            </div>}

            {showPreview && preview && (
              <>
                {mode === 'split' && <ResizeHandle
                  orientation="horizontal"
                  title="拖动调整文件树 / 预览高度"
                  onDelta={(dy) => {
                    const h = splitRef.current?.clientHeight || 0
                    if (h <= 0) return
                    setTreeRatio((r) => r + dy / h)
                  }}
                />}
              <div
                className={`flex min-h-0 flex-1 flex-col ${mode === 'split' ? 'border-t' : ''}`}
                data-testid="file-browser-preview"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}
              >
                {!hidePreviewHeader && (
                  <div
                    className="workspace-subtoolbar flex shrink-0 select-none items-center justify-end gap-1 border-b px-3"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: 'var(--text-muted)' }} title={preview.path}>
                      {hidePreviewClose ? '' : fileName}
                    </span>
                    {preview.kind === 'text' && preview.languageHint === 'markdown' && (
                      <IconButton label="复制正文" size={24} style={{ color: 'var(--text-muted)' }} onClick={() => { void copyText() }}>
                        <Copy size={12} />
                      </IconButton>
                    )}
                    <IconButton label="用系统应用打开" size={24} style={{ color: 'var(--text-muted)' }} onClick={() => { void openExternal() }}>
                      <ExternalLink size={12} />
                    </IconButton>
                    {!hidePreviewClose && <IconButton label="关闭预览" size={24} style={{ color: 'var(--text-muted)' }} onClick={() => setPreview(null)}><X size={12} /></IconButton>}
                  </div>
                )}

                {(() => {
                  const isRichPreview = preview.kind === 'spreadsheet'
                    || preview.kind === 'docx'
                    || preview.kind === 'pdf'
                    || preview.kind === 'pptx'
                    || (preview.kind === 'text' && preview.languageHint === 'html')
                  if (isRichPreview) {
                    return (
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        {preview.kind === 'text' && preview.languageHint === 'html' && (
                          <HtmlAnnotatePreview
                            filePath={preview.path}
                            htmlContent={preview.content}
                            onSendToChat={onTakeToChat}
                            onQueueAnnotation={onQueueAnnotation}
                          />
                        )}
                        {preview.kind === 'spreadsheet' && (
                          <SpreadsheetPreview
                            filePath={preview.path}
                            sheets={preview.sheets}
                            mtimeMs={preview.mtimeMs}
                            onDirtyChange={onDirtyChange}
                            onSendToChat={onTakeToChat}
                            onQueueAnnotation={onQueueAnnotation}
                          />
                        )}
                        {preview.kind === 'docx' && (
                          <DocxPreview
                            filePath={preview.path}
                            htmlContent={preview.html}
                            notices={preview.notices}
                            onOpenExternal={!previewData ? () => { void openExternal() } : undefined}
                            onSendToChat={onTakeToChat}
                            onQueueAnnotation={onQueueAnnotation}
                          />
                        )}
                        {preview.kind === 'pdf' && (
                          <PdfPreview
                            filePath={preview.path}
                            pages={preview.pages}
                            pdfBase64={preview.pdfBase64}
                            onSendToChat={onTakeToChat}
                            onQueueAnnotation={onQueueAnnotation}
                          />
                        )}
                        {preview.kind === 'pptx' && (
                          <PptxPreview
                            filePath={preview.path}
                            slides={preview.slides}
                            onSendToChat={onTakeToChat}
                            onQueueAnnotation={onQueueAnnotation}
                          />
                        )}
                      </div>
                    )
                  }
                  if (preview.kind === 'image') {
                    return (
                      <div className="workspace-surface-stage flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-auto p-6">
                        <div className="workspace-surface-paper workspace-image-checker flex max-h-[calc(100%-2rem)] max-w-full items-center justify-center overflow-hidden rounded-[var(--radius-card)] border p-2">
                          <ImagePreviewImage
                            src={preview.dataUrl}
                            alt={fileName}
                            className="max-h-[420px] max-w-full rounded-[var(--radius-md)] object-contain"
                            buttonClassName="flex max-h-full max-w-full items-center justify-center"
                          />
                        </div>
                        <p className="select-none text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {fileName} · 点击图片放大查看
                        </p>
                      </div>
                    )
                  }
                  if (preview.kind === 'unsupported') {
                    return (
                      <div className="workspace-surface-stage flex min-h-0 flex-1 flex-col">
                        <EmptyState
                          variant="minimal"
                          icon={<FileQuestion size={18} />}
                          title="暂不支持内嵌预览"
                          description={preview.reason}
                          action={!previewData ? <ActionButton size="md" onClick={() => { void openExternal() }}>用系统应用打开</ActionButton> : undefined}
                        />
                      </div>
                    )
                  }
                  if (preview.kind === 'error') {
                    return (
                      <div className="workspace-surface-stage flex min-h-0 flex-1 flex-col p-6">
                        <ErrorState
                          className="m-auto w-full max-w-md"
                          title="无法读取文件"
                          description={preview.message}
                          action={onRetry ? <ActionButton tone="accent" onClick={onRetry}>重新读取</ActionButton> : undefined}
                        />
                      </div>
                    )
                  }
                  if (preview.kind === 'loading') {
                    return (
                      <div className="workspace-surface-paper flex min-h-0 flex-1 items-center justify-center p-6">
                        <p role="status" className="text-xs" style={{ color: 'var(--text-muted)' }}>正在读取文件…</p>
                      </div>
                    )
                  }
                  if (preview.kind === 'text' && preview.languageHint === 'markdown') {
                    return (
                      <div className="workspace-surface-paper min-h-0 flex-1 overflow-auto scrollbar-hover select-text px-6 py-5">
                        <div className="mx-auto max-w-[740px] text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          <MarkdownRenderer content={preview.content} />
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div className="workspace-surface-paper min-h-0 flex-1 overflow-auto scrollbar-hover select-text px-4 py-3">
                      <CodeBlock code={preview.content} language={preview.languageHint || 'text'} />
                    </div>
                  )
                })()}
                {copied && (
                  <p className="px-3 pb-2 text-[10px]" style={{ color: 'var(--success)' }}>已复制</p>
                )}
              </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Header({
  projectPath,
  onClose,
  onRefresh,
  loading,
}: {
  projectPath: string | null
  onClose: () => void
  onRefresh: () => void
  loading: boolean
}) {
  return (
    <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>项目文件</span>
        {projectPath && (
          <p className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }} title={projectPath}>
            {projectPath}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <IconButton label="刷新" size={24} style={{ color: 'var(--text-muted)' }} onClick={onRefresh}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </IconButton>
        <IconButton label="关闭文件浏览器" size={24} style={{ color: 'var(--text-muted)' }} onClick={onClose}>
          <X size={12} />
        </IconButton>
      </div>
    </div>
  )
}

function TreeNode({ entry, depth, onFileClick, selectedPath }: {
  entry: FileEntry
  depth: number
  onFileClick: (e: FileEntry) => void
  selectedPath?: string
}) {
  const [open, setOpen] = useState(depth < 1)
  const isSelected = entry.path === selectedPath

  return (
    <div>
      <ActionButton
        variant="plain"
        padding="none"
        className={`!w-full !min-h-0 !justify-start gap-1.5 !border-0 py-1.5 pr-2 text-left text-[12.5px] ${isSelected ? 'font-medium' : 'font-normal'}`}
        style={{
          paddingLeft: depth * 14 + 8,
          color: isSelected ? 'var(--accent-fg)' : 'var(--text-secondary)',
          background: isSelected ? 'var(--accent-subtle)' : undefined,
        }}
        onClick={() => {
          if (entry.isDir) setOpen(v => !v)
          else onFileClick(entry)
        }}
      >
        {entry.isDir ? (
          <>
            {open ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
            {open ? <FolderOpen size={13} style={{ color: 'var(--companion-accent-warm, #c9a96e)' }} /> : <Folder size={13} style={{ color: 'var(--companion-accent-warm, #c9a96e)' }} />}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <File size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
          </>
        )}
        <span className="truncate">{entry.name}</span>
      </ActionButton>
      {entry.isDir && open && entry.children?.map((child) => (
        <TreeNode key={child.path} entry={child} depth={depth + 1} onFileClick={onFileClick} selectedPath={selectedPath} />
      ))}
    </div>
  )
}

function filterTree(entries: FileEntry[], query: string): FileEntry[] {
  const result: FileEntry[] = []
  for (const entry of entries) {
    if (entry.isDir) {
      const filtered = entry.children ? filterTree(entry.children, query) : []
      if (filtered.length > 0 || entry.name.toLowerCase().includes(query)) {
        result.push({ ...entry, children: filtered })
      }
    } else if (entry.name.toLowerCase().includes(query)) {
      result.push(entry)
    }
  }
  return result
}

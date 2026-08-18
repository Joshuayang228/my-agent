/**
 * 项目文件浏览器 + 预览（对齐 Alice 右栏：树上、预览下）
 *
 * 背景：原先只把任意文件当 UTF-8 文本塞进 <pre>，图片会乱码，Office 也硬读。
 * 设计意图：按扩展名分流 text / image / unsupported；html 用沙箱 iframe 预览；docx/pdf 等太重则外开。
 * 关键约束：依赖 project:readFile / openExternal；预览体积受主进程上限约束。
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Copy,
  ExternalLink,
  File,
  Folder,
  FolderOpen,
  Search,
  RefreshCw,
  X,
} from 'lucide-react'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ResizeHandle } from './shell/ResizeHandle'
import { LAYOUT_BOUNDS, LAYOUT_KEYS, usePersistedNumber } from '../shared/panel-layout'

export interface FileBrowserPreviewEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileBrowserPreviewEntry[]
}

export type FileBrowserPreviewFile =
  | { path: string; kind: 'text'; content: string; languageHint?: string; size?: number }
  | { path: string; kind: 'image'; dataUrl: string; mimeType?: string; size?: number }
  | { path: string; kind: 'unsupported'; reason: string; size?: number }
  | { path: string; kind: 'error'; message: string }

export interface FileBrowserPreviewData {
  projectLabel: string
  tree: FileBrowserPreviewEntry[]
  files: Record<string, FileBrowserPreviewFile>
  initialPath?: string
}

type FileEntry = FileBrowserPreviewEntry
type PreviewState = FileBrowserPreviewFile

interface FileBrowserProps {
  projectPath: string | null
  onClose: () => void
  /** 嵌在右坞 Tab 内时隐藏「项目文件」顶栏关闭钮（坞壳已有） */
  embedded?: boolean
  /** Playground / 测试专用只读样张；存在时完全跳过 project IPC。 */
  previewData?: FileBrowserPreviewData
}

function initialPreview(data?: FileBrowserPreviewData): PreviewState | null {
  if (!data?.initialPath) return null
  return data.files[data.initialPath] ?? null
}

export function FileBrowser({ projectPath, onClose, embedded = false, previewData }: FileBrowserProps) {
  const [tree, setTree] = useState<FileEntry[]>(() => previewData?.tree ?? [])
  const [filter, setFilter] = useState('')
  const [preview, setPreview] = useState<PreviewState | null>(() => initialPreview(previewData))
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  /** html：预览 / 源码；默认预览 */
  const [htmlView, setHtmlView] = useState<'preview' | 'source'>('preview')
  const [treeRatio, setTreeRatio] = usePersistedNumber(
    LAYOUT_KEYS.fileTreeRatio,
    LAYOUT_BOUNDS.fileTreeRatio.fallback,
    LAYOUT_BOUNDS.fileTreeRatio,
  )
  const splitRef = useRef<HTMLDivElement>(null)
  const displayProjectPath = previewData?.projectLabel ?? projectPath

  const loadTree = useCallback(async () => {
    if (previewData) {
      setTree(previewData.tree)
      setPreview(initialPreview(previewData))
      setLoading(false)
      return
    }
    if (!projectPath || !window.electronAPI) return
    setLoading(true)
    try {
      const files = await window.electronAPI.project.listFiles(projectPath, 3)
      setTree(files as FileEntry[])
    } finally {
      setLoading(false)
    }
  }, [previewData, projectPath])

  useEffect(() => { void loadTree() }, [loadTree])

  const handleFileClick = async (entry: FileEntry) => {
    if (entry.isDir) return
    if (previewData) {
      setPreview(previewData.files[entry.path] ?? {
        path: entry.path,
        kind: 'error',
        message: '样张中没有这个文件的预览内容',
      })
      return
    }
    const result = await window.electronAPI?.project.readFile(entry.path)
    if (!result) {
      setPreview({ path: entry.path, kind: 'error', message: '读取失败' })
      return
    }
    if (result.error && !result.kind) {
      setPreview({ path: entry.path, kind: 'error', message: result.error })
      return
    }
    if (result.kind === 'image' && result.dataUrl) {
      setPreview({
        path: entry.path,
        kind: 'image',
        dataUrl: result.dataUrl,
        mimeType: result.mimeType,
        size: result.size,
      })
      return
    }
    if (result.kind === 'unsupported') {
      setPreview({
        path: entry.path,
        kind: 'unsupported',
        reason: result.reason || result.error || '无法预览',
        size: result.size,
      })
      return
    }
    if (result.content !== undefined) {
      setPreview({
        path: entry.path,
        kind: 'text',
        content: result.content,
        languageHint: result.languageHint,
        size: result.size,
      })
      if (result.languageHint === 'html') setHtmlView('preview')
      return
    }
    setPreview({ path: entry.path, kind: 'error', message: result.error || '无法预览' })
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
      {embedded && (
        <div
          className="flex shrink-0 items-center gap-1.5 border-b px-2 py-1"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <span className="min-w-0 flex-1 truncate text-[10px]" style={{ color: 'var(--text-muted)' }} title={displayProjectPath || undefined}>
            {displayProjectPath || '未选择项目'}
          </span>
          <button
            type="button"
            className="rounded p-0.5"
            style={{ color: 'var(--text-muted)' }}
            title="刷新"
            onClick={() => { void loadTree() }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : undefined} />
          </button>
        </div>
      )}

      {!displayProjectPath ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          请先选择一个项目目录
        </div>
      ) : (
        <>
          <div className="border-b px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <div
              className="flex items-center gap-1.5 rounded-md border px-2 py-1"
              style={{ borderColor: 'var(--border-color)', background: 'var(--input-bg)' }}
            >
              <Search size={12} style={{ color: 'var(--text-muted)' }} />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="搜索文件名..."
                className="w-full bg-transparent text-xs outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Alice 式：树上、预览下；中间可拖 */}
          <div ref={splitRef} className="flex min-h-0 flex-1 flex-col">
            <div
              className={`min-h-0 overflow-y-auto px-1 py-1 scrollbar-hover ${preview ? 'shrink-0' : 'flex-1'}`}
              style={preview ? { height: `${Math.round(treeRatio * 100)}%` } : undefined}
            >
              {filteredTree.length === 0 && !loading && (
                <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  {filter ? '无匹配文件' : '目录为空'}
                </div>
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
            </div>

            {preview && (
              <>
                <ResizeHandle
                  orientation="horizontal"
                  title="拖动调整文件树 / 预览高度"
                  onDelta={(dy) => {
                    const h = splitRef.current?.clientHeight || 0
                    if (h <= 0) return
                    setTreeRatio((r) => r + dy / h)
                  }}
                />
              <div
                className="flex min-h-0 flex-1 flex-col border-t"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
              >
                <div
                  className="flex shrink-0 items-center gap-1.5 border-b px-2 py-1.5"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="min-w-0 flex-1 truncate text-[10px]" style={{ color: 'var(--text-muted)' }} title={preview.path}>
                    {fileName}
                  </span>
                  {preview.kind === 'text' && preview.languageHint === 'html' && (
                    <div className="flex shrink-0 rounded border text-[10px]" style={{ borderColor: 'var(--border-color)' }}>
                      <button
                        type="button"
                        className="px-1.5 py-0.5"
                        style={{
                          background: htmlView === 'preview' ? 'var(--accent-subtle)' : undefined,
                          color: htmlView === 'preview' ? 'var(--accent-fg)' : 'var(--text-muted)',
                        }}
                        onClick={() => setHtmlView('preview')}
                      >
                        预览
                      </button>
                      <button
                        type="button"
                        className="px-1.5 py-0.5"
                        style={{
                          background: htmlView === 'source' ? 'var(--accent-subtle)' : undefined,
                          color: htmlView === 'source' ? 'var(--accent-fg)' : 'var(--text-muted)',
                        }}
                        onClick={() => setHtmlView('source')}
                      >
                        源码
                      </button>
                    </div>
                  )}
                  {preview.kind === 'text' && (
                    <button
                      type="button"
                      className="rounded p-0.5"
                      style={{ color: 'var(--text-muted)' }}
                      title="复制正文"
                      onClick={() => { void copyText() }}
                    >
                      <Copy size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded p-0.5"
                    style={{ color: 'var(--text-muted)' }}
                    title="用系统应用打开"
                    onClick={() => { void openExternal() }}
                  >
                    <ExternalLink size={12} />
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => setPreview(null)}
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className={`min-h-0 flex-1 overflow-auto scrollbar-hover select-text ${preview.kind === 'text' && preview.languageHint === 'html' && htmlView === 'preview' ? 'p-0' : 'p-3'}`}>
                  {preview.kind === 'image' && (
                    <img
                      src={preview.dataUrl}
                      alt={fileName}
                      className="mx-auto max-h-full max-w-full object-contain"
                    />
                  )}
                  {preview.kind === 'text' && preview.languageHint === 'html' && htmlView === 'preview' && (
                    <iframe
                      title={fileName}
                      // 空 sandbox：禁脚本 / 表单 / same-origin，仅静态渲染
                      sandbox=""
                      srcDoc={preview.content}
                      className="h-full min-h-[200px] w-full border-0 bg-white"
                    />
                  )}
                  {preview.kind === 'text' && preview.languageHint === 'markdown' && (
                    <div className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      <MarkdownRenderer content={preview.content} />
                    </div>
                  )}
                  {preview.kind === 'text' && preview.languageHint !== 'markdown' && !(preview.languageHint === 'html' && htmlView === 'preview') && (
                    <pre
                      className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {preview.content}
                    </pre>
                  )}
                  {preview.kind === 'unsupported' && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                      <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{preview.reason}</p>
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-[11px]"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                        onClick={() => { void openExternal() }}
                      >
                        用系统应用打开
                      </button>
                    </div>
                  )}
                  {preview.kind === 'error' && (
                    <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{preview.message}</p>
                  )}
                </div>
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
        <button
          type="button"
          onClick={onRefresh}
          className="rounded p-1 transition"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 transition"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        >
          <X size={12} />
        </button>
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
      <button
        type="button"
        className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-[12px] transition"
        style={{
          paddingLeft: depth * 14 + 4,
          color: isSelected ? 'var(--accent-fg)' : 'var(--text-secondary)',
          background: isSelected ? 'var(--accent-subtle)' : undefined,
        }}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--hover-overlay)' }}
        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = '' }}
        onClick={() => {
          if (entry.isDir) setOpen(v => !v)
          else onFileClick(entry)
        }}
      >
        {entry.isDir ? (
          <>
            {open ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
            {open ? <FolderOpen size={13} className="text-amber-500" /> : <Folder size={13} className="text-amber-500" />}
          </>
        ) : (
          <>
            <span className="w-3" />
            <File size={13} style={{ color: 'var(--text-muted)' }} />
          </>
        )}
        <span className="truncate">{entry.name}</span>
      </button>
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

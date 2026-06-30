import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Search, RefreshCw, X } from 'lucide-react'

interface FileEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileEntry[]
}

interface FileBrowserProps {
  projectPath: string | null
  onClose: () => void
}

export function FileBrowser({ projectPath, onClose }: FileBrowserProps) {
  const [tree, setTree] = useState<FileEntry[]>([])
  const [filter, setFilter] = useState('')
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const loadTree = useCallback(async () => {
    if (!projectPath || !window.electronAPI) return
    setLoading(true)
    try {
      const files = await window.electronAPI.project.listFiles(projectPath, 3)
      setTree(files as FileEntry[])
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  useEffect(() => { loadTree() }, [loadTree])

  const handleFileClick = async (entry: FileEntry) => {
    if (entry.isDir) return
    const result = await window.electronAPI?.project.readFile(entry.path)
    if (result?.content !== undefined) {
      setPreview({ path: entry.path, content: result.content })
    }
  }

  const filteredTree = filter
    ? filterTree(tree, filter.toLowerCase())
    : tree

  if (!projectPath) {
    return (
      <div className="flex h-full flex-col">
        <Header onClose={onClose} onRefresh={loadTree} loading={loading} />
        <div className="flex flex-1 items-center justify-center p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          请先选择一个项目目录
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header onClose={onClose} onRefresh={loadTree} loading={loading} />

      <div className="border-b px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-1.5 rounded-md border px-2 py-1" style={{ borderColor: 'var(--border-color)', background: 'var(--input-bg)' }}>
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

      <div className="flex flex-1 overflow-hidden">
        <div className="scrollbar-thin w-full flex-1 overflow-y-auto px-1 py-1">
          {filteredTree.length === 0 && !loading && (
            <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              {filter ? '无匹配文件' : '目录为空'}
            </div>
          )}
          {filteredTree.map((entry) => (
            <TreeNode key={entry.path} entry={entry} depth={0} onFileClick={handleFileClick} selectedPath={preview?.path} />
          ))}
        </div>

        {preview && (
          <div className="flex w-1/2 flex-col border-l" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between border-b px-3 py-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {preview.path.split(/[/\\]/).pop()}
              </span>
              <button onClick={() => setPreview(null)} className="p-0.5" style={{ color: 'var(--text-muted)' }}>
                <X size={12} />
              </button>
            </div>
            <pre className="scrollbar-thin flex-1 overflow-auto p-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {preview.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

function Header({ onClose, onRefresh, loading }: { onClose: () => void; onRefresh: () => void; loading: boolean }) {
  return (
    <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>
      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>项目文件</span>
      <div className="flex items-center gap-1">
        <button
          onClick={onRefresh}
          className="rounded p-1 transition"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
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

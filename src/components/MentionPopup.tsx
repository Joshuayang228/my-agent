import { useState, useEffect, useRef, useCallback } from 'react'
import { File, Folder, Search, X } from 'lucide-react'

interface FileEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileEntry[]
}

interface MentionPopupProps {
  query: string
  anchor: { top: number; left: number }
  onSelect: (entry: FileEntry) => void
  onClose: () => void
}

function flattenTree(entries: FileEntry[], prefix = ''): FileEntry[] {
  const result: FileEntry[] = []
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    result.push({ ...entry, path: entry.path, name: relativePath })
    if (entry.isDir && entry.children) {
      result.push(...flattenTree(entry.children, relativePath))
    }
  }
  return result
}

export default function MentionPopup({ query, anchor, onSelect, onClose }: MentionPopupProps) {
  const [allFiles, setAllFiles] = useState<FileEntry[]>([])
  const [filtered, setFiltered] = useState<FileEntry[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const [hasProject, setHasProject] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const project = await window.electronAPI.project.get()
        if (cancelled) return
        if (!project) {
          setHasProject(false)
          setLoading(false)
          return
        }
        setHasProject(true)
        const tree = await window.electronAPI.project.listFiles(project.path, 3) as unknown as FileEntry[]
        if (cancelled) return
        setAllFiles(flattenTree(tree))
      } catch { /* project not set */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (allFiles.length === 0) {
      setFiltered([])
      return
    }
    const q = query.toLowerCase()
    if (!q) {
      setFiltered(allFiles.slice(0, 20))
    } else {
      const matches = allFiles.filter(f => f.name.toLowerCase().includes(q))
      setFiltered(matches.slice(0, 20))
    }
    setActiveIndex(0)
  }, [query, allFiles])

  useEffect(() => {
    const active = listRef.current?.children[activeIndex] as HTMLElement
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault()
      onSelect(filtered[activeIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [filtered, activeIndex, onSelect, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={popupRef}
      className="fixed z-50 w-72 rounded-lg border shadow-lg"
      style={{
        top: anchor.top,
        left: anchor.left,
        background: 'var(--card-bg)',
        borderColor: 'var(--border-color)',
        maxHeight: '260px',
      }}
    >
      <div className="flex items-center gap-1.5 border-b px-2.5 py-1.5" style={{ borderColor: 'var(--border-color)' }}>
        <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {query ? `搜索: ${query}` : '输入文件名搜索...'}
        </span>
        <button onClick={onClose} className="ml-auto opacity-50 hover:opacity-100">
          <X size={13} />
        </button>
      </div>

      <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: '220px' }}>
        {loading ? (
          <div className="px-3 py-4 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
            加载文件列表...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
            {!hasProject ? '未选择项目目录' : allFiles.length === 0 ? '项目目录为空' : '没有匹配的文件'}
          </div>
        ) : (
          filtered.map((entry, i) => (
            <button
              key={entry.path}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition"
              style={{
                background: i === activeIndex ? 'var(--hover-bg)' : 'transparent',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => onSelect(entry)}
            >
              {entry.isDir
                ? <Folder size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                : <File size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              }
              <span className="truncate">{entry.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

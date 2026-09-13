/**
 * 右坞审阅：本会话 Agent 写过的文件列表 + unified diff / 现状
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, FileCode2, RefreshCw } from 'lucide-react'
import { ResizeHandle } from '../../shell/ResizeHandle'
import { DiffViewer, DiffViewControls, type DiffViewMode } from '../../foundation/DiffViewer'
import { LAYOUT_BOUNDS, LAYOUT_KEYS, usePersistedNumber } from '../../../shared/panel-layout'
import type { WorkspaceChatFocus } from '../../../shared/types'

type ChangeItem = {
  path: string
  toolName: string
  updatedAt: number
  hasBefore: boolean
  beforeTruncated?: boolean
}

interface ReviewPanelProps {
  sessionId: string | null
  onContextChange?: (focus: WorkspaceChatFocus) => void
}

export function ReviewPanel({ sessionId, onContextChange }: ReviewPanelProps) {
  const [items, setItems] = useState<ChangeItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [diffText, setDiffText] = useState<string | null>(null)
  const [language, setLanguage] = useState('diff')
  const [beforeText, setBeforeText] = useState<string | null>(null)
  const [afterText, setAfterText] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<DiffViewMode>('unified')
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)
  const listRequestRef = useRef(0)
  const [listRatio, setListRatio] = usePersistedNumber(
    LAYOUT_KEYS.reviewListRatio,
    LAYOUT_BOUNDS.reviewListRatio.fallback,
    LAYOUT_BOUNDS.reviewListRatio,
  )
  const splitRef = useRef<HTMLDivElement>(null)

  const reload = useCallback(async () => {
    if (!sessionId || !window.electronAPI?.session.listFileChanges) {
      setItems([])
      return
    }
    const request = ++listRequestRef.current
    setError(null)
    try {
      const list = await window.electronAPI.session.listFileChanges(sessionId)
      if (request === listRequestRef.current) setItems(list)
    } catch {
      if (request === listRequestRef.current) setError('无法读取本会话的文件变更，请重试')
    }
  }, [sessionId])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    if (!sessionId || !window.electronAPI?.session.onFileChange) return
    return window.electronAPI.session.onFileChange((payload) => {
      if (payload.sessionId !== sessionId) return
      void reload()
    })
  }, [sessionId, reload])

  const openDiff = async (filePath: string) => {
    if (!sessionId) return
    const request = ++requestRef.current
    setSelected(filePath)
    setLoadingDiff(true)
    setError(null)
    setDiffText(null)
    setBeforeText(null)
    setAfterText(null)
    try {
      const r = await window.electronAPI?.session.getFileChangeDiff(sessionId, filePath)
      if (request !== requestRef.current) return
      if (!r || r.error) {
        setError(r?.error || '无法加载')
      } else {
        setDiffText(r.diff || r.after || '')
        setBeforeText(r.before ?? null)
        setAfterText(r.after ?? null)
        onContextChange?.({ kind: 'review', path: filePath, content: (r.diff || r.after || '').slice(0, 12_000) })
        setLanguage(r.diff ? 'diff' : 'text')
      }
    } catch {
      if (request === requestRef.current) setError('读取文件变更失败，请重试')
    } finally {
      if (request === requestRef.current) setLoadingDiff(false)
    }
  }

  const clearAll = async () => {
    if (!sessionId) return
    await window.electronAPI?.session.clearFileChanges(sessionId)
    setItems([])
    setSelected(null)
    setDiffText(null)
    setBeforeText(null)
    setAfterText(null)
  }

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
        无活跃会话
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          本会话改动 {items.length}
        </span>
        <button type="button" className="ml-auto rounded p-0.5" style={{ color: 'var(--text-muted)' }} title="刷新" onClick={() => { void reload() }}>
          <RefreshCw size={12} />
        </button>
        <button type="button" className="rounded p-0.5" style={{ color: 'var(--text-muted)' }} title="清空列表" onClick={() => { void clearAll() }}>
          <Eraser size={12} />
        </button>
        <DiffViewControls mode={viewMode} canSplit={beforeText != null && afterText != null} onChange={setViewMode} />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          {error ? <>
            <p role="alert" className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>
            <button type="button" className="rounded px-2 py-1 text-[11px]" style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }} onClick={() => { void reload() }}>重新读取</button>
          </> : <>
            <FileCode2 size={20} style={{ color: 'var(--text-muted)' }} />
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Agent 写入 / 编辑文件后，会显示在这里
            </p>
          </>}
        </div>
      ) : (
        <div ref={splitRef} className="flex min-h-0 flex-1 flex-col">
          <div
            className="shrink-0 overflow-auto scrollbar-hover border-b"
            style={{ borderColor: 'var(--border-subtle)', height: `${Math.round(listRatio * 100)}%` }}
          >
            {items.map((it) => {
              const name = it.path.replace(/\\/g, '/').split('/').pop() || it.path
              const active = selected === it.path
              return (
                <button
                  key={it.path}
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-2.5 py-1.5 text-left text-[11px] transition"
                  style={{
                    background: active ? 'var(--accent-subtle)' : undefined,
                    color: 'var(--text-primary)',
                  }}
                  onClick={() => { void openDiff(it.path) }}
                  title={it.path}
                >
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {it.toolName} · {new Date(it.updatedAt).toLocaleTimeString()}
                    {!it.hasBefore ? ' · 新文件/无旧稿' : ''}
                  </span>
                </button>
              )
            })}
          </div>
          <ResizeHandle
            orientation="horizontal"
            title="拖动调整列表 / diff 高度"
            onDelta={(dy) => {
              const h = splitRef.current?.clientHeight || 0
              if (h <= 0) return
              setListRatio((r) => r + dy / h)
            }}
          />
          <div className="min-h-0 flex-1 overflow-auto scrollbar-hover p-2 select-text">
            {loadingDiff && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>加载中…</p>
            )}
            {error && (
              <p className="text-[11px]" style={{ color: 'var(--danger)' }}>{error}</p>
            )}
            {diffText != null && !loadingDiff && <DiffViewer unified={diffText} unifiedLanguage={language} before={beforeText} after={afterText} mode={viewMode} />}
            {!selected && !loadingDiff && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>选择文件查看 diff</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

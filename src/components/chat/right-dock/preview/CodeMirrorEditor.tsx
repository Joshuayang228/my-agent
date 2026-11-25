import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Save, X } from 'lucide-react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import { ActionButton } from '../../../foundation/ActionButton'
import { IconButton } from '../../../foundation/IconButton'

interface CodeMirrorEditorProps {
  filePath: string
  content: string
  languageHint?: string
  mtimeMs?: number
  /** 为 true 时禁止编辑（例如 Playground 只读夹具） */
  readOnly?: boolean
  /** 为 true 时隐藏内置顶栏，作为受控源码编辑器嵌入 Markdown/HTML 视图 */
  embedded?: boolean
  onChange?: (nextValue: string) => void
  onDirtyChange?: (dirty: boolean) => void
  onRegisterSaveHandler?: (handler: (() => Promise<{ ok: boolean; error?: string }>) | null) => void
  onSaved?: (nextContent: string, nextMtimeMs: number) => void
}

function getLanguageExtension(languageHint?: string, filePath?: string): Extension[] {
  const hint = (languageHint || '').toLowerCase()
  const ext = filePath ? filePath.split('.').pop()?.toLowerCase() || '' : ''
  const key = hint || ext
  if (key === 'typescript' || key === 'ts') return [javascript({ typescript: true })]
  if (key === 'tsx') return [javascript({ typescript: true, jsx: true })]
  if (key === 'jsx') return [javascript({ jsx: true })]
  if (key === 'javascript' || key === 'js' || key === 'mjs' || key === 'cjs') return [javascript()]
  if (key === 'python' || key === 'py') return [python()]
  if (key === 'json' || key === 'jsonc') return [json()]
  if (key === 'html' || key === 'htm') return [html()]
  if (key === 'css' || key === 'scss') return [css()]
  if (key === 'markdown' || key === 'md') return [markdown()]
  if (key === 'yaml' || key === 'yml') return [yaml()]
  return []
}

const APP_THEME = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12.5px',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  '.cm-scroller': {
    overflow: 'auto',
    lineHeight: '1.65',
    padding: '10px 0',
  },
  '.cm-content': {
    caretColor: 'var(--accent)',
    padding: '0 12px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    borderRight: '1px solid var(--border-subtle)',
    paddingRight: '4px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)',
    color: 'var(--text-secondary)',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 48%, transparent)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 26%, transparent) !important',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--accent)',
  },
})

/**
 * 背景：右侧工作区此前只能以只读 CodeBlock 查看代码/文本/JSON/YAML/HTML，用户想微调几行必须跳去外部编辑器。
 * 设计意图：基于 CodeMirror 6 提供轻量、跟随主题 Token 的原地编辑能力，支持 Ctrl+S 原子写回、mtime 冲突提示与强制覆盖，
 * 并同时以 embedded 模式复用于 Markdown 与 HTML 的「源码」切换视图。
 * 关键约束：绝不在 Playground 只读模式下调用 project:writeFile；组件卸载时必须销毁 EditorView 释放 DOM 监听。
 */
export function CodeMirrorEditor({
  filePath,
  content,
  languageHint,
  mtimeMs,
  readOnly = false,
  embedded = false,
  onChange,
  onDirtyChange,
  onRegisterSaveHandler,
  onSaved,
}: CodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const savedContentRef = useRef(content)
  const currentContentRef = useRef(content)
  const mtimeRef = useRef(mtimeMs)
  const savingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const onDirtyChangeRef = useRef(onDirtyChange)
  onChangeRef.current = onChange
  onDirtyChangeRef.current = onDirtyChange

  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [conflictMtime, setConflictMtime] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const canSave = !readOnly && !embedded && typeof window !== 'undefined' && Boolean(window.electronAPI?.project.writeFile)

  const performSave = useCallback(async (force = false): Promise<{ ok: boolean; error?: string }> => {
    if (!canSave) return { ok: true }
    if (currentContentRef.current === savedContentRef.current && !force) return { ok: true }
    if (savingRef.current) return { ok: false, error: '正在保存中，请稍候' }
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    setConflictMtime(null)
    try {
      const result = await window.electronAPI!.project.writeFile({
        filePath,
        content: currentContentRef.current,
        expectedMtimeMs: force ? undefined : mtimeRef.current,
        force,
      })
      if (!result || !result.ok) {
        const msg = result?.error || '保存失败，请重试'
        setSaveError(msg)
        if (result?.code === 'CONFLICT' && typeof result.currentMtimeMs === 'number') {
          setConflictMtime(result.currentMtimeMs)
        }
        return { ok: false, error: msg }
      }
      savedContentRef.current = currentContentRef.current
      mtimeRef.current = result.mtimeMs
      setDirty(false)
      onDirtyChangeRef.current?.(false)
      onSaved?.(savedContentRef.current, result.mtimeMs)
      return { ok: true }
    } catch {
      const msg = '文件保存失败，可能正被其他应用占用'
      setSaveError(msg)
      return { ok: false, error: msg }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [canSave, filePath, onSaved])

  const performSaveRef = useRef(performSave)
  performSaveRef.current = performSave

  useEffect(() => {
    if (!canSave) return
    onRegisterSaveHandler?.(() => performSaveRef.current(false))
    return () => onRegisterSaveHandler?.(null)
  }, [canSave, onRegisterSaveHandler])

  const langExtensions = useMemo(() => getLanguageExtension(languageHint, filePath), [languageHint, filePath])

  // 初始化或切换文件时重建 EditorView
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    savedContentRef.current = content
    currentContentRef.current = content
    mtimeRef.current = mtimeMs
    setDirty(false)
    setSaveError(null)
    setConflictMtime(null)
    if (!embedded) onDirtyChangeRef.current?.(false)

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          if (canSave) void performSaveRef.current(false)
          return true
        },
      },
    ])

    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return
      const next = update.state.doc.toString()
      currentContentRef.current = next
      onChangeRef.current?.(next)
      if (!embedded) {
        const isDirty = next !== savedContentRef.current
        setDirty(isDirty)
        onDirtyChangeRef.current?.(isDirty)
      }
    })

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        APP_THEME,
        EditorView.lineWrapping,
        ...langExtensions,
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        saveKeymap,
        updateListener,
      ],
    })

    const view = new EditorView({ state, parent: host })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [filePath, langExtensions, readOnly, embedded, canSave])

  // 当外部热刷新或宿主受控值更新时同步到 EditorView
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentDoc = view.state.doc.toString()
    if (content === currentDoc) {
      if (!embedded) {
        savedContentRef.current = content
        mtimeRef.current = mtimeMs
      }
      return
    }
    savedContentRef.current = content
    currentContentRef.current = content
    mtimeRef.current = mtimeMs
    view.dispatch({
      changes: { from: 0, to: currentDoc.length, insert: content },
    })
    if (!embedded) {
      setDirty(false)
      onDirtyChangeRef.current?.(false)
    }
  }, [content, mtimeMs, embedded])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContentRef.current)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch { /* ignore */ }
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="codemirror-editor">
      {!embedded && (
        <div className="workspace-subtoolbar flex shrink-0 select-none items-center justify-between gap-2 border-b px-3 text-[11px]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase" style={{ color: 'var(--text-muted)' }}>
              {languageHint || filePath.split('.').pop() || 'text'}
            </span>
            {dirty && (
              <span className="text-[10.5px]" style={{ color: 'var(--warning)' }}>
                未保存
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <IconButton
              label={copied ? '已复制' : '复制代码'}
              size={24}
              style={{ color: copied ? 'var(--success)' : 'var(--text-muted)' }}
              onClick={() => { void handleCopy() }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </IconButton>
            {canSave && (
              <ActionButton
                size="sm"
                tone="accent"
                disabled={saving || !dirty}
                onClick={() => { void performSave(false) }}
              >
                <Save size={12} />
                <span>{saving ? '保存中…' : '保存'}</span>
              </ActionButton>
            )}
          </div>
        </div>
      )}

      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden" />

      {!embedded && saveError && (
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2 text-[11px]"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--danger)' }}
          role="alert"
        >
          <span className="min-w-0 flex-1 truncate">{saveError}</span>
          <div className="flex shrink-0 items-center gap-1">
            {conflictMtime !== null && (
              <ActionButton size="sm" tone="danger" onClick={() => { void performSave(true) }}>
                强制覆盖
              </ActionButton>
            )}
            <IconButton label="关闭保存错误" size={24} onClick={() => setSaveError(null)}>
              <X size={12} />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  )
}

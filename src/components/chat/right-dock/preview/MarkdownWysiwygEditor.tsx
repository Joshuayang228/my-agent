import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Save, X } from 'lucide-react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { ActionButton } from '../../../foundation/ActionButton'
import { IconButton } from '../../../foundation/IconButton'
import { SegmentedControl } from '../../../foundation/SegmentedControl'
import { AnnotationBar } from './AnnotationBar'
import { CodeMirrorEditor } from './CodeMirrorEditor'
import { formatDocxSelectionAnnotation, type AnnotationQueueItem } from './annotation-format'
import { joinYamlFrontmatter, splitYamlFrontmatter } from './markdown-frontmatter'

interface MarkdownWysiwygEditorProps {
  filePath: string
  content: string
  mtimeMs?: number
  readOnly?: boolean
  onDirtyChange?: (dirty: boolean) => void
  onRegisterSaveHandler?: (handler: (() => Promise<{ ok: boolean; error?: string }>) | null) => void
  onSendToChat?: (text: string) => void
  onQueueAnnotation?: (item: Omit<AnnotationQueueItem, 'id' | 'createdAt'>) => void
}

/**
 * 背景：用户希望在右侧工作区直接像 Typora 一样所见即所得阅读和修改 Markdown，并可随时切源码模式。
 * 设计意图：以 TipTap v3 + 官方 @tiptap/markdown 承载实时所见即所得编辑（支持标题、列表、任务清单、GFM 表格与代码块），
 * 用 splitYamlFrontmatter / joinYamlFrontmatter 保护头部 YAML Frontmatter 不在往返中丢失；
 * 源码模式复用 CodeMirrorEditor；同时保留划词批注、Ctrl+S 手动保存与全场景未保存防丢保护。
 * 关键约束：仅在用户实际编辑后标记 dirty，避免首次解析归一化误触发未保存红点；Playground 只读态禁止调用写回 IPC。
 */
export function MarkdownWysiwygEditor({
  filePath,
  content,
  mtimeMs,
  readOnly = false,
  onDirtyChange,
  onRegisterSaveHandler,
  onSendToChat,
  onQueueAnnotation,
}: MarkdownWysiwygEditorProps) {
  const initialSplit = useMemo(() => splitYamlFrontmatter(content), [content])
  const [mode, setMode] = useState<'wysiwyg' | 'source'>('wysiwyg')
  const [frontmatter, setFrontmatter] = useState(initialSplit.frontmatter)
  const [draftMarkdown, setDraftMarkdown] = useState(content)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [conflictMtime, setConflictMtime] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedText, setSelectedText] = useState('')

  const savedContentRef = useRef(content)
  const draftRef = useRef(content)
  const frontmatterRef = useRef(initialSplit.frontmatter)
  const mtimeRef = useRef(mtimeMs)
  const savingRef = useRef(false)
  const suppressNextUpdateRef = useRef(false)
  const wysiwygContainerRef = useRef<HTMLDivElement>(null)
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange

  const canSave = !readOnly && typeof window !== 'undefined' && Boolean(window.electronAPI?.project.writeFile)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TableKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: '开始输入 Markdown 内容…' }),
      Markdown,
    ],
    editable: !readOnly,
    content: initialSplit.body,
    contentType: 'markdown',
    onUpdate: ({ editor: instance }) => {
      if (suppressNextUpdateRef.current) {
        suppressNextUpdateRef.current = false
        return
      }
      const serializedBody = typeof instance.getMarkdown === 'function'
        ? instance.getMarkdown()
        : instance.getText()
      const combined = joinYamlFrontmatter(frontmatterRef.current, serializedBody)
      draftRef.current = combined
      setDraftMarkdown(combined)
      const nextDirty = combined !== savedContentRef.current
      setDirty(nextDirty)
      onDirtyChangeRef.current?.(nextDirty)
    },
  })

  // 切换文件或外部热刷新时重置编辑器状态
  useEffect(() => {
    const split = splitYamlFrontmatter(content)
    savedContentRef.current = content
    draftRef.current = content
    frontmatterRef.current = split.frontmatter
    mtimeRef.current = mtimeMs
    setFrontmatter(split.frontmatter)
    setDraftMarkdown(content)
    setDirty(false)
    setSaveError(null)
    setConflictMtime(null)
    setSelectedText('')
    onDirtyChangeRef.current?.(false)

    if (editor) {
      suppressNextUpdateRef.current = true
      editor.commands.setContent(split.body, { contentType: 'markdown' })
    }
  }, [filePath, content, mtimeMs, editor])

  const performSave = useCallback(async (force = false): Promise<{ ok: boolean; error?: string }> => {
    if (!canSave) return { ok: true }
    if (draftRef.current === savedContentRef.current && !force) return { ok: true }
    if (savingRef.current) return { ok: false, error: '正在保存中，请稍候' }
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    setConflictMtime(null)
    try {
      const result = await window.electronAPI!.project.writeFile({
        filePath,
        content: draftRef.current,
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
      savedContentRef.current = draftRef.current
      mtimeRef.current = result.mtimeMs
      setDirty(false)
      onDirtyChangeRef.current?.(false)
      return { ok: true }
    } catch {
      const msg = '文件保存失败，可能正被其他应用占用'
      setSaveError(msg)
      return { ok: false, error: msg }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [canSave, filePath])

  const performSaveRef = useRef(performSave)
  performSaveRef.current = performSave

  useEffect(() => {
    if (!canSave) return
    onRegisterSaveHandler?.(() => performSaveRef.current(false))
    return () => onRegisterSaveHandler?.(null)
  }, [canSave, onRegisterSaveHandler])

  useEffect(() => {
    if (!canSave) return
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void performSaveRef.current(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canSave])

  const handleModeChange = (nextMode: string) => {
    const target = nextMode as 'wysiwyg' | 'source'
    if (target === mode) return
    if (target === 'wysiwyg' && editor) {
      const split = splitYamlFrontmatter(draftRef.current)
      frontmatterRef.current = split.frontmatter
      setFrontmatter(split.frontmatter)
      suppressNextUpdateRef.current = true
      editor.commands.setContent(split.body, { contentType: 'markdown' })
    }
    setMode(target)
  }

  const handleSourceChange = useCallback((nextSource: string) => {
    draftRef.current = nextSource
    setDraftMarkdown(nextSource)
    const split = splitYamlFrontmatter(nextSource)
    frontmatterRef.current = split.frontmatter
    setFrontmatter(split.frontmatter)
    const nextDirty = nextSource !== savedContentRef.current
    setDirty(nextDirty)
    onDirtyChangeRef.current?.(nextDirty)
  }, [])

  const captureSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !wysiwygContainerRef.current) return
    const anchor = selection.anchorNode
    const focus = selection.focusNode
    if (!anchor || !focus) return
    if (!wysiwygContainerRef.current.contains(anchor) || !wysiwygContainerRef.current.contains(focus)) return
    const text = selection.toString().replace(/\s+/g, ' ').trim()
    if (text) setSelectedText(text.slice(0, 600))
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftRef.current)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch { /* ignore */ }
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="markdown-wysiwyg-editor">
      <div className="workspace-subtoolbar flex shrink-0 select-none items-center justify-between gap-2 border-b px-3 text-[11px]">
        <div className="flex min-w-0 items-center gap-2">
          <SegmentedControl
            ariaLabel="Markdown 编辑模式切换"
            value={mode}
            onChange={handleModeChange}
            items={[
              { id: 'wysiwyg', label: '所见即所得' },
              { id: 'source', label: '源码' },
            ]}
          />
          {frontmatter && mode === 'wysiwyg' && (
            <span
              className="hidden truncate text-[10.5px] sm:inline"
              style={{ color: 'var(--text-muted)' }}
              title="头部 YAML Frontmatter 已原样保留，切至源码模式可编辑"
            >
              Frontmatter 已保留
            </span>
          )}
          {dirty && (
            <span className="text-[10.5px]" style={{ color: 'var(--warning)' }}>
              未保存
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <IconButton
            label={copied ? '已复制' : '复制 Markdown'}
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

      {mode === 'wysiwyg' ? (
        <div
          ref={wysiwygContainerRef}
          className="workspace-surface-stage min-h-0 flex-1 overflow-auto px-5 py-6 sm:px-8"
          onMouseUp={captureSelection}
          onKeyUp={captureSelection}
        >
          <div className="workspace-surface-paper mx-auto min-h-[360px] max-w-[740px] rounded-[var(--radius-card)] border px-7 py-6">
            <EditorContent editor={editor} className="markdown-wysiwyg-prose" />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <CodeMirrorEditor
            filePath={filePath}
            content={draftMarkdown}
            languageHint="markdown"
            readOnly={readOnly}
            embedded
            onChange={handleSourceChange}
          />
        </div>
      )}

      {saveError && (
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

      {mode === 'wysiwyg' && (onSendToChat || onQueueAnnotation) && (
        <AnnotationBar
          testId="markdown-annotation-bar"
          anchorLabel={selectedText ? `已划选 ${selectedText.length} 字` : '整篇文档'}
          selectionActive={Boolean(selectedText)}
          quickTriggerLabel="批注全文"
          excerpt={selectedText || '划选上方任意文字可精准引用片段，或针对整篇文档写批注'}
          emptyHint="划选正文片段即可引用批注，或点击右侧针对全文提问"
          placeholder="例如：帮我把这段表述润色得更凝练…"
          onClearAnchor={selectedText ? () => setSelectedText('') : undefined}
          onAddToQueue={onQueueAnnotation ? (comment) => {
            onQueueAnnotation({
              filePath,
              anchorLabel: selectedText ? `已划选 ${selectedText.length} 字` : '整篇文档',
              excerpt: selectedText || undefined,
              comment,
              formattedText: formatDocxSelectionAnnotation({
                filePath,
                selectedText,
                comment,
              }),
            })
          } : undefined}
          onSubmit={(comment) => {
            onSendToChat?.(formatDocxSelectionAnnotation({
              filePath,
              selectedText,
              comment,
            }))
          }}
        />
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, FileText, Info, Loader2 } from 'lucide-react'
import { EmptyState } from '../../../foundation/EmptyState'
import { IconButton } from '../../../foundation/IconButton'
import { SegmentedControl } from '../../../foundation/SegmentedControl'
import { AnnotationBar } from './AnnotationBar'
import { PdfPreview } from './PdfPreview'
import { formatDocxSelectionAnnotation, sanitizeDocxHtml, type AnnotationQueueItem } from './annotation-format'

interface DocxPreviewProps {
  filePath: string
  htmlContent: string
  /** 原始 .docx 二进制的 base64 载荷，存在时优先使用 docx-preview 秒开高保真渲染 */
  docxBase64?: string
  /** 本机是否检测到 WPS / Office / LibreOffice 可用于导出原版 PDF 视图 */
  nativePdfAvailable?: boolean
  /** 转换过程中的温和提示（例如未支持的高级样式） */
  notices?: string[]
  onOpenExternal?: () => void
  onSendToChat?: (text: string) => void
  onQueueAnnotation?: (item: Omit<AnnotationQueueItem, 'id' | 'createdAt'>) => void
}

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer | null {
  if (!base64 || typeof atob !== 'function') return null
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes.buffer
  } catch {
    return null
  }
}

/**
 * 背景：用户希望在右侧工作区高保真阅读 Word（.docx）文档（含复杂简历布局表与分栏），并划选关键段落批注发回对话。
 * 设计意图：有 docxBase64 时默认使用 docx-preview 秒开还原版面并保留划词批注；检测到本机办公套件时提供「原版 PDF」切换，
 * 调用主进程静默转 PDF 缓存后复用 PdfPreview Canvas+划词呈现像素级分页；无二进制载荷或渲染异常时自动降级到清洗后的语义 HTML。
 * 关键约束：降级 HTML 必须经 sanitizeDocxHtml 清洗；仅捕获归属本容器内的划词，避免误抓聊天区文字。
 */
export function DocxPreview({
  filePath,
  htmlContent,
  docxBase64,
  nativePdfAvailable = false,
  notices,
  onOpenExternal,
  onSendToChat,
  onQueueAnnotation,
}: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const docxHostRef = useRef<HTMLDivElement>(null)
  const docxStyleRef = useRef<HTMLDivElement>(null)
  const [selectedText, setSelectedText] = useState('')
  const [viewMode, setViewMode] = useState<'rich' | 'nativePdf'>('rich')
  const [docxRenderFailed, setDocxRenderFailed] = useState(false)
  const [docxRendering, setDocxRendering] = useState(false)
  const [nativePdfBase64, setNativePdfBase64] = useState<string | null>(null)
  const [nativePdfLoading, setNativePdfLoading] = useState(false)
  const [nativePdfError, setNativePdfError] = useState<string | null>(null)

  const canConvertNativePdf = Boolean(
    nativePdfAvailable && typeof window !== 'undefined' && window.electronAPI?.project.convertOfficeToPdf,
  )

  useEffect(() => {
    setSelectedText('')
    setViewMode('rich')
    setDocxRenderFailed(false)
    setNativePdfBase64(null)
    setNativePdfLoading(false)
    setNativePdfError(null)
  }, [filePath, htmlContent, docxBase64])

  const useDocxPreviewEngine = Boolean(docxBase64 && !docxRenderFailed)

  // 使用 docx-preview 渲染高保真 Word 版面
  useEffect(() => {
    if (viewMode !== 'rich' || !useDocxPreviewEngine || !docxBase64) return
    const host = docxHostRef.current
    const styleHost = docxStyleRef.current
    if (!host || !styleHost) return

    let cancelled = false
    setDocxRendering(true)
    host.innerHTML = ''
    styleHost.innerHTML = ''

    const buf = decodeBase64ToArrayBuffer(docxBase64)
    if (!buf) {
      setDocxRenderFailed(true)
      setDocxRendering(false)
      return
    }

    void import('docx-preview')
      .then(async (docx) => {
        if (cancelled) return
        await docx.renderAsync(buf, host, styleHost, {
          className: 'docx-preview-doc',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: true,
          breakPages: true,
          useBase64URL: true,
        })
      })
      .catch(() => {
        if (!cancelled) setDocxRenderFailed(true)
      })
      .finally(() => {
        if (!cancelled) setDocxRendering(false)
      })

    return () => {
      cancelled = true
    }
  }, [viewMode, useDocxPreviewEngine, docxBase64])

  // 按需调用本机 WPS/Office/LibreOffice 静默转 PDF（有主进程缓存）
  useEffect(() => {
    if (viewMode !== 'nativePdf' || !canConvertNativePdf || nativePdfBase64 || nativePdfLoading) return
    let cancelled = false
    setNativePdfLoading(true)
    setNativePdfError(null)
    void window.electronAPI?.project.convertOfficeToPdf(filePath)
      .then((res) => {
        if (cancelled) return
        if (res?.ok && res.pdfBase64) {
          setNativePdfBase64(res.pdfBase64)
        } else {
          setNativePdfError(res?.ok === false ? res.error : '本机原版视图转换失败，已切回高保真视图')
          setViewMode('rich')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNativePdfError('本机原版视图转换失败，已切回高保真视图')
          setViewMode('rich')
        }
      })
      .finally(() => {
        if (!cancelled) setNativePdfLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [viewMode, canConvertNativePdf, filePath, nativePdfBase64, nativePdfLoading])

  const safeHtml = useMemo(() => sanitizeDocxHtml(htmlContent), [htmlContent])

  const captureSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !containerRef.current) return
    const anchor = selection.anchorNode
    const focus = selection.focusNode
    if (!anchor || !focus) return
    if (!containerRef.current.contains(anchor) || !containerRef.current.contains(focus)) return
    const text = selection.toString().replace(/\s+/g, ' ').trim()
    if (text) setSelectedText(text.slice(0, 600))
  }

  if (!useDocxPreviewEngine && !safeHtml.trim()) {
    return (
      <div className="workspace-surface-stage flex h-full flex-col" data-testid="docx-preview-empty">
        <EmptyState
          variant="minimal"
          icon={<FileText size={18} />}
          title="暂无可展示内容"
          description="该 Word 文档没有可展示的正文内容。"
        />
      </div>
    )
  }

  const viewToggle = canConvertNativePdf ? (
    <SegmentedControl
      ariaLabel="Word 视图切换"
      value={viewMode}
      onChange={(id) => setViewMode(id as 'rich' | 'nativePdf')}
      items={[
        { id: 'rich', label: '高保真视图' },
        { id: 'nativePdf', label: '原版 PDF' },
      ]}
    />
  ) : null

  if (viewMode === 'nativePdf') {
    if (nativePdfLoading && !nativePdfBase64) {
      return (
        <div className="flex h-full min-h-0 flex-col" data-testid="docx-preview">
          <div className="workspace-subtoolbar flex shrink-0 select-none items-center justify-between gap-2 border-b px-3 text-[11px]">
            {viewToggle}
            {onOpenExternal && (
              <IconButton label="用系统应用打开" size={24} style={{ color: 'var(--text-muted)' }} onClick={onOpenExternal}>
                <ExternalLink size={12} />
              </IconButton>
            )}
          </div>
          <div className="workspace-surface-stage flex min-h-0 flex-1 items-center justify-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={14} className="animate-spin" />
            <span>正在通过本机办公套件生成原版分页视图（首次约 1~3 秒，后续秒开）…</span>
          </div>
        </div>
      )
    }

    if (nativePdfBase64) {
      return (
        <div className="flex h-full min-h-0 flex-col" data-testid="docx-preview">
          <PdfPreview
            filePath={filePath}
            pages={[]}
            pdfBase64={nativePdfBase64}
            leadingControl={viewToggle}
            onSendToChat={onSendToChat}
            onQueueAnnotation={onQueueAnnotation}
          />
        </div>
      )
    }
  }

  const noticeText = nativePdfError || notices?.[0]

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="docx-preview">
      {(viewToggle || noticeText || onOpenExternal) && (
        <div className="workspace-subtoolbar flex shrink-0 select-none items-center justify-between gap-2 border-b px-3 text-[11px]">
          <div className="flex min-w-0 items-center gap-2">
            {viewToggle ?? (
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Word 文档</span>
            )}
            {noticeText && (
              <span
                className="inline-flex items-center"
                style={{ color: nativePdfError ? 'var(--warning)' : 'var(--text-muted)' }}
                title={noticeText}
                aria-label={noticeText}
              >
                <Info size={12} aria-hidden="true" />
              </span>
            )}
          </div>
          {onOpenExternal && (
            <IconButton label="用系统应用打开" size={24} style={{ color: 'var(--text-muted)' }} onClick={onOpenExternal}>
              <ExternalLink size={12} />
            </IconButton>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className="workspace-surface-stage min-h-0 flex-1 overflow-auto p-4 select-text sm:p-6"
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
      >
        {useDocxPreviewEngine ? (
          <div className="relative mx-auto w-full max-w-[820px]">
            <div ref={docxStyleRef} />
            {docxRendering && (
              <div className="flex items-center justify-center gap-2 py-12 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={14} className="animate-spin" />
                <span>正在加载 Word 版面…</span>
              </div>
            )}
            <div ref={docxHostRef} className="docx-preview-host" data-testid="docx-rich-host" />
          </div>
        ) : (
          <article
            className="workspace-surface-paper docx-prose mx-auto max-w-[680px] rounded-[var(--radius-card)] border px-7 py-6 text-[13.5px] leading-7"
            style={{ color: 'var(--text-primary)' }}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        )}
      </div>

      {(onSendToChat || onQueueAnnotation) && (
        <AnnotationBar
          testId="docx-annotation-bar"
          anchorLabel={selectedText ? `已划选 ${selectedText.length} 字` : '整篇文档'}
          selectionActive={Boolean(selectedText)}
          quickTriggerLabel="批注全文"
          excerpt={selectedText || '划选上方任意文字可精准引用片段，或针对整篇文档写批注'}
          emptyHint="划选正文片段即可引用批注，或点击右侧针对全文提问"
          placeholder="例如：帮我把这段表述改得更简洁专业…"
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

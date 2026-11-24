import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, FileWarning, Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { EmptyState } from '../../../foundation/EmptyState'
import { ErrorState } from '../../../foundation/ErrorState'
import { IconButton } from '../../../foundation/IconButton'
import { SegmentedControl } from '../../../foundation/SegmentedControl'
import { AnnotationBar } from './AnnotationBar'
import { formatPdfPageAnnotation, type AnnotationQueueItem } from './annotation-format'

export interface PdfPreviewPage {
  pageNumber: number
  /** 渲染完成的页面图像（data URL / SVG data URL / Canvas 导出图） */
  imageUrl?: string
  /** 纯文本兜底或扫描页摘要 */
  fallbackText?: string
}

interface PdfPreviewProps {
  filePath: string
  pages: PdfPreviewPage[]
  /** 真实 PDF 文件的 base64 载荷，存在时默认使用 pdfjs-dist Canvas 高清渲染 + 透明文字层划词 */
  pdfBase64?: string
  /** 损坏/加密等错误态 */
  error?: string
  /** 外部（如 Word/PPT 原版 PDF 视图）注入到子工具栏左侧的切换控件 */
  leadingControl?: ReactNode
  /** 当外部已管理自己的底部批注条或备注区时，可选择隐藏内置批注条 */
  hideAnnotationBar?: boolean
  /** 供外部（如 PPT 原版视图）同步当前页码变化 */
  onPageChange?: (pageNumber: number, totalPages: number) => void
  onSendToChat?: (text: string) => void
  onQueueAnnotation?: (item: Omit<AnnotationQueueItem, 'id' | 'createdAt'>) => void
}

const ZOOM_STEPS = [75, 100, 125, 150] as const

let pdfWorkerConfigured = false

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfWorkerConfigured) {
    const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default
    pdfWorkerConfigured = true
  }
  return pdfjs
}

function decodeBase64ToBytes(base64: string): Uint8Array | null {
  if (!base64 || typeof atob !== 'function') return null
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/**
 * 背景：内置 Chromium `<iframe src="blob:...">` 会带出深黑原生工具栏且无法捕获划词批注；文字页此前写死纯白纸色导致深色模式割裂。
 * 设计意图：有真实 pdfBase64 时使用 pdfjs-dist Canvas 按 devicePixelRatio 高清渲染并叠加透明 TextLayer 支持划词，
 * 同时保留「原版预览 / 文字页」切换与 75%~150% 缩放；可被 Word/PPT 原版 PDF 视图直接复用。
 * 关键约束：切页、缩放、切换文件或卸载时必须取消在途 RenderTask 与 TextLayer 并销毁 PDFDocumentProxy 防止内存泄漏。
 */
export function PdfPreview({
  filePath,
  pages,
  pdfBase64,
  error,
  leadingControl,
  hideAnnotationBar = false,
  onPageChange,
  onSendToChat,
  onQueueAnnotation,
}: PdfPreviewProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [zoomIndex, setZoomIndex] = useState(1)
  const [mode, setMode] = useState<'native' | 'text'>(pdfBase64 ? 'native' : 'text')
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [pdfNumPages, setPdfNumPages] = useState(0)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfRenderError, setPdfRenderError] = useState<string | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const selectionScopeRef = useRef<HTMLDivElement>(null)

  const pdfBytes = useMemo(() => (pdfBase64 ? decodeBase64ToBytes(pdfBase64) : null), [pdfBase64])

  useEffect(() => {
    setPageIndex(0)
    setZoomIndex(1)
    setSelectedText('')
    setPdfRenderError(null)
    setMode(pdfBytes ? 'native' : 'text')
  }, [filePath, pages, pdfBytes])

  // 加载 PDFDocumentProxy（仅在存在真实 pdfBytes 时执行）
  useEffect(() => {
    if (!pdfBytes) {
      setPdfDoc(null)
      setPdfNumPages(0)
      setPdfLoading(false)
      return
    }
    let cancelled = false
    let loadingTask: { destroy: () => Promise<void> } | null = null
    setPdfLoading(true)
    setPdfRenderError(null)

    void loadPdfJs()
      .then(async (pdfjs) => {
        // 传入拷贝避免 pdfjs transfer 原缓冲区导致二次重载失败
        const task = pdfjs.getDocument({ data: pdfBytes.slice() })
        loadingTask = task
        const doc = await task.promise
        if (cancelled) {
          void task.destroy()
          return
        }
        setPdfDoc(doc)
        setPdfNumPages(doc.numPages)
      })
      .catch(() => {
        if (!cancelled) {
          setPdfRenderError('原版 PDF 渲染失败，已自动保留文字页视图')
          setPdfDoc(null)
          setPdfNumPages(0)
          if (pages.length > 0) setMode('text')
        }
      })
      .finally(() => {
        if (!cancelled) setPdfLoading(false)
      })

    return () => {
      cancelled = true
      if (loadingTask) void loadingTask.destroy()
    }
  }, [pdfBytes, pages.length])

  const totalPages = Math.max(pdfNumPages, pages.length, pdfBytes ? 1 : 0)
  const safeIndex = totalPages > 0 ? Math.min(Math.max(0, pageIndex), totalPages - 1) : 0
  const current: PdfPreviewPage = pages[safeIndex] ?? { pageNumber: safeIndex + 1 }
  const zoom = ZOOM_STEPS[zoomIndex]
  const effectiveMode = pdfBytes && !pdfRenderError ? mode : 'text'
  const fileName = filePath.split(/[/\\]/).pop() || filePath

  useEffect(() => {
    setSelectedText('')
    if (totalPages > 0) onPageChange?.(safeIndex + 1, totalPages)
  }, [safeIndex, totalPages, onPageChange])

  // 渲染当前页 Canvas + 透明 TextLayer
  useEffect(() => {
    if (effectiveMode !== 'native' || !pdfDoc) return
    let cancelled = false
    let renderTask: RenderTask | null = null
    let textLayerInstance: { cancel?: () => void } | null = null

    void (async () => {
      try {
        const pdfjs = await loadPdfJs()
        const pageNumber = Math.min(Math.max(1, safeIndex + 1), pdfDoc.numPages)
        const page = await pdfDoc.getPage(pageNumber)
        if (cancelled) return

        // 以 640px 为 100% 基准页宽，随缩放档位平滑放大缩小
        const baseViewport = page.getViewport({ scale: 1 })
        const targetWidth = 640 * (zoom / 100)
        const scale = targetWidth / Math.max(1, baseViewport.width)
        const viewport = page.getViewport({ scale })
        const dpr = Math.min(window.devicePixelRatio || 1, 2)

        setPageDimensions({ width: Math.round(viewport.width), height: Math.round(viewport.height) })

        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        renderTask = page.render({
          canvas,
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        })
        await renderTask.promise
        if (cancelled) return

        const textContainer = textLayerRef.current
        if (textContainer && typeof pdfjs.TextLayer === 'function') {
          textContainer.innerHTML = ''
          textContainer.style.setProperty('--scale-factor', String(viewport.scale))
          const textContent = await page.getTextContent()
          if (cancelled) return
          const textLayer = new pdfjs.TextLayer({
            textContentSource: textContent,
            container: textContainer,
            viewport,
          })
          textLayerInstance = textLayer
          await textLayer.render()
        }
      } catch (err) {
        const name = err instanceof Error ? err.name : ''
        if (!cancelled && name !== 'RenderingCancelledException') {
          setPdfRenderError('当前页面渲染异常，可切换文字页继续阅读')
        }
      }
    })()

    return () => {
      cancelled = true
      try { renderTask?.cancel() } catch { /* ignore */ }
      try { textLayerInstance?.cancel?.() } catch { /* ignore */ }
    }
  }, [effectiveMode, pdfDoc, safeIndex, zoom])

  const captureSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selectionScopeRef.current) return
    const anchor = selection.anchorNode
    const focus = selection.focusNode
    if (!anchor || !focus) return
    if (!selectionScopeRef.current.contains(anchor) || !selectionScopeRef.current.contains(focus)) return
    const text = selection.toString().replace(/\s+/g, ' ').trim()
    if (text) setSelectedText(text.slice(0, 600))
  }

  if (error) {
    return (
      <div className="workspace-surface-stage flex h-full flex-col p-4" data-testid="pdf-preview-error">
        <ErrorState className="m-auto w-full max-w-md" title="无法打开 PDF" description={error} />
      </div>
    )
  }

  if (totalPages === 0) {
    return (
      <div className="workspace-surface-stage flex h-full flex-col" data-testid="pdf-preview-empty">
        <EmptyState
          variant="minimal"
          icon={<FileWarning size={18} />}
          title="暂无可渲染页面"
          description="该 PDF 没有可渲染的页面。"
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="pdf-preview">
      <div className="workspace-subtoolbar grid shrink-0 select-none grid-cols-3 items-center gap-2 border-b px-3 text-[11px]">
        <div className="flex items-center justify-start gap-2">
          {leadingControl ? leadingControl : pdfBytes && pages.length > 0 ? (
            <SegmentedControl
              ariaLabel="PDF 视图切换"
              value={effectiveMode}
              onChange={(id) => setMode(id as 'native' | 'text')}
              items={[
                { id: 'native', label: '原版预览' },
                { id: 'text', label: '文字页' },
              ]}
            />
          ) : (
            <span className="truncate font-medium" style={{ color: 'var(--text-secondary)' }}>
              {pdfBytes ? 'PDF 原版' : 'PDF 文字页'}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-1">
          <IconButton
            label="上一页"
            size={24}
            disabled={safeIndex <= 0}
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft size={14} />
          </IconButton>
          <span className="min-w-[52px] text-center font-mono text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            {safeIndex + 1} / {totalPages}
          </span>
          <IconButton
            label="下一页"
            size={24}
            disabled={safeIndex >= totalPages - 1}
            onClick={() => setPageIndex((i) => Math.min(totalPages - 1, i + 1))}
          >
            <ChevronRight size={14} />
          </IconButton>
        </div>

        <div className="flex items-center justify-end gap-1">
          <IconButton
            label="缩小"
            size={24}
            disabled={zoomIndex <= 0}
            onClick={() => setZoomIndex((z) => Math.max(0, z - 1))}
          >
            <ZoomOut size={13} />
          </IconButton>
          <span className="min-w-[38px] text-center font-mono text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            {zoom}%
          </span>
          <IconButton
            label="放大"
            size={24}
            disabled={zoomIndex >= ZOOM_STEPS.length - 1}
            onClick={() => setZoomIndex((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
          >
            <ZoomIn size={13} />
          </IconButton>
        </div>
      </div>

      <div
        ref={selectionScopeRef}
        className="workspace-surface-stage min-h-0 flex-1 overflow-auto p-5 sm:p-6"
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
      >
        {effectiveMode === 'native' && pdfBytes ? (
          <div className="flex min-h-full flex-col items-center">
            {pdfLoading && !pdfDoc ? (
              <div className="m-auto flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={14} className="animate-spin" />
                <span>正在渲染 PDF 页面…</span>
              </div>
            ) : (
              <div
                className="relative overflow-hidden rounded-[var(--radius-card)] border shadow-sm"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: '#ffffff',
                  width: pageDimensions?.width,
                  height: pageDimensions?.height,
                }}
                data-testid="pdf-canvas-page"
              >
                <canvas ref={canvasRef} className="block" />
                <div
                  ref={textLayerRef}
                  className="pdf-text-layer absolute inset-0 select-text overflow-hidden leading-none"
                />
              </div>
            )}
          </div>
        ) : (
          <div
            className="workspace-surface-paper mx-auto overflow-hidden rounded-[var(--radius-card)] border transition-all"
            style={{
              width: `${zoom}%`,
              maxWidth: zoom <= 100 ? 640 : 960,
              color: 'var(--text-primary)',
            }}
          >
            {current.imageUrl ? (
              <img
                src={current.imageUrl}
                alt={`${filePath} 第 ${current.pageNumber} 页`}
                className="block w-full select-none"
              />
            ) : (
              <div className="select-text px-8 py-6">
                <div
                  className="mb-4 flex select-none items-center justify-between border-b pb-2.5 text-[10.5px]"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                >
                  <span className="truncate">{fileName}</span>
                  <span className="shrink-0 font-mono tabular-nums">第 {current.pageNumber} 页</span>
                </div>
                <div className="whitespace-pre-wrap text-[13px] leading-7" style={{ color: 'var(--text-primary)' }}>
                  {current.fallbackText || '（空白页或纯图片扫描页）'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!hideAnnotationBar && (onSendToChat || onQueueAnnotation) && (
        <AnnotationBar
          testId="pdf-annotation-bar"
          anchorLabel={selectedText ? `第 ${safeIndex + 1} 页 · 已划选 ${selectedText.length} 字` : `第 ${safeIndex + 1} 页`}
          selectionActive={Boolean(selectedText)}
          quickTriggerLabel="批注本页"
          excerpt={selectedText || `共 ${totalPages} 页 · ${fileName}`}
          emptyHint="划选页面文字即可引用批注，或点击右侧针对本页提问"
          placeholder="例如：帮我总结这一页的核心结论和待办项…"
          onClearAnchor={selectedText ? () => setSelectedText('') : undefined}
          onAddToQueue={onQueueAnnotation ? (comment) => {
            onQueueAnnotation({
              filePath,
              anchorLabel: selectedText ? `第 ${safeIndex + 1} 页 · 划词` : `第 ${safeIndex + 1} 页`,
              excerpt: selectedText || `共 ${totalPages} 页`,
              comment,
              formattedText: formatPdfPageAnnotation({
                filePath,
                pageNumber: safeIndex + 1,
                totalPages,
                selectedText: selectedText || undefined,
                comment,
              }),
            })
          } : undefined}
          onSubmit={(comment) => {
            onSendToChat?.(formatPdfPageAnnotation({
              filePath,
              pageNumber: safeIndex + 1,
              totalPages,
              selectedText: selectedText || undefined,
              comment,
            }))
          }}
        />
      )}
    </div>
  )
}

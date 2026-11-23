import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FileWarning, ZoomIn, ZoomOut } from 'lucide-react'
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
  /** 真实 PDF 文件的 base64 载荷，存在时默认使用内置 Chromium PDF 原版预览并支持切换文字页视图 */
  pdfBase64?: string
  /** 损坏/加密等错误态 */
  error?: string
  onSendToChat?: (text: string) => void
  onQueueAnnotation?: (item: Omit<AnnotationQueueItem, 'id' | 'createdAt'>) => void
}

const ZOOM_STEPS = [75, 100, 125, 150] as const

/**
 * 背景：用户需要在右侧工作区逐页浏览 PDF 文档，并按页码写批注发回对话。
 * 设计意图：当主进程提供真实 pdfBase64 时，利用 Blob URL + Electron 内置 PDF 查看器提供原版高保真渲染，
 * 并允许一键切换到「文字页」逐页阅读；无二进制流时（如 Playground 样张）直接进入逐页阅读模式。
 * 关键约束：Blob URL 必须在依赖变化或卸载时 revokeObjectURL 防内存泄漏；页码始终钳制在有效范围。
 */
export function PdfPreview({
  filePath,
  pages,
  pdfBase64,
  error,
  onSendToChat,
  onQueueAnnotation,
}: PdfPreviewProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [zoomIndex, setZoomIndex] = useState(1)
  const [mode, setMode] = useState<'native' | 'text'>(pdfBase64 ? 'native' : 'text')

  useEffect(() => {
    setPageIndex(0)
    setZoomIndex(1)
    setMode(pdfBase64 ? 'native' : 'text')
  }, [filePath, pages, pdfBase64])

  const pdfBlobUrl = useMemo(() => {
    if (!pdfBase64 || typeof window === 'undefined' || typeof atob !== 'function') return null
    try {
      const binary = atob(pdfBase64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      return URL.createObjectURL(blob)
    } catch {
      return null
    }
  }, [pdfBase64])

  useEffect(() => {
    if (!pdfBlobUrl) return
    return () => URL.revokeObjectURL(pdfBlobUrl)
  }, [pdfBlobUrl])

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center" role="alert" data-testid="pdf-preview-error">
        <FileWarning size={20} style={{ color: 'var(--danger)' }} />
        <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    )
  }

  const totalPages = Math.max(pages.length, pdfBlobUrl ? 1 : 0)
  if (totalPages === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center" data-testid="pdf-preview-empty">
        <FileWarning size={20} style={{ color: 'var(--text-muted)' }} />
        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>该 PDF 没有可渲染的页面。</p>
      </div>
    )
  }

  const safeIndex = Math.min(Math.max(0, pageIndex), totalPages - 1)
  const current: PdfPreviewPage = pages[safeIndex] ?? { pageNumber: safeIndex + 1 }
  const zoom = ZOOM_STEPS[zoomIndex]
  const effectiveMode = pdfBlobUrl ? mode : 'text'

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="pdf-preview">
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5 text-[11px]"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-2">
          {pdfBlobUrl && (
            <SegmentedControl
              ariaLabel="PDF 视图切换"
              value={effectiveMode}
              onChange={(id) => setMode(id as 'native' | 'text')}
              items={[
                { id: 'native', label: '原版预览' },
                { id: 'text', label: '文字页' },
              ]}
            />
          )}
          <div className="flex items-center gap-1">
            <IconButton
              label="上一页"
              size={24}
              disabled={safeIndex <= 0}
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft size={14} />
            </IconButton>
            <span className="min-w-[54px] text-center font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {current.pageNumber} / {totalPages}
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
        </div>

        {effectiveMode === 'text' && (
          <div className="flex items-center gap-1">
            <IconButton
              label="缩小"
              size={24}
              disabled={zoomIndex <= 0}
              onClick={() => setZoomIndex((z) => Math.max(0, z - 1))}
            >
              <ZoomOut size={13} />
            </IconButton>
            <span className="min-w-[40px] text-center font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
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
        )}
      </div>

      {effectiveMode === 'native' && pdfBlobUrl ? (
        <div className="min-h-0 flex-1 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          <iframe
            key={`${pdfBlobUrl}#page=${current.pageNumber}`}
            title={`${filePath} PDF 原版预览`}
            src={`${pdfBlobUrl}#page=${current.pageNumber}`}
            className="h-full min-h-[260px] w-full border-0"
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4" style={{ background: 'var(--bg-primary)' }}>
          <div
            className="mx-auto overflow-hidden rounded-[var(--radius-card)] border shadow-xs transition-all"
            style={{
              width: `${zoom}%`,
              maxWidth: zoom <= 100 ? 640 : 960,
              borderColor: 'var(--border-subtle)',
              background: '#ffffff',
              color: '#1e293b',
            }}
          >
            {current.imageUrl ? (
              <img
                src={current.imageUrl}
                alt={`${filePath} 第 ${current.pageNumber} 页`}
                className="block w-full select-none"
              />
            ) : (
              <div className="space-y-2 p-6 text-[12px] leading-6 whitespace-pre-wrap">
                {current.fallbackText || '（空白页或纯图片扫描页）'}
              </div>
            )}
          </div>
        </div>
      )}

      {(onSendToChat || onQueueAnnotation) && (
        <AnnotationBar
          testId="pdf-annotation-bar"
          anchorLabel={`第 ${current.pageNumber} 页`}
          excerpt={`共 ${totalPages} 页 · ${filePath.split(/[/\\]/).pop() || filePath}`}
          emptyHint="翻到目标页即可针对该页写批注发送到对话"
          placeholder="例如：帮我总结这一页的核心结论和待办项…"
          onAddToQueue={onQueueAnnotation ? (comment) => {
            onQueueAnnotation({
              filePath,
              anchorLabel: `第 ${current.pageNumber} 页`,
              excerpt: `共 ${totalPages} 页`,
              comment,
              formattedText: formatPdfPageAnnotation({
                filePath,
                pageNumber: current.pageNumber,
                totalPages,
                comment,
              }),
            })
          } : undefined}
          onSubmit={(comment) => {
            onSendToChat?.(formatPdfPageAnnotation({
              filePath,
              pageNumber: current.pageNumber,
              totalPages,
              comment,
            }))
          }}
        />
      )}
    </div>
  )
}

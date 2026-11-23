import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, FileWarning, ZoomIn, ZoomOut } from 'lucide-react'
import { IconButton } from '../../foundation/IconButton'
import { AnnotationBar } from './AnnotationBar'
import { formatPdfPageAnnotation } from './annotation-format'

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
  /** 损坏/加密等错误态 */
  error?: string
  onSendToChat?: (text: string) => void
}

const ZOOM_STEPS = [75, 100, 125, 150] as const

/**
 * 背景：用户需要在右侧工作区逐页浏览 PDF 文档，并按页码写批注发回对话。
 * 设计意图：提供统一的翻页与缩放顶栏、纸面居中渲染区及底部按页批注栏；
 * P0 接受隔离页面图像/文本样张，P1 可直接由主进程/PDF.js 逐页渲染喂入同一接口。
 * 关键约束：页码始终钳制在 [1, pages.length]；错误态和空页态必须清晰提示，不渲染空白黑框。
 */
export function PdfPreview({ filePath, pages, error, onSendToChat }: PdfPreviewProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [zoomIndex, setZoomIndex] = useState(1)

  useEffect(() => {
    setPageIndex(0)
    setZoomIndex(1)
  }, [filePath, pages])

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center" role="alert" data-testid="pdf-preview-error">
        <FileWarning size={20} style={{ color: 'var(--danger)' }} />
        <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center" data-testid="pdf-preview-empty">
        <FileWarning size={20} style={{ color: 'var(--text-muted)' }} />
        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>该 PDF 没有可渲染的页面。</p>
      </div>
    )
  }

  const safeIndex = Math.min(Math.max(0, pageIndex), pages.length - 1)
  const current = pages[safeIndex]
  const zoom = ZOOM_STEPS[zoomIndex]

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="pdf-preview">
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5 text-[11px]"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      >
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
            {current.pageNumber} / {pages.length}
          </span>
          <IconButton
            label="下一页"
            size={24}
            disabled={safeIndex >= pages.length - 1}
            onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
          >
            <ChevronRight size={14} />
          </IconButton>
        </div>

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
      </div>

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

      {onSendToChat && (
        <AnnotationBar
          testId="pdf-annotation-bar"
          anchorLabel={`第 ${current.pageNumber} 页`}
          excerpt={`共 ${pages.length} 页 · ${filePath.split(/[/\\]/).pop() || filePath}`}
          emptyHint="翻到目标页即可针对该页写批注发送到对话"
          placeholder="例如：帮我总结这一页的核心结论和待办项…"
          onSubmit={(comment) => {
            onSendToChat(formatPdfPageAnnotation({
              filePath,
              pageNumber: current.pageNumber,
              totalPages: pages.length,
              comment,
            }))
          }}
        />
      )}
    </div>
  )
}

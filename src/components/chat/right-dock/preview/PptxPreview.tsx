import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Presentation, StickyNote } from 'lucide-react'
import { ActionButton } from '../../../foundation/ActionButton'
import { Badge } from '../../../foundation/Badge'
import { EmptyState } from '../../../foundation/EmptyState'
import { IconButton } from '../../../foundation/IconButton'
import { SegmentedControl } from '../../../foundation/SegmentedControl'
import { AnnotationBar } from './AnnotationBar'
import { PdfPreview } from './PdfPreview'
import {
  formatPptxSlideAnnotation,
  type AnnotationQueueItem,
  type PptxSlideData,
} from './annotation-format'

interface PptxPreviewProps {
  filePath: string
  slides: PptxSlideData[]
  /** 本机是否检测到 WPS / Office / LibreOffice 可用于静默转 PDF 高保真渲染 */
  nativePdfAvailable?: boolean
  onSendToChat?: (text: string) => void
  onQueueAnnotation?: (item: Omit<AnnotationQueueItem, 'id' | 'createdAt'>) => void
}

/**
 * 背景：纯 XML 大纲卡片无法还原 PPT 母版、图示和精确排版；但宿主机无办公软件时仍需立即可读的降级视图。
 * 设计意图：当检测到本机办公套件时默认后台静默转 PDF（带缓存）并以 PdfPreview 呈现 99% 原版幻灯片，
 * 同时提供「原版幻灯片 / 大纲与备注」无缝切换并同步当前页演讲者备注；转换失败或无软件时自动无感降级为 16:9 大纲卡片。
 * 关键约束：页码始终钳制在有效范围；空幻灯片复用 Foundation EmptyState。
 */
export function PptxPreview({
  filePath,
  slides,
  nativePdfAvailable = false,
  onSendToChat,
  onQueueAnnotation,
}: PptxPreviewProps) {
  const canConvertNativePdf = Boolean(
    nativePdfAvailable && typeof window !== 'undefined' && window.electronAPI?.project.convertOfficeToPdf,
  )
  const [slideIndex, setSlideIndex] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const [viewMode, setViewMode] = useState<'nativePdf' | 'outline'>(canConvertNativePdf ? 'nativePdf' : 'outline')
  const [nativePdfBase64, setNativePdfBase64] = useState<string | null>(null)
  const [nativePdfLoading, setNativePdfLoading] = useState(false)
  const [nativePdfFailed, setNativePdfFailed] = useState(false)

  useEffect(() => {
    setSlideIndex(0)
    setNativePdfBase64(null)
    setNativePdfFailed(false)
    setViewMode(canConvertNativePdf ? 'nativePdf' : 'outline')
  }, [filePath, slides, canConvertNativePdf])

  useEffect(() => {
    if (!canConvertNativePdf || viewMode !== 'nativePdf' || nativePdfBase64 || nativePdfFailed) return
    let cancelled = false
    setNativePdfLoading(true)
    void window.electronAPI?.project.convertOfficeToPdf(filePath)
      .then((res) => {
        if (cancelled) return
        if (res?.ok && res.pdfBase64) {
          setNativePdfBase64(res.pdfBase64)
        } else {
          setNativePdfFailed(true)
          setViewMode('outline')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNativePdfFailed(true)
          setViewMode('outline')
        }
      })
      .finally(() => {
        if (!cancelled) setNativePdfLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canConvertNativePdf, viewMode, filePath, nativePdfBase64, nativePdfFailed])

  const handleNativePageChange = useCallback((pageNumber: number) => {
    setSlideIndex(Math.max(0, pageNumber - 1))
  }, [])

  if (slides.length === 0 && !nativePdfBase64 && !nativePdfLoading) {
    return (
      <div className="workspace-surface-stage flex h-full flex-col" data-testid="pptx-preview-empty">
        <EmptyState
          variant="minimal"
          icon={<Presentation size={18} />}
          title="暂无幻灯片"
          description="该演示文稿没有可展示的幻灯片内容。"
        />
      </div>
    )
  }

  const safeIndex = slides.length > 0 ? Math.min(Math.max(0, slideIndex), slides.length - 1) : 0
  const current = slides[safeIndex]

  const viewToggle = canConvertNativePdf && !nativePdfFailed ? (
    <SegmentedControl
      ariaLabel="PPT 视图切换"
      value={viewMode}
      onChange={(id) => setViewMode(id as 'nativePdf' | 'outline')}
      items={[
        { id: 'nativePdf', label: '原版幻灯片' },
        { id: 'outline', label: '大纲与备注' },
      ]}
    />
  ) : null

  if (viewMode === 'nativePdf' && canConvertNativePdf && !nativePdfFailed) {
    if (nativePdfLoading && !nativePdfBase64) {
      return (
        <div className="flex h-full min-h-0 flex-col" data-testid="pptx-preview">
          <div className="workspace-subtoolbar flex shrink-0 select-none items-center justify-between gap-2 border-b px-3 text-[11px]">
            {viewToggle}
            <ActionButton size="sm" onClick={() => setViewMode('outline')}>
              先看大纲
            </ActionButton>
          </div>
          <div className="workspace-surface-stage flex min-h-0 flex-1 items-center justify-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={14} className="animate-spin" />
            <span>正在渲染原版幻灯片（首次约 1~3 秒，二次秒开）…</span>
          </div>
        </div>
      )
    }

    if (nativePdfBase64) {
      return (
        <div className="flex h-full min-h-0 flex-col" data-testid="pptx-preview">
          <div className="flex min-h-0 flex-1 flex-col">
            <PdfPreview
              filePath={filePath}
              pages={[]}
              pdfBase64={nativePdfBase64}
              leadingControl={viewToggle}
              onPageChange={handleNativePageChange}
              onSendToChat={onSendToChat}
              onQueueAnnotation={onQueueAnnotation}
            />
          </div>
          {current?.notes && (
            <div className="shrink-0 border-t px-3 py-2 text-[11.5px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium" style={{ color: 'var(--text-muted)' }}>第 {current.slideNumber} 页演讲者备注</span>
                <ActionButton size="sm" tone={showNotes ? 'accent' : 'neutral'} onClick={() => setShowNotes((v) => !v)}>
                  <StickyNote size={12} /> {showNotes ? '收起备注' : '展开备注'}
                </ActionButton>
              </div>
              {showNotes && (
                <p className="mt-1.5 max-h-24 overflow-auto leading-5" style={{ color: 'var(--text-secondary)' }}>
                  {current.notes}
                </p>
              )}
            </div>
          )}
        </div>
      )
    }
  }

  const buildFormatted = (comment: string) =>
    formatPptxSlideAnnotation({
      filePath,
      slideNumber: current.slideNumber,
      totalSlides: slides.length,
      slideTitle: current.title,
      comment,
    })

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="pptx-preview">
      <div className="workspace-subtoolbar flex shrink-0 select-none items-center justify-between gap-2 border-b px-3 text-[11px]">
        <div className="flex items-center gap-2">
          {viewToggle}
          <div className="flex items-center gap-1">
            <IconButton
              label="上一页幻灯片"
              size={24}
              disabled={safeIndex <= 0}
              onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft size={14} />
            </IconButton>
            <span className="min-w-[52px] text-center font-mono text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {current.slideNumber} / {slides.length}
            </span>
            <IconButton
              label="下一页幻灯片"
              size={24}
              disabled={safeIndex >= slides.length - 1}
              onClick={() => setSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
            >
              <ChevronRight size={14} />
            </IconButton>
          </div>
        </div>

        <ActionButton
          size="sm"
          tone={showNotes ? 'accent' : 'neutral'}
          aria-pressed={showNotes}
          className="gap-1.5"
          onClick={() => setShowNotes((v) => !v)}
        >
          <StickyNote size={12} />
          <span>演讲者备注</span>
          {current.notes && !showNotes && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--accent)' }}
              aria-hidden="true"
            />
          )}
        </ActionButton>
      </div>

      <div className="workspace-surface-stage min-h-0 flex-1 overflow-auto p-5 sm:p-6">
        <div className="mx-auto flex max-w-[680px] flex-col gap-3.5">
          <section
            className="workspace-surface-paper flex aspect-[16/9] min-h-[250px] flex-col justify-between rounded-[var(--radius-card)] border p-7"
            style={{ color: 'var(--text-primary)' }}
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="h-1 w-8 rounded-full" style={{ background: 'var(--accent)' }} aria-hidden="true" />
                  <Badge tone="accent">第 {current.slideNumber} 页</Badge>
                </div>
                <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                  大纲卡片
                </span>
              </div>
              <h2 className="text-[18px] font-semibold leading-snug tracking-tight">
                {current.title || `第 ${current.slideNumber} 页`}
              </h2>
              {current.bullets.length > 0 ? (
                <ul className="list-disc space-y-2 pl-5 text-[13px] leading-6" style={{ color: 'var(--text-secondary)' }}>
                  {current.bullets.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  （此页以图示或封面元素为主，无正文要点）
                </p>
              )}
            </div>
          </section>

          {slides.length > 1 && (
            <div className="flex select-none items-center justify-center gap-1.5 py-0.5" role="tablist" aria-label="幻灯片页码">
              {slides.map((slide, idx) => {
                const isActive = idx === safeIndex
                return (
                  <ActionButton
                    key={slide.slideNumber}
                    variant="plain"
                    padding="none"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`第 ${slide.slideNumber} 页`}
                    title={`第 ${slide.slideNumber} 页${slide.title ? `：${slide.title}` : ''}`}
                    className="!min-h-0 !rounded-full !border-0 transition-all"
                    style={{
                      width: isActive ? 22 : 7,
                      height: 7,
                      background: isActive ? 'var(--accent)' : 'var(--border-color)',
                    }}
                    onClick={() => setSlideIndex(idx)}
                  >
                    <span className="sr-only">第 {slide.slideNumber} 页</span>
                  </ActionButton>
                )
              })}
            </div>
          )}

          {showNotes && current.notes && (
            <div
              className="workspace-surface-paper rounded-[var(--radius-card)] border px-5 py-3.5 text-[12px] leading-6"
              style={{ color: 'var(--text-secondary)' }}
            >
              <p className="mb-1 text-[10.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
                演讲者备注
              </p>
              <p>{current.notes}</p>
            </div>
          )}
        </div>
      </div>

      {(onSendToChat || onQueueAnnotation) && (
        <AnnotationBar
          testId="pptx-annotation-bar"
          anchorLabel={`第 ${current.slideNumber} 页`}
          selectionActive={false}
          quickTriggerLabel="批注本页"
          excerpt={current.title || `共 ${slides.length} 页`}
          emptyHint="翻到目标页后，点击右侧即可针对该页写批注"
          placeholder="例如：精简这一页的 3 条要点并补充数据对比…"
          onAddToQueue={onQueueAnnotation ? (comment) => {
            onQueueAnnotation({
              filePath,
              anchorLabel: `第 ${current.slideNumber} 页`,
              excerpt: current.title,
              comment,
              formattedText: buildFormatted(comment),
            })
          } : undefined}
          onSubmit={(comment) => {
            onSendToChat?.(buildFormatted(comment))
          }}
        />
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Presentation, StickyNote } from 'lucide-react'
import { ActionButton } from '../../foundation/ActionButton'
import { Badge } from '../../foundation/Badge'
import { IconButton } from '../../foundation/IconButton'
import { AnnotationBar } from './AnnotationBar'
import {
  formatPptxSlideAnnotation,
  type AnnotationQueueItem,
  type PptxSlideData,
} from './annotation-format'

interface PptxPreviewProps {
  filePath: string
  slides: PptxSlideData[]
  onSendToChat?: (text: string) => void
  onQueueAnnotation?: (item: Omit<AnnotationQueueItem, 'id' | 'createdAt'>) => void
}

/**
 * 背景：用户需要在右侧工作区快速浏览 PPTX 幻灯片每页大纲与备注，并针对单页写批注发给 AI。
 * 设计意图：以 16:9 清晰卡片展示每页标题、正文要点和可选演讲者备注，配合页码导航和底部 AnnotationBar；
 * 不追求重型像素级动画引擎，优先保证阅读清晰与按页批注闭环。
 * 关键约束：页码始终钳制在有效范围；空幻灯片给出明确提示。
 */
export function PptxPreview({
  filePath,
  slides,
  onSendToChat,
  onQueueAnnotation,
}: PptxPreviewProps) {
  const [slideIndex, setSlideIndex] = useState(0)
  const [showNotes, setShowNotes] = useState(true)

  useEffect(() => {
    setSlideIndex(0)
  }, [filePath, slides])

  if (slides.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center" data-testid="pptx-preview-empty">
        <Presentation size={20} style={{ color: 'var(--text-muted)' }} />
        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>该演示文稿没有可展示的幻灯片内容。</p>
      </div>
    )
  }

  const safeIndex = Math.min(Math.max(0, slideIndex), slides.length - 1)
  const current = slides[safeIndex]

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
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5 text-[11px]"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-1">
          <IconButton
            label="上一页幻灯片"
            size={24}
            disabled={safeIndex <= 0}
            onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft size={14} />
          </IconButton>
          <span className="min-w-[54px] text-center font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
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

        <ActionButton
          size="sm"
          tone={showNotes ? 'accent' : 'neutral'}
          aria-pressed={showNotes}
          className="gap-1"
          onClick={() => setShowNotes((v) => !v)}
        >
          <StickyNote size={12} />
          演讲者备注
        </ActionButton>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="mx-auto max-w-[680px] space-y-3">
          <section
            className="flex min-h-[260px] flex-col justify-between rounded-[var(--radius-card)] border p-6"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Badge tone="accent">Slide {current.slideNumber}</Badge>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  大纲卡片预览
                </span>
              </div>
              <h2 className="text-[17px] font-semibold leading-snug">
                {current.title || `第 ${current.slideNumber} 页`}
              </h2>
              {current.bullets.length > 0 ? (
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-6" style={{ color: 'var(--text-secondary)' }}>
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

          {showNotes && current.notes && (
            <div
              className="rounded-[var(--radius-card)] border px-4 py-3 text-[12px] leading-6"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
              }}
            >
              <p className="mb-1 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                演讲者备注
              </p>
              <p>{current.notes}</p>
            </div>
          )}

          {slides.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {slides.map((slide, idx) => (
                <ActionButton
                  key={slide.slideNumber}
                  size="sm"
                  tone={idx === safeIndex ? 'accent' : 'neutral'}
                  onClick={() => setSlideIndex(idx)}
                >
                  P{slide.slideNumber}
                </ActionButton>
              ))}
            </div>
          )}
        </div>
      </div>

      {(onSendToChat || onQueueAnnotation) && (
        <AnnotationBar
          testId="pptx-annotation-bar"
          anchorLabel={`第 ${current.slideNumber} 页`}
          excerpt={current.title || `共 ${slides.length} 页`}
          emptyHint="切换到目标页即可写批注"
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

import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { AnnotationBar } from './AnnotationBar'
import { formatDocxSelectionAnnotation, sanitizeDocxHtml, type AnnotationQueueItem } from './annotation-format'

interface DocxPreviewProps {
  filePath: string
  htmlContent: string
  /** 转换过程中的温和提示（例如未支持的高级样式） */
  notices?: string[]
  onSendToChat?: (text: string) => void
  onQueueAnnotation?: (item: Omit<AnnotationQueueItem, 'id' | 'createdAt'>) => void
}

/**
 * 背景：用户希望在右侧工作区直接阅读 Word（.docx）文档，并划选关键段落批注发回对话。
 * 设计意图：对主进程转换出的语义 HTML 执行白名单清洗后，在清晰可读的文档排版面中渲染；
 * 通过监听容器内 mouseup/keyup 捕获当前划词片段，供底部 AnnotationBar 发送到对话。
 * 关键约束：严禁跳过 sanitizeDocxHtml 直接注入原始 HTML；仅捕获归属本容器内的划词，避免误抓聊天区文字。
 */
export function DocxPreview({ filePath, htmlContent, notices, onSendToChat, onQueueAnnotation }: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedText, setSelectedText] = useState('')

  useEffect(() => {
    setSelectedText('')
  }, [filePath, htmlContent])

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

  if (!safeHtml.trim()) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center" data-testid="docx-preview-empty">
        <FileText size={20} style={{ color: 'var(--text-muted)' }} />
        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>该 Word 文档没有可展示的正文内容。</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="docx-preview">
      {notices && notices.length > 0 && (
        <div
          className="shrink-0 border-b px-3 py-1.5 text-[11px]"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
        >
          {notices[0]}
        </div>
      )}

      <div
        className="min-h-0 flex-1 overflow-auto p-4 select-text"
        style={{ background: 'var(--bg-primary)' }}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
      >
        <article
          ref={containerRef}
          className="mx-auto max-w-[680px] space-y-3 rounded-[var(--radius-card)] border p-5 text-[13px] leading-7 [&_h1]:text-[18px] [&_h1]:font-semibold [&_h2]:text-[15px] [&_h2]:font-semibold [&_h3]:text-[13px] [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-5"
          style={{
            borderColor: 'var(--border-subtle)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
          }}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </div>

      {(onSendToChat || onQueueAnnotation) && (
        <AnnotationBar
          testId="docx-annotation-bar"
          anchorLabel={selectedText ? `已划选 ${selectedText.length} 字` : '整篇文档'}
          excerpt={selectedText || '划选上方任意文字可精准引用片段，或直接针对全文写批注'}
          emptyHint="划选正文片段即可批注发送到对话"
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

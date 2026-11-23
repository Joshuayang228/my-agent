import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair } from 'lucide-react'
import { ActionButton } from '../../foundation/ActionButton'
import { SegmentedControl } from '../../foundation/SegmentedControl'
import { CodeBlock } from '../../MarkdownRenderer'
import { AnnotationBar } from './AnnotationBar'
import {
  buildHtmlPickerSrcDoc,
  formatHtmlElementAnnotation,
  parseHtmlPickerMessage,
  type AnnotationQueueItem,
  type HtmlPickedElement,
} from './annotation-format'

interface HtmlAnnotatePreviewProps {
  filePath: string
  htmlContent: string
  /** 默认是否开启选元素批注模式 */
  defaultPickerActive?: boolean
  onSendToChat?: (text: string) => void
  onQueueAnnotation?: (item: Omit<AnnotationQueueItem, 'id' | 'createdAt'>) => void
}

/**
 * 背景：用户在右侧预览 HTML 页面时，需要直接点选页面中的某个按钮、卡片或标题并写批注发给 AI 修改。
 * 设计意图：保留「预览 / 源码」视图切换，在预览模式提供「选元素批注」开关；开启时向沙箱 iframe 注入隔离拾取脚本，
 * 通过随机 channelToken 与 source 校验接收点击元素的 CSS Selector 与文本摘要，不降级沙箱权限。
 * 关键约束：iframe 严格保持 sandbox="allow-scripts"（绝不加 allow-same-origin）；切回源码或关闭模式立即停止拾取。
 */
export function HtmlAnnotatePreview({
  filePath,
  htmlContent,
  defaultPickerActive = false,
  onSendToChat,
  onQueueAnnotation,
}: HtmlAnnotatePreviewProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview')
  const [pickerActive, setPickerActive] = useState(defaultPickerActive)
  const [picked, setPicked] = useState<HtmlPickedElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const channelToken = useMemo(
    () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pick-${Math.random().toString(36).slice(2)}`),
    [filePath],
  )

  useEffect(() => {
    setPicked(null)
  }, [filePath])

  useEffect(() => {
    if (viewMode !== 'preview' || !pickerActive) return
    const handleMessage = (event: MessageEvent) => {
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return
      const parsed = parseHtmlPickerMessage(event.data, channelToken)
      if (parsed) setPicked(parsed)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [viewMode, pickerActive, channelToken])

  const srcDoc = useMemo(
    () => buildHtmlPickerSrcDoc(htmlContent, pickerActive, channelToken),
    [htmlContent, pickerActive, channelToken],
  )

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="html-annotate-preview">
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      >
        <SegmentedControl
          ariaLabel="HTML 视图切换"
          value={viewMode}
          onChange={(id) => {
            const next = id as 'preview' | 'source'
            setViewMode(next)
            if (next === 'source') setPickerActive(false)
          }}
          items={[
            { id: 'preview', label: '预览' },
            { id: 'source', label: '源码' },
          ]}
        />

        {viewMode === 'preview' && (onSendToChat || onQueueAnnotation) && (
          <ActionButton
            size="sm"
            tone={pickerActive ? 'accent' : 'neutral'}
            aria-pressed={pickerActive}
            className="gap-1"
            data-testid="html-picker-toggle"
            onClick={() => setPickerActive((prev) => !prev)}
          >
            <Crosshair size={12} />
            {pickerActive ? '选元素中（点击节点）' : '选元素批注'}
          </ActionButton>
        )}

        {viewMode === 'preview' && pickerActive && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            悬停高亮元素，点击锁定
          </span>
        )}
      </div>

      <div className={`min-h-0 flex-1 overflow-auto ${viewMode === 'preview' ? 'p-0' : 'p-3'}`}>
        {viewMode === 'preview' ? (
          <iframe
            ref={iframeRef}
            title={filePath}
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            className="h-full min-h-[220px] w-full border-0 bg-white"
            data-testid="html-annotate-iframe"
          />
        ) : (
          <CodeBlock code={htmlContent} language="html" />
        )}
      </div>

      {viewMode === 'preview' && (onSendToChat || onQueueAnnotation) && (
        <AnnotationBar
          testId="html-annotation-bar"
          anchorLabel={picked ? picked.selector : null}
          excerpt={picked ? (picked.textSnippet || `<${picked.tagName}>`) : undefined}
          emptyHint={pickerActive ? '请在上方页面中点击任意元素以锁定批注目标' : '点击上方「选元素批注」后，即可点选页面任意元素并发送到对话'}
          placeholder="例如：把这个按钮改成次要样式并减小上下边距…"
          onClearAnchor={() => setPicked(null)}
          onAddToQueue={onQueueAnnotation ? (comment) => {
            if (!picked) return
            onQueueAnnotation({
              filePath,
              anchorLabel: picked.selector,
              excerpt: picked.textSnippet || `<${picked.tagName}>`,
              comment,
              formattedText: formatHtmlElementAnnotation({
                filePath,
                element: picked,
                comment,
              }),
            })
          } : undefined}
          onSubmit={(comment) => {
            if (!picked) return
            onSendToChat?.(formatHtmlElementAnnotation({
              filePath,
              element: picked,
              comment,
            }))
          }}
        />
      )}
    </div>
  )
}

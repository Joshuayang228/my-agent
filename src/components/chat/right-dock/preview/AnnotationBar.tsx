import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ListPlus, Send, X } from 'lucide-react'
import { ActionButton } from '../../../foundation/ActionButton'
import { Badge } from '../../../foundation/Badge'
import { IconButton } from '../../../foundation/IconButton'
import { TextField } from '../../../foundation/TextField'

interface AnnotationBarProps {
  /** 当前选中的位置/锚点标签，例如 Sheet1!B2:D5、button.cta 或 第 2 页 */
  anchorLabel: string | null
  /** 选中内容的简短摘要，辅助用户确认没有选错 */
  excerpt?: string
  /** 没有选中任何锚点时的引导提示 */
  emptyHint: string
  placeholder?: string
  onClearAnchor?: () => void
  onSubmit: (comment: string) => void
  /** 可选：加入批注草稿篮（支持连续攒多条再一键汇总发送） */
  onAddToQueue?: (comment: string) => void
  testId?: string
}

/**
 * 背景：Excel 选区、HTML 元素、Word 划词、PDF/PPT 页面都需要把「选中锚点 + 批注说明」发送到对话或先攒入草稿篮。
 * 设计意图：收拢为一个统一的紧凑底栏，全部复用 Foundation 的 Badge / TextField / ActionButton / IconButton，
 * 支持单条直发与多条暂存两种节奏。
 * 关键约束：没有有效锚点或未填写批注时禁用发送与入篮；提交后清空输入框并给出短暂状态反馈。
 */
export function AnnotationBar({
  anchorLabel,
  excerpt,
  emptyHint,
  placeholder = '输入批注或修改要求，回车发送到对话…',
  onClearAnchor,
  onSubmit,
  onAddToQueue,
  testId = 'workspace-annotation-bar',
}: AnnotationBarProps) {
  const [comment, setComment] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  const canSend = Boolean(anchorLabel && comment.trim())

  const showFeedback = (text: string) => {
    setFeedback(text)
    window.setTimeout(() => setFeedback(null), 1600)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSend) return
    onSubmit(comment.trim())
    setComment('')
    showFeedback('已发送到对话')
  }

  const handleQueue = () => {
    if (!canSend || !onAddToQueue) return
    onAddToQueue(comment.trim())
    setComment('')
    showFeedback('已加入批注篮')
  }

  return (
    <div
      className="shrink-0 border-t px-3 py-2"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      data-testid={testId}
    >
      <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
        {anchorLabel ? (
          <>
            <Badge tone="accent">{anchorLabel}</Badge>
            {excerpt && (
              <span
                className="min-w-0 flex-1 truncate text-[11px]"
                style={{ color: 'var(--text-muted)' }}
                title={excerpt}
              >
                {excerpt}
              </span>
            )}
            {onClearAnchor && (
              <IconButton
                label="清除选中"
                size={24}
                style={{ color: 'var(--text-muted)' }}
                onClick={onClearAnchor}
              >
                <X size={12} />
              </IconButton>
            )}
          </>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {emptyHint}
          </span>
        )}
        {feedback && (
          <span className="ml-auto shrink-0 text-[10px]" style={{ color: 'var(--success)' }} role="status">
            {feedback}
          </span>
        )}
      </div>

      <form className="flex items-center gap-1.5" onSubmit={handleSubmit}>
        <TextField
          appearance="outlined"
          aria-label="批注内容"
          placeholder={placeholder}
          value={comment}
          disabled={!anchorLabel}
          className="h-7 min-w-0 flex-1 rounded-[var(--radius-input)] px-2 text-[11px]"
          onChange={(event: ChangeEvent<HTMLInputElement>) => setComment(event.target.value)}
        />
        {onAddToQueue && (
          <ActionButton
            type="button"
            tone="neutral"
            size="sm"
            disabled={!canSend}
            className="gap-1"
            data-testid={`${testId}-queue`}
            onClick={handleQueue}
          >
            <ListPlus size={12} />
            加入批注篮
          </ActionButton>
        )}
        <ActionButton
          type="submit"
          tone="accent"
          size="sm"
          disabled={!canSend}
          className="gap-1"
          data-testid={`${testId}-send`}
        >
          <Send size={12} />
          发送到对话
        </ActionButton>
      </form>
    </div>
  )
}

import { useLayoutEffect, useRef, type ReactNode, type RefObject, type TextareaHTMLAttributes } from 'react'
import { ArrowUp, Paperclip, Square } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'
import { TextField } from '../foundation/TextField'

type ComposerInputProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'style' | 'disabled' | 'onInput'> & { 'data-testid'?: string }

interface ChatComposerProps {
  inputProps: ComposerInputProps
  inputRef?: RefObject<HTMLTextAreaElement | null>
  prefix?: ReactNode
  approvalControl: ReactNode
  modelLabel: string
  streaming?: boolean
  sendDisabled: boolean
  onAttach: () => void
  onSend: () => void
  onStop?: () => void
}

/**
 * 背景：正式 Chat 和候选各写输入卡片，字号、图标和操作槽已经漂移。
 * 设计意图：共享 Foundation 输入与固定按钮，附件、审批、发送和停止仍由调用方负责；不把 IPC 或样张数据带进呈现层。
 * 关键约束：发送 / 停止共用 28px 槽，模型名只能截断，hover 不改布局；输入高度只随内容变化且不超过 120px。
 */
export function ChatComposer({ inputProps, inputRef, prefix, approvalControl, modelLabel, streaming = false, sendDisabled, onAttach, onSend, onStop }: ChatComposerProps) {
  const localRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = inputRef ?? localRef
  const resizeInput = () => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = Math.min(node.scrollHeight, 120) + 'px'
  }
  useLayoutEffect(resizeInput, [inputProps.value])

  return <div data-testid="chat-composer" className="relative rounded-[var(--radius-xl)] border px-3 py-2 shadow-sm transition-shadow focus-within:shadow-md"
    style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)', boxShadow: '0 6px 22px color-mix(in srgb, var(--text-primary) 5%, transparent)' }}>
    {prefix}
    <TextField multiline rows={1} aria-label="消息" {...inputProps} ref={textareaRef} disabled={streaming}
      onInput={resizeInput} className="min-h-[64px] w-full resize-none px-1 py-2 !text-[13px] disabled:opacity-50" style={{ maxHeight: 120 }} />
    <div className="flex min-w-0 items-center justify-between gap-2 pt-1" data-testid="chat-composer-toolbar">
      <div className="flex shrink-0 items-center gap-1">
        <IconButton label="添加附件" onClick={onAttach} className="transition hover:bg-[var(--hover-overlay)]" style={{ color: 'var(--text-muted)' }}><Paperclip size={14} aria-hidden="true" /></IconButton>
        <span className="h-4 w-px" style={{ background: 'var(--border-subtle)' }} />
        {approvalControl}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <span data-testid="chat-current-model" className="min-w-0 max-w-40 truncate text-[10.5px]" style={{ color: 'var(--text-muted)' }} title={modelLabel}>{modelLabel}</span>
        <IconButton label={streaming ? '停止' : '发送'} onClick={streaming ? onStop : onSend} disabled={streaming ? !onStop : sendDisabled}
          className="!rounded-full transition disabled:cursor-not-allowed disabled:opacity-30" style={{ background: streaming ? 'var(--danger)' : 'var(--accent-emphasis)', color: 'var(--bg-primary)' }}>
          {streaming ? <Square size={10} fill="currentColor" aria-hidden="true" /> : <ArrowUp size={14} aria-hidden="true" />}
        </IconButton>
      </div>
    </div>
  </div>
}

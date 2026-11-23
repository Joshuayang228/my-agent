import { useLayoutEffect, useRef, type ReactNode, type RefObject, type TextareaHTMLAttributes } from 'react'
import { ArrowUp, ImagePlus, Paperclip, Square } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'
import { TextField } from '../foundation/TextField'

type ComposerInputProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'style' | 'disabled' | 'onInput'> & { 'data-testid'?: string }

interface ChatComposerProps {
  inputProps: ComposerInputProps
  inputRef?: RefObject<HTMLTextAreaElement | null>
  prefix?: ReactNode
  approvalControl: ReactNode
  /** 项目工作区选择器插槽：统一收纳在输入卡片内部底栏，消除框外下挂“双下巴” */
  projectControl?: ReactNode
  modelLabel: string
  streaming?: boolean
  sendDisabled: boolean
  onAttach: () => void
  onImageGenerate: () => void
  onSend: () => void
  onStop?: () => void
  /** 嵌入输入的焦点由外层卡片承担；保留参数兼容已有样张。 */
  inputFocusRing?: 'field' | 'card'
}

/**
 * 背景：正式 Chat 和候选各写输入卡片，字号、图标和操作槽已经漂移。
 * 设计意图：共享 Foundation 输入与固定按钮，附件、审批、发送和停止仍由调用方负责；不把 IPC 或样张数据带进呈现层。
 * 关键约束：发送 / 停止共用 28px 槽，模型名只能截断，hover 不改布局；输入高度只随内容变化且不超过 120px。
 */
export function ChatComposer({ inputProps, inputRef, prefix, approvalControl, projectControl, modelLabel, streaming = false, sendDisabled, onAttach, onImageGenerate, onSend, onStop, inputFocusRing = 'field' }: ChatComposerProps) {
  const localRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = inputRef ?? localRef
  const resizeInput = () => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = Math.min(node.scrollHeight, 120) + 'px'
  }
  useLayoutEffect(resizeInput, [inputProps.value])

  return <div data-testid="chat-composer" className="relative rounded-[var(--radius-xl)] border px-3.5 py-2.5 shadow-sm transition-shadow focus-within:shadow-md focus-within:outline-1 focus-within:outline-[var(--accent)]"
    style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)', boxShadow: '0 6px 22px color-mix(in srgb, var(--text-primary) 5%, transparent)' }}>
    {prefix}
    <TextField multiline rows={1} aria-label="消息" {...inputProps} appearance="embedded" ref={textareaRef} disabled={streaming}
      onInput={resizeInput} className={`min-h-[60px] w-full resize-none px-1 py-1.5 !text-[14px] leading-relaxed disabled:opacity-50 ${inputFocusRing === 'card' ? 'chat-composer-input-no-ring' : ''}`} style={{ maxHeight: 120 }} />
    <div className="flex min-w-0 items-center justify-between gap-2 pt-1" data-testid="chat-composer-toolbar">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <IconButton label="添加附件" onClick={onAttach} className="transition hover:bg-[var(--hover-overlay)]" style={{ color: 'var(--text-muted)' }}><Paperclip size={15} aria-hidden="true" /></IconButton>
        <IconButton label="生成图片" onClick={onImageGenerate} disabled={streaming} className="transition hover:bg-[var(--hover-overlay)]" style={{ color: 'var(--text-muted)' }}><ImagePlus size={15} aria-hidden="true" /></IconButton>
        <span className="mx-0.5 h-3.5 w-px" style={{ background: 'var(--border-subtle)' }} />
        {approvalControl}
        {projectControl ? (
          <>
            <span className="mx-0.5 h-3.5 w-px" style={{ background: 'var(--border-subtle)' }} />
            {projectControl}
          </>
        ) : null}
      </div>
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
        <span data-testid="chat-current-model" className="min-w-0 max-w-44 truncate text-[12px]" style={{ color: 'var(--text-muted)' }} title={modelLabel}>{modelLabel}</span>
        <IconButton label={streaming ? '停止' : '发送'} onClick={streaming ? onStop : onSend} disabled={streaming ? !onStop : sendDisabled}
          className="!rounded-full transition disabled:cursor-not-allowed disabled:opacity-30" style={{ background: streaming ? 'var(--danger)' : 'var(--accent-emphasis)', color: 'var(--bg-primary)' }}>
          {streaming ? <Square size={10} fill="currentColor" aria-hidden="true" /> : <ArrowUp size={15} aria-hidden="true" />}
        </IconButton>
      </div>
    </div>
  </div>
}

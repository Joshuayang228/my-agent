import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject, type TextareaHTMLAttributes } from 'react'
import { ArrowUp, ImagePlus, Paperclip, Plus, Square } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import { TextField } from '../foundation/TextField'

type ComposerInputProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'style' | 'disabled' | 'onInput'> & { 'data-testid'?: string }

interface ChatComposerProps {
  inputProps: ComposerInputProps
  inputRef?: RefObject<HTMLTextAreaElement | null>
  prefix?: ReactNode
  approvalControl: ReactNode
  /** 项目工作区选择器插槽：置于嵌套式顶部环境托盘内，与下方主输入卡形成双层包裹结构 */
  projectControl?: ReactNode
  /** 模型切换器插槽：传入时以可点击下拉呈现当前模型，未传时回退只读文本 */
  modelControl?: ReactNode
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
 * 背景：正式 Chat 和候选各写输入卡片，且旧版外露回形针、生图按钮、竖线分割与框外双下巴导致底栏拥挤。
 * 设计意图：共享 Foundation 输入、ActionButton 与固定 IconButton，工作区退居上盖环境托盘，附件与生图收敛入 `+` 菜单。
 * 关键约束：发送 / 停止共用 28px 槽，模型名只能截断，hover 不改布局；输入高度只随内容变化且不超过 120px；严禁直连 IPC。
 */
export function ChatComposer({ inputProps, inputRef, prefix, approvalControl, projectControl, modelControl, modelLabel, streaming = false, sendDisabled, onAttach, onImageGenerate, onSend, onStop, inputFocusRing = 'field' }: ChatComposerProps) {
  const localRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = inputRef ?? localRef
  const plusMenuRef = useRef<HTMLDivElement>(null)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)

  const resizeInput = () => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = Math.min(node.scrollHeight, 120) + 'px'
  }
  useLayoutEffect(resizeInput, [inputProps.value])

  useEffect(() => {
    if (!plusMenuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (plusMenuRef.current?.contains(event.target as Node)) return
      setPlusMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPlusMenuOpen(false)
    }
    document.addEventListener('click', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [plusMenuOpen])

  const cardBody = (
    <>
      {prefix}
      <TextField
        multiline
        rows={1}
        aria-label="消息"
        {...inputProps}
        appearance="embedded"
        ref={textareaRef}
        disabled={streaming}
        onInput={resizeInput}
        className={`min-h-[56px] w-full resize-none px-1 py-1.5 !text-[14px] leading-relaxed disabled:opacity-50 ${inputFocusRing === 'card' ? 'chat-composer-input-no-ring' : ''}`}
        style={{ maxHeight: 120 }}
      />
      <div className="flex min-w-0 select-none items-center justify-between gap-2 pt-1" data-testid="chat-composer-toolbar">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <div className="relative" ref={plusMenuRef}>
            <IconButton
              label="添加内容"
              aria-expanded={plusMenuOpen}
              aria-haspopup="menu"
              onClick={(e) => {
                e.stopPropagation()
                setPlusMenuOpen((open) => !open)
              }}
              className="text-[var(--text-secondary)] transition hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            >
              <Plus size={16} aria-hidden="true" />
            </IconButton>
            {plusMenuOpen && (
              <div
                role="menu"
                aria-label="添加内容"
                className="absolute bottom-full left-0 z-50 mb-1.5 w-44 rounded-lg border p-1 shadow-lg"
                style={{ borderColor: 'var(--border-color)', background: 'var(--dropdown-bg)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <ActionButton
                  variant="plain"
                  size="sm"
                  role="menuitem"
                  onClick={() => {
                    setPlusMenuOpen(false)
                    onAttach()
                  }}
                  className="!w-full !justify-start gap-2 rounded-md border-0 !px-2.5 !py-1.5 !text-[12px]"
                >
                  <Paperclip size={13} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                  <span>添加附件</span>
                </ActionButton>
                <ActionButton
                  variant="plain"
                  size="sm"
                  role="menuitem"
                  disabled={streaming}
                  onClick={() => {
                    setPlusMenuOpen(false)
                    onImageGenerate()
                  }}
                  className="!w-full !justify-start gap-2 rounded-md border-0 !px-2.5 !py-1.5 !text-[12px]"
                >
                  <ImagePlus size={13} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                  <span>生成图片</span>
                </ActionButton>
              </div>
            )}
          </div>
          {approvalControl}
        </div>
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
          {modelControl ?? (
            <span
              data-testid="chat-current-model"
              className="min-w-0 max-w-44 truncate text-[12px]"
              style={{ color: 'var(--text-muted)' }}
              title={modelLabel}>{modelLabel}</span>
          )}
          <IconButton
            label={streaming ? '停止' : '发送'}
            onClick={streaming ? onStop : onSend}
            disabled={streaming ? !onStop : sendDisabled}
            className={`!rounded-full transition ${!streaming && !sendDisabled ? 'shadow-sm hover:brightness-95' : ''}`}
            style={{
              background: streaming
                ? 'var(--danger)'
                : sendDisabled
                  ? 'var(--bg-tertiary)'
                  : 'var(--accent-emphasis)',
              color: streaming || !sendDisabled ? 'var(--bg-primary)' : 'var(--text-muted)',
            }}
          >
            {streaming ? <Square size={10} fill="currentColor" aria-hidden="true" /> : <ArrowUp size={15} aria-hidden="true" />}
          </IconButton>
        </div>
      </div>
    </>
  )

  if (projectControl) {
    return (
      <div
        data-testid="chat-composer"
        className="relative rounded-[var(--radius-xl)] border backdrop-blur-md"
        style={{
          borderColor: 'color-mix(in srgb, var(--border-color) 70%, transparent)',
          background: 'color-mix(in srgb, var(--bg-secondary) 72%, transparent)',
        }}
      >
        <div className="flex select-none items-center justify-between gap-2 px-3 py-1.5">
          {projectControl}
        </div>
        <div className="chat-composer-card relative -mx-px -mb-px rounded-[var(--radius-xl)] border px-3.5 py-2.5 backdrop-blur-md">
          {cardBody}
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="chat-composer"
      className="chat-composer-card relative rounded-[var(--radius-xl)] border px-3.5 py-2.5 backdrop-blur-md"
    >
      {cardBody}
    </div>
  )
}

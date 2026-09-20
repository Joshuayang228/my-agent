import type { ReactNode } from 'react'
import { Bot, UserRound } from 'lucide-react'

interface ChatMessageFrameProps {
  role: 'user' | 'assistant'
  name?: string
  timestamp?: number
  previewTimeLabel?: string
  editing?: boolean
  actions?: ReactNode
  children: ReactNode
}

/**
 * 背景：候选有头像与身份行，正式消息却另写外框，容易在回流时丢掉工具、引用或编辑能力。
 * 设计意图：只共享消息排列、身份与气泡；正文和操作通过插槽保留原有数据链路，不复制样张消息。
 * 关键约束：正式时间来自消息记录，未知时间不伪造；头像与操作槽不随 hover 改尺寸，长内容不能撑宽会话。
 */
export function ChatMessageFrame({ role, name, timestamp, previewTimeLabel, editing = false, actions, children }: ChatMessageFrameProps) {
  const isUser = role === 'user'
  const date = typeof timestamp === 'number' && Number.isFinite(timestamp) ? new Date(timestamp) : null
  const validDate = date && Number.isFinite(date.getTime()) ? date : null
  const avatar = <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" aria-hidden="true"
    style={{ background: 'var(--accent-subtle)', color: isUser ? 'var(--accent-fg)' : 'var(--companion-accent-warm)' }}>
    {isUser ? <UserRound size={14} /> : <Bot size={14} />}
  </span>
  return <div data-testid="chat-message-frame" data-role={role} className={'flex min-w-0 items-start gap-2.5 ' + (isUser ? 'justify-end' : '')}>
    {!isUser && avatar}
    <div className={'relative min-w-0 ' + (isUser ? 'max-w-[75%]' : 'max-w-[82%] flex-1')}>
      {!isUser && <div data-testid="chat-message-identity" className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]" style={{ color: 'var(--text-secondary)' }}>{name || '伙伴'}</span>
        {validDate ? <time className="shrink-0" dateTime={validDate.toISOString()} title={validDate.toLocaleString()}>{validDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time> : previewTimeLabel ? <span>{previewTimeLabel}</span> : null}
      </div>}
      <div className={'min-w-0 break-words [overflow-wrap:anywhere] ' + (isUser && !editing ? 'rounded-[var(--radius-lg)] px-3.5 py-2.5 text-[13px] leading-6' : isUser ? '' : 'mt-1.5 text-[14px] leading-7')}
        style={{ background: isUser && !editing ? 'var(--msg-user-bg)' : undefined, color: 'var(--text-primary)' }}>
        {children}
      </div>
      {actions}
    </div>
    {isUser && avatar}
  </div>
}

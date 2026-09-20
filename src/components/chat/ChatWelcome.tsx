import { Bot } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

interface ChatWelcomeProps {
  title: string
  subtitle: string
  onGreet: () => void
  onPlanDay: () => void
  onOpenWorld: () => void
  actionTestId?: string
}

export function ChatWelcome({ title, subtitle, onGreet, onPlanDay, onOpenWorld, actionTestId }: ChatWelcomeProps) {
  return <div className="m-auto w-full max-w-lg text-center" data-testid="chat-welcome">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--accent-subtle)', color: 'var(--companion-accent-warm)' }}>
      <Bot size={22} strokeWidth={1.5} aria-hidden="true" />
    </div>
    <h1 className="mt-5 break-words font-display text-[1.9rem] font-medium" style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{title}</h1>
    <p className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{subtitle}</p>
    <div className="mt-8 flex flex-wrap justify-center gap-2">
      {[
        { label: '打个招呼', onClick: onGreet, primary: true },
        { label: '今天想怎么过？', onClick: onPlanDay },
        { label: '看看朋友圈', onClick: onOpenWorld },
      ].map(({ label, onClick, primary }) => <ActionButton key={label} onClick={onClick} data-testid={actionTestId}
        className="max-w-full !rounded-full !px-3.5 py-1.5 !text-[12px] hover:!border-[var(--companion-accent-warm)] hover:!text-[var(--text-primary)]"
        style={{ borderColor: primary ? 'var(--companion-accent-warm)' : 'var(--border-color)', color: primary ? 'var(--accent-fg)' : 'var(--text-secondary)', background: primary ? 'var(--accent-subtle)' : 'var(--card-bg)' }}>
        {label}
      </ActionButton>)}
    </div>
  </div>
}

import { MessageCircle, LockKeyhole } from 'lucide-react'

export function SideChatPanel() {
  return <div className="flex h-full min-h-0 flex-col" data-testid="workspace-sidechat-panel">
    <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <MessageCircle size={14} style={{ color: 'var(--text-muted)' }} />
      <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>侧边聊天</span>
    </div>
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <LockKeyhole size={20} style={{ color: 'var(--text-muted)' }} />
      <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>侧边聊天尚未接入真实会话</p>
      <p className="max-w-xs text-[11px]" style={{ color: 'var(--text-muted)' }}>完成 session、runtime、消息事件、停止和错误恢复契约后开放。</p>
    </div>
  </div>
}
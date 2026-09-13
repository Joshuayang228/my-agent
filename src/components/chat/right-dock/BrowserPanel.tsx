import { Globe, LockKeyhole } from 'lucide-react'

export function BrowserPanel() {
  return <div className="flex h-full min-h-0 flex-col" data-testid="workspace-browser-panel">
    <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <Globe size={14} style={{ color: 'var(--text-muted)' }} />
      <input aria-label="浏览器地址" disabled placeholder="浏览器能力尚未接入" className="min-w-0 flex-1 bg-transparent text-center text-[11px] outline-none" />
    </div>
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <LockKeyhole size={20} style={{ color: 'var(--text-muted)' }} />
      <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>浏览器工作区尚未接入真实安全容器</p>
      <p className="max-w-xs text-[11px]" style={{ color: 'var(--text-muted)' }}>完成 URL 校验、重定向隔离、权限决策和关闭清理后开放。</p>
    </div>
  </div>
}
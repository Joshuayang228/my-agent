import { X } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'

export interface WorldProfile {
  name: string
  description: string
}

/** 共享身份呈现不读取角色或夹具；调用方负责真实身份，缺省内容不得编造人设。 */
export function WorldProfileHeader({ profile, onClose, testId = 'world-profile' }: {
  profile: WorldProfile
  onClose?: () => void
  testId?: string
}) {
  const name = profile.name.trim() || '伙伴'
  return <section className="relative flex min-h-[9.5rem] shrink-0 items-end gap-3 border-b px-5 pb-4 pt-12" data-testid={testId} style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
    <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-4 text-lg font-semibold" style={{ borderColor: 'var(--card-bg)', background: 'var(--accent-subtle)', color: 'var(--companion-accent-warm)' }}>
      {Array.from(name)[0]}
    </div>
    <div className="min-w-0 flex-1 pb-0.5">
      <h1 className="text-[15px] font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--text-primary)' }}>{name}</h1>
      {profile.description.trim() && <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 [overflow-wrap:anywhere]" style={{ color: 'var(--text-secondary)' }}>{profile.description}</p>}
    </div>
    {onClose && <div className="absolute right-4 top-3"><IconButton label="返回聊天" onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={14} /></IconButton></div>}
  </section>
}

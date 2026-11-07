import { useState } from 'react'
import { X } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'
import { ActionButton } from '../foundation/ActionButton'

export interface WorldProfile {
  name: string
  description: string
  statusSummary?: string
  statusMetrics?: { mood: number; energy: number; socialNeed: number; relationshipSignal: number | null; relationshipPhase: string | null }
}

/** 共享身份呈现不读取角色或夹具；调用方负责真实身份，缺省内容不得编造人设。 */
export function WorldProfileHeader({ profile, onClose, testId = 'world-profile' }: {
  profile: WorldProfile
  onClose?: () => void
  testId?: string
}) {
  const name = profile.name.trim() || '伙伴'
  const [statusMode, setStatusMode] = useState<'narrative' | 'numeric'>('narrative')
  return <section className="relative flex min-h-[9.5rem] shrink-0 items-end gap-3 border-b px-5 pb-4 pt-12" data-testid={testId} style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
    <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-4 text-lg font-semibold" style={{ borderColor: 'var(--card-bg)', background: 'var(--accent-subtle)', color: 'var(--companion-accent-warm)' }}>
      {Array.from(name)[0]}
    </div>
    <div className="min-w-0 flex-1 pb-0.5">
      <h1 className="text-[15px] font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--text-primary)' }}>{name}</h1>
      {profile.description.trim() && <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 [overflow-wrap:anywhere]" style={{ color: 'var(--text-secondary)' }}>{profile.description}</p>}
      {(profile.statusSummary?.trim() || profile.statusMetrics) && <div className="mt-1 flex flex-wrap items-center gap-2" data-testid="world-profile-status">
        <p className="min-w-0 flex-1 text-[10px] leading-4 [overflow-wrap:anywhere]" style={{ color: 'var(--accent-fg)' }}>
          {statusMode === 'narrative'
            ? profile.statusSummary || '当前状态尚未形成叙事摘要。'
            : profile.statusMetrics && <>{`心情 ${profile.statusMetrics.mood}/100 · 精力 ${profile.statusMetrics.energy}/100 · 社交需求 ${profile.statusMetrics.socialNeed}/100`}{profile.statusMetrics.relationshipSignal !== null ? ` · 关系信号 ${profile.statusMetrics.relationshipSignal}/100` : ''}</>}
        </p>
        <ActionButton
          type="button"
          className="shrink-0 px-1.5 py-0.5 text-[10px]"
          onClick={() => setStatusMode(mode => mode === 'narrative' ? 'numeric' : 'narrative')}
          aria-label={statusMode === 'narrative' ? '切换为数字状态' : '切换为自然语言状态'}
        >
          {statusMode === 'narrative' ? '看数字' : '看描述'}
        </ActionButton>
      </div>}
    </div>
    {onClose && <div className="absolute right-4 top-3"><IconButton label="返回聊天" onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={14} /></IconButton></div>}
  </section>
}

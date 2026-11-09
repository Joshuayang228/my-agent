import { useState } from 'react'
import { X } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'
import { ActionButton } from '../foundation/ActionButton'
import { CompanionAvatar } from '../CompanionAvatar'
import { WorldTodayTimeline } from './WorldTodayTimeline'

export interface WorldProfile {
  name: string
  description: string
  statusSummary?: string
  statusMetrics?: { mood: number; energy: number; socialNeed: number; relationshipSignal: number | null; relationshipPhase: string | null }
  avatarSrc?: string | null
  bannerSrc?: string | null
  themeColor?: string | null
}

/** 共享身份呈现不读取角色或夹具；调用方负责真实身份，缺省内容不得编造人设。 */
export function WorldProfileHeader({ profile, roleId, onTakeToChat, onViewMoment, onClose, testId = 'world-profile' }: {
  profile: WorldProfile
  roleId?: string
  onTakeToChat?: (opts: { text: string }) => void
  onViewMoment?: (momentId: string) => void
  onClose?: () => void
  testId?: string
}) {
  const name = profile.name.trim() || '伙伴'
  const [statusMode, setStatusMode] = useState<'narrative' | 'numeric'>('narrative')
  const hasBanner = Boolean(profile.bannerSrc)

  return (
    <section
      className={`relative flex min-h-[9.5rem] shrink-0 items-end gap-3.5 border-b px-5 pb-4 pt-14 overflow-hidden ${hasBanner ? 'shadow-inner' : ''}`}
      data-testid={testId}
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* 顶部宽幅生活场景 Banner 封面 */}
      {hasBanner && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <img
            src={profile.bannerSrc!}
            alt=""
            className="h-full w-full object-cover object-center transition-transform duration-700 ease-out hover:scale-105"
            style={{ filter: 'brightness(0.92)' }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, color-mix(in srgb, var(--bg-secondary) 80%, transparent) 40%, var(--bg-secondary) 100%)',
            }}
          />
        </div>
      )}

      {/* 角色专属大头像 */}
      <div className="relative z-10 shrink-0">
        <CompanionAvatar
          src={profile.avatarSrc}
          name={name}
          role="assistant"
          size="lg"
          shape="rounded"
          themeColor={profile.themeColor}
          className="ring-4 shadow-md !border-2"
        />
      </div>

      <div className="relative z-10 min-w-0 flex-1 pb-0.5">
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
        <WorldTodayTimeline roleId={roleId} onTakeToChat={onTakeToChat} onViewMoment={onViewMoment} />
      </div>
      {onClose && <div className="absolute right-4 top-3 z-20"><IconButton label="返回聊天" onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={14} /></IconButton></div>}
    </section>
  )
}

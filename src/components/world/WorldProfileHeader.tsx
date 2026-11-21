import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, RotateCcw, X } from 'lucide-react'
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

/**
 * 人物世界顶部主页头图与状态栏。
 *
 * 背景：顶部曾内置「看数字」RPG 数值切换并把今日轨迹卡片硬塞进封面内部，导致展开日程时拉扯封面图且暴露调试数值；
 * 同时右上角常驻 3 个换图按钮遮挡封面，且并发调用两次重置会被 visualBusy 锁吞掉第二次。
 * 设计意图：封面区仅保留纯净头图、头像、名称与自然语言状态；外观编辑收敛为点击展开的轻量菜单并串行重置；
 * 今日轨迹独立置于封面下方，展开时互不干扰。
 * 关键约束：不向正式产品界面暴露 0-100 数值条（数值留在 Debug）；缺省内容不编造人设。
 */
export function WorldProfileHeader({ profile, roleId, onTakeToChat, onViewMoment, onClose, testId = 'world-profile' }: {
  profile: WorldProfile
  roleId?: string
  onTakeToChat?: (opts: { text: string }) => void
  onViewMoment?: (momentId: string) => void
  onClose?: () => void
  testId?: string
}) {
  const name = profile.name.trim() || '伙伴'
  const [visualBusy, setVisualBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const canEditVisuals = Boolean(roleId && window.electronAPI?.companion?.pickRoleVisual)

  useEffect(() => {
    if (!menuOpen) return
    const handleOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  const handlePickVisual = async (slot: 'avatar' | 'banner') => {
    if (!canEditVisuals || visualBusy) return
    setVisualBusy(true)
    setMenuOpen(false)
    try {
      await window.electronAPI?.companion?.pickRoleVisual?.(slot, roleId)
    } finally {
      setVisualBusy(false)
    }
  }

  const handleResetAllVisuals = async () => {
    if (!canEditVisuals || visualBusy) return
    setVisualBusy(true)
    setMenuOpen(false)
    try {
      await window.electronAPI?.companion?.resetRoleVisual?.('avatar', roleId)
      await window.electronAPI?.companion?.resetRoleVisual?.('banner', roleId)
    } finally {
      setVisualBusy(false)
    }
  }

  const hasBanner = Boolean(profile.bannerSrc)

  return (
    <div className="shrink-0">
      <section
        className={`relative flex min-h-[9.5rem] items-end gap-3.5 border-b px-5 pb-4 pt-14 overflow-hidden ${hasBanner ? 'shadow-inner' : ''}`}
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
              className="h-full w-full object-cover object-center transition-transform duration-700 ease-out"
              style={{ filter: 'brightness(0.92)' }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.14) 0%, color-mix(in srgb, var(--bg-secondary) 82%, transparent) 46%, var(--bg-secondary) 100%)',
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
          {profile.description.trim() && (
            <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 [overflow-wrap:anywhere]" style={{ color: 'var(--text-secondary)' }}>
              {profile.description}
            </p>
          )}
          {profile.statusSummary?.trim() && (
            <p
              className="mt-1 text-[11px] leading-4 [overflow-wrap:anywhere]"
              data-testid="world-profile-status"
              style={{ color: 'var(--accent-fg)' }}
            >
              {profile.statusSummary}
            </p>
          )}
        </div>

        {/* 右上角收敛操作：轻量外观菜单 + 返回聊天 */}
        <div ref={menuRef} className="absolute right-4 top-3 z-20 flex items-center gap-1">
          {canEditVisuals ? (
            <div className="relative">
              <IconButton
                label="更换头像或封面"
                disabled={visualBusy}
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                style={{ color: 'var(--text-muted)' }}
              >
                <ImageIcon size={14} />
              </IconButton>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 flex w-32 flex-col gap-0.5 rounded-[var(--radius-md)] border p-1 shadow-lg"
                  style={{
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <ActionButton
                    variant="plain"
                    size="sm"
                    className="w-full justify-start text-left"
                    disabled={visualBusy}
                    onClick={() => void handlePickVisual('avatar')}
                    aria-label="更换头像"
                  >
                    更换头像
                  </ActionButton>
                  <ActionButton
                    variant="plain"
                    size="sm"
                    className="w-full justify-start text-left"
                    disabled={visualBusy}
                    onClick={() => void handlePickVisual('banner')}
                    aria-label="更换封面"
                  >
                    更换封面
                  </ActionButton>
                  <div className="my-0.5 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
                  <ActionButton
                    variant="plain"
                    size="sm"
                    className="w-full justify-start text-left"
                    disabled={visualBusy}
                    onClick={() => void handleResetAllVisuals()}
                    aria-label="恢复默认视觉"
                  >
                    <RotateCcw size={11} className="mr-1 inline" />
                    恢复默认
                  </ActionButton>
                </div>
              )}
            </div>
          ) : null}
          {onClose ? <IconButton label="返回聊天" onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={14} /></IconButton> : null}
        </div>
      </section>

      {/* 今日轨迹独立置于封面下方，展开全天日程时不再拉扯头图 */}
      <WorldTodayTimeline roleId={roleId} onTakeToChat={onTakeToChat} onViewMoment={onViewMoment} />
    </div>
  )
}

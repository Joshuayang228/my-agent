import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, MapPin, MessageSquareShare, RotateCcw, X } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'
import { ActionButton } from '../foundation/ActionButton'
import { CompanionAvatar } from '../CompanionAvatar'
import type { CompanionTodayTimeline } from '../../shared/types'

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50
  return Math.max(6, Math.min(100, Math.round(value)))
}

function describeVitalLevel(kind: 'mood' | 'energy' | 'social', value: number): string {
  if (kind === 'mood') return value >= 75 ? '明亮有劲' : value >= 45 ? '还算平稳' : '有点低落'
  if (kind === 'energy') return value >= 75 ? '精力充沛' : value >= 45 ? '精力还够用' : '有点累了'
  return value >= 70 ? '想找人聊聊' : value >= 40 ? '随缘聊两句' : '更想安静待会儿'
}

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
 * 人物世界顶部主页头图与轻状态栏。
 *
 * 背景：顶部曾并置封面、机械拼接的四维状态摘要与可展开 8 张日程卡的「今日轨迹」通栏，
 * 既提前剧透未来日程破坏活人感，又在展开时挤占 60%+ 视口高度。
 * 设计意图：移除前台「全天日程」面板与独立轨迹通栏（完整日程留在后台/Debug）；
 * 封面区收敛为纯净头图、头像、名称、一行简介与极简「此刻」轻状态胶囊（点击即可去聊天），
 * 大幅降低顶部高度并强化渐变底衬可读性。
 * 关键约束：不向正式产品界面暴露 0-100 数值条与未来日程剧透；缺省内容不编造人设。
 */
export function WorldProfileHeader({ profile, roleId, initialTimeline, onTakeToChat, onClose, testId = 'world-profile' }: {
  profile: WorldProfile
  roleId?: string
  initialTimeline?: CompanionTodayTimeline
  onTakeToChat?: (opts: { text: string }) => void
  onViewMoment?: (momentId: string) => void
  onClose?: () => void
  testId?: string
}) {
  const name = profile.name.trim() || '伙伴'
  const [visualBusy, setVisualBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [timeline, setTimeline] = useState<CompanionTodayTimeline | null>(initialTimeline ?? null)
  const menuRef = useRef<HTMLDivElement>(null)
  const canEditVisuals = Boolean(roleId && window.electronAPI?.companion?.pickRoleVisual)

  useEffect(() => {
    if (initialTimeline) {
      setTimeline(initialTimeline)
      return
    }
    let cancelled = false
    const refresh = () => {
      window.electronAPI?.companion?.getTodayTimeline?.(roleId)
        .then((data) => {
          if (!cancelled && data) setTimeline(data)
        })
        .catch(() => {})
    }
    refresh()
    const unsub = window.electronAPI?.companion?.onTimelineUpdated?.((payload) => {
      if (roleId && payload.roleId && payload.roleId !== roleId) return
      refresh()
    })
    const minuteInterval = setInterval(refresh, 60_000)
    return () => {
      cancelled = true
      unsub?.()
      clearInterval(minuteInterval)
    }
  }, [roleId, initialTimeline])

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
  const currentSlot = timeline?.slots?.length
    ? (timeline.slots[timeline.currentSlotIndex] ?? timeline.slots[0])
    : null

  return (
    <div className="shrink-0">
      <section
        className={`relative flex min-h-[7.75rem] items-end gap-3.5 px-5 pb-3.5 pt-10 overflow-hidden ${hasBanner ? 'shadow-inner' : ''}`}
        data-testid={testId}
        style={{
          background: 'var(--bg-primary)',
        }}
      >
        {/* 顶部宽幅生活场景 Banner 封面 */}
        {hasBanner && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <img
              src={profile.bannerSrc!}
              alt=""
              className="h-full w-full object-cover object-[center_22%] transition-transform duration-700 ease-out"
              style={{ filter: 'brightness(0.95)' }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, color-mix(in srgb, var(--bg-primary) 80%, transparent) 46%, var(--bg-primary) 100%)',
              }}
            />
          </div>
        )}

        {/* 角色专属大头像（纸白细边，避免默认 currentColor 黑圈） */}
        <div className="relative z-10 shrink-0">
          <CompanionAvatar
            src={profile.avatarSrc}
            name={name}
            role="assistant"
            size="lg"
            shape="rounded"
            themeColor={profile.themeColor}
            className="!border-2 shadow-sm"
          />
        </div>

        <div className="relative z-10 min-w-0 flex-1 pb-0.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-[17px] font-semibold leading-6 [overflow-wrap:anywhere]" style={{ color: 'var(--text-primary)' }}>{name}</h1>
            {currentSlot?.location && (
              <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <MapPin size={11} />
                {currentSlot.location}
              </span>
            )}
          </div>
          {currentSlot ? (
            <div className="mt-1.5 flex items-center" data-testid="world-profile-status">
              {onTakeToChat ? (
                <button
                  type="button"
                  onClick={() => onTakeToChat({ text: `听说你现在${currentSlot.location ? `在「${currentSlot.location}」` : ''}${currentSlot.activity}：` })}
                  data-testid="world-profile-current-activity"
                  className="group inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] leading-4 transition-colors hover:brightness-95"
                  style={{
                    background: 'color-mix(in srgb, var(--card-bg) 88%, transparent)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                  title="点击和TA聊聊此刻"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-fg)]" />
                  <span className="truncate">此刻 · {currentSlot.activity}</span>
                  <MessageSquareShare size={11} className="shrink-0 opacity-55 transition-opacity group-hover:opacity-100" style={{ color: 'var(--accent-fg)' }} />
                </button>
              ) : (
                <span
                  data-testid="world-profile-current-activity"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] leading-4"
                  style={{
                    background: 'color-mix(in srgb, var(--card-bg) 88%, transparent)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-fg)]" />
                  <span className="truncate">此刻 · {currentSlot.activity}</span>
                </span>
              )}
            </div>
          ) : profile.statusSummary?.trim() ? (
            <p
              className="mt-1 truncate text-[11px] leading-4"
              data-testid="world-profile-status"
              style={{ color: 'var(--accent-fg)' }}
            >
              {profile.statusSummary}
            </p>
          ) : null}
        </div>

        {/* 右下角极简无数字状态微条（心情 / 精力 / 兴致），悬停展示自然语言解读 */}
        {profile.statusMetrics && (
          <div
            className="relative z-10 hidden shrink-0 items-center gap-3 rounded-full border px-3 py-1.5 sm:flex"
            data-testid="world-profile-vitals"
            aria-label="当前状态"
            style={{
              background: 'color-mix(in srgb, var(--card-bg) 82%, transparent)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {([
              { key: 'mood', label: '心情', value: profile.statusMetrics.mood },
              { key: 'energy', label: '精力', value: profile.statusMetrics.energy },
              { key: 'social', label: '兴致', value: profile.statusMetrics.socialNeed },
            ] as const).map((vital) => (
              <div
                key={vital.key}
                className="flex items-center gap-1.5"
                title={`${vital.label}：${describeVitalLevel(vital.key, vital.value)}`}
              >
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{vital.label}</span>
                <span
                  className="block h-1.5 w-11 overflow-hidden rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--border-subtle) 85%, transparent)' }}
                >
                  <span
                    className="block h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${clampPercent(vital.value)}%`,
                      background: 'var(--accent-fg)',
                      opacity: 0.85,
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        )}

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
    </div>
  )
}

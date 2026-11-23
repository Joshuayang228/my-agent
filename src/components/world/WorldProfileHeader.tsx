import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, MapPin, MessageSquareShare, RotateCcw } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'
import { ActionButton } from '../foundation/ActionButton'
import { CompanionAvatar } from '../CompanionAvatar'
import type { CompanionTodayTimeline } from '../../shared/types'

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50
  return Math.max(6, Math.min(100, Math.round(value)))
}

function describeMoodShort(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  if (value >= 80) return '很开心'
  if (value >= 60) return '不错'
  if (value >= 40) return '平静'
  return '有点低落'
}

function describeVitalLevel(kind: 'mood' | 'energy', value: number): string {
  if (kind === 'mood') return value >= 75 ? '明亮有劲' : value >= 45 ? '还算平稳' : '有点低落'
  return value >= 75 ? '精力充沛' : value >= 45 ? '精力还够用' : '有点累了'
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
export function WorldProfileHeader({ profile, roleId, initialTimeline, onTakeToChat, testId = 'world-profile' }: {
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
  const moodWord = describeMoodShort(profile.statusMetrics?.mood)

  return (
    <div className="shrink-0">
      <section
        className={`relative flex min-h-[8.5rem] items-end gap-3.5 px-5 pb-4 pt-12 ${hasBanner ? 'shadow-inner' : ''}`}
        data-testid={testId}
        style={{
          background: 'var(--bg-primary)',
        }}
      >
        {/* 顶部宽幅生活场景 Banner 封面（保留原画色彩 + 底部轻暗角，不再发白发灰） */}
        {hasBanner && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <img
              src={profile.bannerSrc!}
              alt=""
              className="h-full w-full object-cover object-[center_22%] transition-transform duration-700 ease-out"
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.10) 42%, rgba(0,0,0,0.52) 100%)',
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
          <h1
            className="text-[17px] font-semibold leading-6 [overflow-wrap:anywhere]"
            style={{
              color: hasBanner ? '#ffffff' : 'var(--text-primary)',
              textShadow: hasBanner ? '0 1px 4px rgba(0,0,0,0.35)' : undefined,
            }}
          >
            {name}
          </h1>
          {currentSlot ? (
            <div className="mt-1 flex items-center" data-testid="world-profile-status">
              {onTakeToChat ? (
                <button
                  type="button"
                  onClick={() => onTakeToChat({ text: `听说你现在${currentSlot.location ? `在「${currentSlot.location}」` : ''}${currentSlot.activity}：` })}
                  data-testid="world-profile-current-activity"
                  className="group inline-flex max-w-full items-center gap-1.5 rounded-md py-0.5 text-[12px] leading-4 transition-opacity hover:opacity-100"
                  style={{
                    color: hasBanner ? 'rgba(255,255,255,0.92)' : 'var(--text-secondary)',
                    textShadow: hasBanner ? '0 1px 3px rgba(0,0,0,0.35)' : undefined,
                  }}
                  title="点击和TA聊聊此刻"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: hasBanner ? '#6ee7b7' : 'var(--accent-fg)' }} />
                  <span className="truncate">
                    {moodWord ? `${moodWord} · ` : ''}此刻 · {currentSlot.activity}
                  </span>
                  <MessageSquareShare size={11} className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
                </button>
              ) : (
                <span
                  data-testid="world-profile-current-activity"
                  className="inline-flex max-w-full items-center gap-1.5 text-[12px] leading-4"
                  style={{
                    color: hasBanner ? 'rgba(255,255,255,0.92)' : 'var(--text-secondary)',
                    textShadow: hasBanner ? '0 1px 3px rgba(0,0,0,0.35)' : undefined,
                  }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: hasBanner ? '#6ee7b7' : 'var(--accent-fg)' }} />
                  <span className="truncate">
                    {moodWord ? `${moodWord} · ` : ''}此刻 · {currentSlot.activity}
                  </span>
                </span>
              )}
            </div>
          ) : profile.statusSummary?.trim() ? (
            <p
              className="mt-1 truncate text-[12px] leading-4"
              data-testid="world-profile-status"
              style={{
                color: hasBanner ? 'rgba(255,255,255,0.92)' : 'var(--accent-fg)',
                textShadow: hasBanner ? '0 1px 3px rgba(0,0,0,0.35)' : undefined,
              }}
            >
              {profile.statusSummary}
            </p>
          ) : null}
        </div>

        {/* 右下角极简无数字双色状态微条（心情翠绿 / 精力天蓝），悬停展示自然语言解读 */}
        {profile.statusMetrics && (
          <div
            className="relative z-10 hidden shrink-0 items-center gap-3 rounded-full px-3 py-1.5 backdrop-blur-sm sm:flex"
            data-testid="world-profile-vitals"
            aria-label="当前状态"
            style={{
              background: hasBanner ? 'rgba(0,0,0,0.30)' : 'var(--card-bg)',
              border: hasBanner ? '1px solid rgba(255,255,255,0.16)' : '1px solid var(--border-subtle)',
            }}
          >
            {([
              {
                key: 'mood',
                label: '心情',
                value: profile.statusMetrics.mood,
                fill: 'linear-gradient(90deg, #6ee7b7 0%, #34d399 100%)',
              },
              {
                key: 'energy',
                label: '精力',
                value: profile.statusMetrics.energy,
                fill: 'linear-gradient(90deg, #93c5fd 0%, #60a5fa 100%)',
              },
            ] as const).map((vital) => (
              <div
                key={vital.key}
                className="flex items-center gap-1.5"
                title={`${vital.label}：${describeVitalLevel(vital.key, vital.value)}`}
              >
                <span
                  className="text-[11px]"
                  style={{ color: hasBanner ? 'rgba(255,255,255,0.88)' : 'var(--text-muted)' }}
                >
                  {vital.label}
                </span>
                <span
                  className="block h-1.5 w-14 overflow-hidden rounded-full"
                  style={{ background: hasBanner ? 'rgba(255,255,255,0.22)' : 'var(--border-subtle)' }}
                >
                  <span
                    className="block h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${clampPercent(vital.value)}%`,
                      background: vital.fill,
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 右上角位置轻胶囊 + 收敛外观菜单 */}
        <div ref={menuRef} className="absolute right-4 top-3 z-20 flex items-center gap-1.5">
          {currentSlot?.location && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] backdrop-blur-sm"
              style={{
                background: hasBanner ? 'rgba(0,0,0,0.32)' : 'var(--bg-secondary)',
                color: hasBanner ? 'rgba(255,255,255,0.92)' : 'var(--text-secondary)',
              }}
            >
              <MapPin size={11} />
              {currentSlot.location}
            </span>
          )}
          {canEditVisuals ? (
            <div className="relative">
              <IconButton
                label="更换头像或封面"
                disabled={visualBusy}
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                style={{ color: hasBanner ? 'rgba(255,255,255,0.88)' : 'var(--text-muted)' }}
              >
                <ImageIcon size={14} />
              </IconButton>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-1.5 flex w-32 flex-col gap-0.5 rounded-[var(--radius-md)] border p-1 shadow-lg"
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
        </div>
      </section>
    </div>
  )
}

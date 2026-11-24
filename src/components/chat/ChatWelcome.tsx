import type { ReactNode } from 'react'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { getWorldSurfaceIcon } from '../../shared/icon-registry'
import { ActionButton } from '../foundation/ActionButton'

export interface ChatWelcomeLatestMoment {
  id: string
  text: string
  publishedAt: number
  /** 首张配图缩略图（若有）；多图时配合 imageCount 展示 +N 角标 */
  thumbSrc?: string | null
  imageCount?: number
  onOpen: () => void
  onTalkAbout: () => void
}

interface ChatWelcomeProps {
  title: string
  subtitle: string
  /** 保留可选属性兼容历史调用方；空态首屏不再重复渲染中间头像 */
  avatarSrc?: string | null
  roleName?: string
  /** 居中输入框插槽：置于问候标题台词与毛玻璃朋友圈回声悬浮卡之间 */
  composer?: ReactNode
  /** 最新 1 条真实朋友圈动态悬浮切片卡：克制展示伙伴近期生活（支持有图/纯文两种形态） */
  latestMoment?: ChatWelcomeLatestMoment | null
  onGreet?: () => void
  onPlanDay?: () => void
  onAskRecent?: () => void
  onOpenWorld?: () => void
  actionTestId?: string
}

function formatRelativeMomentTime(publishedAt: number): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - publishedAt) / 60_000))
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} 天前`
  return new Date(publishedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

/**
 * 对话空态欢迎屏（ChatWelcome）。
 *
 * 背景：去掉输入框上方拦截视线的 3 颗模板胶囊后，中央首屏回归「时段问候 + 角色台词 → 居中嵌套输入卡 → 等宽毛玻璃朋友圈悬浮切片卡」。
 * 设计意图：以极简三段式聚焦呼吸感呈现数字伙伴的当下在场与独立生活世界，卡片点击即可聊聊这条动态。
 * 关键约束：仅使用 Foundation `ActionButton` 且不直连主进程 IPC，朋友圈图标严格从 `icon-registry` 派生。
 */
export function ChatWelcome({
  title,
  subtitle,
  roleName,
  composer,
  latestMoment,
}: ChatWelcomeProps) {
  const MomentsIcon = getWorldSurfaceIcon('moments')

  return (
    <div
      className="m-auto flex w-full flex-col items-center text-center"
      style={{ maxWidth: composer ? 'var(--layout-width)' : '32rem' }}
      data-testid="chat-welcome"
    >
      <h1
        className="break-words font-display text-[2.1rem] font-medium tracking-tight"
        style={{
          color: 'var(--text-primary)',
          overflowWrap: 'anywhere',
          textShadow: '0 1px 12px color-mix(in srgb, var(--bg-primary) 85%, transparent)',
        }}
      >
        {title}
      </h1>
      <p
        className="mt-2 max-w-lg whitespace-pre-wrap break-words text-[14.5px] leading-relaxed"
        style={{
          color: 'color-mix(in srgb, var(--text-primary) 72%, var(--text-secondary))',
          overflowWrap: 'anywhere',
          textShadow: '0 1px 12px color-mix(in srgb, var(--bg-primary) 85%, transparent)',
        }}
      >
        {subtitle}
      </p>

      {composer ? (
        <div className="mt-7 w-full text-left" data-testid="chat-welcome-composer">
          {composer}
        </div>
      ) : null}

      {latestMoment ? (
        <section
          onClick={latestMoment.onTalkAbout}
          className="group mt-7 w-full cursor-pointer rounded-[var(--radius-lg)] border px-4 py-3 text-left backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          style={{
            borderColor: 'color-mix(in srgb, var(--border-color) 65%, transparent)',
            background: 'color-mix(in srgb, var(--card-bg) 62%, transparent)',
          }}
          data-testid="chat-welcome-latest-moment"
          aria-label="伙伴最新动态"
        >
          <div className="flex items-center gap-3.5">
            {latestMoment.thumbSrc ? (
              <div
                className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[var(--radius-md)] border"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
                data-testid="chat-welcome-moment-thumb"
              >
                <img
                  src={latestMoment.thumbSrc}
                  alt="最新动态配图"
                  className="block h-full w-full object-cover"
                />
                {(latestMoment.imageCount ?? 1) > 1 && (
                  <span
                    className="absolute bottom-0.5 right-0.5 rounded px-1 text-[9px] font-medium leading-tight text-white"
                    style={{ background: 'rgba(0, 0, 0, 0.58)' }}
                  >
                    +{(latestMoment.imageCount ?? 1) - 1}
                  </span>
                )}
              </div>
            ) : (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}
                aria-hidden="true"
              >
                <MomentsIcon size={17} strokeWidth={1.7} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="truncate text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {roleName?.trim() || '伙伴'}
                </span>
                <span> · {formatRelativeMomentTime(latestMoment.publishedAt)}在朋友圈</span>
              </div>
              <p
                className="mt-0.5 line-clamp-2 break-words text-[13.5px] leading-relaxed"
                style={{ color: 'var(--text-primary)' }}
              >
                {latestMoment.text}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <ActionButton
                variant="plain"
                size="sm"
                onClick={latestMoment.onTalkAbout}
                aria-label="聊聊这条动态"
                title="聊聊这条动态"
                className="!min-h-0 !rounded-full border-0 !px-2.5 !py-1 !text-[12px] font-medium opacity-80 transition group-hover:opacity-100"
                style={{ color: 'var(--accent-fg)' }}
              >
                <span>聊聊</span>
                <ChevronRight size={13} className="ml-0.5" aria-hidden="true" />
              </ActionButton>
              <ActionButton
                variant="plain"
                size="sm"
                onClick={latestMoment.onOpen}
                aria-label="前往朋友圈查看"
                title="前往朋友圈查看"
                className="!h-7 !min-h-0 !w-7 !rounded-full border-0 !p-0"
                style={{ color: 'var(--text-muted)' }}
              >
                <ArrowUpRight size={14} aria-hidden="true" />
              </ActionButton>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

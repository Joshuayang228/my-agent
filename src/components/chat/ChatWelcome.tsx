import type { ReactNode } from 'react'
import { ArrowUpRight, MessageSquareShare } from 'lucide-react'
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
  /** 居中输入框插槽：置于 3 颗快捷提示词胶囊与最新动态轻卡之间 */
  composer?: ReactNode
  /** 最新 1 条真实朋友圈动态轻卡：克制展示伙伴近期生活（支持有图/无图两种形态） */
  latestMoment?: ChatWelcomeLatestMoment | null
  onGreet: () => void
  onPlanDay: () => void
  /** 第三颗纯提示词胶囊回调；未传时兼容回退 onOpenWorld */
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
 * 背景：用户反馈 3 颗快捷胶囊应全部为对话提示词并放在输入框上方，底部最新动态的操作收为纯图标并优雅兼容有图动态。
 * 设计意图：以「标题台词 → 3 颗纯提示词胶囊 → 居中输入框 → 单条最新动态轻卡（左图右文 / 纯文）」形成清晰聚焦动线。
 * 关键约束：仅使用 Foundation `ActionButton` 且不直连主进程 IPC，保证 Playground 与正式 Chat 同源复用。
 */
export function ChatWelcome({
  title,
  subtitle,
  composer,
  latestMoment,
  onGreet,
  onPlanDay,
  onAskRecent,
  onOpenWorld,
  actionTestId,
}: ChatWelcomeProps) {
  const promptChips = [
    { label: '打个招呼', onClick: onGreet },
    { label: '今天想怎么过？', onClick: onPlanDay },
    { label: '最近在忙啥呢？', onClick: onAskRecent ?? onOpenWorld ?? onGreet },
  ]

  return (
    <div
      className="m-auto flex w-full flex-col items-center text-center"
      style={{ maxWidth: composer ? 'var(--layout-width)' : '32rem' }}
      data-testid="chat-welcome"
    >
      <h1
        className="break-words font-display text-[2rem] font-medium tracking-tight"
        style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}
      >
        {title}
      </h1>
      <p
        className="mt-2.5 max-w-lg whitespace-pre-wrap break-words text-[15px] leading-relaxed"
        style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}
      >
        {subtitle}
      </p>

      {/* 3 颗纯对话提示词胶囊位于输入框上方，点击直接发起对应话题 */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {promptChips.map(({ label, onClick }) => (
          <ActionButton
            key={label}
            onClick={onClick}
            data-testid={actionTestId}
            className="max-w-full !rounded-full !px-3.5 py-1.5 !text-[12.5px] backdrop-blur-md transition hover:!border-[var(--border-color)] hover:!text-[var(--text-primary)]"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
              background: 'color-mix(in srgb, var(--card-bg) 82%, transparent)',
            }}
          >
            {label}
          </ActionButton>
        ))}
      </div>

      {composer ? (
        <div className="mt-5 w-full text-left" data-testid="chat-welcome-composer">
          {composer}
        </div>
      ) : null}

      {latestMoment ? (
        <section
          className="mt-5 w-full max-w-xl rounded-[var(--radius-card)] border px-4 py-3 text-left shadow-sm backdrop-blur-md transition"
          style={{
            borderColor: 'var(--border-subtle)',
            background: 'color-mix(in srgb, var(--card-bg) 78%, transparent)',
          }}
          data-testid="chat-welcome-latest-moment"
          aria-label="伙伴最新动态"
        >
          <div className="flex items-start gap-3">
            {latestMoment.thumbSrc ? (
              <div
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border"
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
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>最新动态</span>
                  <span>·</span>
                  <span>{formatRelativeMomentTime(latestMoment.publishedAt)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <ActionButton
                    variant="plain"
                    size="sm"
                    onClick={latestMoment.onTalkAbout}
                    aria-label="聊聊这条动态"
                    title="聊聊这条动态"
                    className="!h-6 !min-h-0 !w-6 !p-0"
                    style={{ color: 'var(--accent-fg)' }}
                  >
                    <MessageSquareShare size={13} aria-hidden="true" />
                  </ActionButton>
                  <ActionButton
                    variant="plain"
                    size="sm"
                    onClick={latestMoment.onOpen}
                    aria-label="前往朋友圈查看"
                    title="前往朋友圈查看"
                    className="!h-6 !min-h-0 !w-6 !p-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </ActionButton>
                </div>
              </div>
              <p
                className="mt-1 line-clamp-2 break-words text-[13.5px] leading-relaxed"
                style={{ color: 'var(--text-primary)' }}
              >
                {latestMoment.text}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

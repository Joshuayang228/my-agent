import type { ReactNode } from 'react'
import { ArrowUpRight, MessageSquareShare, Sparkles } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

export interface ChatWelcomeLatestMoment {
  id: string
  text: string
  publishedAt: number
  onOpen: () => void
  onTalkAbout: () => void
}

interface ChatWelcomeProps {
  title: string
  subtitle: string
  /** 保留可选属性兼容历史调用方；空态首屏不再重复渲染中间头像 */
  avatarSrc?: string | null
  roleName?: string
  /** 居中输入框插槽：提供时将输入框置于标题台词与快捷胶囊之间，贴合桌面端聚焦开聊节奏 */
  composer?: ReactNode
  /** 最新 1 条真实朋友圈动态轻卡：克制展示伙伴正在过自己的生活，不堆叠成信息流 */
  latestMoment?: ChatWelcomeLatestMoment | null
  onGreet: () => void
  onPlanDay: () => void
  onOpenWorld: () => void
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
 * 背景：侧栏顶部与对话氛围壁纸已充分呈现伙伴形象，旧版居中圆头像与第三人称简介显得模板化且重复；
 * 同时输入框贴底导致画面上下割裂、缺少伙伴近期生活温度。
 * 设计意图：去头像，以「主标题 + 角色第一人称台词 → 居中输入框 → 统一清透胶囊 → 单条最新朋友圈轻卡」组织视觉重心。
 * 关键约束：仅使用 Foundation `ActionButton` 且不直连主进程 IPC，保证 Playground 与正式 Chat 同源复用。
 */
export function ChatWelcome({
  title,
  subtitle,
  composer,
  latestMoment,
  onGreet,
  onPlanDay,
  onOpenWorld,
  actionTestId,
}: ChatWelcomeProps) {
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

      {composer ? (
        <div className="mt-7 w-full text-left" data-testid="chat-welcome-composer">
          {composer}
        </div>
      ) : null}

      <div className={`${composer ? 'mt-4' : 'mt-7'} flex flex-wrap justify-center gap-2`}>
        {[
          { label: '打个招呼', onClick: onGreet },
          { label: '今天想怎么过？', onClick: onPlanDay },
          { label: '看看朋友圈', onClick: onOpenWorld },
        ].map(({ label, onClick }) => (
          <ActionButton
            key={label}
            onClick={onClick}
            data-testid={actionTestId}
            className="max-w-full !rounded-full !px-3.5 py-1.5 !text-[12px] backdrop-blur-md transition hover:!border-[var(--border-color)] hover:!text-[var(--text-primary)]"
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

      {latestMoment ? (
        <section
          className="mt-6 w-full max-w-xl rounded-[var(--radius-card)] border px-4 py-3 text-left shadow-sm backdrop-blur-md transition"
          style={{
            borderColor: 'var(--border-subtle)',
            background: 'color-mix(in srgb, var(--card-bg) 78%, transparent)',
          }}
          data-testid="chat-welcome-latest-moment"
          aria-label="伙伴最新动态"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <Sparkles size={12} style={{ color: 'var(--accent-fg)' }} aria-hidden="true" />
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>最新动态</span>
              <span>·</span>
              <span>{formatRelativeMomentTime(latestMoment.publishedAt)}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ActionButton
                variant="plain"
                size="sm"
                onClick={latestMoment.onTalkAbout}
                className="!min-h-0 gap-1 !px-2 !py-0.5 !text-[11px]"
                style={{ color: 'var(--accent-fg)' }}
              >
                <MessageSquareShare size={11} aria-hidden="true" />
                聊聊这条
              </ActionButton>
              <ActionButton
                variant="plain"
                size="sm"
                onClick={latestMoment.onOpen}
                className="!min-h-0 gap-0.5 !px-1.5 !py-0.5 !text-[11px]"
                style={{ color: 'var(--text-muted)' }}
              >
                去看看
                <ArrowUpRight size={11} aria-hidden="true" />
              </ActionButton>
            </div>
          </div>
          <p
            className="mt-1.5 line-clamp-2 break-words text-[13px] leading-relaxed"
            style={{ color: 'var(--text-primary)' }}
          >
            {latestMoment.text}
          </p>
        </section>
      ) : null}
    </div>
  )
}

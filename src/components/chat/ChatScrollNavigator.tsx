import { useState } from 'react'
import { ArrowDown } from 'lucide-react'

export interface ChatTurnAnchor {
  id: string
  preview: string
  replyPreview?: string
  timestamp?: number
}

/**
 * 格式化用户在导航轨中展示的紧凑摘要。
 */
export function formatTurnPreview(content: string, maxLen = 68): string {
  const singleLine = content.replace(/\s+/g, ' ').trim()
  if (!singleLine) return '（空消息）'
  return singleLine.length > maxLen ? `${singleLine.slice(0, maxLen)}…` : singleLine
}

function formatTurnClock(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(timestamp)
  } catch {
    return ''
  }
}

/**
 * 长对话左侧轮次圆点跳转轨（参考 Antigravity 极简圆点导航）。
 *
 * 背景：整表展开会遮挡正文，给轨道加白底像贴补丁；用户只需要悬停某颗圆点预览该轮问答，点击即跳。
 * 设计意图：左侧边缘纯透明竖排极简圆点（零白底补丁）；悬停单颗圆点时，仅在其右侧轻显该轮的紧凑预览卡
 * （用户发言 + 助手回复摘录 + 轮次/时间），点击平滑滚动至对应发言。
 * 关键约束：少于 2 条用户发言时不渲染，保持短对话纯净无噪音。
 */
export function ChatTurnRail({
  turns,
  activeTurnId,
  onJumpToTurn,
}: {
  turns: readonly ChatTurnAnchor[]
  activeTurnId: string | null
  onJumpToTurn: (id: string) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (turns.length < 2) return null

  const compact = turns.length > 20

  return (
    <div
      className="pointer-events-auto absolute left-2.5 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center sm:flex"
      aria-label="对话轮次导航"
      data-testid="chat-turn-rail"
    >
      <div className={`flex flex-col items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {turns.map((turn, idx) => {
          const isActive = turn.id === activeTurnId
          const isHovered = turn.id === hoveredId
          const timeText = formatTurnClock(turn.timestamp)
          return (
            <div
              key={turn.id}
              className="relative flex items-center"
              onMouseEnter={() => setHoveredId(turn.id)}
              onMouseLeave={() => setHoveredId((prev) => (prev === turn.id ? null : prev))}
            >
              <button
                type="button"
                onClick={() => onJumpToTurn(turn.id)}
                onFocus={() => setHoveredId(turn.id)}
                onBlur={() => setHoveredId((prev) => (prev === turn.id ? null : prev))}
                aria-label={`跳转到第 ${idx + 1} 轮：${turn.preview}`}
                className="flex h-3 w-3 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-fg)]"
              >
                <span
                  className={`block rounded-full transition-all duration-150 ${
                    isActive
                      ? 'h-2 w-2'
                      : isHovered
                        ? 'h-2 w-2 scale-110'
                        : 'h-1.5 w-1.5'
                  }`}
                  style={{
                    background: isActive
                      ? 'var(--accent-fg)'
                      : isHovered
                        ? 'var(--text-primary)'
                        : 'color-mix(in srgb, var(--text-muted) 45%, transparent)',
                  }}
                />
              </button>

              {isHovered && (
                <div
                  className="pointer-events-none absolute left-full top-1/2 ml-2.5 w-64 -translate-y-1/2 rounded-[var(--radius-md)] border px-3 py-2.5 shadow-lg backdrop-blur-md"
                  style={{
                    background: 'color-mix(in srgb, var(--card-bg) 95%, transparent)',
                    borderColor: 'var(--border-subtle)',
                  }}
                  data-testid="chat-turn-rail-preview"
                >
                  <p
                    className="line-clamp-2 break-words text-[12px] font-medium leading-4"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {turn.preview}
                  </p>
                  {turn.replyPreview && (
                    <p
                      className="mt-1.5 line-clamp-2 break-words text-[11px] leading-4"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {turn.replyPreview}
                    </p>
                  )}
                  <div
                    className="mt-2 flex items-center justify-between text-[10px] tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span>{idx + 1} / {turns.length}</span>
                    {timeText && <span>{timeText}</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 底部居中「回到底部」悬浮箭头按钮。
 *
 * 背景：长对话向上翻阅历史后，手动滚回最底端费力。
 * 设计意图：仅在距离底部超过阈值时轻盈浮现于输入框正上方中央，一键平滑回底。
 */
export function ChatScrollToBottomButton({
  visible,
  onClick,
}: {
  visible: boolean
  onClick: () => void
}) {
  if (!visible) return null
  return (
    <div className="pointer-events-none absolute -top-11 left-1/2 z-20 -translate-x-1/2">
      <button
        type="button"
        onClick={onClick}
        aria-label="回到底部"
        title="回到底部"
        data-testid="chat-scroll-to-bottom"
        className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-all hover:brightness-95 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-fg)]"
        style={{
          background: 'color-mix(in srgb, var(--card-bg) 92%, transparent)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
      >
        <ArrowDown size={15} />
      </button>
    </div>
  )
}

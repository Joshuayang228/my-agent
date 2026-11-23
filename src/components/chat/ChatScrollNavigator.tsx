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
  const hoveredIdx = hoveredId ? turns.findIndex((t) => t.id === hoveredId) : -1

  return (
    <div
      className="pointer-events-auto absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-start py-2 sm:flex"
      aria-label="对话轮次导航"
      data-testid="chat-turn-rail"
      onMouseLeave={() => setHoveredId(null)}
    >
      <div className="flex flex-col items-start">
        {turns.map((turn, idx) => {
          const isActive = turn.id === activeTurnId
          const isHovered = turn.id === hoveredId
          const distance = hoveredIdx >= 0 ? Math.abs(idx - hoveredIdx) : -1
          const timeText = formatTurnClock(turn.timestamp)
          const barWidthClass = distance === 0
            ? 'w-6'
            : distance === 1
              ? 'w-4'
              : distance === 2
                ? 'w-3'
                : isActive
                  ? 'w-3.5'
                  : 'w-2'
          const barColor = distance === 0
            ? 'var(--text-primary)'
            : isActive
              ? 'var(--accent-fg)'
              : distance === 1
                ? 'color-mix(in srgb, var(--text-secondary) 70%, transparent)'
                : distance === 2
                  ? 'color-mix(in srgb, var(--text-muted) 60%, transparent)'
                  : 'color-mix(in srgb, var(--text-muted) 42%, transparent)'
          return (
            <div
              key={turn.id}
              className="relative flex items-center"
              onMouseEnter={() => setHoveredId(turn.id)}
            >
              {/* 宽大无缝热区（靠左边缘 44px 宽 × 14px 高、纵向零缝隙），贴合 Codex 顺滑扫过与点击手感 */}
              <button
                type="button"
                onClick={() => onJumpToTurn(turn.id)}
                onFocus={() => setHoveredId(turn.id)}
                onBlur={() => setHoveredId((prev) => (prev === turn.id ? null : prev))}
                aria-label={`跳转到第 ${idx + 1} 轮：${turn.preview}`}
                className={`flex w-11 cursor-pointer items-center justify-start pl-2.5 pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-fg)] ${
                  compact ? 'py-1' : 'py-1.5'
                }`}
              >
                <span
                  className={`block h-[2px] rounded-full transition-all duration-150 ${barWidthClass}`}
                  style={{ background: barColor }}
                />
              </button>

              {isHovered && (
                <div
                  className="pointer-events-none absolute left-full top-1/2 ml-1 w-64 -translate-y-1/2 rounded-[var(--radius-md)] border px-3 py-2.5 shadow-lg backdrop-blur-md"
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

import { useEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'

export interface ChatTurnAnchor {
  id: string
  preview: string
}

/**
 * 格式化用户在导航轨中展示的单行摘要。
 */
export function formatTurnPreview(content: string): string {
  const singleLine = content.replace(/\s+/g, ' ').trim()
  if (!singleLine) return '（空消息）'
  return singleLine.length > 42 ? `${singleLine.slice(0, 42)}…` : singleLine
}

/**
 * 长对话左侧轮次小横杠导航轨（参考 Codex / Antigravity 对话跳转条）。
 *
 * 背景：长上下文对话中，用户反复上滑定位自己此前发过的某条指令非常耗时。
 * 设计意图：在对话区左侧边缘常驻极简小横杠（每条用户消息一格，当前可视轮次高亮加宽）；
 * 悬停时展开紧凑浮层目录，点击任意横杠或条目即可平滑跳转到对应发言位置。
 * 关键约束：少于 2 条用户发言时不渲染，保持短对话纯净无噪音；浮层不遮挡正文输入区。
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
  const [open, setOpen] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverJumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      if (hoverJumpTimerRef.current) clearTimeout(hoverJumpTimerRef.current)
    }
  }, [])

  if (turns.length < 2) return null

  const scheduleHoverJump = (turnId: string) => {
    if (hoverJumpTimerRef.current) clearTimeout(hoverJumpTimerRef.current)
    hoverJumpTimerRef.current = setTimeout(() => {
      onJumpToTurn(turnId)
    }, 80)
  }

  const handleEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setOpen(true)
  }

  const handleLeave = () => {
    if (hoverJumpTimerRef.current) {
      clearTimeout(hoverJumpTimerRef.current)
      hoverJumpTimerRef.current = null
    }
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => setOpen(false), 140)
  }

  // 超过 18 轮时压缩小横杠间距，保证整条轨道始终稳稳落在一屏内
  const compact = turns.length > 18

  return (
    <div
      className="pointer-events-auto absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 items-center sm:flex"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      data-testid="chat-turn-rail"
    >
      {/* 极简小横杠触发轨 */}
      <div
        className={`flex flex-col items-start rounded-full px-1.5 py-2 transition-colors ${compact ? 'gap-1' : 'gap-1.5'}`}
        style={{
          background: open ? 'color-mix(in srgb, var(--card-bg) 78%, transparent)' : 'transparent',
        }}
        aria-label="对话轮次导航"
      >
        {turns.map((turn, idx) => {
          const isActive = turn.id === activeTurnId
          return (
            <button
              key={turn.id}
              type="button"
              onMouseEnter={() => scheduleHoverJump(turn.id)}
              onClick={() => onJumpToTurn(turn.id)}
              aria-label={`跳转到第 ${idx + 1} 轮：${turn.preview}`}
              className="group flex h-2.5 items-center py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-fg)]"
            >
              <span
                className={`block h-[2.5px] rounded-full transition-all duration-150 ${
                  isActive ? 'w-4' : 'w-2.5 group-hover:w-3.5'
                }`}
                style={{
                  background: isActive
                    ? 'var(--accent-fg)'
                    : 'color-mix(in srgb, var(--text-muted) 42%, transparent)',
                }}
              />
            </button>
          )
        })}
      </div>

      {/* 悬停展开的极简跳转目录（无多余标题与编号，悬停即联动定位、点击锁定收起） */}
      {open && (
        <div
          className="ml-1.5 max-h-64 w-56 overflow-y-auto rounded-[var(--radius-md)] border p-1 shadow-md backdrop-blur-md"
          style={{
            background: 'color-mix(in srgb, var(--card-bg) 92%, transparent)',
            borderColor: 'var(--border-subtle)',
          }}
          data-testid="chat-turn-rail-popover"
        >
          <div className="flex flex-col gap-0.5">
            {turns.map((turn) => {
              const isActive = turn.id === activeTurnId
              return (
                <button
                  key={turn.id}
                  type="button"
                  onMouseEnter={() => scheduleHoverJump(turn.id)}
                  onClick={() => {
                    if (hoverJumpTimerRef.current) clearTimeout(hoverJumpTimerRef.current)
                    onJumpToTurn(turn.id)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] leading-4 transition-colors hover:bg-[var(--hover-overlay)]"
                  style={{
                    background: isActive ? 'var(--accent-subtle)' : undefined,
                    color: isActive ? 'var(--accent-fg)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{turn.preview}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
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

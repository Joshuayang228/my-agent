/**
 * 今日生活轨迹时间线组件（WorldTodayTimeline）
 *
 * 背景：角色一日生活由日剧本驱动，事件与动态按时间槽推进；但前端此前无法直观呈现今日轨迹。
 * 设计意图：在人物世界展示流动的「今日生活时间线」，展示今日主题、全天时段安排与当前进行中事项，
 * 并支持一键切入主会话聊聊当前生活或特定时段活动。
 * 关键约束：纯展示组件，交互控件统一使用 Foundation 基础组件。
 */

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Clock, MapPin, MessageSquareShare, Newspaper } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import type { CompanionTodayTimeline } from '../../shared/types'

export function WorldTodayTimeline({
  roleId,
  initialTimeline,
  onTakeToChat,
  onViewMoment,
}: {
  roleId?: string
  initialTimeline?: CompanionTodayTimeline
  onTakeToChat?: (opts: { text: string }) => void
  onViewMoment?: (momentId: string) => void
}) {
  const [timeline, setTimeline] = useState<CompanionTodayTimeline | null>(initialTimeline ?? null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (initialTimeline) {
      setTimeline(initialTimeline)
      return
    }
    let cancelled = false
    const refresh = () => {
      window.electronAPI?.companion?.getTodayTimeline(roleId)
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

  if (!timeline || !timeline.slots.length) return null

  const currentSlot = timeline.slots[timeline.currentSlotIndex] ?? timeline.slots[0]

  return (
    <div
      className="mt-2 w-full rounded-lg border p-2.5 transition"
      data-testid="world-today-timeline"
      style={{
        background: 'color-mix(in srgb, var(--card-bg) 60%, transparent)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Clock size={13} style={{ color: 'var(--accent-fg)' }} />
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
            今日轨迹 · 《{timeline.theme}》
          </span>
          {currentSlot && (
            <Badge tone="accent">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-fg)] animate-pulse" />
              {currentSlot.timeStr} {currentSlot.activity}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {currentSlot && onTakeToChat && (
            <ActionButton
              tone="accent"
              size="sm"
              onClick={() => onTakeToChat({ text: `听说你今天在「${currentSlot.location}」${currentSlot.activity}：` })}
              data-testid="timeline-chat-current"
            >
              <MessageSquareShare size={12} className="mr-1 inline" />
              聊聊此刻
            </ActionButton>
          )}
          <ActionButton
            variant="plain"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            data-testid="timeline-toggle-expand"
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={13} className="mr-1 inline" /> : <ChevronDown size={13} className="mr-1 inline" />}
            {expanded ? '收起日程' : '全天日程'}
          </ActionButton>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t pt-2.5" style={{ borderColor: 'var(--border-subtle)' }} data-testid="timeline-expanded-slots">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {timeline.slots.map((slot, index) => {
              const isCurrent = slot.status === 'current'
              const isPast = slot.status === 'past'
              return (
                <div
                  key={index}
                  className="flex items-start justify-between gap-2 rounded-md border p-2 text-[11px] transition"
                  style={{
                    borderColor: isCurrent ? 'var(--accent-fg)' : 'var(--border-subtle)',
                    background: isCurrent ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                  }}
                  data-testid={`timeline-slot-${slot.hour}-${slot.minute}`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-medium" style={{ color: isCurrent ? 'var(--accent-fg)' : 'var(--text-primary)' }}>
                        {slot.timeStr}
                      </span>
                      <Badge tone={isCurrent ? 'accent' : isPast ? 'neutral' : 'neutral'}>
                        {isCurrent ? '进行中' : isPast ? '已完成' : '未开始'}
                      </Badge>
                      {slot.mood && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          心情：{slot.mood}
                        </span>
                      )}
                    </div>
                    <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {slot.activity}
                    </p>
                    {slot.location && (
                      <p className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={10} />
                        {slot.location}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {onTakeToChat && (
                      <ActionButton
                        variant="plain"
                        size="sm"
                        onClick={() => onTakeToChat({ text: `关于你今天安排的「${slot.activity}」：` })}
                        title="和TA聊聊这个安排"
                      >
                        <MessageSquareShare size={12} className="mr-1 inline" />
                        聊聊
                      </ActionButton>
                    )}
                    {slot.momentId && onViewMoment && (
                      <ActionButton
                        variant="plain"
                        size="sm"
                        onClick={() => onViewMoment(slot.momentId!)}
                        title="查看关联的朋友圈动态"
                      >
                        <Newspaper size={12} className="mr-1 inline" />
                        看动态
                      </ActionButton>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

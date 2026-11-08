/**
 * 角色今日生活轨迹（Today Timeline）
 *
 * 背景：角色一日生活由日剧本驱动，事件与动态按时间槽推进；但前端此前无法直观呈现今日轨迹。
 * 设计意图：聚合当日日剧本（主题、全天时段）、事件实际发布状态与关联 Moment，计算当前进行中时段，
 * 为人物世界提供流动、连贯的「今日生活时间线」，让用户可随时查看伙伴今日的生活轨迹并一键发起对话。
 * 关键约束：纯只读/聚合能力，缺省时尽力补齐当日剧本，不修改世界状态水位线或触发外部生图。
 */

import type { CompanionTodayTimeline, CompanionTodayTimelineSlot } from '../../../src/shared/types'
import { toLocalDateString, localDateTimeMs } from './dates'
import * as store from './store'
import { generateDayScript } from './script-generator'
import { ensureDayScripts } from './engine'
import type { DayScriptPayload } from '../types'

export async function getTodayTimelineForRole(
  roleId: string,
  now = Date.now(),
): Promise<CompanionTodayTimeline> {
  const date = toLocalDateString(now)
  let dayScriptRow = await store.getDayScript(roleId, date)

  if (!dayScriptRow) {
    try {
      await ensureDayScripts(roleId, date, date, { preferLlm: true })
      dayScriptRow = await store.getDayScript(roleId, date)
    } catch {
      // 降级为确定性哈希剧本
    }
  }

  const payload: DayScriptPayload = dayScriptRow?.payload ?? generateDayScript(roleId, date)
  const allEvents = await store.listEvents(roleId).catch(() => [])

  const slots: CompanionTodayTimelineSlot[] = []

  for (let i = 0; i < payload.slots.length; i++) {
    const slot = payload.slots[i]
    const scheduledAt = localDateTimeMs(date, slot.hour, slot.minute)
    const nextSlot = payload.slots[i + 1]
    const nextScheduledAt = nextSlot
      ? localDateTimeMs(date, nextSlot.hour, nextSlot.minute)
      : scheduledAt + 2 * 3_600_000

    let status: 'past' | 'current' | 'upcoming'
    if (now < scheduledAt) {
      status = 'upcoming'
    } else if (now >= scheduledAt && now < nextScheduledAt) {
      status = 'current'
    } else {
      status = 'past'
    }

    const event = allEvents.find((e) => Math.abs(e.scheduledAt - scheduledAt) < 60_000)
    let momentId: string | undefined = undefined

    if (event && event.status === 'published') {
      try {
        const moment = await store.getMomentByEventId(roleId, event.id)
        if (moment) momentId = moment.id
      } catch {
        // 忽略读取错误
      }
    }

    slots.push({
      hour: slot.hour,
      minute: slot.minute,
      timeStr: `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`,
      activity: slot.activity,
      mood: slot.mood,
      location: slot.location,
      type: slot.type,
      status,
      scheduledAt,
      eventId: event?.id,
      momentId,
    })
  }

  const currentIdx = slots.findIndex((s) => s.status === 'current')
  const currentSlotIndex = currentIdx !== -1
    ? currentIdx
    : (now < (slots[0]?.scheduledAt ?? 0) ? 0 : Math.max(0, slots.length - 1))

  return {
    roleId,
    date,
    theme: payload.theme,
    slots,
    currentSlotIndex,
  }
}

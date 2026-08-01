/**
 * Moments 投影（W3）
 *
 * 背景：朋友圈是 published 事件的 UI 截面，不是另一套生活真相。
 * 意图：事件 → companion_moments；列表仅按 role 查询（IPC 再限 active）。
 */

import type { CompanionEvent, CompanionMoment } from '../types'
import * as store from './store'

export function formatMomentText(event: CompanionEvent): string {
  const p = event.payload
  const activity = String(p.activity ?? event.type)
  const mood = p.mood ? `（${String(p.mood)}）` : ''
  const location = p.location ? ` · ${String(p.location)}` : ''
  if (event.type === 'moment') {
    return `${activity}${mood}${location}`
  }
  return `${activity}${mood}${location}`
}

/** 将已 published 事件投影为 moment（幂等） */
export async function projectMomentFromEvent(
  event: CompanionEvent,
): Promise<CompanionMoment | null> {
  if (event.status !== 'published') return null
  // 朋友圈优先 moment 类型；activity 也投影，方便时间线有内容
  return store.insertMoment({
    roleId: event.roleId,
    eventId: event.id,
    publishedAt: event.scheduledAt,
    text: formatMomentText(event),
    meta: {
      type: event.type,
      mood: event.payload.mood,
      location: event.payload.location,
      theme: event.payload.theme,
    },
  })
}

/**
 * 发布 [fromMs, toMs] 内 planned 事件并投影 moments。
 * 返回新 published 数量。
 */
export async function publishAndProjectRange(
  roleId: string,
  fromMs: number,
  toMs: number,
): Promise<number> {
  const planned = await store.listEvents(roleId, { status: 'planned' })
  let n = 0
  for (const ev of planned) {
    if (ev.scheduledAt < fromMs || ev.scheduledAt > toMs) continue
    await store.markEventPublished(ev.id)
    const published: CompanionEvent = { ...ev, status: 'published' }
    await projectMomentFromEvent(published)
    n += 1
  }
  return n
}

/** tick 用：发布所有 scheduled_at <= now 的 planned 并投影 */
export async function publishAndProjectDue(roleId: string, now: number): Promise<number> {
  return publishAndProjectRange(roleId, 0, now)
}

export async function listMomentsForRole(
  roleId: string,
  opts?: { limit?: number; offset?: number },
): Promise<CompanionMoment[]> {
  return store.listMoments(roleId, opts)
}

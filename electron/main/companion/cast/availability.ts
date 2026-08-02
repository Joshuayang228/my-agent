/**
 * 卡司可用性（对照 Alice checkFriendAvailability）
 *
 * 背景：Alice 召唤朋友前会按 busyHours/busyDays + declineRate 婉拒并给改约建议。
 * 意图：召唤开聊前可 soft-block；仍允许 force。日程槽位优先于静态忙闲表。
 * 约束：不 resume / 不 tick 对方生活；纯查询。单测可注入 now / random。
 */

import { loadRolePack } from '../identity/loader'
import { toLocalDateString } from '../life/dates'
import { getDayScript, listEvents } from '../life/store'

export interface BusyProfile {
  /** 0–23 */
  busyHours: number[]
  /** 0=周日 … 6=周六 */
  busyDays: number[]
  /** 0–1，非忙时段的随机婉拒概率基数（Alice 用 0.5 * declineRate） */
  declineRate: number
}

/** 静态忙闲：NPC / 薄主角；无配置则默认较空闲 */
export const BUSY_PROFILES: Record<string, BusyProfile> = {
  chen: {
    busyHours: [10, 11, 14, 15, 16, 17, 18, 19],
    busyDays: [1, 2, 3, 4, 5],
    declineRate: 0.4,
  },
  ayu: {
    busyHours: [9, 10, 11, 19, 20, 21],
    busyDays: [0, 5, 6],
    declineRate: 0.25,
  },
  zhou: {
    busyHours: [14, 15, 16, 17],
    busyDays: [1, 2, 3, 4, 5],
    declineRate: 0.2,
  },
  xia: {
    busyHours: [22, 23, 0, 1],
    busyDays: [0, 1, 2, 3, 4, 5, 6],
    declineRate: 0.15,
  },
  lin: {
    busyHours: [10, 11, 15, 16, 17],
    busyDays: [1, 2, 3, 4, 5],
    declineRate: 0.15,
  },
}

const DECLINE_REASONS = [
  '今天事情有点堆，不太方便长聊',
  '手头正忙着收尾一件事',
  '这会儿注意力不太在线，怕聊不好',
  '刚约了别的事，挤不出整块时间',
]

export interface CastAvailability {
  available: boolean
  roleId: string
  name: string
  /** 不可用时的口语理由 */
  reason?: string
  /** 改约建议，如「要不改今天 19 点？」 */
  alternative?: string
  /** 此刻日程/在场一句话（不论是否可用） */
  presence?: string
}

export interface AvailabilityOpts {
  now?: number
  /** 注入 [0,1) 随机源；默认 Math.random */
  random?: () => number
  universeId?: string
}

function pickReason(random: () => number): string {
  const i = Math.floor(random() * DECLINE_REASONS.length) % DECLINE_REASONS.length
  return DECLINE_REASONS[i]
}

function suggestAlternative(now: Date, random: () => number): string {
  const hour = now.getHours()
  if (hour >= 20 || random() < 0.35) return '要不改明天？'
  const next = hour < 18 ? 19 : Math.min(22, hour + 2)
  return `要不改今天 ${next} 点？`
}

/**
 * 从日剧本/事件推断「此刻在干嘛」。
 */
export async function describeCastPresence(
  roleId: string,
  opts: AvailabilityOpts = {},
): Promise<string | undefined> {
  const now = opts.now ?? Date.now()
  const date = toLocalDateString(now)
  const windowMs = 75 * 60 * 1000

  try {
    const events = await listEvents(roleId)
    const nearby = events
      .filter((e) => Math.abs(e.scheduledAt - now) <= windowMs)
      .sort((a, b) => Math.abs(a.scheduledAt - now) - Math.abs(b.scheduledAt - now))
    const hit = nearby[0]
    if (hit) {
      const activity = String(hit.payload.activity || '').trim()
      const location = String(hit.payload.location || '').trim()
      if (activity) {
        return location ? `${activity}（${location}）` : activity
      }
    }
  } catch {
    /* 无事件表时忽略 */
  }

  try {
    const script = await getDayScript(roleId, date)
    if (!script?.payload?.slots?.length) return undefined
    const hour = new Date(now).getHours()
    const slots = [...script.payload.slots].sort(
      (a, b) => Math.abs(a.hour - hour) - Math.abs(b.hour - hour),
    )
    const slot = slots[0]
    if (!slot) return undefined
    if (Math.abs(slot.hour - hour) > 2) return undefined
    return slot.location
      ? `${slot.activity}（${slot.location}）`
      : slot.activity
  } catch {
    return undefined
  }
}

function isBusyActivity(text: string): boolean {
  return /加班|开会|赶工|deadline|专注|推进|通勤|开工|忙碌/i.test(text)
}

/**
 * 召唤前可用性检查。受 Alice `checkFriendAvailability` 启发，逻辑自研。
 */
export async function checkCastAvailability(
  roleId: string,
  opts: AvailabilityOpts = {},
): Promise<CastAvailability> {
  const universeId = opts.universeId ?? 'default'
  const nowMs = opts.now ?? Date.now()
  const random = opts.random ?? Math.random
  const pack = loadRolePack(roleId, universeId)
  const presence = await describeCastPresence(roleId, { now: nowMs, universeId })

  // 日程显示正在忙 → 高概率婉拒
  if (presence && isBusyActivity(presence) && random() < 0.75) {
    return {
      available: false,
      roleId,
      name: pack.name,
      reason: `${pack.name}说：在忙「${presence}」`,
      alternative: suggestAlternative(new Date(nowMs), random),
      presence,
    }
  }

  const profile = BUSY_PROFILES[roleId]
  if (!profile) {
    return { available: true, roleId, name: pack.name, presence }
  }

  const d = new Date(nowMs)
  const hour = d.getHours()
  const day = d.getDay()
  const inBusyWindow =
    profile.busyHours.includes(hour) && profile.busyDays.includes(day)

  if (inBusyWindow && random() < 0.7) {
    return {
      available: false,
      roleId,
      name: pack.name,
      reason: `${pack.name}说：${pickReason(random)}`,
      alternative: suggestAlternative(d, random),
      presence,
    }
  }

  if (random() < 0.5 * profile.declineRate) {
    return {
      available: false,
      roleId,
      name: pack.name,
      reason: `${pack.name}说：${pickReason(random)}`,
      alternative: suggestAlternative(d, random),
      presence,
    }
  }

  return { available: true, roleId, name: pack.name, presence }
}

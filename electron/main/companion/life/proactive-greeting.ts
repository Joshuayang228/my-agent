/**
 * 定时主动问候（M31-G3 / L4）
 *
 * 背景：L4 打扰最高，必须默认可关，且文案只能挂在已有 World 增量上。
 * 意图：life ticker 周期检查；有近 Moment 且未问候过当日时，发应用内找上门气泡。
 * 约束：默认关闭；复用勿扰窗；不发系统桌面通知；无 Moment 绝不空喊「想我了吗」。
 */

import { BrowserWindow } from 'electron'
import * as settings from '../../storage/settings-store'
import * as identity from '../identity/loader'
import { toLocalDateString } from './dates'
import { listMomentsForRole } from './moments'
import {
  DEFAULT_QUIET_END_HOUR,
  DEFAULT_QUIET_START_HOUR,
  isInQuietHours,
  parseHourSetting,
  MOMENT_TIPS_MUTED_KEY,
  MOMENT_TIPS_QUIET_END_KEY,
  MOMENT_TIPS_QUIET_START_KEY,
} from './moment-tips'

export const PROACTIVE_GREETING_ENABLED_KEY = 'companionProactiveGreetingEnabled' as const
export const PROACTIVE_GREETING_LAST_DAY_KEY = 'companionProactiveGreetingLastDay' as const

/** 近 Moment 窗口：超过则视为无增量，不问候 */
export const PROACTIVE_GREETING_MOMENT_MAX_AGE_MS = 24 * 60 * 60 * 1000

export type ProactiveGreetingDenyReason =
  | 'disabled'
  | 'muted'
  | 'quiet-hours'
  | 'already-today'
  | 'no-fresh-moment'

export interface ProactiveGreetingDecision {
  allow: boolean
  reason: 'ok' | ProactiveGreetingDenyReason
}

export function decideProactiveGreeting(input: {
  enabled: boolean
  muted: boolean
  localHour: number
  quietStartHour: number
  quietEndHour: number
  lastGreetingDay: string
  today: string
  hasFreshMoment: boolean
}): ProactiveGreetingDecision {
  if (!input.enabled) return { allow: false, reason: 'disabled' }
  if (input.muted) return { allow: false, reason: 'muted' }
  if (isInQuietHours(input.localHour, input.quietStartHour, input.quietEndHour)) {
    return { allow: false, reason: 'quiet-hours' }
  }
  if (input.lastGreetingDay === input.today) {
    return { allow: false, reason: 'already-today' }
  }
  if (!input.hasFreshMoment) {
    return { allow: false, reason: 'no-fresh-moment' }
  }
  return { allow: true, reason: 'ok' }
}

export function formatProactiveGreetingToast(input: {
  roleName: string
  preview: string
}): string {
  const name = input.roleName.trim() || '伙伴'
  const preview = input.preview.replace(/\s+/g, ' ').trim().slice(0, 36)
  if (preview) {
    return `${name}还在过她的日子：${preview}——有空打开朋友圈看看`
  }
  return `${name}今天有新动态，有空打开朋友圈看看`
}

function parseEnabled(raw: string): boolean {
  const t = raw.trim().toLowerCase()
  return t === '1' || t === 'true' || t === 'yes'
}

function parseMuted(raw: string): boolean {
  const t = raw.trim().toLowerCase()
  return t === '1' || t === 'true' || t === 'yes'
}

function broadcast(payload: {
  roleId: string
  toast: string
  momentId: string
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('companion:proactive-greeting', payload)
  }
}

/**
 * ticker 周期调用：条件满足则广播一次应用内主动问候。
 */
export async function maybeProactiveGreeting(
  roleId: string,
  now = Date.now(),
): Promise<{ greeted: boolean; reason: ProactiveGreetingDecision['reason'] }> {
  const id = roleId.trim()
  if (!id) return { greeted: false, reason: 'disabled' }

  const enabled = parseEnabled(await settings.getSetting(PROACTIVE_GREETING_ENABLED_KEY))
  const muted = parseMuted(await settings.getSetting(MOMENT_TIPS_MUTED_KEY))
  const quietStart = parseHourSetting(
    await settings.getSetting(MOMENT_TIPS_QUIET_START_KEY),
    DEFAULT_QUIET_START_HOUR,
  )
  const quietEnd = parseHourSetting(
    await settings.getSetting(MOMENT_TIPS_QUIET_END_KEY),
    DEFAULT_QUIET_END_HOUR,
  )
  const lastDay = (await settings.getSetting(PROACTIVE_GREETING_LAST_DAY_KEY)).trim()
  const today = toLocalDateString(now)

  const moments = await listMomentsForRole(id, { limit: 1 })
  const latest = moments[0]
  const preview = latest?.text?.trim() || ''
  const ageOk =
    Boolean(latest) &&
    preview.length > 0 &&
    now - latest!.publishedAt <= PROACTIVE_GREETING_MOMENT_MAX_AGE_MS

  const decision = decideProactiveGreeting({
    enabled,
    muted,
    localHour: new Date(now).getHours(),
    quietStartHour: quietStart,
    quietEndHour: quietEnd,
    lastGreetingDay: lastDay,
    today,
    hasFreshMoment: ageOk,
  })
  if (!decision.allow) {
    return { greeted: false, reason: decision.reason }
  }

  let roleName = id
  try {
    const universeId = (await settings.getSetting('universeId')) || 'default'
    roleName = identity.loadRolePack(id, universeId).name
  } catch {
    /* id 即可 */
  }

  const toast = formatProactiveGreetingToast({ roleName, preview })
  await settings.setSetting(PROACTIVE_GREETING_LAST_DAY_KEY, today)
  broadcast({ roleId: id, toast, momentId: latest!.id })
  return { greeted: true, reason: 'ok' }
}

export const __test = {
  decideProactiveGreeting,
  formatProactiveGreetingToast,
}

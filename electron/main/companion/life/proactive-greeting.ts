/**
 * 定时主动问候（M31-G3 / L4）
 *
 * 背景：L4 打扰最高，必须默认可关，且文案只能挂在已有 World 增量上。
 * 意图：life ticker 周期检查；有近 Moment 且未问候过当日时，发应用内找上门气泡。
 * 约束：默认关闭；复用勿扰窗；不发系统桌面通知；无 Moment 绝不空喊「想我了吗」。
 */

import { PROACTIVE_DELIVERY_POLICY } from '../../../../src/shared/proactive-evidence'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm/index'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { compileProactiveGreetingRequest } from '../../prompts/registered-request'
import * as settings from '../../storage/settings-store'
import * as identity from '../identity/loader'
import { toLocalDateString } from './dates'
import { listMomentsForRole } from './moments'
import { dispatchProactiveGreeting, hasProactiveReservation, recordProactiveSkip } from './proactive-evidence'
import {
  DEFAULT_QUIET_END_HOUR,
  DEFAULT_QUIET_START_HOUR,
  isInQuietHours,
  parseHourSetting,
  MOMENT_TIPS_MUTED_KEY,
  MOMENT_TIPS_QUIET_END_KEY,
  MOMENT_TIPS_QUIET_START_KEY,
} from './moment-tips'

export const PROACTIVE_GREETING_ENABLED_KEY = PROACTIVE_DELIVERY_POLICY.enabledSettingKey
export const PROACTIVE_GREETING_LAST_DAY_KEY = 'companionProactiveGreetingLastDay' as const

/** 近 Moment 窗口：超过则视为无增量，不问候 */
export const PROACTIVE_GREETING_MOMENT_MAX_AGE_MS = PROACTIVE_DELIVERY_POLICY.momentMaxAgeMs

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

/**
 * 背景：ticker 可重入且角色会切换，全局日标记不能约束每个人物。
 * 意图：判断既有打扰策略，再让证据服务原子预留与定向投递。
 * 约束：greeted 仅表示已发出；呈现靠单独回执，无窗口与失败不假报送达。
 */
export async function maybeProactiveGreeting(
  roleId: string,
  now = Date.now(),
): Promise<{ greeted: boolean; reason: ProactiveGreetingDecision['reason'] | 'no-window' | 'send-failed' | 'evidence-unavailable' | 'role-inactive' }> {
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
  const today = toLocalDateString(now)
  const lastDay = hasProactiveReservation(id, today) ? today : ''

  const moments = await listMomentsForRole(id, { limit: 1 })
  const latest = moments[0]
  const preview = latest?.text?.trim() || ''
  const ageOk =
    Boolean(latest) &&
    preview.length > 0 &&
    now >= latest!.publishedAt &&
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
    recordProactiveSkip(id, today, decision.reason, now, latest?.id)
    return { greeted: false, reason: decision.reason }
  }

  let roleName = id
  try {
    const universeId = (await settings.getSetting('universeId')) || 'default'
    roleName = identity.loadRolePack(id, universeId).name
  } catch {
    /* id 即可 */
  }

  let toast = formatProactiveGreetingToast({ roleName, preview })
  try {
    const config = await loadAuxLLMConfig()
    if (hasLLMAuthentication(config)) {
      const raw = await chatComplete({ config, request: compileProactiveGreetingRequest({ roleName, momentText: preview.slice(0, 1500) }), caller: 'proactive-greeting', temperature: 0.6, maxTokens: 160 })
      const parsed: unknown = JSON.parse(raw)
      const greeting = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof (parsed as Record<string, unknown>).greeting === 'string' ? ((parsed as Record<string, unknown>).greeting as string).trim() : ''
      if (greeting.length >= 2 && greeting.length <= 80 && !/[\r\n<>]/.test(greeting)) toast = `${roleName}：${greeting}`
    }
  } catch {
    // 确定性问候作为唯一回退；投递证据仍由同一门闸记录。
  }
  const activeRoleId = (await settings.getSetting('activeRoleId')).trim()
  if (activeRoleId && activeRoleId !== id) {
    recordProactiveSkip(id, today, 'role-inactive', now, latest?.id)
    return { greeted: false, reason: 'role-inactive' }
  }
  return dispatchProactiveGreeting({ roleId: id, localDay: today, momentId: latest!.id, toast, now })
}

export const __test = {
  decideProactiveGreeting,
  formatProactiveGreetingToast,
}

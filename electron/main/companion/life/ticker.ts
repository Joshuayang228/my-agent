/**
 * LifeEngine 动态生活时钟事件驱动（仅 active）
 *
 * 背景：桌面端此前仅按固定 5 分钟轮询推进生活世界，导致临界计划事件（如午餐、动态发布）产生最多 5 分钟的感知滞后。
 * 意图：按需对齐下一次 planned 事件到期时间动态调度唤醒（Dynamic Clock Trigger），并在推进落地后广播 companion:timeline-updated。
 * 约束：失败只打日志，不抛到主进程；动态对齐具备最小延迟保护（不盲目高频轮询），支持可靠 stop。
 */

import { BrowserWindow } from 'electron'
import { createLogger } from '../../utils/logger'
import { tickActiveRole } from './engine'
import { maybeProactiveGreeting } from './proactive-greeting'
import { checkAndProgressAbsorbedResonances } from './chat-resonance'
import { triggerSpontaneousImpulse } from './spontaneous-impulse'
import { checkAndGenerateInnerThought } from './inner-thoughts'
import { checkAndPerformContextualDressing } from './autonomous-dressing'
import { checkAndProgressTravelJourney } from './travel-progression'
import { checkAndTriggerVulnerability } from './vulnerability'
import { checkAndTriggerNightlyReflection } from './nightly-reflection'
import { checkAndReplanIfExhausted } from './replan'
import { checkAndTriggerHostCare } from './host-presence'
import * as store from './store'
import * as settings from '../../storage/settings-store'

const log = createLogger('LifeTicker')

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000

async function isActiveRole(roleId: string): Promise<boolean> {
  const active = (await settings.getSetting('activeRoleId')).trim()
  return !active || active === roleId
}

async function runForActiveRole(roleId: string, label: string, action: () => Promise<unknown>): Promise<boolean> {
  if (!(await isActiveRole(roleId))) return false
  try {
    await action()
    return true
  } catch (err) {
    log.warn(`${label} failed`, { roleId, error: String(err) })
    return true
  }
}

let timer: ReturnType<typeof setTimeout> | null = null

export function broadcastTimelineUpdated(roleId: string, now = Date.now()): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('companion:timeline-updated', { roleId, now })
    }
  }
}

export async function getNextPlannedEventDelay(
  roleId: string,
  now = Date.now(),
  maxIntervalMs = DEFAULT_INTERVAL_MS,
): Promise<number> {
  try {
    const planned = await store.listEvents(roleId, { status: 'planned', order: 'asc', limit: 10 })
    const upcoming = planned.find((e) => e.scheduledAt > now)
    if (upcoming) {
      const diff = upcoming.scheduledAt - now + 500
      if (diff > 0 && diff < maxIntervalMs) {
        return Math.max(3000, diff)
      }
    }
  } catch {
    // 降级使用标准周期
  }
  return maxIntervalMs
}

export function startLifeTicker(defaultIntervalMs = DEFAULT_INTERVAL_MS): void {
  if (timer !== null) return

  const executeTick = async () => {
    const now = Date.now()
    let activeRoleId: string | null = null
    try {
      const r = await tickActiveRole(now)
      activeRoleId = r.roleId
      if (r.roleId && !r.paused) {
        broadcastTimelineUpdated(r.roleId, now)
        // M31-G3：默认可关；失败不阻断 ticker
        const actions: Array<[string, () => Promise<unknown>]> = [
          ['proactive greeting', () => maybeProactiveGreeting(r.roleId, now)],
          ['chat resonance progression', () => checkAndProgressAbsorbedResonances(r.roleId, now)],
          ['spontaneous impulse', () => triggerSpontaneousImpulse(r.roleId, now)],
          ['inner thought', () => checkAndGenerateInnerThought(r.roleId, now)],
          ['contextual dressing', () => checkAndPerformContextualDressing(r.roleId, now)],
          ['travel progression', () => checkAndProgressTravelJourney(r.roleId, now)],
          ['vulnerability', () => checkAndTriggerVulnerability(r.roleId, now)],
          ['nightly reflection', () => checkAndTriggerNightlyReflection(r.roleId, now)],
          ['replan', () => checkAndReplanIfExhausted(r.roleId, now)],
          ['host care', () => checkAndTriggerHostCare(r.roleId, now)],
        ]
        for (const [label, action] of actions) {
          if (!(await runForActiveRole(r.roleId, label, action))) break
        }
      }
    } catch (err) {
      log.warn('tickActiveRole failed', { error: String(err) })
    }

    let nextDelay = defaultIntervalMs
    if (activeRoleId) {
      nextDelay = await getNextPlannedEventDelay(activeRoleId, Date.now(), defaultIntervalMs)
    }

    if (timer !== null) {
      timer = setTimeout(executeTick, nextDelay)
      log.debug('Next life tick scheduled', { nextDelay, roleId: activeRoleId })
    }
  }

  timer = setTimeout(executeTick, 0)
  log.info('Life ticker started with dynamic clock triggers', { defaultIntervalMs })
}

export function stopLifeTicker(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
    log.info('Life ticker stopped')
  }
}


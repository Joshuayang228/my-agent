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
import * as store from './store'

const log = createLogger('LifeTicker')

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000

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
      if (r.roleId) {
        broadcastTimelineUpdated(r.roleId, now)
        // M31-G3：默认可关；失败不阻断 ticker
        await maybeProactiveGreeting(r.roleId, now).catch((err) => {
          log.warn('proactive greeting failed', { error: String(err) })
        })
        await checkAndProgressAbsorbedResonances(r.roleId, now).catch((err) => {
          log.warn('checkAndProgressAbsorbedResonances failed', { error: String(err) })
        })
        await triggerSpontaneousImpulse(r.roleId, now).catch((err) => {
          log.warn('triggerSpontaneousImpulse failed', { error: String(err) })
        })
        await checkAndGenerateInnerThought(r.roleId, now).catch((err) => {
          log.warn('checkAndGenerateInnerThought failed', { error: String(err) })
        })
        await checkAndPerformContextualDressing(r.roleId, now).catch((err) => {
          log.warn('checkAndPerformContextualDressing failed', { error: String(err) })
        })
        await checkAndProgressTravelJourney(r.roleId, now).catch((err) => {
          log.warn('checkAndProgressTravelJourney failed', { error: String(err) })
        })
        await checkAndTriggerVulnerability(r.roleId, now).catch((err) => {
          log.warn('checkAndTriggerVulnerability failed', { error: String(err) })
        })
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


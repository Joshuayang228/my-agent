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
import { isActiveRole } from '../../storage/settings-store'
import { dispatchCompanionWindowOutbox } from '../core/outbox/dispatcher'

const log = createLogger('LifeTicker')

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000

async function runForActiveRole(roleId: string, label: string, action: () => Promise<unknown>): Promise<{ ok: boolean; result?: unknown }> {
  if (!(await isActiveRole(roleId))) return { ok: false }
  try {
    return { ok: true, result: await action() }
  } catch (err) {
    log.warn(`${label} failed`, { roleId, error: String(err) })
    return { ok: true }
  }
}

/**
 * 判断一次生活动作是否真的向用户投递了主动内容。
 *
 * 背景：生活时钟会在同一轮评估问候、搭话、脆弱时刻和宿主关怀，若每个动作各自只看自己的冷却，
 *       一轮可能连续打断用户多次。
 * 设计意图：只依据动作返回的已投递结果做轻量协调，不把后台状态变化误判为消息，也不复制各模块的策略。
 * 关键约束：只有明确的 `greeted` / `triggered` 或带有用户事件载荷的结果才消费本轮名额，失败和空结果必须允许后续动作继续评估。
 */
export function didDeliverUserFacingAction(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false
  const value = result as Record<string, unknown>
  if (value.greeted === true || value.triggered === true) return true
  return typeof value.kind === 'string' && typeof value.message === 'string'
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
      const tickRoleId = r.roleId
      if (tickRoleId && !r.paused) {
        broadcastTimelineUpdated(tickRoleId, now)
        // M31-G3：默认可关；失败不阻断 ticker
        const actions: Array<{ label: string; userFacing: boolean; action: () => Promise<unknown> }> = [
          { label: 'proactive greeting', userFacing: true, action: () => maybeProactiveGreeting(tickRoleId, now) },
          { label: 'chat resonance progression', userFacing: false, action: () => checkAndProgressAbsorbedResonances(tickRoleId, now) },
          { label: 'spontaneous impulse', userFacing: true, action: () => triggerSpontaneousImpulse(tickRoleId, now) },
          { label: 'inner thought', userFacing: false, action: () => checkAndGenerateInnerThought(tickRoleId, now) },
          { label: 'contextual dressing', userFacing: false, action: () => checkAndPerformContextualDressing(tickRoleId, now) },
          { label: 'travel progression', userFacing: false, action: () => checkAndProgressTravelJourney(tickRoleId, now) },
          { label: 'vulnerability', userFacing: true, action: () => checkAndTriggerVulnerability(tickRoleId, now) },
          { label: 'nightly reflection', userFacing: false, action: () => checkAndTriggerNightlyReflection(tickRoleId, now) },
          { label: 'replan', userFacing: false, action: () => checkAndReplanIfExhausted(tickRoleId, now) },
          { label: 'host care', userFacing: true, action: () => checkAndTriggerHostCare(tickRoleId, now) },
        ]
        let userFacingDelivered = false
        for (const item of actions) {
          if (item.userFacing && userFacingDelivered) continue
          const outcome = await runForActiveRole(tickRoleId, item.label, item.action)
          if (!outcome.ok) break
          if (item.userFacing && didDeliverUserFacingAction(outcome.result)) userFacingDelivered = true
        }
        await runForActiveRole(tickRoleId, 'companion outbox delivery', () => dispatchCompanionWindowOutbox())
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


import { didDeliverUserFacingAction, runAutomaticProactiveAction } from '../companion/application/proactive-budget'
/**
 * LifeEngine 动态生活时钟事件驱动（仅 active）
 *
 * 背景：桌面端此前仅按固定 5 分钟轮询推进生活世界，导致临界计划事件（如午餐、动态发布）产生最多 5 分钟的感知滞后。
 * 意图：按需对齐下一次 planned 事件到期时间动态调度唤醒（Dynamic Clock Trigger），并在推进落地后广播 companion:timeline-updated。
 * 约束：失败只打日志，不抛到主进程；动态对齐具备最小延迟保护（不盲目高频轮询），支持可靠 stop。
 */

import { BrowserWindow } from 'electron'
import { createLogger } from '../utils/logger'
import { runCompanionLifeTickWorkflow } from '../agent-host/host'
import { resolveActiveLifeScope, type tickActiveRole } from '../companion/life/engine'
import { maybeProactiveGreeting } from '../companion/life/proactive-greeting'
import { checkAndProgressAbsorbedResonances } from '../companion/life/chat-resonance'
import { triggerSpontaneousImpulse } from '../companion/life/spontaneous-impulse'
import { checkAndGenerateInnerThought } from '../companion/life/inner-thoughts'
import { checkAndPerformContextualDressing } from '../companion/life/autonomous-dressing'
import { checkAndProgressTravelJourney } from '../companion/life/travel-progression'
import { checkAndTriggerVulnerability } from '../companion/life/vulnerability'
import { checkAndTriggerNightlyReflection } from '../companion/life/nightly-reflection'
import { checkAndReplanIfExhausted } from '../companion/life/replan'
import { checkAndTriggerHostCare } from '../companion/life/host-presence'
import { listEvents } from '../companion/core/persistence/life-repository'
import { isActiveRole } from '../storage/settings-store'
import { dispatchCompanionWindowOutbox } from '../companion/adapters/window-outbox-dispatcher'
import { executeCompanionCommand } from '../companion/core/commands/gateway'
import { dispatchCompanionSessionOutbox } from '../companion/adapters/session-outbox-dispatcher'
import { captureCompanionLifecycle } from '../utils/companion-lifecycle'
import { runWithExecutionSignal } from '../utils/execution-cancellation'
import { runWithTraceContext } from '../utils/trace-context'
import { recoverCompanionFollowups } from '../companion/application/companion-followups'

const log = createLogger('LifeTicker')

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000

async function runForActiveRole(roleId: string, label: string, tickId: number, signal: AbortSignal, action: () => Promise<unknown>): Promise<{ ok: boolean; result?: unknown }> {
  if (signal.aborted) return { ok: false }
  if (!(await isActiveRole(roleId))) return { ok: false }
  try {
    const result = await executeCompanionCommand({
      roleId,
      actionType: `life-ticker:${label}`,
      idempotencyKey: `life-tick:${roleId}:${label}:${tickId}`,
      signal,
      handler: action,
    })
    return { ok: true, result }
  } catch (err) {
    if (signal.aborted) return { ok: false }
    log.warn(`${label} failed`, { roleId, error: String(err) })
    return { ok: true }
  }
}

export { didDeliverUserFacingAction } from '../companion/application/proactive-budget'

interface LifeTicker {
  controller: AbortController
  timer?: ReturnType<typeof setTimeout>
  busy: boolean
}

let ticker: LifeTicker | undefined

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
    const planned = await listEvents(roleId, { status: 'planned', order: 'asc', limit: 10 })
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
  if (ticker) return
  const owner: LifeTicker = { controller: new AbortController(), busy: false }
  ticker = owner

  const executeTick = async () => {
    if (ticker !== owner || owner.busy) return
    owner.busy = true
    const signal = AbortSignal.any([owner.controller.signal, captureCompanionLifecycle()])
    const now = Date.now()
    const traceId = `companion-life-tick:${now}`
    let activeRoleId: string | null = null
    try {
      const binding = await resolveActiveLifeScope()
      signal.throwIfAborted()
      await runWithExecutionSignal(signal, () => runWithTraceContext({ roleId: binding.roleId, traceId }, async () => {
        const r = await executeCompanionCommand({
          roleId: binding.roleId,
          actionType: 'life-clock-tick',
          idempotencyKey: `life-clock:${binding.universeId}:${now}`,
          correlationId: traceId,
          signal,
          handler: () => runCompanionLifeTickWorkflow(now, { ...binding, traceId, signal }) as ReturnType<typeof tickActiveRole>,
        })
        signal.throwIfAborted()
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
            const outcome = await runForActiveRole(tickRoleId, item.label, now, signal, () => item.userFacing ? runAutomaticProactiveAction(tickRoleId, now, item.action) : item.action())
            if (!outcome.ok) break
            if (item.userFacing && didDeliverUserFacingAction(outcome.result)) userFacingDelivered = true
          }
          await runForActiveRole(tickRoleId, 'companion outbox delivery', now, signal, () => dispatchCompanionWindowOutbox())
          await runForActiveRole(tickRoleId, 'companion session outbox delivery', now, signal, () => dispatchCompanionSessionOutbox())
        }
      }))
    } catch (err) {
      if (!signal.aborted) log.warn('tickActiveRole failed', { error: String(err) })
    }

    if (ticker === owner) await recoverCompanionFollowups()

    let nextDelay = defaultIntervalMs
    if (!signal.aborted && activeRoleId) {
      nextDelay = await getNextPlannedEventDelay(activeRoleId, Date.now(), defaultIntervalMs)
    }

    owner.busy = false
    if (ticker === owner) {
      owner.timer = setTimeout(executeTick, nextDelay)
      log.debug('Next life tick scheduled', { nextDelay, roleId: activeRoleId })
    }
  }

  // 背景：主进程启动时窗口、设置和人物世界仍在恢复，立即推进会与初始化写入并发，
  // 产生用户尚未打开应用就被生活动作改写的状态。
  // 设计意图：首轮沿默认周期进入统一调度，后续仍按下一条计划动态缩短等待；显式生命周期入口可随时触发即时推进。
  // 关键约束：timer 必须先写入再等待，stopLifeTicker 才能取消首轮；不能用 Promise 直接启动后台 tick。
  owner.timer = setTimeout(executeTick, defaultIntervalMs)
  log.info('Life ticker started with dynamic clock triggers', { defaultIntervalMs })
}

export function stopLifeTicker(): void {
  if (ticker) {
    const owner = ticker
    ticker = undefined
    clearTimeout(owner.timer)
    owner.controller.abort(new DOMException('生活时钟已停止。', 'AbortError'))
    log.info('Life ticker stopped')
  }
}


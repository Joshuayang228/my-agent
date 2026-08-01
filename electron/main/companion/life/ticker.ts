/**
 * LifeEngine 轻量定时 tick（仅 active）
 *
 * 背景：桌面端需周期性推进活跃主角生活世界。
 * 意图：启动时立刻 tick 一次，之后按间隔调用 tickActiveRole。
 * 约束：失败只打日志，不抛到主进程；可 stop。
 */

import { createLogger } from '../../utils/logger'
import { tickActiveRole } from './engine'

const log = createLogger('LifeTicker')

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null

export function startLifeTicker(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (timer) return
  const run = () => {
    tickActiveRole(Date.now()).catch((err) => {
      log.warn('tickActiveRole failed', { error: String(err) })
    })
  }
  run()
  timer = setInterval(run, intervalMs)
  log.info('Life ticker started', { intervalMs })
}

export function stopLifeTicker(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
  log.info('Life ticker stopped')
}

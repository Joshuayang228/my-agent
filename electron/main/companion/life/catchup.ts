/**
 * Catch-up（W3）
 *
 * 背景：完整切换回曾暂停角色时，细补最近 ≤7×24h 窗口内的剧本/事件；更早只写概况摘要。
 * 意图：runCatchup(roleId, pausedAt, now)；单测可注入固定 now。
 * 约束：时区用本地日历日；不在打开瞬间伪造「正在发生」。
 */

import { createLogger } from '../../utils/logger'
import { eachLocalDateInclusive, toLocalDateString } from './dates'
import { ensureDayScripts } from './engine'
import { publishAndProjectRange } from './moments'
import * as store from './store'

const log = createLogger('Catchup')

/** 细补时间窗长度（毫秒）— 与 tech-spec 冻结公式一致 */
export const CATCHUP_FINE_MS = 7 * 86_400_000

export function computeFineStart(pausedAt: number, now: number): number {
  return Math.max(pausedAt, now - CATCHUP_FINE_MS)
}

/** 规则模板概况（W3 不调 LLM） */
export function buildCatchupSummary(
  roleId: string,
  pausedAt: number,
  fineStart: number,
  now: number,
): string {
  const from = toLocalDateString(pausedAt)
  const gapEnd = toLocalDateString(fineStart)
  const until = toLocalDateString(now)
  const gapDays = eachLocalDateInclusive(from, gapEnd).length
  return (
    `【生活追赶摘要】角色 ${roleId} 自 ${from} 起暂停；` +
    `${from}～${gapEnd} 约 ${gapDays} 个日历日以概况带过（未逐日生成）。` +
    `已细补 ${gapEnd}～${until} 近窗生活。现在是 ${until}。`
  )
}

/**
 * 执行 Catch-up：摘要（若空洞 > 细窗）→ ensure 细窗剧本 → 发布并投影 moments → 清除 pause。
 */
export async function runCatchup(
  roleId: string,
  pausedAt: number,
  now: number,
): Promise<{ fineDays: number; summaryUpdated: boolean; published: number }> {
  const fineStart = computeFineStart(pausedAt, now)
  let summaryUpdated = false

  if (pausedAt < fineStart) {
    const summary = buildCatchupSummary(roleId, pausedAt, fineStart, now)
    await store.setCatchupSummary(roleId, summary)
    summaryUpdated = true
  }

  const fromDate = toLocalDateString(fineStart)
  const toDate = toLocalDateString(now)
  await ensureDayScripts(roleId, fromDate, toDate)
  const fineDays = eachLocalDateInclusive(fromDate, toDate).length

  const published = await publishAndProjectRange(roleId, fineStart, now)
  await store.clearPausedAt(roleId)
  await store.touchLastTick(roleId, now)

  log.info('Catch-up done', { roleId, fineDays, summaryUpdated, published, pausedAt, now })
  return { fineDays, summaryUpdated, published }
}

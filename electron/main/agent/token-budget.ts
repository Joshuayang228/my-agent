/**
 * Token 预算控制 — 会话级 + 日级限额。
 *
 * Alice/wps-cowork：任务级 + 每日级 token 限额，超限自动终止。
 *
 * 日级限额使用内存中的计数器（每日重置），会话级通过 SQLite 累积 token 值检查。
 */

import * as store from '../storage/session-store'
import * as settings from '../storage/settings-store'
import { createLogger } from '../utils/logger'

const log = createLogger('TokenBudget')

let dailyTokens = 0
let dailyResetDate = getTodayString()

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function checkDailyReset(): void {
  const today = getTodayString()
  if (today !== dailyResetDate) {
    log.info('Daily token counter reset', { previous: dailyTokens, date: dailyResetDate })
    dailyTokens = 0
    dailyResetDate = today
  }
}

/** 记录本次消耗的 token（daily 累加） */
export function recordDailyUsage(promptTokens: number, completionTokens: number): void {
  checkDailyReset()
  dailyTokens += promptTokens + completionTokens
}

/** 获取今日已消耗的 token 总数 */
export function getDailyUsage(): number {
  checkDailyReset()
  return dailyTokens
}

export interface BudgetCheckResult {
  allowed: boolean
  reason?: string
  sessionUsed?: number
  sessionBudget?: number
  dailyUsed?: number
  dailyBudget?: number
}

/**
 * 检查是否超出预算 — 在 Agent Loop 每轮迭代前调用。
 */
export async function checkBudget(sessionId: string): Promise<BudgetCheckResult> {
  const s = await settings.getAllSettings()
  const sessionBudget = parseInt(s.sessionTokenBudget) || 0
  const dailyBudget = parseInt(s.dailyTokenBudget) || 0

  if (sessionBudget > 0) {
    const usage = await store.getTokenUsage(sessionId)
    const sessionUsed = usage.promptTokens + usage.completionTokens
    if (sessionUsed >= sessionBudget) {
      log.warn('Session token budget exceeded', { sessionId, sessionUsed, sessionBudget })
      return {
        allowed: false,
        reason: `会话 Token 预算已耗尽（已使用 ${sessionUsed.toLocaleString()} / 预算 ${sessionBudget.toLocaleString()}）`,
        sessionUsed,
        sessionBudget,
      }
    }
  }

  if (dailyBudget > 0) {
    checkDailyReset()
    if (dailyTokens >= dailyBudget) {
      log.warn('Daily token budget exceeded', { dailyUsed: dailyTokens, dailyBudget })
      return {
        allowed: false,
        reason: `每日 Token 预算已耗尽（已使用 ${dailyTokens.toLocaleString()} / 预算 ${dailyBudget.toLocaleString()}）`,
        dailyUsed: dailyTokens,
        dailyBudget,
      }
    }
  }

  return { allowed: true }
}

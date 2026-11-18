import { randomUUID } from 'node:crypto'
import { getDatabase, persist, withDatabaseTransaction } from '../../storage/database'
import { getSetting } from '../../storage/settings-store'
import { withCompanionUnitOfWork } from '../core/transaction/unit-of-work'
import { toLocalDateString } from '../life/dates'
import { DEFAULT_MAX_TIPS_PER_DAY, MOMENT_TIP_MIN_INTERVAL_MS, MOMENT_TIPS_MAX_PER_DAY_KEY, MOMENT_TIPS_MUTED_KEY, MOMENT_TIPS_QUIET_START_KEY, MOMENT_TIPS_QUIET_END_KEY, DEFAULT_QUIET_START_HOUR, DEFAULT_QUIET_END_HOUR, parseMaxPerDay, parseHourSetting, isInQuietHours } from '../life/proactive-settings'

export const AUTOMATIC_PROACTIVE_POLICY = {
  defaultMaxPerDay: DEFAULT_MAX_TIPS_PER_DAY,
  minimumIntervalMs: MOMENT_TIP_MIN_INTERVAL_MS,
  reservationSemantics: '进程中断的发送预留继续占用当日预算',
} as const

export function didDeliverUserFacingAction(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false
  const value = result as Record<string, unknown>
  return value.greeted === true || value.triggered === true || value.notified === true
    || (typeof value.kind === 'string' && typeof value.message === 'string')
    || (value.status === 'active' && typeof value.vulnerabilityText === 'string')
}

async function getProactiveLimit(now: number): Promise<number | null> {
  const [budgetRaw, mutedRaw, quietStartRaw, quietEndRaw] = await Promise.all([getSetting(MOMENT_TIPS_MAX_PER_DAY_KEY), getSetting(MOMENT_TIPS_MUTED_KEY), getSetting(MOMENT_TIPS_QUIET_START_KEY), getSetting(MOMENT_TIPS_QUIET_END_KEY)])
  if (['1', 'true', 'yes'].includes(mutedRaw.trim().toLowerCase()) || isInQuietHours(new Date(now).getHours(), parseHourSetting(quietStartRaw, DEFAULT_QUIET_START_HOUR), parseHourSetting(quietEndRaw, DEFAULT_QUIET_END_HOUR))) return null
  return parseMaxPerDay(budgetRaw)
}

async function reserveProactiveBudget(input: { id: string; roleId: string; now: number; maxPerDay: number; status: 'reserved' | 'delivered' }): Promise<boolean> {
  const { id, roleId, now, maxPerDay, status } = input
  const day = toLocalDateString(now)
  const db = await getDatabase()
  db.run('CREATE TABLE IF NOT EXISTS companion_proactive_budget (id TEXT PRIMARY KEY, role_id TEXT NOT NULL, local_day TEXT NOT NULL, attempted_at INTEGER NOT NULL, status TEXT NOT NULL)')
  db.run('CREATE INDEX IF NOT EXISTS idx_companion_proactive_budget_role_day ON companion_proactive_budget(role_id, local_day, attempted_at)')
  const count = Number(db.exec('SELECT COUNT(*) FROM companion_proactive_budget WHERE role_id = ? AND local_day = ?', [roleId, day])[0]?.values[0][0] ?? 0)
  const latest = Number(db.exec('SELECT MAX(attempted_at) FROM companion_proactive_budget WHERE role_id = ?', [roleId])[0]?.values[0][0] ?? 0)
  if ((maxPerDay > 0 && count >= maxPerDay) || (latest > 0 && now - latest < MOMENT_TIP_MIN_INTERVAL_MS)) return false
  db.run('INSERT INTO companion_proactive_budget VALUES (?, ?, ?, ?, ?)', [id, roleId, day, now, status])
  persist()
  return true
}

/**
 * 背景：生活事实可以在静音和勿扰时照常生成，随附通知仍需消耗同一个角色预算。
 * 设计意图：预算扣除和通知入队共同提交，回滚时保留原预算。
 * 关键约束：回调只写本地 Outbox，外部投递须在事务提交后执行。
 */
export async function enqueueAutomaticProactiveNotification(roleId: string, now: number, enqueue: () => Promise<void>): Promise<void> {
  await withCompanionUnitOfWork(async () => {
    const maxPerDay = await getProactiveLimit(now)
    if (maxPerDay === null) return
    const reserved = await reserveProactiveBudget({ id: randomUUID(), roleId, now, maxPerDay, status: 'delivered' })
    if (reserved) await enqueue()
  })
}

/**
 * 背景：每种生活行为各自限次，跨 tick 叠加时仍会频繁打扰，进程重启也不能重置角色总预算。
 * 设计意图：沿用用户已有每日生活提醒上限与最短间隔，在模型调用前持久预留；未产生内容释放名额。
 * 关键约束：预留事务只写本地数据，实际动作在提交后执行；崩溃遗留预留保守消费名额，0 保持不限次数语义。
 */
export async function runAutomaticProactiveAction<T>(roleId: string, now: number, action: () => Promise<T>): Promise<T | null> {
  const id = randomUUID()
  const reserved = await withCompanionUnitOfWork(async () => {
    const maxPerDay = await getProactiveLimit(now)
    if (maxPerDay === null) return false
    return reserveProactiveBudget({ id, roleId, now, maxPerDay, status: 'reserved' })
  })
  if (!reserved) return null
  let delivered = false
  try {
    const result = await action()
    delivered = didDeliverUserFacingAction(result)
    return result
  } finally {
    // 已取消的动作仍需结算已有预留，且该事务只允许修改本次预留行。
    await withDatabaseTransaction(async db => {
      if (delivered) db.run("UPDATE companion_proactive_budget SET status = 'delivered' WHERE id = ?", [id])
      else db.run('DELETE FROM companion_proactive_budget WHERE id = ?', [id])
    })
  }
}

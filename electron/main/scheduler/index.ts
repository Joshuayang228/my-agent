import { randomUUID } from 'node:crypto'
import { getDatabase, withDatabaseTransaction } from '../storage/database'
import { createLogger, hashForLog } from '../utils/logger'
import { BrowserWindow, Notification } from 'electron'
import { getSetting } from '../storage/settings-store'
import { getDefaultProtagonistId } from '../companion/identity/loader'
import type { SqlValue } from 'sql.js'

const log = createLogger('Scheduler')

/**
 * Headless execution callback — set by runtime.ts on startup.
 * When set, Scheduler triggers Agent loop directly in main process
 * instead of just notifying the renderer.
 */
export interface HeadlessExecutionContext {
  taskId: string
  runId: string
  scheduledAt: number
  traceId: string
  idempotencyKey: string
  roleId?: string
  universeId?: string
}

export function createHeadlessExecutionContext(taskId: string, scheduledAt: number, runId = randomUUID()): HeadlessExecutionContext {
  const stableKey = `scheduler:${taskId}:${scheduledAt}`
  return { taskId, runId, scheduledAt, traceId: stableKey, idempotencyKey: stableKey }
}

let headlessRunner: ((prompt: string, taskName: string, context: HeadlessExecutionContext) => Promise<string>) | null = null

export function setHeadlessRunner(runner: (prompt: string, taskName: string, context: HeadlessExecutionContext) => Promise<string>): void {
  headlessRunner = runner
}

export interface ScheduledTask {
  id: string
  name: string
  prompt: string
  cron?: string
  intervalMs?: number
  enabled: boolean
  lastRunAt?: number
  nextRunAt?: number
  createdAt: number
  roleId?: string
  universeId?: string
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
const running = new Set<string>()
const MAX_TIMER_DELAY = 2_147_483_647
let stopped = false

export const MAX_TASK_NAME_LENGTH = 200
export const MAX_TASK_PROMPT_LENGTH = 100_000
export const MAX_TASK_CRON_LENGTH = 128
export const MIN_TASK_INTERVAL_MS = 1_000
export const MAX_TASK_INTERVAL_MS = 365 * 24 * 60 * 60 * 1_000

/**
 * 计算受限五段式 Cron 的下一次本地触发时间。
 * 背景：桌面端需要在应用内计算唤醒时间，不能依赖常驻系统 cron 服务。
 * 设计意图：只支持当前输入校验允许的分钟/小时语义，保持跨平台行为可预测，避免引入完整解析器。
 * 关键约束：结果必须严格晚于 from，月、日和星期仅支持通配符。
 */
export function parseCronNextRun(cron: string, from: number): number | null {
  if (typeof cron !== 'string' || cron.length === 0 || cron.length > MAX_TASK_CRON_LENGTH) return null
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5 || !Number.isFinite(from)) return null

  const [minStr, hourStr, ...calendar] = parts
  if (!calendar.every(part => part === '*')) return null
  if (minStr !== '*' && (!/^\d{1,2}$/.test(minStr) || Number(minStr) > 59)) return null
  if (hourStr !== '*' && (!/^\d{1,2}$/.test(hourStr) || Number(hourStr) > 23)) return null
  const nextMinute = (Math.floor(from / 60_000) + 1) * 60_000
  // 沿实际时间前进，跳过夏令时不存在的本地时刻。
  for (let time = nextMinute; time < nextMinute + 48 * 3600_000; time += 60_000) {
    const date = new Date(time)
    if ((minStr === '*' || date.getMinutes() === Number(minStr))
      && (hourStr === '*' || date.getHours() === Number(hourStr))) return time
  }
  return null
}

function computeNextRun(task: Pick<ScheduledTask, 'intervalMs' | 'cron'>, now: number): number | null {
  if (task.intervalMs && task.intervalMs > 0) return now + task.intervalMs
  return task.cron ? parseCronNextRun(task.cron, now) : null
}

async function resolveBinding(): Promise<{ roleId: string; universeId: string }> {
  const universeId = (await getSetting('universeId')).trim() || 'default'
  const roleId = (await getSetting('activeRoleId')).trim() || getDefaultProtagonistId(universeId)
  return { roleId, universeId }
}

function clearTaskTimer(id: string): void {
  clearTimeout(timers.get(id))
  timers.delete(id)
}

function scheduleNext(task: ScheduledTask): void {
  clearTaskTimer(task.id)
  if (stopped || !task.enabled || !task.nextRunAt || running.has(task.id)) return
  const scheduledAt = task.nextRunAt
  const delay = Math.min(MAX_TIMER_DELAY, Math.max(0, scheduledAt - Date.now()))
  const timer = setTimeout(() => {
    if (timers.get(task.id) !== timer) return
    timers.delete(task.id)
    if (Date.now() < scheduledAt) {
      scheduleNext(task)
      return
    }
    void runOccurrence(task.id, scheduledAt).catch(error => {
      log.error('Scheduled occurrence could not be persisted', { taskId: task.id, errorType: error instanceof Error ? error.name : 'unknown' })
    })
  }, delay)
  timers.set(task.id, timer)
}

/** 领取在模型调用前持久化，结算与下次时刻在同一事务中保存。
 * 重启时已经领取的任务标记中断，防止重复触发可能已经发生的副作用。
 */
async function runOccurrence(taskId: string, scheduledAt: number): Promise<void> {
  if (stopped || running.has(taskId)) return
  running.add(taskId)
  try {
    const context = createHeadlessExecutionContext(taskId, scheduledAt)
    const task = await withDatabaseTransaction(async db => {
      if (stopped) return null
      const current = await getTask(taskId)
      if (!current?.enabled || current.nextRunAt !== scheduledAt || !current.roleId || !current.universeId) return null
      if (stopped) return null
      db.run(`INSERT OR IGNORE INTO scheduled_task_runs
        (task_id, scheduled_at, run_id, role_id, universe_id, status, started_at)
        VALUES (?, ?, ?, ?, ?, 'running', ?)`, [taskId, scheduledAt, context.runId, current.roleId, current.universeId, Date.now()])
      return db.getRowsModified() === 1 ? current : null
    })
    if (!task) {
      running.delete(taskId)
      const updated = await getTask(taskId)
      if (updated && updated.nextRunAt !== scheduledAt) scheduleNext(updated)
      return
    }

    let status: 'completed' | 'failed' = 'failed'
    try {
      if (!headlessRunner || stopped) throw new Error('后台执行器不可用。')
      const result = await headlessRunner(task.prompt, task.name, { ...context, roleId: task.roleId, universeId: task.universeId })
      status = 'completed'
      log.info('Headless task completed', { taskId, runId: context.runId, resultLength: result.length })
    } catch (error) {
      log.warn('Headless task failed', { taskId, runId: context.runId, errorType: error instanceof Error ? error.name : 'unknown' })
    }

    const finalized = await withDatabaseTransaction(async db => {
      const now = Date.now()
      db.run("UPDATE scheduled_task_runs SET status = ?, finished_at = ? WHERE run_id = ? AND status = 'running'", [status, now, context.runId])
      if (db.getRowsModified() !== 1) return false
      const current = await getTask(taskId)
      if (current?.nextRunAt === scheduledAt) {
        const next = current.enabled ? computeNextRun(current, now) : null
        db.run('UPDATE scheduled_tasks SET last_run_at = ?, next_run_at = ? WHERE id = ?', [now, next, taskId])
      }
      return true
    })
    try {
      if (finalized && status === 'completed' && !stopped && Notification.isSupported()) {
        new Notification({ title: '定时任务完成', body: '定时任务已完成，点击查看结果。' }).show()
      }
      if (finalized && !stopped) BrowserWindow.getAllWindows()[0]?.webContents.send('scheduler:triggered', { taskId, name: task.name, prompt: task.prompt })
    } catch (error) {
      log.warn('Scheduled occurrence notification unavailable', { taskId, errorType: error instanceof Error ? error.name : 'unknown' })
    }
  } finally {
    running.delete(taskId)
  }
  const updated = await getTask(taskId)
  if (updated) scheduleNext(updated)
}

// ── CRUD ──

/**
 * 校验定时任务边界，避免渲染进程把超大 Prompt、无效 cron 或极端 interval 写入持久层。
 *
 * 背景：任务会被持久化，并在后台 headless 调用 Agent；输入异常不仅影响 UI，还可能在
 * 下次启动时持续触发资源消耗。设计意图：在服务层而不是仅 IPC 层校验，防止其他内部调用绕过。
 * 关键约束：cron 当前只支持基础的「分钟 小时 * * *」形式；复杂 cron 先拒绝而不是静默产生错误时间。
 */
export function validateScheduledTaskInput(input: {
  name?: unknown
  prompt?: unknown
  cron?: unknown
  intervalMs?: unknown
}): string | null {
  if (input.name !== undefined && (typeof input.name !== 'string' || input.name.trim().length === 0 || input.name.length > MAX_TASK_NAME_LENGTH)) {
    return '任务名称无效或过长'
  }
  if (input.prompt !== undefined && (typeof input.prompt !== 'string' || input.prompt.trim().length === 0 || input.prompt.length > MAX_TASK_PROMPT_LENGTH)) {
    return '任务提示词无效或过长'
  }
  if (input.cron !== undefined && input.cron !== null) {
    if (typeof input.cron !== 'string' || input.cron.length > MAX_TASK_CRON_LENGTH || parseCronNextRun(input.cron, Date.now()) === null) {
      return 'Cron 表达式无效'
    }
  }
  if (input.intervalMs !== undefined && input.intervalMs !== null) {
    if (typeof input.intervalMs !== 'number' || !Number.isInteger(input.intervalMs)
      || input.intervalMs < MIN_TASK_INTERVAL_MS || input.intervalMs > MAX_TASK_INTERVAL_MS) {
      return '任务间隔无效或超出范围'
    }
  }
  return null
}

export async function createTask(opts: { name: string; prompt: string; cron?: string; intervalMs?: number }): Promise<ScheduledTask> {
  const validationError = validateScheduledTaskInput(opts)
  if (validationError) throw new Error(validationError)
  const binding = await resolveBinding()
  const id = randomUUID()
  const now = Date.now()
  const nextRunAt = computeNextRun(opts, now) ?? undefined
  const task: ScheduledTask = { ...opts, ...binding, id, enabled: true, createdAt: now, nextRunAt }
  await withDatabaseTransaction(async db => {
    db.run(`INSERT INTO scheduled_tasks (id, name, prompt, cron, interval_ms, enabled, created_at, next_run_at, role_id, universe_id)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`, [id, opts.name, opts.prompt, opts.cron || null, opts.intervalMs || null, now, nextRunAt ?? null, binding.roleId, binding.universeId])
  })
  scheduleNext(task)
  log.info('Task created', { id, nameHash: hashForLog(opts.name), nameLength: opts.name.length })
  return task
}

export async function listTasks(): Promise<ScheduledTask[]> {
  const db = await getDatabase()
  const stmt = db.prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC')
  const tasks: ScheduledTask[] = []
  while (stmt.step()) {
    const r = stmt.getAsObject() as Record<string, unknown>
    tasks.push(rowToTask(r))
  }
  stmt.free()
  return tasks
}

export async function getTask(id: string): Promise<ScheduledTask | null> {
  const db = await getDatabase()
  const stmt = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?')
  stmt.bind([id])
  if (!stmt.step()) { stmt.free(); return null }
  const task = rowToTask(stmt.getAsObject() as Record<string, unknown>)
  stmt.free()
  return task
}

export async function updateTask(id: string, updates: Partial<Pick<ScheduledTask, 'name' | 'prompt' | 'cron' | 'intervalMs' | 'enabled'>>): Promise<void> {
  const validationError = validateScheduledTaskInput(updates)
  if (validationError) throw new Error(validationError)
  const sets: string[] = []
  const vals: SqlValue[] = []

  if (updates.name !== undefined) { sets.push('name = ?'); vals.push(updates.name) }
  if (updates.prompt !== undefined) { sets.push('prompt = ?'); vals.push(updates.prompt) }
  if (updates.cron !== undefined) { sets.push('cron = ?'); vals.push(updates.cron || null) }
  if (updates.intervalMs !== undefined) { sets.push('interval_ms = ?'); vals.push(updates.intervalMs || null) }
  if (updates.enabled !== undefined) { sets.push('enabled = ?'); vals.push(updates.enabled ? 1 : 0) }

  if (sets.length === 0) return
  const task = await withDatabaseTransaction(async db => {
    const current = await getTask(id)
    if (!current) return null
    if (updates.intervalMs !== undefined || updates.cron !== undefined || updates.enabled !== undefined) {
      const updated = { ...current, ...updates }
      sets.push('next_run_at = ?')
      vals.push(updated.enabled ? computeNextRun(updated, Date.now()) : null)
    }
    vals.push(id)
    db.run(`UPDATE scheduled_tasks SET ${sets.join(', ')} WHERE id = ?`, vals)
    return getTask(id)
  })
  if (task) scheduleNext(task)
}

export async function deleteTask(id: string): Promise<void> {
  await withDatabaseTransaction(async db => {
    db.run('DELETE FROM scheduled_tasks WHERE id = ?', [id])
  })
  clearTaskTimer(id)
  log.info('Task deleted', { id })
}

export async function initScheduler(): Promise<void> {
  stopped = false
  const tasks = await withDatabaseTransaction(async db => {
    const now = Date.now()
    const binding = await resolveBinding()
    const interrupted = db.exec("SELECT task_id, scheduled_at FROM scheduled_task_runs WHERE status = 'running'")[0]?.values ?? []
    const unfinished = new Map(interrupted.map(([taskId, scheduledAt]) => [String(taskId), Number(scheduledAt)]))
    db.run("UPDATE scheduled_task_runs SET status = 'interrupted', finished_at = ? WHERE status = 'running'", [now])
    for (const task of await listTasks()) {
      const interruptedCurrent = unfinished.get(task.id) === task.nextRunAt && unfinished.has(task.id)
      const next = task.enabled && (interruptedCurrent || !task.nextRunAt) ? computeNextRun(task, now) : task.nextRunAt
      db.run(`UPDATE scheduled_tasks SET role_id = COALESCE(role_id, ?), universe_id = COALESCE(universe_id, ?),
        next_run_at = ?, last_run_at = CASE WHEN ? THEN ? ELSE last_run_at END WHERE id = ?`,
      [binding.roleId, binding.universeId, next ?? null, interruptedCurrent ? 1 : 0, now, task.id])
    }
    return listTasks()
  })
  for (const task of tasks) scheduleNext(task)
  log.info(`Scheduler initialized, ${tasks.filter(t => t.enabled).length} active tasks`)
}

export function shutdownScheduler(): void {
  stopped = true
  for (const [id, timer] of timers) {
    clearTimeout(timer)
    timers.delete(id)
  }
  log.info('Scheduler shutdown')
}

export function rowToTask(r: Record<string, unknown>): ScheduledTask {
  return {
    id: r.id as string,
    name: r.name as string,
    prompt: r.prompt as string,
    cron: (r.cron as string) || undefined,
    intervalMs: (r.interval_ms as number) || undefined,
    enabled: !!(r.enabled as number),
    lastRunAt: (r.last_run_at as number) || undefined,
    nextRunAt: (r.next_run_at as number) || undefined,
    createdAt: r.created_at as number,
    roleId: typeof r.role_id === 'string' ? r.role_id : undefined,
    universeId: typeof r.universe_id === 'string' ? r.universe_id : undefined,
  }
}

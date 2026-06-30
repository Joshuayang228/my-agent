import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../storage/database'
import { createLogger } from '../utils/logger'
import { BrowserWindow, Notification } from 'electron'

const log = createLogger('Scheduler')

/**
 * Headless execution callback — set by runtime.ts on startup.
 * When set, Scheduler triggers Agent loop directly in main process
 * instead of just notifying the renderer.
 */
let headlessRunner: ((prompt: string, taskName: string) => Promise<string>) | null = null

export function setHeadlessRunner(runner: (prompt: string, taskName: string) => Promise<string>): void {
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
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function parseCronNextRun(cron: string, from: number): number | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return null

  const [minStr, hourStr] = parts
  const min = minStr === '*' ? new Date(from).getMinutes() : parseInt(minStr)
  const hour = hourStr === '*' ? new Date(from).getHours() : parseInt(hourStr)

  const d = new Date(from)
  d.setSeconds(0, 0)
  d.setMinutes(min)
  d.setHours(hour)

  if (d.getTime() <= from) d.setDate(d.getDate() + 1)
  return d.getTime()
}

function scheduleNext(task: ScheduledTask) {
  const existing = timers.get(task.id)
  if (existing) clearTimeout(existing)

  if (!task.enabled) return

  let nextRun: number | null = null

  if (task.intervalMs && task.intervalMs > 0) {
    const base = task.lastRunAt || Date.now()
    nextRun = base + task.intervalMs
  } else if (task.cron) {
    nextRun = parseCronNextRun(task.cron, Date.now())
  }

  if (!nextRun) return

  const delay = Math.max(nextRun - Date.now(), 1000)
  log.info(`Task scheduled: ${task.name}`, { nextRun: new Date(nextRun).toISOString(), delayMs: delay })

  updateNextRunAt(task.id, nextRun)

  const timer = setTimeout(async () => {
    timers.delete(task.id)
    log.info(`Task triggered: ${task.name}`)

    const db = await getDatabase()
    db.run('UPDATE scheduled_tasks SET last_run_at = ? WHERE id = ?', [Date.now(), task.id])
    persist()

    // Headless execution: run Agent loop directly in main process
    if (headlessRunner) {
      try {
        const result = await headlessRunner(task.prompt, task.name)
        log.info(`Headless task completed: ${task.name}`, { resultLength: result.length })

        // Notify user via OS notification
        if (Notification.isSupported()) {
          new Notification({
            title: `定时任务完成: ${task.name}`,
            body: result.slice(0, 200),
          }).show()
        }
      } catch (err) {
        log.error(`Headless task failed: ${task.name}`, { error: err instanceof Error ? err.message : String(err) })
      }
    }

    // Also notify renderer if window exists
    const wins = BrowserWindow.getAllWindows()
    if (wins.length > 0) {
      wins[0].webContents.send('scheduler:triggered', { taskId: task.id, name: task.name, prompt: task.prompt })
    }

    const updated = await getTask(task.id)
    if (updated && updated.enabled) scheduleNext(updated)
  }, delay)

  timers.set(task.id, timer)
}

async function updateNextRunAt(taskId: string, nextRunAt: number) {
  const db = await getDatabase()
  db.run('UPDATE scheduled_tasks SET next_run_at = ? WHERE id = ?', [nextRunAt, taskId])
  persist()
}

// ── CRUD ──

export async function createTask(opts: { name: string; prompt: string; cron?: string; intervalMs?: number }): Promise<ScheduledTask> {
  const db = await getDatabase()
  const id = randomUUID()
  const now = Date.now()

  db.run(
    'INSERT INTO scheduled_tasks (id, name, prompt, cron, interval_ms, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
    [id, opts.name, opts.prompt, opts.cron || null, opts.intervalMs || null, now],
  )
  persist()

  const task: ScheduledTask = { id, name: opts.name, prompt: opts.prompt, cron: opts.cron, intervalMs: opts.intervalMs, enabled: true, createdAt: now }
  scheduleNext(task)
  log.info('Task created', { id, name: opts.name })
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
  const db = await getDatabase()
  const sets: string[] = []
  const vals: unknown[] = []

  if (updates.name !== undefined) { sets.push('name = ?'); vals.push(updates.name) }
  if (updates.prompt !== undefined) { sets.push('prompt = ?'); vals.push(updates.prompt) }
  if (updates.cron !== undefined) { sets.push('cron = ?'); vals.push(updates.cron || null) }
  if (updates.intervalMs !== undefined) { sets.push('interval_ms = ?'); vals.push(updates.intervalMs || null) }
  if (updates.enabled !== undefined) { sets.push('enabled = ?'); vals.push(updates.enabled ? 1 : 0) }

  if (sets.length === 0) return
  vals.push(id)
  db.run(`UPDATE scheduled_tasks SET ${sets.join(', ')} WHERE id = ?`, vals)
  persist()

  const task = await getTask(id)
  if (task) scheduleNext(task)
}

export async function deleteTask(id: string): Promise<void> {
  const existing = timers.get(id)
  if (existing) { clearTimeout(existing); timers.delete(id) }

  const db = await getDatabase()
  db.run('DELETE FROM scheduled_tasks WHERE id = ?', [id])
  persist()
  log.info('Task deleted', { id })
}

export async function initScheduler(): Promise<void> {
  const tasks = await listTasks()
  for (const task of tasks) {
    if (task.enabled) scheduleNext(task)
  }
  log.info(`Scheduler initialized, ${tasks.filter(t => t.enabled).length} active tasks`)
}

export function shutdownScheduler(): void {
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
  }
}

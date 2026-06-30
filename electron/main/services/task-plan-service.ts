/**
 * 任务规划服务 — 会话级任务计划的状态管理 + SQLite 持久化。
 *
 * 内部服务（非工具），可被 Runtime / 工具 / 中间件直接调用。
 * 工具层包装在 tools/builtins/task-plan.ts。
 */

export interface TaskStep {
  id: number
  description: string
  status: 'pending' | 'in_progress' | 'done' | 'skipped'
  result?: string
}

export interface TaskPlan {
  goal: string
  steps: TaskStep[]
  createdAt: number
  sessionId?: string
}

let currentSessionId: string | undefined
const memoryStore = new Map<string, TaskPlan>()
let dbAvailable: boolean | null = null
let dbReady = false

export function setCurrentSessionId(sessionId: string): void {
  currentSessionId = sessionId
}

export function getCurrentSessionId(): string | undefined {
  return currentSessionId
}

function getStoreKey(sessionId?: string): string {
  return `plan_${sessionId || currentSessionId || 'default'}`
}

async function tryGetDatabase() {
  if (dbAvailable === false) return null
  try {
    const { getDatabase: gdb } = await import('../storage/database')
    const db = await gdb()
    dbAvailable = true
    return db
  } catch {
    dbAvailable = false
    return null
  }
}

async function ensureTable(): Promise<void> {
  if (dbReady || dbAvailable === false) return
  const db = await tryGetDatabase()
  if (!db) return
  db.run(`
    CREATE TABLE IF NOT EXISTS task_plans (
      id          TEXT PRIMARY KEY,
      session_id  TEXT,
      goal        TEXT NOT NULL,
      steps       TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    )
  `)
  dbReady = true
}

export async function loadPlan(sessionId?: string): Promise<TaskPlan | null> {
  const sid = sessionId || currentSessionId
  if (!sid) {
    return memoryStore.values().next().value ?? null
  }

  await ensureTable()
  const db = await tryGetDatabase()

  if (db) {
    const row = db.exec('SELECT goal, steps, created_at FROM task_plans WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1', [sid])
    if (row.length && row[0].values.length) {
      const [goal, stepsJson, createdAt] = row[0].values[0] as [string, string, number]
      try {
        const steps = JSON.parse(stepsJson) as TaskStep[]
        return { goal, steps, createdAt, sessionId: sid }
      } catch { /* fall through to memory */ }
    }
  }

  return memoryStore.get(getStoreKey(sid)) ?? null
}

export async function savePlan(plan: TaskPlan): Promise<void> {
  const sid = plan.sessionId || currentSessionId || 'default'
  const key = getStoreKey(sid)
  memoryStore.set(key, plan)

  await ensureTable()
  const db = await tryGetDatabase()
  if (db) {
    db.run(
      `INSERT OR REPLACE INTO task_plans (id, session_id, goal, steps, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [key, sid, plan.goal, JSON.stringify(plan.steps), plan.createdAt, Date.now()],
    )
    try {
      const { persist } = await import('../storage/database')
      persist()
    } catch { /* ok */ }
  }
}

export async function deletePlan(sessionId?: string): Promise<boolean> {
  const sid = sessionId || currentSessionId || 'default'
  const key = getStoreKey(sid)
  memoryStore.delete(key)

  const db = await tryGetDatabase()
  if (db) {
    db.run('DELETE FROM task_plans WHERE id = ?', [key])
    try {
      const { persist } = await import('../storage/database')
      persist()
    } catch { /* ok */ }
  }
  return true
}

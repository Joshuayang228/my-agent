/**
 * 任务规划服务 — 会话级任务计划的状态管理 + SQLite 持久化。
 *
 * 内部服务（非工具），可被 Runtime / 工具 / 中间件直接调用。
 * 工具层包装在 tools/builtins/task-plan.ts。
 */

import { getDatabase, withDatabaseTransaction } from '../storage/database'
import { getExecutionSignal } from '../utils/execution-cancellation'

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
  sessionId: string
}

function assertSessionId(sessionId: string): void {
  if (!sessionId?.trim()) throw new Error('任务计划缺少会话执行环境。')
}

export async function loadPlan(sessionId: string): Promise<TaskPlan | null> {
  assertSessionId(sessionId)
  const db = await getDatabase()
  if (!db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'task_plans'").length) return null
  const rows = db.exec('SELECT goal, steps, created_at FROM task_plans WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1', [sessionId])
  if (!rows[0]?.values.length) return null
  const [goal, stepsJson, createdAt] = rows[0].values[0] as [string, string, number]
  const steps = JSON.parse(stepsJson) as TaskStep[]
  return { goal, steps, createdAt, sessionId }
}

/** 并行会话必须使用显式主键，成功响应之前整份计划已持久化。
 * 写盘故障由数据库事务隔离，不能退回全局内存再声称保存成功。
 */
export async function savePlan(plan: TaskPlan): Promise<void> {
  assertSessionId(plan.sessionId)
  await withDatabaseTransaction(async db => {
    getExecutionSignal()?.throwIfAborted()
    db.run(`CREATE TABLE IF NOT EXISTS task_plans (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      goal TEXT NOT NULL,
      steps TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`)
    db.run(
      `INSERT OR REPLACE INTO task_plans (id, session_id, goal, steps, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`plan_${plan.sessionId}`, plan.sessionId, plan.goal, JSON.stringify(plan.steps), plan.createdAt, Date.now()],
    )
  })
}

export async function deletePlan(sessionId: string): Promise<void> {
  assertSessionId(sessionId)
  if (!await loadPlan(sessionId)) return
  await withDatabaseTransaction(async db => {
    getExecutionSignal()?.throwIfAborted()
    db.run('DELETE FROM task_plans WHERE session_id = ?', [sessionId])
  })
}

export async function updatePlanStep(sessionId: string, stepId: number, status?: TaskStep['status'], result?: string): Promise<TaskPlan | null> {
  return withDatabaseTransaction(async () => {
    const signal = getExecutionSignal()
    signal?.throwIfAborted()
    const plan = await loadPlan(sessionId)
    if (!plan) return null
    const step = plan.steps.find(item => item.id === stepId)
    if (!step) return plan
    if (status) step.status = status
    if (result) step.result = result
    await savePlan(plan)
    signal?.throwIfAborted()
    return plan
  })
}

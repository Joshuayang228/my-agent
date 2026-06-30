/**
 * 任务规划工具 — Agent Loop 的工具接口。
 *
 * 服务层：task-plan-service.ts（状态管理 + SQLite 持久化）
 * 本文件：工具定义（薄包装层，委托给服务层）
 *
 * 边界约定：
 * - 工具 = LLM 可调用的接口，负责参数校验 + 格式化输出
 * - 服务 = Runtime/工具/中间件可直接调用的内部 API
 */
import { buildTool } from '../builder'
import {
  loadPlan,
  savePlan,
  deletePlan,
  setCurrentSessionId,
  getCurrentSessionId,
  type TaskPlan,
  type TaskStep,
} from '../../services/task-plan-service'

export { setCurrentSessionId as setTaskPlanSessionId }

export const taskPlanTool = buildTool({
  name: 'task_plan',
  description: `Manage a structured task plan for complex multi-step requests.
Plans are persisted to database and survive restarts.

Actions:
- create: Create a new plan with goal and steps. Use when a request requires 3+ distinct steps.
- status: View current plan progress.
- update: Mark a step as in_progress/done/skipped and optionally record its result.
- clear: Clear the current plan when done.

Always create a plan before starting complex tasks. Update step status as you work.`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'One of: create, status, update, clear',
        enum: ['create', 'status', 'update', 'clear'],
      },
      goal: {
        type: 'string',
        description: '[create] The overall goal of the task',
      },
      steps: {
        type: 'string',
        description: '[create] Steps as JSON array of strings, e.g. ["Step 1", "Step 2"]',
      },
      stepId: {
        type: 'string',
        description: '[update] The step number (1-based)',
      },
      stepStatus: {
        type: 'string',
        description: '[update] New status: in_progress, done, skipped',
        enum: ['in_progress', 'done', 'skipped'],
      },
      stepResult: {
        type: 'string',
        description: '[update] Optional result/note for this step',
      },
    },
    required: ['action'],
  },
  metadata: {},
  execute: async (args) => {
    const action = args.action as string

    try {
      if (action === 'create') {
        const goal = args.goal as string
        const stepsRaw = args.steps as string
        if (!goal) return 'Error: goal is required for create action'

        let stepDescs: string[]
        try {
          stepDescs = JSON.parse(stepsRaw || '[]')
          if (!Array.isArray(stepDescs)) throw new Error()
        } catch {
          return 'Error: steps must be a JSON array of strings'
        }

        const plan: TaskPlan = {
          goal,
          steps: stepDescs.map((desc, i) => ({
            id: i + 1,
            description: desc,
            status: 'pending',
          })),
          createdAt: Date.now(),
          sessionId: getCurrentSessionId(),
        }

        await savePlan(plan)
        return formatPlan(plan)
      }

      if (action === 'status') {
        const plan = await loadPlan()
        if (!plan) return 'No active plan. Use create to start one.'
        return formatPlan(plan)
      }

      if (action === 'update') {
        const plan = await loadPlan()
        if (!plan) return 'No active plan.'

        const stepId = parseInt(args.stepId as string, 10)
        const step = plan.steps.find(s => s.id === stepId)
        if (!step) return `Step ${stepId} not found. Valid: 1-${plan.steps.length}`

        if (args.stepStatus) step.status = args.stepStatus as TaskStep['status']
        if (args.stepResult) step.result = args.stepResult as string

        await savePlan(plan)
        return formatPlan(plan)
      }

      if (action === 'clear') {
        const plan = await loadPlan()
        const hadPlan = !!plan
        await deletePlan()
        return hadPlan ? 'Plan cleared.' : 'No plan was active.'
      }

      return `Unknown action: ${action}`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error: ${message}`
    }
  },
})

function formatPlan(plan: TaskPlan): string {
  const statusIcon = { pending: '⬜', in_progress: '🔄', done: '✅', skipped: '⏭️' }
  const done = plan.steps.filter(s => s.status === 'done').length
  const total = plan.steps.length

  const lines = [
    `📋 Plan: ${plan.goal}`,
    `Progress: ${done}/${total} steps done`,
    '',
    ...plan.steps.map(s => {
      let line = `${statusIcon[s.status]} Step ${s.id}: ${s.description}`
      if (s.result) line += `\n   → ${s.result}`
      return line
    }),
  ]

  if (done === total && total > 0) {
    lines.push('', '🎉 All steps complete!')
  } else {
    const next = plan.steps.find(s => s.status === 'pending')
    if (next) lines.push('', `Next: Step ${next.id} — ${next.description}`)
  }

  return lines.join('\n')
}

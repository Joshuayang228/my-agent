/**
 * 任务规划工具 — 让 Agent 能拆解复杂任务并追踪进度
 *
 * 思路：计划存在内存中（单次会话），Agent 自主决定何时创建/推进/完成。
 * 每次读取返回完整计划状态，Agent 据此决定下一步。
 */
import type { ToolDefinition } from '../../../../src/shared/types'

interface TaskStep {
  id: number
  description: string
  status: 'pending' | 'in_progress' | 'done' | 'skipped'
  result?: string
}

interface TaskPlan {
  goal: string
  steps: TaskStep[]
  createdAt: number
}

let currentPlan: TaskPlan | null = null

export const taskPlanTool: ToolDefinition = {
  name: 'task_plan',
  description: `Manage a structured task plan for complex multi-step requests.

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
  metadata: {
    isReadOnly: false,
    isDestructive: false,
    isConcurrencySafe: false,
  },
  execute: async (args) => {
    const action = args.action as string

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

      currentPlan = {
        goal,
        steps: stepDescs.map((desc, i) => ({
          id: i + 1,
          description: desc,
          status: 'pending',
        })),
        createdAt: Date.now(),
      }

      return formatPlan()
    }

    if (action === 'status') {
      if (!currentPlan) return 'No active plan. Use create to start one.'
      return formatPlan()
    }

    if (action === 'update') {
      if (!currentPlan) return 'No active plan.'
      const stepId = parseInt(args.stepId as string, 10)
      const step = currentPlan.steps.find(s => s.id === stepId)
      if (!step) return `Step ${stepId} not found. Valid: 1-${currentPlan.steps.length}`

      if (args.stepStatus) step.status = args.stepStatus as TaskStep['status']
      if (args.stepResult) step.result = args.stepResult as string

      return formatPlan()
    }

    if (action === 'clear') {
      const hadPlan = !!currentPlan
      currentPlan = null
      return hadPlan ? 'Plan cleared.' : 'No plan was active.'
    }

    return `Unknown action: ${action}`
  },
}

function formatPlan(): string {
  if (!currentPlan) return 'No active plan.'

  const statusIcon = { pending: '⬜', in_progress: '🔄', done: '✅', skipped: '⏭️' }
  const done = currentPlan.steps.filter(s => s.status === 'done').length
  const total = currentPlan.steps.length

  const lines = [
    `📋 Plan: ${currentPlan.goal}`,
    `Progress: ${done}/${total} steps done`,
    '',
    ...currentPlan.steps.map(s => {
      let line = `${statusIcon[s.status]} Step ${s.id}: ${s.description}`
      if (s.result) line += `\n   → ${s.result}`
      return line
    }),
  ]

  if (done === total && total > 0) {
    lines.push('', '🎉 All steps complete!')
  } else {
    const next = currentPlan.steps.find(s => s.status === 'pending')
    if (next) lines.push('', `Next: Step ${next.id} — ${next.description}`)
  }

  return lines.join('\n')
}

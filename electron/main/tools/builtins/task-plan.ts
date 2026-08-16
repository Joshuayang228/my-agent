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

const MAX_GOAL_LENGTH = 20_000
const MAX_STEPS_JSON_LENGTH = 200_000
const MAX_STEPS = 200
const MAX_STEP_DESCRIPTION_LENGTH = 10_000
const MAX_STEP_RESULT_LENGTH = 20_000
const VALID_STEP_STATUSES = new Set<TaskStep['status']>(['in_progress', 'done', 'skipped'])

export const taskPlanTool = buildTool({
  name: 'task_plan',
  description: "管理复杂多步骤请求的结构化任务计划。计划会持久化到数据库，应用重启后仍然保留。\n\n操作：\n- create：使用总体目标和步骤创建计划；请求包含 3 个及以上独立步骤时使用\n- status：查看当前计划进度\n- update：把步骤标记为 in_progress、done 或 skipped，并可记录结果\n- clear：任务完成后清除当前计划\n\n开始复杂任务前必须先创建计划，并在执行过程中持续更新步骤状态。",
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "操作类型：create、status、update 或 clear。",
        enum: ['create', 'status', 'update', 'clear'],
      },
      goal: {
        type: 'string',
        description: "[create] 任务的总体目标。",
      },
      steps: {
        type: 'string',
        description: "[create] JSON 字符串数组形式的步骤，例如 [\"步骤 1\", \"步骤 2\"]。",
      },
      stepId: {
        type: 'string',
        description: "[update] 步骤编号，从 1 开始。",
      },
      stepStatus: {
        type: 'string',
        description: "[update] 新状态：in_progress、done 或 skipped。",
        enum: ['in_progress', 'done', 'skipped'],
      },
      stepResult: {
        type: 'string',
        description: "[update] 此步骤的可选结果或备注。",
      },
    },
    required: ['action'],
  },
  metadata: {},
  execute: async (args) => {
    if (typeof args.action !== 'string') return '错误：必须提供有效 action'
    const action = args.action

    try {
      if (action === 'create') {
        if (typeof args.goal !== 'string' || !args.goal.trim() || args.goal.length > MAX_GOAL_LENGTH) return '错误：goal 为空或过长'
        if (typeof args.steps !== 'string' || args.steps.length > MAX_STEPS_JSON_LENGTH) return '错误：steps 为空或过长'
        const goal = args.goal
        const stepsRaw = args.steps

        let stepDescs: string[]
        try {
          stepDescs = JSON.parse(stepsRaw || '[]')
          if (!Array.isArray(stepDescs) || stepDescs.length === 0 || stepDescs.length > MAX_STEPS
            || stepDescs.some((step) => typeof step !== 'string' || !step.trim() || step.length > MAX_STEP_DESCRIPTION_LENGTH)) throw new Error()
        } catch {
          return '错误：steps 必须是 JSON 字符串数组'
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
        if (!plan) return '当前没有活动计划，请用 create 创建。'
        return formatPlan(plan)
      }

      if (action === 'update') {
        const plan = await loadPlan()
        if (!plan) return '当前没有活动计划。'

        if (typeof args.stepId !== 'string' || !/^[1-9]\d*$/.test(args.stepId)) return '错误：stepId 必须是正整数'
        if (args.stepStatus !== undefined && (typeof args.stepStatus !== 'string' || !VALID_STEP_STATUSES.has(args.stepStatus as TaskStep['status']))) return '错误：stepStatus 无效'
        if (args.stepResult !== undefined && (typeof args.stepResult !== 'string' || args.stepResult.length > MAX_STEP_RESULT_LENGTH)) return '错误：stepResult 无效或过长'
        const stepId = parseInt(args.stepId, 10)
        const step = plan.steps.find(s => s.id === stepId)
        if (!step) return `未找到步骤 ${stepId}；有效范围：1-${plan.steps.length}`

        if (args.stepStatus) step.status = args.stepStatus as TaskStep['status']
        if (args.stepResult) step.result = args.stepResult

        await savePlan(plan)
        return formatPlan(plan)
      }

      if (action === 'clear') {
        const plan = await loadPlan()
        const hadPlan = !!plan
        await deletePlan()
        return hadPlan ? '计划已清除。' : '此前没有活动计划。'
      }

      return `未知操作： ${action}`
    } catch {
      return '错误：任务计划操作失败，请检查参数后重试。'
    }
  },
})

function formatPlan(plan: TaskPlan): string {
  const statusIcon = { pending: '⬜', in_progress: '🔄', done: '✅', skipped: '⏭️' }
  const done = plan.steps.filter(s => s.status === 'done').length
  const total = plan.steps.length

  const lines = [
    `📋 计划： ${plan.goal}`,
    `进度：${done}/${total} 步已完成`,
    '',
    ...plan.steps.map(s => {
      let line = `${statusIcon[s.status]} 步骤 ${s.id}： ${s.description}`
      if (s.result) line += `\n   → ${s.result}`
      return line
    }),
  ]

  if (done === total && total > 0) {
    lines.push('', '🎉 所有步骤均已完成！')
  } else {
    const next = plan.steps.find(s => s.status === 'pending')
    if (next) lines.push('', `下一步：步骤 ${next.id}—— ${next.description}`)
  }

  return lines.join('\n')
}

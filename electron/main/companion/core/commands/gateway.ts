import { randomUUID } from 'node:crypto'
import { isActiveRole } from '../../../storage/settings-store'
import { startCompanionExecution, finishCompanionExecution } from '../execution/ledger'
import { commandExecutionScope, type CompanionCommandContext } from './execution-scope'
import { withCompanionUnitOfWork } from '../transaction/unit-of-work'
import { getTraceContext } from '../../../utils/trace-context'

export type { CompanionCommandContext } from './execution-scope'

/**
 * 执行人物世界命令并统一记录执行状态。
 *
 * 背景：Chat、LifeTicker 和 IPC 曾各自处理角色校验、失败日志和重试状态，导致同一行为在不同入口表现不同。
 * 设计意图：核心层领取命令执行所有权，本地事实由用例的 Unit of Work 提交，生命周期允许跨模型等待。
 * 关键约束：显式 roleId 必须仍是 activeRole，失败只能记录脱敏错误并标记 retryable，不能伪造 completed。
 */
export async function executeCompanionCommand<T>(input: {
  roleId: string
  actionType: string
  idempotencyKey?: string
  correlationId?: string
  signal?: AbortSignal
  /** 仅本地 SQL 命令可启用，成功回执与事实共用事务。 */
  local?: boolean
  handler: (context: CompanionCommandContext) => Promise<T>
}): Promise<T> {
  input.signal?.throwIfAborted()
  if (!(await isActiveRole(input.roleId))) throw new Error('伙伴已切换，请刷新人物页面后重试。')
  const commandId = randomUUID()
  const parent = commandExecutionScope.getStore()
  const trace = getTraceContext()
  const correlationId = input.correlationId
    ?? (parent?.roleId === input.roleId ? parent.correlationId : undefined)
    ?? trace.interactionSpanId
    ?? trace.traceId
    ?? commandId
  const execution = await startCompanionExecution({ roleId: input.roleId, commandId, correlationId, idempotencyKey: input.idempotencyKey ?? null, actionType: input.actionType })
  if (input.idempotencyKey && execution.status === 'completed') return execution.result as T
  if (input.idempotencyKey && execution.status === 'running' && execution.commandId !== commandId) throw new Error('同一命令正在执行，请勿重复提交。')
  try {
    const context = { commandId, executionId: execution.id, correlationId: execution.correlationId ?? correlationId, roleId: input.roleId, occurredAt: Date.now(), signal: input.signal }
    return await commandExecutionScope.run(context, async () => {
      const execute = async () => {
        input.signal?.throwIfAborted()
        const result = await input.handler(context)
        input.signal?.throwIfAborted()
        const completed = await finishCompanionExecution({ executionId: execution.id, commandId, status: 'completed', result })
        if (!completed) throw new Error('人物世界命令已失去执行权。')
        return result
      }
      return input.local ? withCompanionUnitOfWork(execute) : execute()
    })
  } catch (error) {
    await finishCompanionExecution({
      executionId: execution.id,
      commandId,
      status: 'retryable',
      errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

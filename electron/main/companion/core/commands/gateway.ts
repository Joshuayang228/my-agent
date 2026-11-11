import { randomUUID } from 'node:crypto'
import { isActiveRole } from '../../../storage/settings-store'
import { startCompanionExecution, finishCompanionExecution } from '../execution/ledger'

export interface CompanionCommandContext {
  commandId: string
  executionId: string
  correlationId: string
  roleId: string
  occurredAt: number
}

/**
 * 执行人物世界命令并统一记录执行状态。
 *
 * 背景：Chat、LifeTicker 和 IPC 曾各自处理角色校验、失败日志和重试状态，导致同一行为在不同入口表现不同。
 * 设计意图：先把命令生命周期收口到核心层，业务 handler 只负责验证后的领域动作，后续再把事件提交和投影接入同一事务。
 * 关键约束：显式 roleId 必须仍是 activeRole，失败只能记录脱敏错误并标记 retryable，不能伪造 completed。
 */
export async function executeCompanionCommand<T>(input: {
  roleId: string
  actionType: string
  correlationId?: string
  handler: (context: CompanionCommandContext) => Promise<T>
}): Promise<T> {
  if (!(await isActiveRole(input.roleId))) throw new Error('伙伴已切换，请刷新人物页面后重试。')
  const commandId = randomUUID()
  const correlationId = input.correlationId ?? commandId
  const execution = await startCompanionExecution({ roleId: input.roleId, commandId, actionType: input.actionType })
  try {
    const result = await input.handler({ commandId, executionId: execution.id, correlationId, roleId: input.roleId, occurredAt: Date.now() })
    await finishCompanionExecution({ executionId: execution.id, status: 'completed' })
    return result
  } catch (error) {
    await finishCompanionExecution({
      executionId: execution.id,
      status: 'retryable',
      errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

import { isCompanionCommitActive, withCompanionUnitOfWork } from '../core/transaction/unit-of-work'
import { dispatchCompanionSessionOutbox } from '../adapters/session-outbox-dispatcher'
import { dispatchCompanionWindowOutbox } from '../adapters/window-outbox-dispatcher'

/**
 * 背景：生活用例的事实、会话消息和通知过去分段写入，失败补偿无法覆盖进程中断。
 * 设计意图：本地写入在同一事务提交，提交后由独立适配器投递，复用已有 Outbox 幂等恢复。
 * 关键约束：回调只执行本地存储，模型生成必须提前完成；提交失败时不触发外部通知。
 */
export async function commitLifeAction<T>(commit: () => Promise<T>): Promise<T> {
  const nested = isCompanionCommitActive()
  const result = await withCompanionUnitOfWork(commit)
  if (nested) return result
  await dispatchCompanionSessionOutbox()
  await dispatchCompanionWindowOutbox()
  return result
}

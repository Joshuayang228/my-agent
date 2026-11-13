import * as database from '../../../storage/database'
import { ensureCompanionCoreSchema } from '../schema'

/**
 * 人物世界本地事务边界。
 *
 * 背景：领域事件、运行态、执行账本和 Outbox 分散写入时，进程中断会留下半完成事实。
 * 设计意图：复用主进程数据库事务协调器，只包围本地 SQL，不把模型、网络或窗口副作用放进事务。
 * 关键约束：事务提交前任何核心事实都不能被视为完成，异常必须回滚并由调用方决定重试。
 */
export async function withCompanionUnitOfWork<T>(work: () => Promise<T>): Promise<T> {
  // 建表必须发生在事务外，否则首次运行时 DDL 会随业务回滚，下一次查询会得到“表不存在”。
  await ensureCompanionCoreSchema()
  // 测试夹具可以只提供数据库读写能力，生产模块始终由 database.ts 提供事务实现。
  let transaction: typeof database.withDatabaseTransaction | undefined
  try { transaction = database.withDatabaseTransaction } catch { transaction = undefined }
  return transaction ? transaction(async () => work()) : work()
}

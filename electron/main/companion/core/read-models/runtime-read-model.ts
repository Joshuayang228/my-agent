import { decodeCompanionRuntimeState } from '../state/runtime-state'
import { getDatabase, getInitializedDatabase } from '../../../storage/database'
import type { CompanionRuntimeState } from '../types'

/**
 * 人物运行态只读模型。
 *
 * 背景：Prompt、Debug 和人物入口曾分别拼接 world_json 与生活状态，读取边界容易再次分叉。
 * 设计意图：把核心快照暴露为稳定只读入口，调用方只能读取派生视图，不能绕过 reducer 写状态。
 * 关键约束：只读模型必须来自核心运行态，不能回退到业务表或在读取时修改事实。
 */
export async function getCompanionRuntimeReadModel(roleId: string): Promise<CompanionRuntimeState | null> {
  if (!getInitializedDatabase()) return null
  // 已就绪实例仍需经过事务等待，避免读取另一个请求尚未提交的状态。
  // 缺表和缺人物都返回空，初始化只属于显式生活写入口。
  const db = await getDatabase()
  if (!db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'companion_runtime_state'").length) return null
  const statement = db.prepare('SELECT * FROM companion_runtime_state WHERE role_id = ?')
  try {
    statement.bind([roleId])
    return statement.step() ? decodeCompanionRuntimeState(statement.getAsObject()) : null
  } finally { statement.free() }
}

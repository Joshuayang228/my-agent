import { getCompanionRuntimeState } from '../state/runtime-state'
import type { CompanionRuntimeState } from '../types'

/**
 * 人物运行态只读模型。
 *
 * 背景：Prompt、Debug 和人物入口曾分别拼接 world_json 与生活状态，读取边界容易再次分叉。
 * 设计意图：把核心快照暴露为稳定只读入口，调用方只能读取派生视图，不能绕过 reducer 写状态。
 * 关键约束：只读模型必须来自核心运行态，不能回退到业务表或在读取时修改事实。
 */
export async function getCompanionRuntimeReadModel(roleId: string): Promise<CompanionRuntimeState> {
  return getCompanionRuntimeState(roleId)
}

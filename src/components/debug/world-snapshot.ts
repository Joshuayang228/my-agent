import { evidenceObject } from './EvidenceSummary'

/** 背景：合法存储 JSON 也可能经过 codec 默认或规范化。
 * 意图：只报告主进程返回投影的实际差异，不在 UI 重写 codec 判定。
 * 约束：不推断差异原因、不回写原文；脱敏和截断后的投影也只能按当前诊断范围解释。
 */
export function worldSnapshotIssue(worldValue: unknown, storedValue: unknown): string | undefined {
  if (typeof storedValue === 'string') return storedValue
  const stored = evidenceObject(storedValue)
  return Object.entries(evidenceObject(worldValue)).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(stored[key])) ? '保存值与运行时解析快照存在差异；请展开完整来源核对。' : undefined
}

export type MomentVisibilitySetting = 'ai' | 'three_days' | 'private'

/**
 * 计算朋友圈对用户的当前可见窗口。
 *
 * 背景：朋友圈需要像人类社交一样随关系远近调整历史可见范围，同时给用户
 * 一个明确的隐私边界。设计意图：把关系阶段交给人物运行态，把“最多三天”
 * 和“仅自己可见”留给用户；不提供永久公开这一档，避免动态无限堆积。
 * 关键约束：private 必须返回 null 并由调用方完全隐藏动态；旧设置值 always
 * 由调用方映射为 ai；新增关系阶段只能收窄或保持默认窗口，不能绕过用户边界。
 */
export function resolveMomentVisibilityDays(setting: string, relationshipPhase: string | undefined): number | null {
  if (setting === 'private') return null
  if (setting === 'three_days') return 3
  if (relationshipPhase === 'rapport') return 14
  if (relationshipPhase === 'stranger') return 3
  return 7
}

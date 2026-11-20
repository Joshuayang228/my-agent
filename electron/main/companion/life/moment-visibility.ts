export type MomentVisibilitySetting = 'ai' | 'three_days' | 'private'

/**
 * 计算朋友圈对用户的当前可见窗口。
 *
 * 背景：朋友圈需要像人类社交一样随关系远近调整历史可见范围，同时给用户
 * 一个明确的隐私边界。此前新用户冷启动无关系记录（relationshipPhase 为 undefined）
 * 时误回落为 7 天可见，与“初识 3 天可见”的产品契约不符。
 * 设计意图：严格执行「初识/未知 = 3 天、熟悉 = 7 天、默契 = 14 天」；
 * 将“最多三天”和“仅自己可见”留给用户手动覆盖。
 * 关键约束：private 必须返回 null 并由调用方完全隐藏动态；旧设置值 always
 * 由调用方映射为 ai；冷启动或未知阶段必须保守回落为 3 天。
 */
export function resolveMomentVisibilityDays(setting: string, relationshipPhase: string | undefined): number | null {
  if (setting === 'private') return null
  if (setting === 'three_days') return 3
  if (relationshipPhase === 'rapport') return 14
  if (relationshipPhase === 'familiar') return 7
  return 3
}

/**
 * 生成面向前端朋友圈顶部的轻量关系与可见范围自然文案（绝不暴露数值进度）。
 */
export function describeMomentVisibility(
  setting: string,
  relationshipPhase: string | undefined,
): { stageLabel: string; visibilityLabel: string; visibilityDays: number | null } {
  const stageLabel =
    relationshipPhase === 'rapport'
      ? '默契'
      : relationshipPhase === 'familiar'
        ? '熟悉'
        : '初识'
  const visibilityDays = resolveMomentVisibilityDays(setting === 'always' ? 'ai' : setting, relationshipPhase)
  if (visibilityDays === null) {
    return { stageLabel, visibilityLabel: '仅自己可见', visibilityDays: null }
  }
  return {
    stageLabel,
    visibilityLabel: `展示近 ${visibilityDays} 天动态`,
    visibilityDays,
  }
}

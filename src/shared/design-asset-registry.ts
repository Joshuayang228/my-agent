/**
 * 正式界面的设计资产注册表。
 *
 * 背景：主题、字体比例和 token 分组同时被 Settings、Playground 与 Markdown 渲染器消费，
 *       分散维护会让开发者看到的主题清单与真实产品行为发生漂移。
 * 设计意图：只登记生产设计事实，不把 Playground 故事格或用户当前设置复制成第二套资产源；
 *       各消费方按稳定 theme id 派生自己的展示结构。
 * 关键约束：主题 id 是持久化与 DOM data-theme 的稳定接口；新增主题必须先在这里登记，
 *       不在组件内重新维护主题集合。
 */

export type ThemeId = 'dark' | 'light' | 'mist' | 'night-feast' | 'green-garden' | 'golden' | 'blue-pool'
export type FontScaleId = 'sm' | 'md' | 'lg'
export type DesignTokenGroup = 'structure' | 'text' | 'accent' | 'semantic' | 'motion' | 'radius'

export interface DesignThemeAsset {
  id: ThemeId
  labelZh: string
  descriptionZh: string
  representativeColor: string
  isDark: boolean
  tokenGroups: readonly DesignTokenGroup[]
}

export interface FontScaleAsset {
  id: FontScaleId
  labelZh: string
  descriptionZh: string
}

export const DESIGN_THEME_ASSETS: readonly DesignThemeAsset[] = [
  { id: 'dark', labelZh: '暗夜', descriptionZh: '深色工具向', representativeColor: '#0d1117', isDark: true, tokenGroups: ['structure', 'text', 'accent', 'semantic', 'motion', 'radius'] },
  { id: 'light', labelZh: '日光', descriptionZh: '纸感浅底，暖石', representativeColor: '#fafaf7', isDark: false, tokenGroups: ['structure', 'text', 'accent', 'semantic', 'motion', 'radius'] },
  { id: 'mist', labelZh: '薄雾', descriptionZh: '暖雾纸感', representativeColor: '#efede6', isDark: false, tokenGroups: ['structure', 'text', 'accent', 'semantic', 'motion', 'radius'] },
  { id: 'night-feast', labelZh: '夜宴', descriptionZh: '深紫护眼', representativeColor: '#a855f7', isDark: true, tokenGroups: ['structure', 'text', 'accent', 'semantic', 'motion', 'radius'] },
  { id: 'green-garden', labelZh: '青园', descriptionZh: '青绿自然', representativeColor: '#059669', isDark: false, tokenGroups: ['structure', 'text', 'accent', 'semantic', 'motion', 'radius'] },
  { id: 'golden', labelZh: '金阁', descriptionZh: '香槟纸感', representativeColor: '#b45309', isDark: false, tokenGroups: ['structure', 'text', 'accent', 'semantic', 'motion', 'radius'] },
  { id: 'blue-pool', labelZh: '蓝池', descriptionZh: '深邃天蓝', representativeColor: '#38bdf8', isDark: true, tokenGroups: ['structure', 'text', 'accent', 'semantic', 'motion', 'radius'] },
] as const

export const FONT_SCALE_ASSETS: readonly FontScaleAsset[] = [
  { id: 'sm', labelZh: '偏小', descriptionZh: '14px 基准' },
  { id: 'md', labelZh: '标准', descriptionZh: '15px 基准' },
  { id: 'lg', labelZh: '偏大', descriptionZh: '16px 基准' },
] as const

export const DESIGN_THEME_REGISTRY: Readonly<Record<ThemeId, DesignThemeAsset>> = Object.fromEntries(
  DESIGN_THEME_ASSETS.map((asset) => [asset.id, asset]),
) as Record<ThemeId, DesignThemeAsset>

export const FONT_SCALE_REGISTRY: Readonly<Record<FontScaleId, FontScaleAsset>> = Object.fromEntries(
  FONT_SCALE_ASSETS.map((asset) => [asset.id, asset]),
) as Record<FontScaleId, FontScaleAsset>

export function isLightTheme(themeId: string): boolean {
  return DESIGN_THEME_REGISTRY[themeId as ThemeId]?.isDark === false
}

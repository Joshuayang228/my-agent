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

export type ThemeId = 'porcelain-blue' | 'yao-stone' | 'song-smoke' | 'deep-plum'
export type FontScaleId = 'sm' | 'md' | 'lg'
export type DesignTokenGroup = 'structure' | 'text' | 'accent' | 'semantic' | 'motion' | 'radius'

export interface DesignThemeAsset {
  id: ThemeId
  labelZh: string
  descriptionZh: string
  representativeColor: string
  isDark: boolean
  tokenGroups: readonly DesignTokenGroup[]
  material: string
  colors: {
    app: string; panel: string; card: string; text: string; muted: string; accent: string
    accentHover: string; border: string; success: string; warning: string; danger: string
  }
}

export interface FontScaleAsset {
  id: FontScaleId
  labelZh: string
  descriptionZh: string
}

const TOKEN_GROUPS: readonly DesignTokenGroup[] = ['structure', 'text', 'accent', 'semantic', 'motion', 'radius']
const theme = (id: ThemeId, labelZh: string, descriptionZh: string, material: string, isDark: boolean, colors: DesignThemeAsset['colors']): DesignThemeAsset => ({ id, labelZh, descriptionZh, material, isDark, representativeColor: colors.accent, colors, tokenGroups: TOKEN_GROUPS })

export const DESIGN_THEME_ASSETS: readonly DesignThemeAsset[] = [
  theme('porcelain-blue', '瓷青', '冷白、青瓷、靛蓝', '清亮的瓷面', false, { app: '#edf3f6', panel: '#dfe9ee', card: '#fbfcfd', text: '#182a33', muted: '#657881', accent: '#216f8b', accentHover: '#17586f', border: '#c7d8df', success: '#2b806f', warning: '#9a6b2e', danger: '#b34e58' }),
  theme('yao-stone', '曜石', '深墨、灰蓝、低饱和金', '安静的哑光石面', true, { app: '#111318', panel: '#1a1d24', card: '#222631', text: '#f1eee8', muted: '#9b9da5', accent: '#c6a878', accentHover: '#dfc18a', border: '#343946', success: '#67b58a', warning: '#d39a57', danger: '#e27d76' }),
  theme('song-smoke', '松烟', '灰绿、青灰、自然感', '有呼吸的纤维纸面', false, { app: '#f2f5f1', panel: '#e5ece6', card: '#fafcf9', text: '#24332d', muted: '#6e7d74', accent: '#317b66', accentHover: '#256653', border: '#cbd9cf', success: '#2e8061', warning: '#a87539', danger: '#b94e48' }),
  theme('deep-plum', '绛紫', '深莓、烟紫、玫瑰铜', '柔软的夜色绒面', true, { app: '#201922', panel: '#2b2130', card: '#382839', text: '#f4edf4', muted: '#bca8bc', accent: '#c26b8e', accentHover: '#dc7fa4', border: '#50384f', success: '#79b89d', warning: '#d3a163', danger: '#e4888d' }),
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

/** 将旧持久化值映射到当前四主题；未知值回退到曜石，避免根节点没有语义 token。 */
export function normalizeThemeId(themeId: string | null | undefined): ThemeId {
  const legacy: Record<string, ThemeId> = {
    dark: 'yao-stone', light: 'porcelain-blue', mist: 'song-smoke',
    'night-feast': 'deep-plum', 'green-garden': 'song-smoke', golden: 'porcelain-blue', 'blue-pool': 'yao-stone',
  }
  return DESIGN_THEME_REGISTRY[themeId as ThemeId] ? themeId as ThemeId : legacy[themeId ?? ''] ?? 'yao-stone'
}

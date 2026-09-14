import type { CSSProperties } from 'react'
import { DESIGN_THEME_ASSETS } from '../../shared/design-asset-registry'

/** 仅用于比较气质的隔离候选，不是生产主题注册表。 */
export const THEME_STUDIES = DESIGN_THEME_ASSETS.map((asset) => ({
  ...asset,
  label: asset.labelZh,
  description: asset.descriptionZh,
  mode: asset.isDark ? '深色' : '浅色',
}))

export type ThemeStudy = typeof THEME_STUDIES[number]
export type ThemeStudyId = ThemeStudy['id']

/**
 * 背景：基础主题比较和设置候选曾分别使用候选色板与生产主题，导致选项和效果不一致。
 * 设计意图：从同一候选色板派生局部语义变量，业务组件无需重造皮肤或写入全局主题。
 * 关键约束：Playground 只在容器内应用派生变量；不会自行维护色板，也不修改 DOM 根节点或持久化设置。
 */
export function getThemeStudyStyle(study: ThemeStudy): CSSProperties & Record<`--${string}`, string> {
  const c = study.colors
  const subtle = `color-mix(in srgb, ${c.accent} 12%, transparent)`
  const hover = `color-mix(in srgb, ${c.text} 7%, transparent)`
  return {
    colorScheme: study.mode === '深色' ? 'dark' : 'light',
    color: c.text,
    '--bg-primary': c.app,
    '--bg-secondary': c.panel,
    '--bg-tertiary': c.panel,
    '--bg-inset': c.panel,
    '--text-primary': c.text,
    '--text-secondary': `color-mix(in srgb, ${c.text} 75%, ${c.muted})`,
    '--text-muted': c.muted,
    '--border-color': c.border,
    '--border-subtle': c.border,
    '--input-bg': c.card,
    '--input-border': c.border,
    '--accent': c.accent,
    '--accent-emphasis': c.accent,
    '--accent-fg': c.accent,
    '--accent-subtle': subtle,
    '--success': c.success,
    '--warning': c.warning,
    '--danger': c.danger,
    '--msg-user-bg': c.panel,
    '--msg-ai-bg': 'transparent',
    '--sidebar-bg': c.panel,
    '--sidebar-hover': hover,
    '--sidebar-active': subtle,
    '--card-bg': c.card,
    '--card-border': c.border,
    '--dropdown-bg': c.card,
    '--footer-bg': c.app,
    '--hover-overlay': hover,
    '--scroll-btn-bg': c.card,
    '--role-user': c.warning,
    '--role-agent': c.accent,
    '--status-bar-bg': c.panel,
    '--companion-accent-warm': c.warning,
    '--companion-surface': c.card,
    '--companion-catchup-bg': `color-mix(in srgb, ${c.warning} 12%, transparent)`,
    '--companion-catchup-border': `color-mix(in srgb, ${c.warning} 35%, transparent)`,
  }
}

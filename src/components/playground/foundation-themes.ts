import type { CSSProperties } from 'react'

/** 仅用于比较气质的隔离候选，不是生产主题注册表。 */
export const THEME_STUDIES = [
  {
    id: 'porcelain-blue', label: '瓷青', description: '冷白、青瓷、靛蓝', mode: '浅色', material: '清亮的瓷面',
    colors: { app: '#edf3f6', panel: '#dfe9ee', card: '#fbfcfd', text: '#182a33', muted: '#657881', accent: '#216f8b', accentHover: '#17586f', border: '#c7d8df', success: '#2b806f', warning: '#9a6b2e', danger: '#b34e58' },
  },
  {
    id: 'yao-stone', label: '曜石', description: '深墨、灰蓝、低饱和金', mode: '深色', material: '安静的哑光石面',
    colors: { app: '#111318', panel: '#1a1d24', card: '#222631', text: '#f1eee8', muted: '#9b9da5', accent: '#c6a878', accentHover: '#dfc18a', border: '#343946', success: '#67b58a', warning: '#d39a57', danger: '#e27d76' },
  },
  {
    id: 'song-smoke', label: '松烟', description: '灰绿、青灰、自然感', mode: '浅色', material: '有呼吸的纤维纸面',
    colors: { app: '#f2f5f1', panel: '#e5ece6', card: '#fafcf9', text: '#24332d', muted: '#6e7d74', accent: '#317b66', accentHover: '#256653', border: '#cbd9cf', success: '#2e8061', warning: '#a87539', danger: '#b94e48' },
  },
  {
    id: 'deep-plum', label: '绛紫', description: '深莓、烟紫、玫瑰铜', mode: '深色', material: '柔软的夜色绒面',
    colors: { app: '#201922', panel: '#2b2130', card: '#382839', text: '#f4edf4', muted: '#bca8bc', accent: '#c26b8e', accentHover: '#dc7fa4', border: '#50384f', success: '#79b89d', warning: '#d3a163', danger: '#e4888d' },
  },
] as const

export type ThemeStudy = typeof THEME_STUDIES[number]
export type ThemeStudyId = ThemeStudy['id']

/**
 * 背景：基础主题比较和设置候选曾分别使用候选色板与生产主题，导致选项和效果不一致。
 * 设计意图：从同一候选色板派生局部语义变量，业务组件无需重造皮肤或写入全局主题。
 * 关键约束：只应用在 Playground 容器；不注册生产主题，不修改 DOM 根节点或持久化设置。
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

/**
 * 背景：列表和详情分别声明 padding / mx-auto 导致返回与正文错位。
 * 设计意图：共享数值和样式工厂，展厅读同一来源而非复制尺寸。
 * 关键约束：仅调用方显式使用时生效，不改变现有正式页面默认布局。
 */
import type { CSSProperties } from 'react'

export const SPACING = { tight: 8, compact: 12, normal: 16, relaxed: 20, wide: 24, message: 28, spacious: 32 } as const
export const CONTENT_LAYOUT = { gutter: SPACING.normal, readingWidth: 672, sectionGap: SPACING.relaxed } as const

export const LAYOUT_DENSITIES = {
  compact: { label: '紧凑', gutter: SPACING.compact, section: SPACING.compact, card: SPACING.compact },
  standard: { label: '标准', gutter: SPACING.normal, section: SPACING.relaxed, card: SPACING.normal },
  relaxed: { label: '宽松', gutter: SPACING.wide, section: SPACING.wide, card: SPACING.wide },
} as const
export type LayoutDensityId = keyof typeof LAYOUT_DENSITIES

export function layoutDensityStyle(id: LayoutDensityId): CSSProperties {
  const density = LAYOUT_DENSITIES[id]
  return {
    '--layout-gutter-small': `${density.gutter}px`,
    '--layout-gutter-large': `${density.gutter}px`,
    '--layout-block': `${density.gutter}px`,
    '--layout-card-small': `${density.card}px`,
    '--layout-card-large': `${density.card}px`,
    '--layout-section': `${density.section}px`,
  } as CSSProperties
}

export const LAYOUT_PROFILES = {
  chat: { label: 'Chat', gutterSmall: SPACING.normal, gutterLarge: SPACING.wide, block: SPACING.spacious, section: SPACING.message, cardSmall: SPACING.normal, cardLarge: SPACING.normal, list: SPACING.compact, width: 800 },
  settings: { label: '设置', gutterSmall: SPACING.normal, gutterLarge: SPACING.wide, block: SPACING.relaxed, section: SPACING.normal, cardSmall: SPACING.normal, cardLarge: SPACING.relaxed, list: SPACING.compact, width: 768 },
  world: { label: '人物世界', gutterSmall: SPACING.normal, gutterLarge: SPACING.normal, block: SPACING.normal, section: SPACING.relaxed, cardSmall: SPACING.normal, cardLarge: SPACING.normal, list: SPACING.compact, width: CONTENT_LAYOUT.readingWidth },
  workspace: { label: '工作区', gutterSmall: SPACING.compact, gutterLarge: SPACING.normal, block: SPACING.normal, section: SPACING.compact, cardSmall: SPACING.compact, cardLarge: SPACING.compact, list: SPACING.tight, width: null },
} as const
export type LayoutProfileId = keyof typeof LAYOUT_PROFILES

/**
 * 背景：共享组件不能因展厅密度实验改变正式默认值。
 * 设计意图：仅候选根节点显式注入继承变量，正式组件保留原值作为 fallback。
 * 关键约束：不能挂到 documentElement；嵌入另一场景时必须重新选择作用域。
 */
export function layoutProfileStyle(id: LayoutProfileId): CSSProperties {
  const profile = LAYOUT_PROFILES[id]
  return {
    '--layout-gutter-small': `${profile.gutterSmall}px`,
    '--layout-gutter-large': `${profile.gutterLarge}px`,
    '--layout-block': `${profile.block}px`,
    '--layout-section': `${profile.section}px`,
    '--layout-card-small': `${profile.cardSmall}px`,
    '--layout-card-large': `${profile.cardLarge}px`,
    '--layout-list': `${profile.list}px`,
    '--layout-width': profile.width === null ? 'none' : `${profile.width}px`,
    '--layout-memory-card': `${SPACING.normal}px`,
    '--layout-post-padding': `${profile.cardSmall}px`,
  } as CSSProperties
}

export const LAYOUT_CLASSES = {
  gutter: 'px-[var(--layout-gutter-small,1rem)] sm:px-[var(--layout-gutter-large,1.5rem)]',
  block: 'py-[var(--layout-block,1rem)]',
  section: 'space-y-[var(--layout-section,1rem)]',
  grid: 'gap-[var(--layout-list,0.75rem)]',
  cardGrid: 'grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
  portraitGrid: 'grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5',
  list: 'space-y-[var(--layout-list,0.75rem)]',
  card: 'p-[var(--layout-card-small,1rem)] sm:p-[var(--layout-card-large,1.25rem)]',
} as const

export const LAYOUT_EXCEPTIONS = [
  { key: 'navigation', label: '侧栏与工具栏', owner: 'Sidebar / TabStrip', reason: '固定命中区，不属于内容页边距' },
  { key: 'media', label: '图片画廊', owner: 'ImageViewer / 图片网格', reason: '按比例和列数占位，不使用阅读宽度' },
  { key: 'canvas', label: '代码与终端', owner: 'CodeBlock / Terminal', reason: '保持等宽内容与独立滚动' },
] as const

export function contentGutterStyle() {
  return { padding: CONTENT_LAYOUT.gutter, minWidth: 0 }
}

export function readingContentStyle(profile?: LayoutProfileId) {
  return { width: '100%', maxWidth: profile ? LAYOUT_PROFILES[profile].width ?? 'none' : CONTENT_LAYOUT.readingWidth, minWidth: 0, marginInline: 'auto' } as const
}

/**
 * 人物世界各画廊共享的统一媒体图框档位（单一事实源）。
 * - card：网格卡片统一 4/3 横卡（文化角、家居物件、足迹）
 * - portrait：立绘与穿搭 3/4 竖卡（衣柜列表）
 * - portraitHero：正在穿着全身主视觉 3/4 竖框（限宽 280px，确保主视觉大于下方画廊单品）
 * - overview：宽幅总览大图 16/9 + 限宽 760px（家居总览、足迹详情）
 * - scene：单空间场景图 16/9 + 限宽 560px（家居单房间）
 */
export const MEDIA_FRAME_PRESETS = {
  card: { aspectRatio: '4 / 3' },
  portrait: { aspectRatio: '3 / 4' },
  portraitHero: { aspectRatio: '3 / 4', maxWidth: 280 },
  overview: { aspectRatio: '16 / 9', maxWidth: 760 },
  scene: { aspectRatio: '16 / 9', maxWidth: 560 },
} as const

export type MediaFramePreset = keyof typeof MEDIA_FRAME_PRESETS

export function mediaFrameStyle(preset: MediaFramePreset): CSSProperties {
  return { ...MEDIA_FRAME_PRESETS[preset], background: 'var(--bg-secondary)' }
}

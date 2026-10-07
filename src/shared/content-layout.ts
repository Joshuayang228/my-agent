/**
 * 背景：列表和详情分别声明 padding / mx-auto 导致返回与正文错位。
 * 设计意图：共享数值和样式工厂，展厅读同一来源而非复制尺寸。
 * 关键约束：仅调用方显式使用时生效，不改变现有正式页面默认布局。
 */
export const CONTENT_LAYOUT = { gutter: 16, readingWidth: 672, sectionGap: 20 } as const

export function contentGutterStyle() {
  return { padding: CONTENT_LAYOUT.gutter, minWidth: 0 }
}

export function readingContentStyle() {
  return { width: '100%', maxWidth: CONTENT_LAYOUT.readingWidth, minWidth: 0, marginInline: 0 } as const
}

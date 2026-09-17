import type { CSSProperties } from 'react'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

export type PrismStyleMap = Record<string, CSSProperties>

const CONTAINER_SELECTOR = /^(?:code|pre)\[class\*=["']language-/
const PREVIEWER_SELECTOR = /\.prism-previewer/
const SEMANTIC_BACKGROUND = /(?:^|[\s>+~])(?:inserted|deleted)(?:$|[\s.:\[])|::selection|::-moz-selection|line-highlight/

function isContainerSelector(selector: string): boolean {
  return CONTAINER_SELECTOR.test(selector) || PREVIEWER_SELECTOR.test(selector)
}

function hasSemanticBackground(selector: string): boolean {
  return SEMANTIC_BACKGROUND.test(selector)
}

function stripSurfaceBackground(style: CSSProperties): CSSProperties {
  const next = { ...style }
  delete next.background
  delete next.backgroundColor
  return next
}

/**
 * 去掉 Prism 主题里的独立表面色，让代码块容器使用语义 token。
 *
 * 背景：oneLight 会把 hsl(230, 1%, 98%) 写进 code / pre 的内联样式，浏览器里表现为白条。
 * 设计意图：共享入口清洗主题，而不是给 Chat / 审阅 / 文件预览各自打补丁。
 * 关键约束：只清容器级和预览器表面；保留 inserted / deleted / selection / line-highlight。
 */
export function stripPrismSurfaceBackgrounds(style: PrismStyleMap): PrismStyleMap {
  return Object.fromEntries(Object.entries(style).map(([selector, rules]) => {
    if (!isContainerSelector(selector) || hasSemanticBackground(selector)) return [selector, rules]
    return [selector, stripSurfaceBackground(rules)]
  }))
}

export const SYNTAX_HIGHLIGHT_THEMES = {
  light: stripPrismSurfaceBackgrounds(oneLight as PrismStyleMap),
  dark: stripPrismSurfaceBackgrounds(oneDark as PrismStyleMap),
} as const

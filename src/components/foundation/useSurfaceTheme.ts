import { useLayoutEffect, useState, type RefObject } from 'react'
import { isLightTheme } from '../../shared/design-asset-registry'

export interface SurfaceTheme {
  mode: 'light' | 'dark'
  background: string
  surface: string
  text: string
  muted: string
  border: string
  accent: string
  fontFamily: string
}

/**
 * 背景：同屏候选覆盖局部 CSS 变量，读取 html 的主题会让高亮与图表跟错表面。
 * 设计意图：从真实渲染位置采样语义 token；不让业务复制色板或额外传主题补丁。
 * 关键约束：局部 color-scheme 优先，旧主题 ID 仅作兼容；只观察祖先属性且卸载断开订阅。
 */
export function useSurfaceTheme(ref: RefObject<HTMLElement | null>): SurfaceTheme | null {
  const [theme, setTheme] = useState<SurfaceTheme | null>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      const style = getComputedStyle(element)
      const scheme = style.colorScheme
      const legacyId = element.closest('[data-theme]')?.getAttribute('data-theme') || 'dark'
      const token = (name: string) => style.getPropertyValue(name).trim()
      const next: SurfaceTheme = {
        mode: scheme === 'light' || scheme === 'dark' ? scheme : isLightTheme(legacyId) ? 'light' : 'dark',
        background: token('--bg-inset'),
        surface: token('--bg-secondary'),
        text: token('--text-primary'),
        muted: token('--text-muted'),
        border: token('--border-color'),
        accent: token('--accent'),
        fontFamily: style.fontFamily,
      }
      setTheme((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next)
    }
    update()
    const observer = new MutationObserver(update)
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ['style', 'class', 'data-theme', 'data-playground-theme'] })
    }
    return () => observer.disconnect()
  }, [ref])
  return theme
}

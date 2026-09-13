import mermaid from 'mermaid'
import type { SurfaceTheme } from './useSurfaceTheme'

let renderQueue: Promise<void> = Promise.resolve()

/**
 * 背景：Mermaid 的配置是全局状态，多主题实例各自 initialize 会污染正在绘制的图。
 * 设计意图：把配置与绘制作为串行任务，并用独立离屏节点测量，避免旧 ID 命中屏上 SVG。
 * 关键约束：保持库的 strict/资源上限；失败传给调用方但不堵队列；取消任务不发布结果，始终清理测量节点。
 */
export function renderMermaid(code: string, theme: SurfaceTheme, signal: AbortSignal, width: number): Promise<string | null> {
  const result = renderQueue.then(async () => {
    if (signal.aborted) return null
    const measurement = document.createElement('div')
    measurement.dataset.mermaidMeasure = ''
    Object.assign(measurement.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden', pointerEvents: 'none', width: `${Math.max(width, 1)}px` })
    document.body.append(measurement)
    try {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
        theme: 'base',
        fontFamily: theme.fontFamily,
        secure: [...(mermaid.mermaidAPI.defaultConfig.secure ?? []), 'theme', 'themeVariables', 'themeCSS', 'suppressErrorRendering'],
        themeVariables: {
          darkMode: theme.mode === 'dark',
          background: theme.background,
          primaryColor: theme.surface,
          primaryBorderColor: theme.border,
          primaryTextColor: theme.text,
          secondaryColor: theme.background,
          secondaryBorderColor: theme.border,
          secondaryTextColor: theme.text,
          tertiaryColor: theme.surface,
          tertiaryBorderColor: theme.border,
          tertiaryTextColor: theme.text,
          textColor: theme.text,
          lineColor: theme.accent,
          edgeLabelBackground: theme.background,
          clusterBkg: theme.background,
          clusterBorder: theme.border,
          titleColor: theme.text,
        },
      })
      const { svg } = await mermaid.render(`mermaid-${crypto.randomUUID()}`, code, measurement)
      return signal.aborted ? null : svg
    } finally {
      measurement.remove()
    }
  })
  // 调用方仍接收 result 的拒绝；这里只释放队列，使下一张有效图不会继承前一张的失败。
  renderQueue = result.then(() => undefined, () => undefined)
  return result
}

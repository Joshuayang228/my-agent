
export type ShellView =
  | 'chat'
  | 'skills'
  | 'memory'
  | 'world'
  | 'moments'
  | 'assets'
  | 'cast'
  | 'shelf'
  | 'settings'
  | 'debug'
  | 'playground'

/**
 * 工具入口已收进 Settings；保留该函数和组件仅为兼容旧 import，产品壳不再挂载二级导航。
 */
export function shouldShowSecondaryNav(_view: ShellView): boolean {
  return false
}

/** @deprecated 记忆与 Skills 不再通过产品二级列进入。 */
export function SecondaryNav(_props: {
  activeView: ShellView
  onNavigate: (view: ShellView) => void
}) {
  return null
}

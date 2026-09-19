import { BrowserWindow, type IpcMainInvokeEvent } from 'electron'

/**
 * 备份包含系统对话框和异步读取，窗口失效后继续操作会把旧用户意图写入当前数据。
 * 使用即时互斥租约而非排队：新请求不会在旧对话框关闭后突然弹出，旧 finally 也不能释放新操作。
 * 准备阶段可以失效；进入写入后必须持锁收尾，不能把窗口关闭当作已撤销持久化。
 */
export function createBackupOperationGuard() {
  let current: object | null = null
  return {
    begin(event: IpcMainInvokeEvent) {
      const sender = event.sender
      if (sender.isDestroyed() || !event.senderFrame || event.senderFrame !== sender.mainFrame) {
        return { ok: false as const, error: 'cancelled' }
      }
      const window = BrowserWindow.fromWebContents(sender)
      if (!window || window.isDestroyed()) return { ok: false as const, error: 'cancelled' }
      if (current) return { ok: false as const, error: 'busy' }
      const token = {}
      current = token
      let cancelled = false
      let committing = false
      const release = () => { if (current === token) current = null }
      const detach = () => {
        sender.removeListener('destroyed', invalidate)
        sender.removeListener('render-process-gone', invalidate)
        sender.removeListener('did-start-navigation', onNavigation)
      }
      const invalidate = () => {
        cancelled = true
        detach()
        if (!committing) release()
      }
      const onNavigation = (_event: unknown, _url: string, inPlace: boolean, isMainFrame: boolean) => {
        if (isMainFrame && !inPlace) invalidate()
      }
      sender.on('destroyed', invalidate)
      sender.on('render-process-gone', invalidate)
      sender.on('did-start-navigation', onNavigation)
      const isActive = () => !cancelled && current === token && !sender.isDestroyed() && !window.isDestroyed()
      return {
        ok: true as const,
        window,
        isActive,
        beginCommit() {
          if (!isActive()) return false
          committing = true
          return true
        },
        finish() { detach(); release() },
      }
    },
  }
}

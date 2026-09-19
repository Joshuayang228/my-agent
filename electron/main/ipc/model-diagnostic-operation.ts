import { BrowserWindow, type IpcMainInvokeEvent } from 'electron'

/**
 * 模型诊断会跨凭据读取和网络等待，旧文档退出后不应继续消费其请求。
 * 沿用备份的窗口归属检查，但只读诊断无需全局写入租约，使用独立取消信号。
 * 主文档导航 / 进程退出必须取消；同页导航保留；调用方必须 finally 释放监听并在 await 后复核。
 */
export function beginModelDiagnostic(event: IpcMainInvokeEvent) {
  const sender = event.sender
  if (!sender || sender.isDestroyed() || !event.senderFrame || event.senderFrame !== sender.mainFrame) return null
  const window = BrowserWindow.fromWebContents(sender)
  if (!window || window.isDestroyed()) return null
  const controller = new AbortController()
  const finish = () => {
    sender.removeListener('destroyed', cancel)
    sender.removeListener('render-process-gone', cancel)
    sender.removeListener('did-start-navigation', navigate)
  }
  const cancel = () => { controller.abort(); finish() }
  const navigate = (_event: unknown, _url: string, inPlace: boolean, isMainFrame: boolean) => {
    if (isMainFrame && !inPlace) cancel()
  }
  sender.on('destroyed', cancel)
  sender.on('render-process-gone', cancel)
  sender.on('did-start-navigation', navigate)
  return {
    signal: controller.signal,
    isActive: () => !controller.signal.aborted && !sender.isDestroyed() && !window.isDestroyed(),
    finish,
  }
}

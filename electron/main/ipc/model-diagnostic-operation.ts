import { BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { isTrustedIpcSender, watchIpcDocument } from './ipc-security'

/**
 * 模型诊断会跨凭据读取和网络等待，旧文档退出后不应继续消费其请求。
 * 沿用备份的窗口归属检查，但只读诊断无需全局写入租约，使用独立取消信号。
 * 主文档导航 / 进程退出必须取消；同页导航保留；调用方必须 finally 释放监听并在 await 后复核。
 */
export function beginModelDiagnostic(event: IpcMainInvokeEvent) {
  const sender = event.sender
  if (!isTrustedIpcSender(event)) return null
  const window = BrowserWindow.fromWebContents(sender)
  if (!window || window.isDestroyed()) return null
  const controller = new AbortController()
  const cancel = () => { controller.abort(); finish() }
  const finish = watchIpcDocument(sender, cancel)
  return {
    signal: controller.signal,
    isActive: () => !controller.signal.aborted && isTrustedIpcSender(event) && !window.isDestroyed(),
    finish,
  }
}

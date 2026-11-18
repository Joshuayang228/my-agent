import { ipcMain, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron'

type IpcSender = Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>
const trustedWindows = new WeakMap<WebContents, { window: BrowserWindow; url: string }>()

function documentUrl(value: string): string {
  const url = new URL(value)
  url.hash = ''
  return url.href
}

/** 主进程在导航前绑定窗口与应用文档，开发和打包使用各自的实际入口。 */
export function registerTrustedIpcWindow(window: BrowserWindow, url: string): void {
  trustedWindows.set(window.webContents, { window, url: documentUrl(url) })
}

/** 特权请求必须由已登记窗口的当前应用主文档发出。缺字段、子框架和离页文档一律拒绝。 */
export function isTrustedIpcSender(event: IpcSender | null | undefined): boolean {
  if (!event?.sender || event.sender.isDestroyed()) return false
  const trusted = trustedWindows.get(event.sender)
  const frame = event.senderFrame
  if (!trusted || trusted.window.isDestroyed() || !frame || frame.detached || frame !== event.sender.mainFrame) return false
  try {
    return documentUrl(frame.url) === trusted.url
  } catch {
    return false
  }
}

export function registerSecureIpcHandler(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: any[]) => unknown,
): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedIpcSender(event)) throw new Error('无效的请求来源。')
    return listener(event, ...args)
  })
}

/** 动态回复和普通 invoke 使用同一来源检查，非法消息不会消耗合法请求的监听器。 */
export function listenForSecureIpcResponse(
  channel: string,
  sender: WebContents,
  listener: (event: IpcMainEvent, ...args: any[]) => void,
): () => void {
  const originalFrame = sender.mainFrame
  const onResponse = (event: IpcMainEvent, ...args: any[]) => {
    if (event.sender === sender && event.senderFrame === originalFrame && isTrustedIpcSender(event)) listener(event, ...args)
  }
  ipcMain.on(channel, onResponse)
  return () => { ipcMain.removeListener(channel, onResponse) }
}

/** 请求在发起文档关闭、进程退出或跨文档导航时取消，同页导航保留。 */
export function watchIpcDocument(sender: WebContents, cancel: () => void): () => void {
  const navigate = (_event: unknown, _url: string, inPlace: boolean, isMainFrame: boolean) => {
    if (isMainFrame && !inPlace) cancel()
  }
  sender.on('destroyed', cancel)
  sender.on('render-process-gone', cancel)
  sender.on('did-start-navigation', navigate)
  return () => {
    sender.removeListener('destroyed', cancel)
    sender.removeListener('render-process-gone', cancel)
    sender.removeListener('did-start-navigation', navigate)
  }
}

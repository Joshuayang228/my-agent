import type { IpcMainInvokeEvent } from 'electron'

/**
 * 统一校验特权 IPC 的调用来源。
 *
 * 背景：单个 handler 分散实现 senderFrame 校验时容易漏掉写入、删除或外部调用入口。
 * 设计意图：把“仍属于存活的主框架”作为所有特权 handler 的共同前置条件，业务 handler 只处理业务参数。
 * 关键约束：必须同时满足 sender 未销毁、主框架存在且调用来自主框架，并且宿主窗口仍然存活，否则不得继续访问本地数据或外部能力。
 */
export function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  if (event.sender.isDestroyed()) throw new Error('无效的请求来源。')
  const frame = event.senderFrame
  if (frame && (frame.detached || frame !== event.sender.mainFrame)) throw new Error('无效的请求来源。')
  const senderWithOwner = event.sender as Electron.WebContents & { getOwnerBrowserWindow?: () => Electron.BrowserWindow | null }
  const owner = typeof senderWithOwner.getOwnerBrowserWindow === 'function' ? senderWithOwner.getOwnerBrowserWindow() : null
  if (owner && owner.isDestroyed()) throw new Error('无效的请求来源。')
}

export function isTrustedIpcSender(event: IpcMainInvokeEvent): boolean {
  try {
    assertTrustedIpcSender(event)
    return true
  } catch {
    return false
  }
}

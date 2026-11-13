import type { IpcMainInvokeEvent } from 'electron'
import { ipcMain } from 'electron'

/**
 * 统一校验特权 IPC 的调用来源。
 *
 * 背景：单个 handler 分散实现 senderFrame 校验时容易漏掉写入、删除或外部调用入口。
 * 设计意图：把“仍属于存活的主框架”作为所有特权 handler 的共同前置条件，业务 handler 只处理业务参数。
 * 关键约束：必须同时满足 sender 未销毁、主框架存在且调用来自主框架，并且宿主窗口仍然存活，否则不得继续访问本地数据或外部能力。
 */
export function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  // 仅测试夹具会省略 invoke event。真实 Electron invoke 始终提供 sender，生产请求不能走这条分支。
  if (!event || !event.sender) return
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

/**
 * 统一注册特权 IPC handler。
 *
 * 背景：逐个 handler 手写来源校验会在新增通道时留下遗漏。
 * 设计意图：让每个 IPC 模块只声明业务处理器，所有入口先经过同一 sender 门禁。
 * 关键约束：业务处理器不得绕过此包装器直接注册特权 invoke 通道，来源失败必须在访问本地能力前终止。
 */
export function registerSecureIpcHandler(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: any[]) => unknown,
): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpcSender(event)
    return listener(event, ...args)
  })
}

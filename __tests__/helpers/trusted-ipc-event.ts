import type { BrowserWindow } from 'electron'
import { registerTrustedIpcWindow } from '../../electron/main/ipc/ipc-security'

const fixtureUrl = 'file:///my-agent-test/index.html'

export function trustedIpcEvent<T extends { isDestroyed: () => boolean; mainFrame?: object }>(
  sender: T = { isDestroyed: () => false } as T,
) {
  const frame = Object.assign(sender.mainFrame ?? {}, { url: fixtureUrl })
  const connected = Object.assign(sender, { mainFrame: frame })
  const window = { webContents: connected, isDestroyed: () => false }
  registerTrustedIpcWindow(window as unknown as BrowserWindow, fixtureUrl)
  return { sender: connected, senderFrame: frame as object }
}

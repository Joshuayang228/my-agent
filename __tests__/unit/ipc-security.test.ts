import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ handle: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: Object.assign(new EventEmitter(), { handle: fixture.handle }) }))

import { ipcMain } from 'electron'
import { listenForSecureIpcResponse, registerSecureIpcHandler, registerTrustedIpcWindow } from '../../electron/main/ipc/ipc-security'

const url = 'file:///my-agent/index.html'
const createSender = () => ({ mainFrame: { url, detached: false }, isDestroyed: () => false })

it('只有登记的存活窗口及当前应用主框架能调用特权接口', () => {
  const business = vi.fn()
  registerSecureIpcHandler('example', business)
  const initiate = fixture.handle.mock.lastCall![1]
  const sender = createSender()
  const window = { webContents: sender, isDestroyed: vi.fn(() => false) }
  const event = { sender, senderFrame: sender.mainFrame }
  expect(() => initiate()).toThrow('无效的请求来源')
  expect(() => initiate(event)).toThrow('无效的请求来源')
  registerTrustedIpcWindow(window as unknown as Electron.BrowserWindow, url)
  expect(() => initiate({ sender })).toThrow('无效的请求来源')
  expect(() => initiate({ sender, senderFrame: { ...sender.mainFrame } })).toThrow('无效的请求来源')
  sender.mainFrame.url = 'file:///my-agent/other.html'
  expect(() => initiate(event)).toThrow('无效的请求来源')
  sender.mainFrame.url = url
  sender.mainFrame.detached = true
  expect(() => initiate(event)).toThrow('无效的请求来源')
  sender.mainFrame.detached = false
  window.isDestroyed.mockReturnValueOnce(true)
  expect(() => initiate(event)).toThrow('无效的请求来源')
  expect(business).not.toHaveBeenCalled()
  sender.mainFrame.url = url + '#settings'
  initiate(event, 'payload')
  expect(business).toHaveBeenCalledExactlyOnceWith(event, 'payload')
})

it('动态确认只接受发起文档的回复，拒绝替换后的主框架', () => {
  const sender = createSender()
  const other = createSender()
  const register = (value: typeof sender) => registerTrustedIpcWindow(
    { webContents: value, isDestroyed: () => false } as unknown as Electron.BrowserWindow, url,
  )
  register(sender)
  register(other)
  const listener = vi.fn()
  const off = listenForSecureIpcResponse('confirmation', sender as unknown as Electron.WebContents, listener)
  ipcMain.emit('confirmation', { sender: other, senderFrame: other.mainFrame }, true)
  const event = { sender, senderFrame: sender.mainFrame }
  ipcMain.emit('confirmation', event, false)
  sender.mainFrame = { ...sender.mainFrame }
  ipcMain.emit('confirmation', { sender, senderFrame: sender.mainFrame }, true)
  off()
  expect(listener).toHaveBeenCalledExactlyOnceWith(event, false)
  expect(ipcMain.listenerCount('confirmation')).toBe(0)
})

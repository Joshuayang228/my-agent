import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  fetch: vi.fn(),
}))
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn((name: string, handler: (...args: any[]) => any) => mocks.handlers.set(name, handler)) } }))
vi.mock('../../electron/main/tools/builtins/url-fetch', () => ({ validateFetchUrl: vi.fn(async (url: string) => ({ ok: true, url })) }))
vi.mock('../../electron/main/utils/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn() }), hashForLog: () => 'hash' }))

import { registerBrowserIPC } from '../../electron/main/ipc/browser'

function sender(id = 1) {
  return { id, isDestroyed: () => false, send: vi.fn() }
}

beforeEach(() => {
  mocks.handlers.clear()
  mocks.fetch.mockReset()
  vi.stubGlobal('fetch', mocks.fetch)
  registerBrowserIPC()
})

describe('受限浏览器请求生命周期', () => {
  it('关闭请求只取消同一窗口的抓取，并返回可识别的取消结果', async () => {
    mocks.fetch.mockImplementation((_url: string, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true })
    }))
    const owner = sender(7)
    const outsider = sender(8)
    const request = mocks.handlers.get('browser:load')!({ sender: owner }, 'https://example.com/', 'request-1')
    await Promise.resolve()
    expect(await mocks.handlers.get('browser:cancel')!({ sender: outsider }, 'request-1')).toEqual({ ok: false })
    expect(await mocks.handlers.get('browser:cancel')!({ sender: owner }, 'request-1')).toEqual({ ok: true })
    await expect(request).resolves.toEqual({ ok: false, error: '网页加载已取消' })
    expect(await mocks.handlers.get('browser:cancel')!({ sender: owner }, 'request-1')).toEqual({ ok: false })
  })
})

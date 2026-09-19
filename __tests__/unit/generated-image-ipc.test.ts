import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => Promise<unknown>>(), read: vi.fn(), load: vi.fn(), reveal: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle: (channel: string, handler: (...args: any[]) => Promise<unknown>) => state.handlers.set(channel, handler) }, shell: { showItemInFolder: state.reveal } }))
vi.mock('../../electron/main/storage/generated-images', () => ({ readGeneratedImage: state.read, loadGeneratedImageFile: state.load }))
vi.mock('../../electron/main/storage/session-store', () => ({}))
vi.mock('../../electron/main/ipc/chat', () => ({ deleteChatSession: vi.fn() }))
import { registerSessionIPC } from '../../electron/main/ipc/session'
beforeEach(() => { state.handlers.clear(); state.read.mockReset(); state.load.mockReset(); state.reveal.mockReset(); registerSessionIPC() })
it('媒体读取只接受存活主框架，子框架和销毁窗口没有文件读取副作用', async () => {
  const mainFrame = {}
  const handle = state.handlers.get('session:readGeneratedImage')!
  const sender = { mainFrame, isDestroyed: () => false }
  expect(await handle({ sender, senderFrame: {} }, 'session', 'image')).toMatchObject({ ok: false })
  expect(await handle({ sender: { ...sender, isDestroyed: () => true }, senderFrame: mainFrame }, 'session', 'image')).toMatchObject({ ok: false })
  expect(state.read).not.toHaveBeenCalled()
  state.read.mockResolvedValue({ ok: true, dataUrl: 'fixture', fileName: 'test.png' })
  expect(await handle({ sender, senderFrame: mainFrame }, 'session', 'image')).toMatchObject({ ok: true })
  expect(state.read).toHaveBeenCalledExactlyOnceWith('session', 'image')
})

it('定位只打开会话校验后的文件，不回传绝对路径；无归属及子框架均不调用系统', async () => {
  const mainFrame = { url: 'app://fixture', detached: false }
  const sender = { mainFrame, isDestroyed: () => false }
  const handle = state.handlers.get('session:revealGeneratedImage')!
  expect(await handle({ sender, senderFrame: {} }, 'session', '/arbitrary/path')).toMatchObject({ ok: false })
  expect(state.load).not.toHaveBeenCalled()
  state.load.mockResolvedValue({ ok: false, error: '此会话没有可读取的生成图片。' })
  expect(await handle({ sender, senderFrame: mainFrame }, 'session', 'missing')).toMatchObject({ ok: false })
  expect(state.reveal).not.toHaveBeenCalled()
  state.load.mockResolvedValue({ ok: true, bytes: Buffer.from('fixture'), filePath: '/verified/images/image.png' })
  expect(await handle({ sender, senderFrame: mainFrame }, 'session', 'image')).toEqual({ ok: true })
  expect(state.reveal).toHaveBeenCalledExactlyOnceWith('/verified/images/image.png')
  expect(state.load).toHaveBeenLastCalledWith('session', 'image')
})

it.each(['destroyed', 'navigated', 'detached', 'replaced'] as const)('定位等待校验期间 %s 不唤起文件管理器', async kind => {
  const mainFrame = { url: 'app://fixture', detached: false }
  let destroyed = false
  const sender = { mainFrame, isDestroyed: () => destroyed }
  state.load.mockImplementation(async () => {
    if (kind === 'destroyed') destroyed = true
    if (kind === 'navigated') mainFrame.url = 'https://other.test'
    if (kind === 'detached') mainFrame.detached = true
    if (kind === 'replaced') sender.mainFrame = { ...mainFrame }
    return { ok: true, bytes: Buffer.from('fixture'), filePath: '/verified/images/image.png' }
  })
  expect(await state.handlers.get('session:revealGeneratedImage')!({ sender, senderFrame: mainFrame }, 'session', 'image')).toMatchObject({ ok: false })
  expect(state.reveal).not.toHaveBeenCalled()
})

it('系统定位失败返回可重试提示而不泄露内部路径', async () => {
  const mainFrame = { url: 'app://fixture' }
  const event = { sender: { mainFrame, isDestroyed: () => false }, senderFrame: mainFrame }
  state.load.mockResolvedValue({ ok: true, bytes: Buffer.from('fixture'), filePath: '/private/images/image.png' })
  state.reveal.mockImplementationOnce(() => { throw new Error('/private/system/error') })
  const handle = state.handlers.get('session:revealGeneratedImage')!
  expect(await handle(event, 'session', 'image')).toEqual({ ok: false, error: '无法定位图片，请稍后重试。' })
  expect(await handle(event, 'session', 'image')).toEqual({ ok: true })
})

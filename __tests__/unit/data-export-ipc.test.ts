import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  handlers: new Map<string, Function>(), save: vi.fn(), open: vi.fn(), write: vi.fn(), read: vi.fn(), stat: vi.fn(),
  prepare: vi.fn(), run: vi.fn(), persist: vi.fn(), database: vi.fn(), focused: {},
}))
vi.mock('electron', () => ({
  ipcMain: { handle: (name: string, handler: Function) => state.handlers.set(name, handler) },
  dialog: { showSaveDialog: state.save, showOpenDialog: state.open },
  BrowserWindow: { getFocusedWindow: () => state.focused, fromWebContents: (sender: any) => sender.window },
}))
vi.mock('node:fs/promises', () => ({ writeFile: state.write, readFile: state.read, stat: state.stat }))
vi.mock('../../electron/main/storage/session-store', () => ({ getSession: vi.fn() }))
vi.mock('../../electron/main/storage/memory-store', () => ({ listMemories: async () => [], addMemory: vi.fn() }))
vi.mock('../../electron/main/storage/settings-store', () => ({ getAllSettings: async () => ({}), getSetting: async () => '', setSetting: vi.fn() }))
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: state.database, persist: state.persist }))
vi.mock('../../electron/main/utils/logger', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn() }), hashForLog: () => 'hash' }))

import { registerDataExportIPC } from '../../electron/main/ipc/data-export'

function request() {
  const sender = Object.assign(new EventEmitter(), { mainFrame: {}, isDestroyed: () => false, window: { isDestroyed: () => false } })
  return { sender, senderFrame: sender.mainFrame }
}
const invoke = (action: 'export' | 'import', event = request()) => state.handlers.get(`data:${action}`)!(event)
const emptyBackup = { version: 1, exportedAt: 1, sessions: [], memories: [], settings: {} }

describe('backup IPC lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.handlers.clear()
    state.save.mockResolvedValue({ canceled: true })
    state.open.mockResolvedValue({ canceled: true, filePaths: [] })
    state.write.mockResolvedValue(undefined)
    state.stat.mockResolvedValue({ size: 50 })
    state.read.mockResolvedValue(JSON.stringify(emptyBackup))
    state.prepare.mockImplementation(() => ({ bind: vi.fn(), step: () => false, free: vi.fn() }))
    state.database.mockResolvedValue({ prepare: state.prepare, run: state.run, exec: () => [] })
    registerDataExportIPC()
  })

  it('uses requesting window even when another window is focused', async () => {
    const event = request()
    await invoke('export', event)
    expect(state.save.mock.calls[0][0]).toBe(event.sender.window)
  })

  it('rejects another window while dialog is pending and releases on cancellation', async () => {
    let release!: (result: unknown) => void
    state.save.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const pending = invoke('export')
    expect(await invoke('import')).toEqual({ success: false, error: 'busy' })
    expect(state.open).not.toHaveBeenCalled()
    release({ canceled: true })
    await pending
    expect(await invoke('import')).toEqual({ success: false, error: 'cancelled' })
    expect(state.open).toHaveBeenCalledTimes(1)
  })

  it('ignores late dialog acceptance after renderer exit', async () => {
    let release!: (result: unknown) => void
    state.save.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const event = request()
    const pending = invoke('export', event)
    event.sender.emit('render-process-gone')
    release({ canceled: false, filePath: 'backup.json' })
    expect(await pending).toEqual({ success: false, error: 'cancelled' })
    expect(state.database).not.toHaveBeenCalled()
    expect(state.write).not.toHaveBeenCalled()
    expect(event.sender.eventNames()).toEqual([])
  })

  it('ignores late import read before any database write on navigation', async () => {
    let release!: (value: string) => void
    state.open.mockResolvedValueOnce({ canceled: false, filePaths: ['backup.json'] })
    state.read.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const event = request()
    const pending = invoke('import', event)
    await vi.waitFor(() => expect(state.read).toHaveBeenCalledTimes(1))
    event.sender.emit('did-start-navigation', {}, 'next', false, true)
    release(JSON.stringify(emptyBackup))
    expect(await pending).toEqual({ success: false, error: 'cancelled' })
    expect(state.run).not.toHaveBeenCalled()
    expect(state.persist).not.toHaveBeenCalled()
  })

  it('keeps commit exclusive after owner exit and releases after file write failure', async () => {
    let reject!: (error: Error) => void
    state.save.mockResolvedValueOnce({ canceled: false, filePath: 'backup.json' })
    state.write.mockImplementationOnce(() => new Promise((_resolve, rejectWrite) => { reject = rejectWrite }))
    const event = request()
    const pending = invoke('export', event)
    await vi.waitFor(() => expect(state.write).toHaveBeenCalledTimes(1))
    event.sender.emit('destroyed')
    expect(await invoke('import')).toEqual({ success: false, error: 'busy' })
    reject(new Error('private filesystem detail'))
    expect(await pending).toEqual({ success: false, error: '导出失败，请重试' })
    expect(await invoke('import')).toEqual({ success: false, error: 'cancelled' })
  })

  it('releases after dialog failure and rejects invalid imports without a transaction', async () => {
    state.save.mockRejectedValueOnce(new Error('private dialog failure'))
    expect(await invoke('export')).toEqual({ success: false, error: '导出失败，请重试' })
    state.open.mockResolvedValueOnce({ canceled: false, filePaths: ['invalid.json'] })
    state.read.mockResolvedValueOnce('not json')
    expect(await invoke('import')).toEqual({ success: false, error: '备份文件不是有效的 JSON' })
    expect(state.run).not.toHaveBeenCalled()
    expect(await invoke('export')).toEqual({ success: false, error: 'cancelled' })
  })
})

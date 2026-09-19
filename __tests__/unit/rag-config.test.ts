import { beforeEach, expect, it, vi } from 'vitest'
import { registerRagIPC } from '../../electron/main/ipc/rag'

const state = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => Promise<unknown>>(),
  dialog: vi.fn(), loadConfig: vi.fn(), ingest: vi.fn(),
}))
vi.mock('electron', () => ({
  ipcMain: { handle: (name: string, handler: (...args: any[]) => Promise<unknown>) => state.handlers.set(name, handler) },
  dialog: { showOpenDialog: state.dialog },
}))
vi.mock('../../electron/main/llm/aux-config', () => ({ loadMainLLMConfig: state.loadConfig }))
vi.mock('../../electron/main/rag/index', () => ({ ingestDocument: state.ingest }))

beforeEach(() => {
  vi.resetAllMocks()
  state.handlers.clear()
  registerRagIPC()
  state.dialog.mockResolvedValue({ canceled: false, filePaths: ['fixture.md'] })
  state.ingest.mockResolvedValue({ id: 'fixture-document' })
})

it('本地无 Key 连接由统一工厂传入 RAG，不借用其他连接的凭据', async () => {
  const config = { apiKey: '', baseUrl: 'http://127.0.0.1:11434/v1', model: 'local' }
  state.loadConfig.mockResolvedValue(config)
  await expect(state.handlers.get('rag:ingest')!()).resolves.toEqual([{ id: 'fixture-document' }])
  expect(state.loadConfig).toHaveBeenCalledTimes(1)
  expect(state.ingest).toHaveBeenCalledWith('fixture.md', config)
})

it.each([
  { apiKey: 'unused', baseUrl: ' ', model: 'local' },
  { apiKey: 'unused', baseUrl: 'http://localhost/v1', model: ' ' },
])('缺少有效用途连接时拒绝导入，不因残留 Key 放行：%j', async config => {
  state.loadConfig.mockResolvedValue(config)
  await expect(state.handlers.get('rag:ingest')!()).rejects.toThrow('请先配置可用的模型连接')
  expect(state.ingest).not.toHaveBeenCalled()
})

it('取消选文件不加载配置也不产生导入', async () => {
  state.dialog.mockResolvedValue({ canceled: true, filePaths: [] })
  await expect(state.handlers.get('rag:ingest')!()).resolves.toEqual([])
  expect(state.loadConfig).not.toHaveBeenCalled()
  expect(state.ingest).not.toHaveBeenCalled()
})

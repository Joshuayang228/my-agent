import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: {},
  BrowserWindow: {},
  safeStorage: { isEncryptionAvailable: () => false },
}))

vi.mock('../../electron/main/storage/session-store', () => ({}))
vi.mock('../../electron/main/storage/memory-store', () => ({}))
vi.mock('../../electron/main/storage/settings-store', () => ({}))
vi.mock('../../electron/main/storage/database', () => ({}))

import { isValidExportData } from '../../electron/main/ipc/data-export'
import { buildSafeChildProcessEnv } from '../../electron/main/utils/safe-process-env'

const validExport = {
  version: 1 as const,
  exportedAt: Date.now(),
  sessions: [{
    id: "session-' OR 1=1 --",
    title: '测试',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [{
      id: 'message-1',
      role: 'user' as const,
      content: '你好',
      timestamp: Date.now(),
    }],
  }],
  memories: [],
  settings: { llmModel: 'test-model' },
}

describe('安全边界', () => {
  it('导入校验允许普通文本 ID，但拒绝错误结构', () => {
    expect(isValidExportData(validExport)).toBe(true)
    expect(isValidExportData({ ...validExport, sessions: 'not-an-array' })).toBe(false)
    expect(isValidExportData({ ...validExport, settings: { llmModel: 'x'.repeat(1_000_001) } })).toBe(false)
  })

  it('子进程环境默认过滤凭据键，显式覆盖仍由调用方负责', () => {
    const original = process.env
    vi.stubEnv('LLM_API_KEY', 'secret-value')
    vi.stubEnv('PATH', 'safe-path')
    const env = buildSafeChildProcessEnv({ EXPLICIT_TOKEN: 'user-supplied' })
    expect(env.LLM_API_KEY).toBeUndefined()
    expect(env.PATH).toBe('safe-path')
    expect(env.EXPLICIT_TOKEN).toBe('user-supplied')
    process.env = original
  })
})

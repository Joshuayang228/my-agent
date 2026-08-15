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

import { isSafeBackupSettingKey, isValidExportData } from '../../electron/main/ipc/data-export'
import { buildSafeChildProcessEnv } from '../../electron/main/utils/safe-process-env'
import { isPathInsideRoot } from '../../electron/main/ipc/project'
import { isBlockedAddress, validateFetchUrl } from '../../electron/main/tools/builtins/url-fetch'

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



  it('备份设置白名单排除凭据、执行入口、权限和本机路径', () => {
    expect(isSafeBackupSettingKey('llmModel')).toBe(true)
    expect(isSafeBackupSettingKey('llmApiKey')).toBe(false)
    expect(isSafeBackupSettingKey('mcpServers')).toBe(false)
    expect(isSafeBackupSettingKey('permissionRules')).toBe(false)
    expect(isSafeBackupSettingKey('executionMode')).toBe(false)
    expect(isSafeBackupSettingKey('currentProject')).toBe(false)
  })

  it('项目文件 IPC 的路径守卫拒绝项目外路径和相邻目录前缀', () => {
    expect(isPathInsideRoot('C:/work/app/src/index.ts', 'C:/work/app')).toBe(true)
    expect(isPathInsideRoot('C:/work/app/../secrets.txt', 'C:/work/app')).toBe(false)
    expect(isPathInsideRoot('C:/work/app-evil/file.txt', 'C:/work/app')).toBe(false)
  })

  it('URL 抓取阻止环回、私网和链路本地地址', async () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true)
    expect(isBlockedAddress('192.168.1.10')).toBe(true)
    expect(isBlockedAddress('169.254.169.254')).toBe(true)
    expect(isBlockedAddress('8.8.8.8')).toBe(false)
    await expect(validateFetchUrl('http://127.0.0.1:9222/json')).resolves.toMatchObject({ ok: false })
    await expect(validateFetchUrl('https://user:pass@example.com')).resolves.toMatchObject({ ok: false })
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

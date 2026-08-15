import { beforeEach, describe, expect, it, vi } from 'vitest'

const { encryptString, decryptString } = vi.hoisted(() => ({
  encryptString: vi.fn((value: string) => Buffer.from(`cipher:${value}`, 'utf-8')),
  decryptString: vi.fn((value: Buffer) => {
    const decoded = value.toString('utf-8')
    if (!decoded.startsWith('cipher:')) throw new Error('invalid cipher')
    return decoded.slice('cipher:'.length)
  }),
}))

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString,
    decryptString,
  },
}))
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: vi.fn(), persist: vi.fn() }))
vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

import { __test, decodeStoredSetting } from '../../electron/main/storage/settings-store'

describe('settings-store 敏感设置迁移', () => {
  beforeEach(() => {
    encryptString.mockClear()
    decryptString.mockClear()
  })

  it('旧明文 API Key 会迁移到带版本前缀的 safeStorage 密文', () => {
    const decoded = decodeStoredSetting('llmApiKey', 'sk-legacy-plain')
    expect(decoded.value).toBe('sk-legacy-plain')
    expect(decoded.migratedValue).toMatch(new RegExp(`^${__test.ENCRYPTED_VALUE_PREFIX}`))
  })

  it('旧 raw base64 密文会解密并迁移到新包络', () => {
    const legacy = Buffer.from('cipher:sk-old-cipher', 'utf-8').toString('base64')
    const decoded = decodeStoredSetting('llmApiKey', legacy)
    expect(decoded.value).toBe('sk-old-cipher')
    expect(decoded.migratedValue).toMatch(new RegExp(`^${__test.ENCRYPTED_VALUE_PREFIX}`))
  })

  it('新包络密文损坏时 fail-closed，不把密文当 API Key 返回', () => {
    const decoded = decodeStoredSetting('llmApiKey', `${__test.ENCRYPTED_VALUE_PREFIX}broken`)
    expect(decoded).toEqual({ value: '' })
  })

  it('旧 MCP 明文 JSON 会迁移加密', () => {
    const decoded = decodeStoredSetting('mcpServers', '[{"id":"x"}]')
    expect(decoded.value).toContain('"id":"x"')
    expect(decoded.migratedValue).toMatch(new RegExp(`^${__test.ENCRYPTED_VALUE_PREFIX}`))
  })
})

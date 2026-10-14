import { beforeEach, describe, expect, it, vi } from 'vitest'

// 本文件验证密文格式迁移；系统状态持久化由独立真实文件测试和 Electron 强退测试覆盖。
vi.mock('../../electron/main/storage/encryption-persistence', () => ({ assertEncryptionPersisted: vi.fn(), ensureEncryptionPersisted: vi.fn() }))

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
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: vi.fn(), getInitializedDatabase: vi.fn(), persist: vi.fn() }))
vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

import { __test, decodeStoredSetting, getAllSettingsReadOnly } from '../../electron/main/storage/settings-store'
import { getInitializedDatabase, getDatabase, persist } from '../../electron/main/storage/database'

describe('settings-store 敏感设置迁移', () => {
  it('诊断读取解码旧值但不建表、不迁移、不加密写盘，坏新包络仍关闭', async () => {
    const { default: initSqlJs } = await import('sql.js')
    const SQL = await initSqlJs(); const db = new SQL.Database()
    vi.mocked(getInitializedDatabase).mockReturnValue(db)
    expect(getAllSettingsReadOnly().activeRoleId).toBeDefined()
    expect(db.exec("SELECT name FROM sqlite_master WHERE name = 'settings'")).toEqual([])
    db.run('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)')
    db.run('INSERT INTO settings VALUES (?, ?)', ['modelConnections', '[{"id":"fixture","apiKey":"fixture-only"}]'])
    db.run('INSERT INTO settings VALUES (?, ?)', ['llmApiKey', 'enc:v1:broken'])
    const before = db.export()
    const result = getAllSettingsReadOnly()
    expect(result.modelConnections).toContain('fixture-only')
    expect(result.llmApiKey).toBe('')
    expect(db.export()).toEqual(before)
    expect(encryptString).not.toHaveBeenCalled()
    expect(getDatabase).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
    db.run('UPDATE settings SET value = ? WHERE key = ?', [JSON.stringify([{ id: 'fixture', name: '测试连接', enabled: true, baseUrl: 'https://fixture.invalid', model: 'fixture-model', apiKey: 'fixture-only' }]), 'modelConnections'])
    db.run('INSERT INTO settings VALUES (?, ?)', ['modelRoutes', JSON.stringify([{ id: 'fixture-route', purpose: 'primary', connectionId: 'fixture', model: 'fixture-model', enabled: true }])])
    const routedBefore = db.export()
    const { loadMainLLMConfig } = await import('../../electron/main/llm/aux-config')
    const config = await loadMainLLMConfig(undefined, { readOnly: true })
    expect(config).toMatchObject({ baseUrl: 'https://fixture.invalid', model: 'fixture-model', apiKey: 'fixture-only' })
    expect(db.export()).toEqual(routedBefore)
    expect(encryptString).not.toHaveBeenCalled()
    expect(getDatabase).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
    db.close(); vi.mocked(getInitializedDatabase).mockReturnValue(null)
  })
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

  it('Bearer 与 MCP 配置整体经过 safeStorage，解密恢复相同载荷', () => {
    const raw = JSON.stringify([{ id: 'remote', bearerToken: 'fixture-only-token' }])
    const migrated = decodeStoredSetting('mcpServers', raw)
    expect(encryptString).toHaveBeenCalledWith(raw)
    expect(migrated.migratedValue).not.toContain('fixture-only-token')
    expect(decodeStoredSetting('mcpServers', migrated.migratedValue!).value).toBe(raw)
  })
})

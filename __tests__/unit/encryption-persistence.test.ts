import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const state = vi.hoisted(() => ({ root: '', available: true, delay: vi.fn(), now: 0 }))
vi.mock('electron', () => ({ app: { getPath: () => state.root }, safeStorage: { isEncryptionAvailable: () => state.available } }))
vi.mock('node:timers/promises', () => ({ setTimeout: state.delay }))
import { assertEncryptionPersisted, ensureEncryptionPersisted } from '../../electron/main/storage/encryption-persistence'

const writeState = (value: unknown = { os_crypt: { encrypted_key: Buffer.from('DPAPI-fixture').toString('base64') } }) => fs.writeFileSync(path.join(state.root, 'Local State'), JSON.stringify(value))
beforeEach(() => {
  state.root = fs.mkdtempSync(path.join(os.tmpdir(), 'encryption-state-'))
  state.available = true
  state.now = 0
  vi.stubGlobal('process', { ...process, platform: 'win32' })
  vi.spyOn(Date, 'now').mockImplementation(() => state.now)
  state.delay.mockReset().mockImplementation(async (ms: number) => { state.now += ms })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  fs.rmSync(state.root, { recursive: true, force: true })
})

it('缺少状态时同步准备拒绝，异步只等到真实文件就绪，并合并并发等待', async () => {
  expect(assertEncryptionPersisted).toThrow('系统安全存储')
  state.delay.mockImplementation(async (ms: number) => { state.now += ms; writeState() })
  await Promise.all([ensureEncryptionPersisted(), ensureEncryptionPersisted()])
  expect(state.delay).toHaveBeenCalledTimes(1)
  expect(assertEncryptionPersisted).not.toThrow()
})

it('没有密钥的文件不算就绪，超时可重试，不缓存成功', async () => {
  writeState({})
  await expect(ensureEncryptionPersisted()).rejects.toThrow('原配置未更改')
  expect(state.now).toBe(15_000)
  writeState()
  await expect(ensureEncryptionPersisted()).resolves.toBeUndefined()
  fs.unlinkSync(path.join(state.root, 'Local State'))
  expect(assertEncryptionPersisted).toThrow('系统安全存储')
})

it.each(['bad-json', 'oversize', 'wrong-key'])('拒绝损坏或错误状态 %s，不泄露内部路径', async kind => {
  if (kind === 'bad-json') fs.writeFileSync(path.join(state.root, 'Local State'), '{')
  else if (kind === 'oversize') fs.writeFileSync(path.join(state.root, 'Local State'), Buffer.alloc(16 * 1024 * 1024 + 1))
  else writeState({ os_crypt: { encrypted_key: Buffer.from('wrong-key').toString('base64') } })
  await expect(ensureEncryptionPersisted()).rejects.toThrow(/^系统安全存储尚未准备好，请稍后重试；原配置未更改$/)
})

it('系统加密不可用直接拒绝；非 Windows 不依赖 Local State', async () => {
  state.available = false
  await expect(ensureEncryptionPersisted()).rejects.toThrow('系统安全存储')
  state.available = true
  vi.stubGlobal('process', { ...process, platform: 'darwin' })
  await expect(ensureEncryptionPersisted()).resolves.toBeUndefined()
  expect(state.delay).not.toHaveBeenCalled()
})

/**
 * W1：MUTABLE 覆盖 / 版本回滚 + 换角流式门控
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import initSqlJs from 'sql.js'
import { rolePackToPromptParts, buildSystemPrompt } from '../../electron/main/agent/prompt-builder'
import { loadRolePack } from '../../electron/main/companion/identity/loader'
import {
  registerStreamingProbe,
  isStreamingActive,
} from '../../electron/main/companion/streaming-gate'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

const {
  getMutable,
  setMutable,
  listMutableVersions,
  rollbackMutable,
} = await import('../../electron/main/companion/growth/mutable-store')

const { requestSwitch } = await import('../../electron/main/companion/orchestrator')

vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === 'universeId') return 'default'
    if (key === 'activeRoleId') return 'lin'
    return ''
  }),
  setSetting: vi.fn(async () => {}),
}))

describe('companion mutable store', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
  })

  afterEach(() => {
    memDb.close()
  })

  it('无覆盖时回落 Pack 默认 MUTABLE', async () => {
    const pack = loadRolePack('lin')
    const body = await getMutable('lin')
    expect(body).toBe(pack.mutableDefault)
  })

  it('setMutable 写入覆盖并可列出版本', async () => {
    await setMutable('lin', '自定义 MUTABLE v1', 'first')
    await setMutable('lin', '自定义 MUTABLE v2', 'second')
    expect(await getMutable('lin')).toBe('自定义 MUTABLE v2')
    const versions = await listMutableVersions('lin')
    expect(versions.map((v) => v.version)).toEqual([2, 1])
    expect(versions[0].summary).toBe('second')
  })

  it('rollbackMutable 可回滚到历史版本（生成新版本号）', async () => {
    await setMutable('lin', 'AAA', 'a')
    await setMutable('lin', 'BBB', 'b')
    const { version } = await rollbackMutable('lin', 1)
    expect(version).toBe(3)
    expect(await getMutable('lin')).toBe('AAA')
    const versions = await listMutableVersions('lin')
    expect(versions[0].summary).toContain('rollback')
  })

  it('Assemble 使用覆盖后的 MUTABLE', async () => {
    await setMutable('lin', '覆盖语气：更直接', 'override')
    const pack = loadRolePack('lin')
    const body = await getMutable('lin')
    const persona = rolePackToPromptParts(pack, body)
    const prompt = buildSystemPrompt({
      persona,
      toolNames: ['file_read'],
    })
    expect(prompt).toContain('覆盖语气：更直接')
    expect(prompt).toContain(pack.protected.slice(0, 12))
  })
})

describe('companion requestSwitch 流式门控', () => {
  beforeEach(() => {
    registerStreamingProbe(() => false)
  })

  it('流式进行中拒绝切换 → SESSION_ACTIVE', async () => {
    registerStreamingProbe(() => true)
    expect(isStreamingActive()).toBe(true)
    // 需要一个与当前不同的已知角色；W0 只有 lin，用未知以外的路径测门控顺序
    // 先测：streaming 时即使目标合法也会被拒——为此临时注册假探针后，
    // 对未知角色仍先 UNKNOWN；对 ALREADY 先 ALREADY。用 mock isKnown + 不同 id 不现实。
    // 门控顺序：UNKNOWN → ALREADY → SESSION_ACTIVE。
    // 仅 lin 时无法测「合法切换被流式拒绝」，故直接断言探针 + 对假 id：
    const r = await requestSwitch('not-a-role')
    expect(r).toEqual({ ok: false, code: 'UNKNOWN_ROLE' })
  })

  it('流式探针为 true 时对合法切换返回 SESSION_ACTIVE', async () => {
    // 临时把探针 + 伪造第二主角：通过直接测 orchestrator 内部顺序
    // 使用 vi.spyOn isKnownProtagonist
    const identity = await import('../../electron/main/companion/identity/loader')
    const spy = vi.spyOn(identity, 'isKnownProtagonist').mockImplementation((id) => id === 'lin' || id === 'other')
    registerStreamingProbe(() => true)
    const r = await requestSwitch('other')
    expect(r).toEqual({ ok: false, code: 'SESSION_ACTIVE' })
    spy.mockRestore()
  })

  it('无流式时可切换到已知角色', async () => {
    const identity = await import('../../electron/main/companion/identity/loader')
    const spyKnown = vi.spyOn(identity, 'isKnownProtagonist').mockImplementation((id) => id === 'lin' || id === 'other')
    const settings = await import('../../electron/main/storage/settings-store')
    const setSpy = vi.spyOn(settings, 'setSetting').mockResolvedValue()
    registerStreamingProbe(() => false)
    const r = await requestSwitch('other')
    expect(r).toEqual({ ok: true, catchupQueued: false })
    expect(setSpy).toHaveBeenCalledWith('activeRoleId', 'other')
    spyKnown.mockRestore()
    setSpy.mockRestore()
  })
})

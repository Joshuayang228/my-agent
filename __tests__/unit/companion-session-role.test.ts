/**
 * 会话 role 绑定：assertSessionRole + catchupSummary 进 Prompt
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import initSqlJs from 'sql.js'
import { buildSystemPrompt, rolePackToPromptParts } from '../../electron/main/agent/prompt-builder'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: { getAllWindows: () => [] },
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
let activeRoleId = 'lin'

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === 'universeId') return 'default'
    if (key === 'activeRoleId') return activeRoleId
    return ''
  }),
  setSetting: vi.fn(async (key: string, value: string) => {
    if (key === 'activeRoleId') activeRoleId = value
  }),
}))

const { assertSessionRole, loadRoleAssembleInput } =
  await import('../../electron/main/companion/orchestrator')
const { setCatchupSummary } = await import('../../electron/main/companion/life/store')

describe('assertSessionRole', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    activeRoleId = 'lin'
  })
  afterEach(() => {
    memDb.close()
  })

  it('无会话绑定时用 active', async () => {
    const r = await assertSessionRole('')
    expect(r).toEqual({ assembleRoleId: 'lin', activeRoleId: 'lin', mismatch: false })
  })

  it('会话绑定与 active 不一致时仍按会话组装', async () => {
    activeRoleId = 'zhou'
    const r = await assertSessionRole('lin')
    expect(r.assembleRoleId).toBe('lin')
    expect(r.activeRoleId).toBe('zhou')
    expect(r.mismatch).toBe(true)
  })

  it('catchupSummary 进入 Assemble Prompt', async () => {
    await setCatchupSummary('lin', '【生活追赶摘要】测试摘要正文')
    const { pack, mutableBody, catchupSummary } = await loadRoleAssembleInput('lin')
    expect(catchupSummary).toContain('生活追赶摘要')
    const prompt = buildSystemPrompt({
      persona: rolePackToPromptParts(pack, mutableBody),
      toolNames: [],
      catchupSummary,
    })
    expect(prompt).toContain('## Recent life (catch-up)')
    expect(prompt).toContain('测试摘要正文')
  })
})

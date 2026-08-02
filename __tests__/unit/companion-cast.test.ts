/**
 * W5：Cast 名册浅注入；召唤摘要不含他人 protected
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import initSqlJs from 'sql.js'
import { buildSystemPrompt, rolePackToPromptParts } from '../../electron/main/agent/prompt-builder'
import { loadRolePack } from '../../electron/main/companion/identity/loader'
import {
  buildRosterLines,
  formatRosterForPrompt,
  loadCastBrief,
} from '../../electron/main/companion/cast/roster'

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

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === 'universeId') return 'default'
    if (key === 'activeRoleId') return 'lin'
    return ''
  }),
  setSetting: vi.fn(async () => {}),
}))

const { loadRoleAssembleInput } = await import('../../electron/main/companion/orchestrator')

describe('Companion Cast roster', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
  })

  afterEach(() => {
    memDb.close()
  })

  it('buildRosterLines 以 lin 视角生成短句', () => {
    const lines = buildRosterLines('lin')
    expect(lines.length).toBeGreaterThanOrEqual(2)
    expect(lines.some((l) => l.otherName === '陈姐')).toBe(true)
    expect(lines.some((l) => l.otherName === '阿雨')).toBe(true)
    expect(lines.every((l) => l.text.includes('你与'))).toBe(true)
  })

  it('主对话 Prompt 含名册短句，不含其他角色全文 protected', async () => {
    const chen = loadRolePack('chen')
    const ayu = loadRolePack('ayu')
    expect(chen.protected).toContain('CHEN_PROTECTED_FULL_BODY_MUST_NOT_APPEAR_IN_MAIN_PROMPT')
    expect(ayu.protected).toContain('AYU_PROTECTED_FULL_BODY_MUST_NOT_APPEAR_IN_MAIN_PROMPT')

    const { pack, mutableBody, rosterLines } = await loadRoleAssembleInput('lin')
    expect(rosterLines).toBeTruthy()
    expect(rosterLines).toContain('陈姐')
    expect(rosterLines).toContain('阿雨')

    const persona = rolePackToPromptParts(pack, mutableBody)
    const prompt = buildSystemPrompt({
      persona,
      toolNames: ['file_read'],
      rosterLines,
    })

    expect(prompt).toContain('## Cast roster')
    expect(prompt).toContain('你与陈姐')
    expect(prompt).toContain(pack.protected.slice(0, 20))
    expect(prompt).not.toContain('CHEN_PROTECTED_FULL_BODY_MUST_NOT_APPEAR_IN_MAIN_PROMPT')
    expect(prompt).not.toContain('AYU_PROTECTED_FULL_BODY_MUST_NOT_APPEAR_IN_MAIN_PROMPT')
  })

  it('loadCastBrief 召唤摘要不含 protected 字段内容泄露到 brief', () => {
    const brief = loadCastBrief('chen')
    expect(brief.name).toBe('陈姐')
    expect(brief.summary).toContain('同事')
    expect(brief.canBeProtagonist).toBe(false)
    expect(JSON.stringify(brief)).not.toContain(
      'CHEN_PROTECTED_FULL_BODY_MUST_NOT_APPEAR_IN_MAIN_PROMPT',
    )
    const block = formatRosterForPrompt(buildRosterLines('lin'))
    expect(block).not.toContain('CHEN_PROTECTED_FULL_BODY_MUST_NOT_APPEAR_IN_MAIN_PROMPT')
  })

  it('NPC 不在主角列表；三主角槽可列出且无需改 Orchestrator', async () => {
    const { listProtagonists } = await import('../../electron/main/companion/identity/loader')
    const ids = listProtagonists('default').map((p) => p.id)
    expect(ids).toEqual(['lin', 'zhou', 'xia'])
    expect(ids).not.toContain('chen')
    expect(ids).not.toContain('ayu')
  })
})

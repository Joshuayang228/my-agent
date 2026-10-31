import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { publishCharacterDraft, saveCharacterDraft } from '../../electron/main/companion/authoring/draft-store'

const root = path.join(process.cwd(), '.agent-data', 'universes')
let universeId = 'default'
let roleId = 'luffy'

vi.mock('electron', () => ({
  app: { getPath: () => { throw new Error('not ready') } },
  BrowserWindow: { getAllWindows: () => [] },
  safeStorage: { isEncryptionAvailable: () => false },
}))
vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (key: string) => key === 'universeId' ? universeId : roleId),
  setSetting: vi.fn(async (key: string, value: string) => { if (key === 'universeId') universeId = value; else if (key === 'activeRoleId') roleId = value }),
}))
vi.mock('../../electron/main/companion/life/engine', () => ({ pauseRole: vi.fn(), resumeRole: vi.fn() }))
vi.mock('../../electron/main/companion/streaming-gate', () => ({ isStreamingActive: () => false }))
vi.mock('../../electron/main/utils/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) }))

const { requestUniverseSwitch } = await import('../../electron/main/companion/orchestrator')

describe('用户世界观切换', () => {
  beforeEach(() => { universeId = 'default'; roleId = 'luffy' })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })

  it('切换到已发布用户世界并绑定其默认主角', async () => {
    const draft = await saveCharacterDraft({ action: 'create', universeId: 'switch-world', title: '切换测试世界', roleId: 'hero', roleName: '测试主角', section: 'identity', content: '测试身份。' })
    await saveCharacterDraft({ action: 'submit_for_review', draftId: draft.id })
    await publishCharacterDraft(draft.id)
    const result = await requestUniverseSwitch('switch-world')
    expect(result).toMatchObject({ ok: true, universeId: 'switch-world', roleId: 'switch-world-hero', name: '测试主角' })
    expect(universeId).toBe('switch-world')
    expect(roleId).toBe('switch-world-hero')
  })

  it('未知世界不改变当前组合', async () => {
    const result = await requestUniverseSwitch('missing-world')
    expect(result).toEqual({ ok: false, code: 'UNKNOWN_UNIVERSE' })
    expect(universeId).toBe('default')
    expect(roleId).toBe('luffy')
  })
})

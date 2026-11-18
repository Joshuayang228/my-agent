import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { publishCharacterDraft, saveCharacterDraft } from '../../electron/main/companion/authoring/draft-store'
import { getCompanionAssetCatalog } from '../../electron/main/companion/asset-registry'
import { loadRolePack, resolveRoleUniverseId } from '../../electron/main/companion/identity/loader'
import { _resetDatabaseForTests, getDatabase } from '../../electron/main/storage/database'
import { getSetting, setSetting } from '../../electron/main/storage/settings-store'

const fixture = vi.hoisted(() => ({ directory: '' }))
const switchWorld = `switch-world-${process.pid}-${Date.now()}`

vi.mock('electron', () => ({
  app: { getPath: () => fixture.directory },
  BrowserWindow: { getAllWindows: () => [] },
  safeStorage: { isEncryptionAvailable: () => false },
}))
vi.mock('../../electron/main/companion/streaming-gate', () => ({ isStreamingActive: () => false }))

const { requestUniverseSwitch } = await import('../../electron/main/companion/orchestrator')

describe('用户世界观切换', () => {
  beforeEach(async () => {
    fixture.directory = await mkdtemp(path.join(tmpdir(), 'universe-switch-test-'))
    await setSetting('universeId', 'default')
    await setSetting('activeRoleId', 'luffy')
  })
  afterEach(async () => {
    _resetDatabaseForTests()
    await rm(fixture.directory, { recursive: true, force: true })
  })

  it('切换到已发布用户世界并绑定其默认主角', async () => {
    const draft = await saveCharacterDraft({ action: 'create', universeId: switchWorld, title: '切换测试世界', roleId: 'hero', roleName: '测试主角', section: 'identity', content: '测试身份。' })
    await saveCharacterDraft({ action: 'submit_for_review', draftId: draft.id })
    await publishCharacterDraft(draft.id)
    const [result, duplicate] = await Promise.all([requestUniverseSwitch(switchWorld), requestUniverseSwitch(switchWorld)])
    expect(result).toMatchObject({ ok: true, universeId: switchWorld, roleId: `${switchWorld}-hero`, name: '测试主角' })
    expect(duplicate).toEqual({ ok: false, code: 'ALREADY_ACTIVE' })
    expect(await getSetting('universeId')).toBe(switchWorld)
    const roleId = await getSetting('activeRoleId')
    expect(roleId).toBe(`${switchWorld}-hero`)
    expect(resolveRoleUniverseId(roleId)).toBe(switchWorld)
    expect(loadRolePack(roleId).name).toBe('测试主角')
  })

  it('未知世界不改变当前组合', async () => {
    const result = await requestUniverseSwitch('missing-world')
    expect(result).toEqual({ ok: false, code: 'UNKNOWN_UNIVERSE' })
    expect(await getSetting('universeId')).toBe('default')
    expect(await getSetting('activeRoleId')).toBe('luffy')
  })

  it('切换用户世界与恢复默认世界时，伙伴资产目录按当前 universeId 隔离聚合', async () => {
    const draft = await saveCharacterDraft({ action: 'create', universeId: switchWorld, title: '切换测试世界', roleId: 'hero', roleName: '测试主角', section: 'identity', content: '测试身份。' })
    await saveCharacterDraft({ action: 'submit_for_review', draftId: draft.id })
    await publishCharacterDraft(draft.id)

    await requestUniverseSwitch(switchWorld)
    const switchedCatalog = getCompanionAssetCatalog(await getSetting('universeId'))
    expect(switchedCatalog.some(asset => asset.key.includes(`${switchWorld}-hero`))).toBe(true)
    expect(switchedCatalog.some(asset => asset.key.includes('luffy'))).toBe(false)

    await requestUniverseSwitch('default')
    const defaultCatalog = getCompanionAssetCatalog(await getSetting('universeId'))
    expect(defaultCatalog.some(asset => asset.key.includes('luffy'))).toBe(true)
    expect(defaultCatalog.some(asset => asset.key.includes(`${switchWorld}-hero`))).toBe(false)
  })

  it('目标主角写入失败时不提交任何半切换状态', async () => {
    const draft = await saveCharacterDraft({ action: 'create', universeId: switchWorld, title: '切换测试世界', roleId: 'hero', roleName: '测试主角', section: 'identity', content: '测试身份。' })
    await saveCharacterDraft({ action: 'submit_for_review', draftId: draft.id })
    await publishCharacterDraft(draft.id)
    const db = await getDatabase()
    db.run(`CREATE TRIGGER reject_target_role BEFORE UPDATE ON settings
      WHEN NEW.key = 'activeRoleId' AND NEW.value <> 'luffy'
      BEGIN SELECT RAISE(ABORT, 'fixture-target-role-write'); END`)
    await setSetting('activeRoleId', 'luffy')
    const filename = path.join(fixture.directory, 'my-agent.db')
    const saved = await readFile(filename)

    await expect(requestUniverseSwitch(switchWorld)).rejects.toThrow('fixture-target-role-write')
    expect(await getSetting('universeId')).toBe('default')
    expect(await getSetting('activeRoleId')).toBe('luffy')
    expect((await readFile(filename)).equals(saved)).toBe(true)
  })
})

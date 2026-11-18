import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { listCharacterDrafts, publishCharacterDraft, saveCharacterDraft } from '../../electron/main/companion/authoring/draft-store'
import { listAvailableUniverseIds, loadRolePack, loadUniverseManifest } from '../../electron/main/companion/identity/loader'
import { getCompanionAssetCatalog } from '../../electron/main/companion/asset-registry'
import { runWithExecutionSignal } from '../../electron/main/utils/execution-cancellation'

const fixture = vi.hoisted(() => ({ directory: '' }))
vi.mock('electron', () => ({ app: { getPath: () => fixture.directory } }))
const continuityWorld = `continuity-world-${process.pid}-${Date.now()}`

beforeEach(async () => {
  fixture.directory = await mkdtemp(path.join(tmpdir(), 'character-draft-test-'))
})
afterEach(async () => {
  await rm(fixture.directory, { recursive: true, force: true })
})

describe('人物体系草稿存储', () => {
  it('支持创建、补充分区和提交审阅，不直接发布生产人物', async () => {
    const created = await saveCharacterDraft({ action: 'create', universeId: 'test-world', title: '测试世界人物', roleId: 'test-role', roleName: '测试人物' })
    const updated = await saveCharacterDraft({ action: 'update', draftId: created.id, section: 'identity', content: '稳定身份与表达基线。' })
    const review = await saveCharacterDraft({ action: 'submit_for_review', draftId: created.id })
    expect(updated.sections.identity).toContain('稳定身份')
    expect(review.status).toBe('review')
    expect((await listCharacterDrafts()).map(item => item.id)).toContain(created.id)
  })

  it('拒绝缺少主键或未知分区', async () => {
    await expect(saveCharacterDraft({ action: 'create', universeId: '', title: 'x', roleId: 'x', roleName: 'x' })).rejects.toThrow()
    await expect(saveCharacterDraft({ action: 'create', universeId: 'world', title: 'x', roleId: 'role', roleName: 'x', section: 'unknown' as never, content: 'x' })).rejects.toThrow()
  })

  it('审阅草稿可以发布为用户世界观，内部人物标识带世界观前缀且可由同一 loader 读取', async () => {
    const created = await saveCharacterDraft({ action: 'create', universeId: 'draft-world', title: '草稿世界', roleId: 'hero', roleName: '测试主角', section: 'identity', content: '勇敢、直接、重视伙伴。' })
    await saveCharacterDraft({ action: 'submit_for_review', draftId: created.id })
    const published = await publishCharacterDraft(created.id)
    expect(published.roleId).toBe('draft-world-hero')
    expect(listAvailableUniverseIds()).toContain('draft-world')
    expect(loadUniverseManifest('draft-world').defaultProtagonistId).toBe(published.roleId)
    expect(loadRolePack(published.roleId, 'draft-world').name).toBe('测试主角')
    expect(loadRolePack(published.roleId, 'draft-world').firstContact).toBeUndefined()
    expect(getCompanionAssetCatalog('draft-world').some(asset => asset.key === `companion:draft-world:${published.roleId}:manifest`)).toBe(true)
  })

  it('发布人物草稿会保留首次冷启与连续性分区', async () => {
    const created = await saveCharacterDraft({ action: 'create', universeId: continuityWorld, title: '连续性测试', roleId: 'hero', roleName: '测试主角' })
    await saveCharacterDraft({ action: 'update', draftId: created.id, section: 'firstContact', content: '首次见面：我是测试主角！' })
    await saveCharacterDraft({ action: 'update', draftId: created.id, section: 'continuity', content: '既有经历 / 当前状态 / 用户共同经历分开记录。' })
    await saveCharacterDraft({ action: 'submit_for_review', draftId: created.id })
    const published = await publishCharacterDraft(created.id)
    const assets = getCompanionAssetCatalog(continuityWorld)
    expect(assets.some(asset => asset.sourcePath.endsWith('/scenes/first-contact.md'))).toBe(true)
    expect(assets.some(asset => asset.sourcePath.endsWith('/timeline/continuity.md'))).toBe(true)
    expect(loadRolePack(published.roleId, continuityWorld).protected).toContain('测试主角')
  })

  it('执行信号取消后拒绝保存或发布人物草稿，且不残留临时目录', async () => {
    const created = await saveCharacterDraft({ action: 'create', universeId: 'cancel-world', title: '取消测试', roleId: 'hero', roleName: '测试主角' })
    await saveCharacterDraft({ action: 'submit_for_review', draftId: created.id })
    const controller = new AbortController()
    controller.abort(new Error('fixture-draft-cancelled'))
    await expect(runWithExecutionSignal(controller.signal, () => saveCharacterDraft({
      action: 'update',
      draftId: created.id,
      section: 'identity',
      content: '已取消的内容不应保存。',
    }))).rejects.toThrow('fixture-draft-cancelled')
    await expect(runWithExecutionSignal(controller.signal, () => publishCharacterDraft(created.id))).rejects.toThrow('fixture-draft-cancelled')
    expect(listAvailableUniverseIds()).not.toContain('cancel-world')
    const draftFiles = await readdir(path.join(fixture.directory, 'character-drafts'))
    expect(draftFiles.some(name => name.includes('.tmp-'))).toBe(false)
  })
})

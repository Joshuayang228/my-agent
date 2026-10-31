import { afterEach, describe, expect, it } from 'vitest'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { listCharacterDrafts, publishCharacterDraft, saveCharacterDraft } from '../../electron/main/companion/authoring/draft-store'
import { listAvailableUniverseIds, loadRolePack, loadUniverseManifest } from '../../electron/main/companion/identity/loader'

const draftRoot = path.join(process.cwd(), '.agent-data', 'character-drafts')
const universeRoot = path.join(process.cwd(), '.agent-data', 'universes')

afterEach(async () => { await rm(draftRoot, { recursive: true, force: true }); await rm(universeRoot, { recursive: true, force: true }) })

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
  })
})

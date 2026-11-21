import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  readRoleVisualOverrideDataUrl,
  resetRoleVisualOverride,
  saveRoleVisualOverride,
} from '../../electron/main/companion/identity/visual-overrides'
import { buildAutomaticMomentImageDescription } from '../../electron/main/companion/life/automatic-moment-media'

// 1x1 valid transparent PNG
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

describe('Product Visual Consistency v1 — Role Visual Overrides & Outfit Anchor', () => {
  let rootDir: string

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-agent-visuals-'))
  })

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true })
  })

  it('保存、读取、跨角色隔离与重置角色头像/封面覆写', async () => {
    expect(readRoleVisualOverrideDataUrl('luffy', 'avatar', { rootDir })).toBeNull()

    const saved = await saveRoleVisualOverride('luffy', 'avatar', TINY_PNG, { rootDir })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.dataUrl.startsWith('data:image/png;base64,')).toBe(true)

    expect(readRoleVisualOverrideDataUrl('luffy', 'avatar', { rootDir })).toBe(saved.dataUrl)
    // 跨角色与跨槽位严格隔离
    expect(readRoleVisualOverrideDataUrl('nami', 'avatar', { rootDir })).toBeNull()
    expect(readRoleVisualOverrideDataUrl('luffy', 'banner', { rootDir })).toBeNull()

    const reset = resetRoleVisualOverride('luffy', 'avatar', { rootDir })
    expect(reset.ok).toBe(true)
    expect(readRoleVisualOverrideDataUrl('luffy', 'avatar', { rootDir })).toBeNull()
  })

  it('拒绝空文件、损坏非图片字节与路径穿越 roleId', async () => {
    const empty = await saveRoleVisualOverride('luffy', 'banner', Buffer.alloc(0), { rootDir })
    expect(empty.ok).toBe(false)

    const badBytes = await saveRoleVisualOverride('luffy', 'banner', Buffer.from('not-an-image'), { rootDir })
    expect(badBytes.ok).toBe(false)

    const traversal = await saveRoleVisualOverride('../evil', 'banner', TINY_PNG, { rootDir })
    expect(traversal.ok).toBe(false)
  })

  it('自主朋友圈配图描述同时注入角色外观锚点与当前穿着衣物', () => {
    const desc = buildAutomaticMomentImageDescription({
      momentText: '在甲板上吹海风看云。',
      appearance: '黑色短发，戴草帽',
      currentOutfit: '海风防风外套',
    })
    expect(desc).toContain('人物外观锚点：黑色短发，戴草帽')
    expect(desc).toContain('当前穿着：海风防风外套')
  })
})


describe('Role Reference Images（角色垫图加载）', () => {
  it('路飞 Role Pack 可加载有效的垫图参考字节用于生图一致性', async () => {
    const { loadRoleReferenceImages } = await import('../../electron/main/companion/identity/loader')
    const refs = loadRoleReferenceImages('luffy')
    expect(refs.length).toBeGreaterThanOrEqual(1)
    expect(refs[0].bytes.length).toBeGreaterThan(0)
    expect(['image/png', 'image/jpeg', 'image/webp']).toContain(refs[0].mimeType)
  })
})


describe('Companion Image Gen Prep（按场景动态垫图与画幅选择）', () => {
  it('食物与风景场景自动跳过人物垫图并选择正确画幅，人物与封面场景自动装配垫图', async () => {
    const { inferMomentImageCategory, prepareCompanionImageGen } = await import('../../electron/main/companion/life/image-gen-prep')
    expect(inferMomentImageCategory('刚出锅的带骨烤肉和海鲜炒饭太香了')).toBe('food')
    expect(inferMomentImageCategory('晚霞把海平线染成一片金色')).toBe('scenery')
    expect(inferMomentImageCategory('和索隆、乌索普在甲板开宴会干杯')).toBe('hangout')

    const foodPrep = await prepareCompanionImageGen({ roleId: 'luffy', description: '刚出锅的带骨烤肉', category: 'food' })
    expect(foodPrep.aspectRatio).toBe('1:1')
    expect(foodPrep.referenceImages).toHaveLength(0)

    const coverPrep = await prepareCompanionImageGen({ roleId: 'luffy', description: '千里阳光号迎着朝阳出航', category: 'cover', homeRoomId: 'shared-deck' })
    expect(coverPrep.aspectRatio).toBe('16:9')
    expect(coverPrep.referenceImages.length).toBeGreaterThanOrEqual(1)
    expect(coverPrep.visualAnchor).toContain('手绘日系冒险插画风格')
    expect(coverPrep.prompt).toContain('【构图方向】')
  })
})

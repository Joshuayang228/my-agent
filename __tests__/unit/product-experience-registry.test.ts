import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PLAYGROUND_TABS } from '../../src/components/playground/catalog'
import {
  PRODUCT_EXPERIENCE_ASSETS,
  PRODUCT_EXPERIENCE_REGISTRY,
  isActiveProductExperience,
  isFoundationStatusAllowed,
  productExperiencesUsingFoundation,
} from '../../src/shared/product-experience-registry'
import { UI_COMPONENT_REGISTRY } from '../../src/shared/ui-component-registry'

describe('product experience registry', () => {
  it('每个产品体验都声明稳定入口、真实来源和存在的基础依赖', () => {
    const keys = PRODUCT_EXPERIENCE_ASSETS.map((asset) => asset.key)
    const tabIds = PRODUCT_EXPERIENCE_ASSETS.map((asset) => asset.playgroundTabId)

    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(tabIds).size).toBe(tabIds.length)
    expect(PRODUCT_EXPERIENCE_REGISTRY['experience.world'].fixtureAssetPaths).toEqual([
      'src/assets/playground/moment-tea-by-window.jpg',
      'src/assets/playground/wardrobe-gray-blue-jacket.png',
      'src/assets/playground/wardrobe-lin-casual-outfit.png',
      'src/assets/playground/wardrobe-lin-commute-outfit.png', 'src/assets/playground/wardrobe-lin-sport-outfit.png',
      'src/assets/playground/wardrobe-top.png', 'src/assets/playground/wardrobe-bottom.png', 'src/assets/playground/wardrobe-shoes.png',
      'src/assets/playground/wardrobe-shirt.png', 'src/assets/playground/wardrobe-trousers.png', 'src/assets/playground/wardrobe-commute-shoes.png',
      'src/assets/playground/wardrobe-sport-top.png', 'src/assets/playground/wardrobe-sport-bottom.png',
      'src/assets/playground/culture-book.png', 'src/assets/playground/culture-film.png', 'src/assets/playground/culture-music.png', 'src/assets/playground/culture-photo.png',
      'src/assets/playground/home-overview.png', 'src/assets/playground/home-living.png', 'src/assets/playground/home-bedroom.png',
      'src/assets/playground/home-study.png', 'src/assets/playground/home-entry.png', 'src/assets/playground/home-sofa.png',
      'src/assets/playground/home-lamp.png', 'src/assets/playground/home-camera.png', 'src/assets/playground/home-umbrella.png',
      'src/assets/playground/wardrobe-icons/phosphor-t-shirt.svg',
      'src/assets/playground/wardrobe-icons/phosphor-pants.svg',
      'src/assets/playground/wardrobe-icons/phosphor-hoodie.svg',
      'src/assets/playground/wardrobe-icons/phosphor-sneaker.svg',
      'src/assets/playground/wardrobe-icons/phosphor-coat-hanger.svg',
      'src/assets/playground/wardrobe-icons/iconpark-clothes-short-sleeve.svg',
      'src/assets/playground/wardrobe-icons/iconpark-clothes-pants.svg',
      'src/assets/playground/wardrobe-icons/iconpark-clothes-windbreaker.svg',
      'src/assets/playground/wardrobe-icons/iconpark-clothes-suit.svg',
      'src/assets/playground/wardrobe-icons/iconpark-boots.svg',
      'src/assets/playground/travel-canal.png',
    ])

    for (const experience of PRODUCT_EXPERIENCE_ASSETS) {
      expect(experience.key).toMatch(/^experience\.[a-z0-9-]+$/)
      expect(PRODUCT_EXPERIENCE_REGISTRY[experience.key]).toBe(experience)
      expect(experience.sourcePaths.length).toBeGreaterThan(0)
      expect(experience.formalEntryPaths.length).toBeGreaterThan(0)
      expect(experience.realDataPaths.length).toBeGreaterThan(0)
      expect(experience.evidencePaths.length).toBeGreaterThan(0)
      expect(experience.experienceParts.length).toBeGreaterThan(0)
      expect(experience.usesFoundation.length).toBeGreaterThan(0)
      expect(new Set(experience.usesFoundation).size).toBe(experience.usesFoundation.length)
      for (const sourcePath of experience.sourcePaths) expect(existsSync(sourcePath)).toBe(true)
      for (const formalPath of experience.formalEntryPaths) {
        expect(formalPath).toMatch(/^src\//)
        expect(formalPath).not.toMatch(/playground|__tests__|fixtures/)
        expect(existsSync(formalPath), `${experience.key}: ${formalPath}`).toBe(true)
      }
      for (const dataPath of experience.realDataPaths) {
        expect(dataPath).toMatch(/^electron\/main\//)
        expect(existsSync(dataPath), `${experience.key}: ${dataPath}`).toBe(true)
      }
      for (const evidencePath of experience.evidencePaths) {
        expect(evidencePath).toMatch(/^__tests__\/(unit|e2e)\/.*\.test\.ts$/)
        expect(existsSync(evidencePath), `${experience.key}: ${evidencePath}`).toBe(true)
      }
      for (const fixturePath of experience.fixtureAssetPaths ?? []) expect(existsSync(fixturePath)).toBe(true)
      for (const foundationKey of experience.usesFoundation) {
        const foundation = UI_COMPONENT_REGISTRY[foundationKey]
        expect(foundation, `${experience.key} 引用了不存在的基础组件 ${foundationKey}`).toBeDefined()
        expect(foundation.layer, `${experience.key} 引用了非基础层资产 ${foundationKey}`).toBe('foundation')
        expect(
          isFoundationStatusAllowed(experience.status, foundation.status),
          `${experience.key}(${experience.status}) 不能依赖 ${foundationKey}(${foundation.status})`,
        ).toBe(true)
      }
    }
  })

  it('Playground 产品体验入口与注册表一一对应', () => {
    const activeExperienceTabs = PLAYGROUND_TABS
      .filter((tab) => tab.group === 'experience' && tab.status !== 'archived')
      .map((tab) => tab.id)
    const registeredActiveTabs = PRODUCT_EXPERIENCE_ASSETS
      .filter(isActiveProductExperience)
      .map((asset) => asset.playgroundTabId)
    expect([...activeExperienceTabs].sort()).toEqual([...registeredActiveTabs].sort())
  })

  it('反向使用关系从活跃体验的正式及候选基础依赖派生', () => {
    expect(isActiveProductExperience({ ...PRODUCT_EXPERIENCE_ASSETS[0], status: 'archived' })).toBe(false)
    expect(productExperiencesUsingFoundation('developer.markdown').map((asset) => asset.key)).toEqual(['experience.workspace'])
    expect(productExperiencesUsingFoundation('state.empty').map((asset) => asset.key)).toEqual([
      'experience.chat',
      'experience.world',
    ])
    expect(productExperiencesUsingFoundation('state.permission-confirm').map((asset) => asset.key)).toEqual(['experience.chat'])
    expect(productExperiencesUsingFoundation('behavior.badge').map((asset) => asset.key)).toEqual(['experience.world'])
  })

  it('生命周期规则阻止正式体验依赖候选或 Playground 基础', () => {
    const world = PRODUCT_EXPERIENCE_REGISTRY['experience.world']
    expect(world.usesFoundation).not.toContain('behavior.badge')
    expect(world.playgroundUsesFoundation).toContain('behavior.badge')
    for (const experience of PRODUCT_EXPERIENCE_ASSETS) {
      for (const key of (experience as typeof world).playgroundUsesFoundation ?? []) {
        expect(UI_COMPONENT_REGISTRY[key].layer).toBe('foundation')
        expect(isFoundationStatusAllowed('playground', UI_COMPONENT_REGISTRY[key].status)).toBe(true)
      }
    }
    expect(isFoundationStatusAllowed('adopted', 'adopted')).toBe(true)
    expect(isFoundationStatusAllowed('adopted', 'playground')).toBe(false)
    expect(isFoundationStatusAllowed('adopted', 'candidate')).toBe(false)
    expect(isFoundationStatusAllowed('playground', 'playground')).toBe(true)
    expect(isFoundationStatusAllowed('playground', 'adopted')).toBe(true)
    expect(isFoundationStatusAllowed('playground', 'candidate')).toBe(false)
  })
})

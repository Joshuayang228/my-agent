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

    for (const experience of PRODUCT_EXPERIENCE_ASSETS) {
      expect(experience.key).toMatch(/^experience\.[a-z0-9-]+$/)
      expect(PRODUCT_EXPERIENCE_REGISTRY[experience.key]).toBe(experience)
      expect(experience.sourcePaths.length).toBeGreaterThan(0)
      expect(experience.experienceParts.length).toBeGreaterThan(0)
      expect(experience.usesFoundation.length).toBeGreaterThan(0)
      expect(new Set(experience.usesFoundation).size).toBe(experience.usesFoundation.length)
      for (const sourcePath of experience.sourcePaths) expect(existsSync(sourcePath)).toBe(true)
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

  it('反向使用关系只从活跃体验的 usesFoundation 派生', () => {
    expect(isActiveProductExperience({ ...PRODUCT_EXPERIENCE_ASSETS[0], status: 'archived' })).toBe(false)
    expect(productExperiencesUsingFoundation('developer.markdown').map((asset) => asset.key)).toEqual(['experience.workspace'])
    expect(productExperiencesUsingFoundation('state.empty').map((asset) => asset.key)).toEqual([
      'experience.chat',
      'experience.world',
      'experience.memory',
      'experience.business-states',
    ])
  })

  it('生命周期规则阻止正式体验依赖候选或 Playground 基础', () => {
    expect(isFoundationStatusAllowed('adopted', 'adopted')).toBe(true)
    expect(isFoundationStatusAllowed('adopted', 'playground')).toBe(false)
    expect(isFoundationStatusAllowed('adopted', 'candidate')).toBe(false)
    expect(isFoundationStatusAllowed('playground', 'playground')).toBe(true)
    expect(isFoundationStatusAllowed('playground', 'adopted')).toBe(true)
    expect(isFoundationStatusAllowed('playground', 'candidate')).toBe(false)
  })
})

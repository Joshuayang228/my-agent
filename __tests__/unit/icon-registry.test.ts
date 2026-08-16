import { describe, expect, it } from 'vitest'
import { ICON_ASSETS, ICON_CATEGORIES, ICON_REGISTRY } from '../../src/shared/icon-registry'

describe('Lucide icon registry', () => {
  it('maintains stable semantic keys and complete category metadata', () => {
    const keys = ICON_ASSETS.map((asset) => asset.key)

    expect(ICON_ASSETS.length).toBeGreaterThanOrEqual(100)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(ICON_CATEGORIES.map((category) => category.id))).toEqual(new Set(ICON_ASSETS.map((asset) => asset.category)))

    for (const asset of ICON_ASSETS) {
      expect(asset.key).toMatch(/^[a-z-]+\.[a-z0-9-]+$/)
      expect(asset.label).toBeTruthy()
      expect(asset.english).toBeTruthy()
      expect(asset.usage).toBeTruthy()
      expect(['P0', 'P1']).toContain(asset.priority)
      expect(['function', 'object']).toContain(typeof asset.icon)
      expect(ICON_REGISTRY[asset.key]).toBe(asset)
    }
  })

  it('keeps the high-frequency navigation, runtime and companion keys available', () => {
    for (const key of [
      'navigation.search',
      'navigation.settings',
      'conversation.send',
      'conversation.generating',
      'developer.debug',
      'developer.playground',
      'developer.test',
      'companion.home',
      'companion.camera',
      'companion.wardrobe',
      'assets.lock',
      'status.warning',
    ]) {
      expect(ICON_REGISTRY[key]).toBeDefined()
    }
  })
})

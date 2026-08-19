import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { ADOPTED_ICON_SOURCES, ICON_ASSETS, ICON_CATEGORIES, ICON_REGISTRY } from '../../src/shared/icon-registry'

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
      expect(['catalog', 'adopted']).toContain(asset.adoptionStatus)
      expect(asset.adoptionStatus === 'adopted').toBe(asset.sourcePaths.length > 0)
      for (const sourcePath of asset.sourcePaths) expect(existsSync(sourcePath)).toBe(true)
      expect(['function', 'object']).toContain(typeof asset.icon)
      expect(ICON_REGISTRY[asset.key]).toBe(asset)
    }
  })

  it('keeps adopted evidence attached to individual icons rather than the whole directory', () => {
    expect(Object.keys(ADOPTED_ICON_SOURCES).sort()).toEqual(
      ICON_ASSETS.filter((asset) => asset.adoptionStatus === 'adopted').map((asset) => asset.key).sort(),
    )
    expect(ICON_REGISTRY['navigation.menu'].adoptionStatus).toBe('adopted')
    expect(ICON_REGISTRY['navigation.panel-left'].adoptionStatus).toBe('catalog')
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

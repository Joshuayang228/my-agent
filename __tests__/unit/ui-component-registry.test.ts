import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  UI_COMPONENT_ASSETS,
  UI_COMPONENT_CATEGORIES,
  UI_COMPONENT_REGISTRY,
  UI_COMPONENT_STATUSES,
} from '../../src/shared/ui-component-registry'

describe('UI component asset registry', () => {
  it('keeps stable keys, category coverage and lifecycle metadata', () => {
    const keys = UI_COMPONENT_ASSETS.map((asset) => asset.key)

    expect(UI_COMPONENT_ASSETS.length).toBeGreaterThanOrEqual(25)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(UI_COMPONENT_CATEGORIES.map((item) => item.id))).toEqual(new Set(UI_COMPONENT_ASSETS.map((asset) => asset.category)))
    const statusIds = new Set(UI_COMPONENT_STATUSES.map((item) => item.id))
    for (const asset of UI_COMPONENT_ASSETS) expect(statusIds.has(asset.status)).toBe(true)

    for (const asset of UI_COMPONENT_ASSETS) {
      expect(asset.key).toMatch(/^[a-z-]+\.[a-z0-9-]+$/)
      expect(asset.labelZh).toBeTruthy()
      expect(asset.labelEn).toBeTruthy()
      expect(asset.descriptionZh).toBeTruthy()
      expect(asset.stories.length).toBeGreaterThanOrEqual(0)
      expect(asset.accessibilityNotes.length).toBeGreaterThanOrEqual(1)
      expect(['verified', 'needs-review', 'not-applicable']).toContain(asset.accessibilityStatus)
      expect(UI_COMPONENT_REGISTRY[asset.key]).toBe(asset)
      if (asset.sourcePath) expect(existsSync(asset.sourcePath)).toBe(true)
      if (asset.status === 'adopted') expect(asset.sourcePath).toBeTruthy()
      if (asset.implementation === 'radix-candidate') expect(asset.reference).toMatch(/Radix/)
    }
  })

  it('keeps the first component inventory anchors discoverable', () => {
    for (const key of [
      'behavior.dialog',
      'behavior.tabs',
      'behavior.combobox',
      'state.toast',
      'state.permission-confirm',
      'developer.asset-table',
      'companion.status-bar',
      'layout.primary-sidebar',
      'layout.right-dock',
    ]) {
      expect(UI_COMPONENT_REGISTRY[key]).toBeDefined()
    }
  })
})

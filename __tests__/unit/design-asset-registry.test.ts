import { describe, expect, it } from 'vitest'
import {
  DESIGN_THEME_ASSETS,
  DESIGN_THEME_REGISTRY,
  FONT_SCALE_ASSETS,
  isLightTheme,
} from '../../src/shared/design-asset-registry'

describe('设计资产注册表', () => {
  it('主题与字体比例拥有稳定唯一身份', () => {
    expect(DESIGN_THEME_ASSETS).toHaveLength(7)
    expect(new Set(DESIGN_THEME_ASSETS.map((asset) => asset.id)).size).toBe(DESIGN_THEME_ASSETS.length)
    expect(FONT_SCALE_ASSETS.map((asset) => asset.id)).toEqual(['sm', 'md', 'lg'])
    for (const asset of DESIGN_THEME_ASSETS) {
      expect(DESIGN_THEME_REGISTRY[asset.id]).toBe(asset)
      expect(asset.labelZh).toBeTruthy()
      expect(asset.descriptionZh).toBeTruthy()
      expect(asset.representativeColor).toMatch(/^#[0-9a-f]{6}$/i)
      expect(asset.tokenGroups.length).toBeGreaterThan(0)
    }
  })

  it('明暗派生只从注册表判断', () => {
    expect(isLightTheme('light')).toBe(true)
    expect(isLightTheme('mist')).toBe(true)
    expect(isLightTheme('golden')).toBe(true)
    expect(isLightTheme('dark')).toBe(false)
    expect(isLightTheme('night-feast')).toBe(false)
    expect(isLightTheme('unknown-theme')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ASSET_GOVERNANCE } from '../../scripts/asset-governance.mjs'
import { THEME_STUDIES, getThemeStudyStyle } from '../../src/components/playground/foundation-themes'
import {
  DESIGN_THEME_ASSETS,
  DESIGN_THEME_REGISTRY,
  FONT_SCALE_ASSETS,
  isLightTheme,
} from '../../src/shared/design-asset-registry'

describe('设计资产注册表', () => {
  it('候选色板保留独立的静态资产门禁，不冒充生产主题或 UI 控件', () => {
    const candidate = ASSET_GOVERNANCE.find((family) => family.id === 'design-study')
    expect(candidate?.kind).toBe('static-renderer')
    expect(candidate?.sourcePaths).toEqual(['src/components/playground/foundation-themes.ts'])
    expect(candidate?.registryPaths).toEqual(candidate?.sourcePaths)
    expect(candidate?.modelContextTypes).toEqual([])
    const production = ASSET_GOVERNANCE.find((family) => family.id === 'design')
    expect(production?.registryPaths).toEqual(['src/shared/design-asset-registry.ts'])
  })

  it('基础与设置共享四个隔离候选，不替换七个生产主题', () => {
    expect(THEME_STUDIES.map((theme) => theme.label)).toEqual(['瓷青', '曜石', '松烟', '绛紫'])
    expect(new Set(THEME_STUDIES.map((theme) => theme.id)).size).toBe(4)
    for (const theme of THEME_STUDIES) {
      const style = getThemeStudyStyle(theme)
      expect(style['--bg-primary']).toBe(theme.colors.app)
      expect(style['--card-bg']).toBe(theme.colors.card)
      expect(style['--accent']).toBe(theme.colors.accent)
      expect(style.colorScheme).toBe(theme.mode === '深色' ? 'dark' : 'light')
      expect(DESIGN_THEME_ASSETS.some((asset) => String(asset.id) === theme.id)).toBe(false)
    }
    for (const file of ['DesignSystemPanel', 'SettingsExperienceCandidate']) {
      const source = readFileSync(new URL(`../../src/components/playground/${file}.tsx`, import.meta.url), 'utf8')
      expect(source).toContain("from './foundation-themes'")
      expect(source).not.toContain('const THEME_STUDIES =')
    }
  })

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

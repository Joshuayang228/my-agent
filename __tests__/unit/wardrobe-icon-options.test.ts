import { readFileSync } from 'node:fs'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { wardrobePreviewIcons } from '../../src/components/playground/WardrobeIconOptions'
import { PRODUCT_EXPERIENCE_REGISTRY } from '../../src/shared/product-experience-registry'

describe('衣柜静态图标对照', () => {
  it('选定组合仅覆盖套装、下装与外套，上装和鞋子保留原图标', () => {
    const icons = wardrobePreviewIcons('mixed')!
    expect(Object.keys(icons)).toEqual(['outfits', 'bottom', 'outerwear'])
    const phosphor = wardrobePreviewIcons('phosphor')!
    for (const id of Object.keys(icons)) {
      const selected = renderToStaticMarkup(createElement(Fragment, null, icons[id]))
      const reference = renderToStaticMarkup(createElement(Fragment, null, phosphor[id]))
      expect(selected.replace('data-wardrobe-icon="mixed"', 'data-wardrobe-icon="phosphor"')).toBe(reference)
    }
  })
  it('默认不覆盖原图标，两组均只注入五个服装类别', () => {
    expect(wardrobePreviewIcons('original')).toBeUndefined()
    for (const style of ['phosphor', 'iconpark'] as const) {
      const icons = wardrobePreviewIcons(style)!
      expect(Object.keys(icons)).toEqual(['outfits', 'top', 'bottom', 'outerwear', 'shoes'])
      const html = renderToStaticMarkup(createElement(Fragment, null, ...Object.values(icons)))
      expect(html.match(/data-wardrobe-icon=/g)).toHaveLength(5)
      expect(html).toContain('background-color:currentColor')
      expect(html).toContain('h-[14px] w-[14px]')
      expect(html).not.toContain('https:')
    }
  })
  it('十个本地素材有实际图形且没有主动内容或外链', () => {
    const paths = PRODUCT_EXPERIENCE_REGISTRY['experience.world'].fixtureAssetPaths.filter(path => path.includes('/wardrobe-icons/'))
    expect(paths).toHaveLength(10)
    for (const path of paths) {
      const svg = readFileSync(path, 'utf8')
      expect(svg).toContain('<svg')
      expect(svg).toContain('viewBox=')
      expect(svg).toContain('<path')
      expect(svg).not.toMatch(/<script|<foreignObject|\bhref\s*=|\bon\w+\s*=|url\(/i)
      expect(svg).not.toContain('#2F88FF')
    }
  })
  it('保留两组许可证与来源、修改声明', () => {
    const base = 'src/assets/playground/wardrobe-icons/'
    expect(readFileSync(base + 'PHOSPHOR-LICENSE.txt', 'utf8')).toContain('Copyright (c) 2023 Phosphor Icons')
    expect(readFileSync(base + 'ICONPARK-LICENSE.txt', 'utf8')).toContain('Copyright 2019-present Bytedance Inc.')
    const provenance = readFileSync(base + 'README.md', 'utf8')
    expect(provenance).toContain('填充改为 none')
    expect(provenance).toContain('已归档')
  })
})

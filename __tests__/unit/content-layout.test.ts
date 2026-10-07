import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { ActionButton } from '../../src/components/foundation/ActionButton'
import { LayoutLanguageSamples } from '../../src/components/playground/LayoutLanguageSamples'
import { CONTENT_LAYOUT, LAYOUT_CLASSES, LAYOUT_DENSITIES, LAYOUT_EXCEPTIONS, LAYOUT_PROFILES, SPACING, layoutDensityStyle, layoutProfileStyle, contentGutterStyle, readingContentStyle } from '../../src/shared/content-layout'

function hasSharedDetail(source: string, id: string) {
  const file = ts.createSourceFile('candidate.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let valid = false
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node)) {
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute)
      const attr = (name: string) => attributes.find(item => item.name.getText(file) === name)?.initializer
      const target = attr('data-testid')
      if (target && ts.isStringLiteral(target) && target.text === id) {
        const style = attr('style')
        const classes = attr('className')
        valid = !!style && ts.isJsxExpression(style) && !!style.expression && ts.isCallExpression(style.expression)
          && style.expression.expression.getText(file) === 'readingContentStyle'
          && !(classes && ts.isStringLiteral(classes) && /mx-auto|\bp[lrxy]?-\d|\bmax-w-/.test(classes.text))
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return valid
}

describe('共享内容布局候选', () => {
  it('基础五组实际样张同时存在，例外定义仍保留而不占展示区', () => {
    const markup = renderToStaticMarkup(createElement(LayoutLanguageSamples))
    for (const id of ['text', 'images', 'combinations', 'modules', 'alignment']) expect(markup).toContain(`data-testid="layout-section-${id}"`)
    expect(markup).not.toContain('独立布局契约')
    expect(markup).not.toContain('布局稳定性')
    expect(markup).not.toContain('overflow-y-auto')
    expect(markup).toContain('data-testid="layout-module-action"')
    expect(markup).toContain('group-hover:opacity-100')
    expect(LAYOUT_EXCEPTIONS.map(item => item.key)).toEqual(['navigation', 'media', 'canvas'])
  })
  it('基础密度不引用产品场景，并与同一间距阶梯一致', () => {
    expect(Object.values(LAYOUT_DENSITIES).map(value => value.label)).toEqual(['紧凑', '标准', '宽松'])
    for (const [id, density] of Object.entries(LAYOUT_DENSITIES)) {
      expect(Object.values(SPACING)).toContain(density.gutter)
      expect(Object.values(SPACING)).toContain(density.section)
      expect(Object.values(SPACING)).toContain(density.card)
      expect(layoutDensityStyle(id as keyof typeof LAYOUT_DENSITIES)).toMatchObject({ '--layout-gutter-small': `${density.gutter}px`, '--layout-card-large': `${density.card}px` })
    }
    const source = readFileSync(new URL('../../src/components/playground/LayoutLanguageSamples.tsx', import.meta.url), 'utf8')
    const ast = ts.createSourceFile('samples.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    for (const statement of ast.statements.filter(ts.isImportDeclaration)) {
      const bindings = statement.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        expect(bindings.elements.map(element => element.name.text)).not.toContain('LAYOUT_PROFILES')
        expect(bindings.elements.map(element => element.name.text)).not.toContain('layoutProfileStyle')
      }
    }
  })
  it('场景密度读取统一阶梯，变量仅由调用方显式注入', () => {
    for (const [id, profile] of Object.entries(LAYOUT_PROFILES)) {
      for (const key of ['gutterSmall', 'gutterLarge', 'block', 'section', 'cardSmall', 'cardLarge', 'list'] as const) {
        expect(Object.values(SPACING)).toContain(profile[key])
      }
      const variables = layoutProfileStyle(id as keyof typeof LAYOUT_PROFILES) as Record<string, string>
      expect(variables['--layout-section']).toBe(`${profile.section}px`)
      expect(variables['--layout-gutter-small']).toBe(`${profile.gutterSmall}px`)
    }
    expect(LAYOUT_CLASSES.card).toContain('var(--layout-card-small,1rem)')
    expect(LAYOUT_CLASSES.card).toContain('var(--layout-card-large,1.25rem)')
    expect(readingContentStyle('workspace').maxWidth).toBe('none')
    expect(readingContentStyle('chat').maxWidth).toBe(800)
  })
  it('数值只有一个来源，限宽不隐式居中', () => {
    expect(contentGutterStyle().padding).toBe(CONTENT_LAYOUT.gutter)
    expect(readingContentStyle()).toMatchObject({ maxWidth: CONTENT_LAYOUT.readingWidth, width: '100%', marginInline: 0 })
  })
  it.each([
    ['playground/FootprintsExperienceCandidate', 'travel-detail'],
    ['world/WorldCultureGallery', 'culture-detail'],
    ['world/WorldHomeGallery', 'home-object-detail'],
  ])('检查 %s 的真实 JSX 详情调用并拒绝局部覆盖', (path, id) => {
    const source = readFileSync(new URL(`../../src/components/${path}.tsx`, import.meta.url), 'utf8')
    expect(hasSharedDetail(source, id)).toBe(true)
    expect(hasSharedDetail(source.replace('style={readingContentStyle()}', 'style={{ marginInline: "auto" }}'), id)).toBe(false)
    expect(hasSharedDetail(`<article data-testid="${id}" style={readingContentStyle()} className="mx-auto p-4"></article>`, id)).toBe(false)
    expect(hasSharedDetail('import { readingContentStyle } from "shared"', id)).toBe(false)
  })
  it('媒体零内边距是显式接口，默认按钮保持原尺寸', () => {
    const defaultButton = renderToStaticMarkup(createElement(ActionButton, { children: '返回' }))
    const mediaButton = renderToStaticMarkup(createElement(ActionButton, { children: '图片', padding: 'none' }))
    expect(defaultButton).toContain('px-2.5')
    expect(mediaButton).toContain('p-0')
    expect(mediaButton).not.toContain('px-2.5')
  })
})

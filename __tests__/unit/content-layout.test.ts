import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { ActionButton } from '../../src/components/foundation/ActionButton'
import { CONTENT_LAYOUT, contentGutterStyle, readingContentStyle } from '../../src/shared/content-layout'

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

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TextField } from '../../src/components/foundation/TextField'

describe('TextField 显式边界候选', () => {
  it('未传外观时保留原调用方边框和圆角，不自动套独立框', () => {
    const html = renderToStaticMarkup(createElement(TextField, { className: 'border-0 rounded-none', defaultValue: '旧调用' }))
    expect(html).not.toContain('foundation-text-field-outlined')
    expect(html).not.toContain('foundation-text-field-embedded')
    expect(html).toContain('border-0 rounded-none')
  })
  it.each(['outlined', 'embedded'] as const)('%s 使用同一基础组件，外观不泄漏为 DOM 属性', appearance => {
    const html = renderToStaticMarkup(createElement(TextField, { appearance, 'aria-label': '名称', 'aria-invalid': true, disabled: true, defaultValue: '小林' }))
    expect(html).toContain(`foundation-text-field-${appearance}`)
    expect(html).not.toContain('appearance=')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('value="小林"')
  })
  it('多行输入保留原生属性并使用相同外观', () => {
    const html = renderToStaticMarkup(createElement(TextField, { multiline: true, appearance: 'outlined', rows: 3, maxLength: 100, defaultValue: '内容' }))
    expect(html).toContain('<textarea')
    expect(html).toContain('foundation-text-field-outlined')
    expect(html).toContain('rows="3"')
    expect(html).toContain('maxLength="100"')
  })
})

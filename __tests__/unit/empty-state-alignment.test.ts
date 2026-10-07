import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '../../src/components/foundation/EmptyState'

describe('空态文字可选居中', () => {
  const props = { title: '空态', description: '描述' }
  it('默认保留原操作区，显式无按钮居中拆分等高预留', () => {
    expect(renderToStaticMarkup(createElement(EmptyState, props))).toContain('mt-4 flex min-h-7')
    const centered = renderToStaticMarkup(createElement(EmptyState, { ...props, centerWithoutAction: true }))
    expect(centered.match(/h-\[22px\]/g)).toHaveLength(2)
    expect(centered).not.toContain('mt-4 flex min-h-7')
  })
  it('有操作时仍保留操作槽，不拆分真实操作区', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { ...props, centerWithoutAction: true, action: createElement('button', null, '重试') }))
    expect(html).toContain('mt-4 flex min-h-7')
    expect(html).not.toContain('h-[22px]')
    expect(html).toContain('重试')
  })
})

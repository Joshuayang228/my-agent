import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '../../src/components/foundation/EmptyState'

describe('空态文字默认居中与操作槽保留', () => {
  const props = { title: '空态', description: '描述' }
  it('无操作时默认自动上下均衡居中，显式 centerWithoutAction=false 时保留底部占位槽', () => {
    const defaultCentered = renderToStaticMarkup(createElement(EmptyState, props))
    expect(defaultCentered.match(/h-\[22px\]/g)).toHaveLength(2)
    expect(defaultCentered).not.toContain('mt-4 flex min-h-7')
    expect(renderToStaticMarkup(createElement(EmptyState, { ...props, centerWithoutAction: false }))).toContain('mt-4 flex min-h-7')
  })
  it('有操作时仍保留操作槽，不拆分真实操作区', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { ...props, centerWithoutAction: true, action: createElement('button', null, '重试') }))
    expect(html).toContain('mt-4 flex min-h-7')
    expect(html).not.toContain('h-[22px]')
    expect(html).toContain('重试')
  })
})

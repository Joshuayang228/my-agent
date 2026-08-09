import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AdoptionMark } from '../../src/components/playground/AdoptionMark'

describe('Playground AdoptionMark', () => {
  it('只呈现已采用这一项可访问语义', () => {
    const html = renderToStaticMarkup(createElement(AdoptionMark))

    expect(html).toContain('aria-label="已采用"')
    expect(html).toContain('title="已采用"')
    expect(html).not.toContain('实验中')
    expect(html).not.toContain('备用')
  })
})

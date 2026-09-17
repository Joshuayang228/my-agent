import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  SYNTAX_HIGHLIGHT_THEMES,
  stripPrismSurfaceBackgrounds,
  type PrismStyleMap,
} from '../../src/components/foundation/syntax-highlight-theme'

const renderer = readFileSync('src/components/MarkdownRenderer.tsx', 'utf8')

describe('Prism 表面色清洗', () => {
  it('清掉 oneLight 容器底，保留 inserted / deleted / selection', () => {
    const raw = oneLight as PrismStyleMap
    const cleaned = SYNTAX_HIGHLIGHT_THEMES.light
    expect(raw['code[class*="language-"]'].background).toBe('hsl(230, 1%, 98%)')
    expect(raw['pre[class*="language-"]'].background).toBe('hsl(230, 1%, 98%)')
    expect(cleaned['code[class*="language-"]'].background).toBeUndefined()
    expect(cleaned['code[class*="language-"]'].backgroundColor).toBeUndefined()
    expect(cleaned['pre[class*="language-"]'].background).toBeUndefined()
    expect(cleaned['pre[class*="language-"]'].color).toBe(raw['pre[class*="language-"]'].color)
    expect(cleaned['code[class*="language-"]::selection'].background).toBe(raw['code[class*="language-"]::selection'].background)
    expect(cleaned['pre.diff-highlight > code .token.token.deleted:not(.prefix)'].backgroundColor)
      .toBe(raw['pre.diff-highlight > code .token.token.deleted:not(.prefix)'].backgroundColor)
    expect(cleaned['pre.diff-highlight > code .token.token.inserted:not(.prefix)'].backgroundColor)
      .toBe(raw['pre.diff-highlight > code .token.token.inserted:not(.prefix)'].backgroundColor)
    expect(cleaned['.line-highlight.line-highlight'].background).toBe(raw['.line-highlight.line-highlight'].background)
  })

  it('CodeBlock 只消费清洗后的主题，不把未清洗 oneLight / oneDark 交给高亮器', () => {
    expect(renderer).toContain("from './foundation/syntax-highlight-theme'")
    expect(renderer).toContain('SYNTAX_HIGHLIGHT_THEMES.light')
    expect(renderer).toContain('SYNTAX_HIGHLIGHT_THEMES.dark')
    expect(renderer).not.toContain("from 'react-syntax-highlighter/dist/esm/styles/prism'")
    expect(renderer).not.toMatch(/style=\{theme\?\.mode === 'light' \? oneLight : oneDark\}/)
  })

  it('负例：未清洗主题仍带容器白底', () => {
    const leftover = stripPrismSurfaceBackgrounds({
      'code[class*="language-"]': { background: '#fff', color: '#111' },
      inserted: { backgroundColor: 'rgba(0, 255, 0, 0.15)', color: '#0a0' },
    })
    expect(leftover['code[class*="language-"]'].background).toBeUndefined()
    expect(leftover.inserted.backgroundColor).toBe('rgba(0, 255, 0, 0.15)')
  })
})

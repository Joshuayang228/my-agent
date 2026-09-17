import { expect, type Locator } from '@playwright/test'

const WHITE_SURFACES = new Set(['rgb(255, 255, 255)', 'rgb(250, 250, 250)'])

export async function expectSharedCodeSurface(scope: Locator) {
  const nested = scope.locator('[data-foundation="code-block"]')
  const block = (await nested.count()) > 0 ? nested.first() : scope
  const { inset, preBackground, codeBackground, tokenBackgrounds } = await block.evaluate((node) => {
    const pre = node.querySelector('pre')
    const code = node.querySelector('pre code')
    const probe = document.createElement('span')
    probe.style.backgroundColor = 'var(--bg-inset)'
    node.appendChild(probe)
    const inset = getComputedStyle(probe).backgroundColor
    probe.remove()
    return {
      inset,
      preBackground: pre ? getComputedStyle(pre).backgroundColor : '',
      codeBackground: code ? getComputedStyle(code).backgroundColor : '',
      tokenBackgrounds: Array.from(node.querySelectorAll('pre .token')).map((token) => getComputedStyle(token).backgroundColor),
    }
  })
  expect(preBackground).toBe(inset)
  expect(codeBackground).toBe('rgba(0, 0, 0, 0)')
  expect(WHITE_SURFACES.has(preBackground)).toBe(false)
  expect(WHITE_SURFACES.has(codeBackground)).toBe(false)
  expect(tokenBackgrounds.some((value) => WHITE_SURFACES.has(value))).toBe(false)
}

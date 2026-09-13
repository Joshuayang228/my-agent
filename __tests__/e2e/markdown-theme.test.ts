import { test, expect } from '@playwright/test'
import { THEME_STUDIES } from '../../src/components/playground/foundation-themes'

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).join(', ')})`

test('代码高亮跟随局部深浅主题而非 html', async ({ page }) => {
  await page.goto('/__tests__/fixtures/markdown-theme.html')
  const keyword = (index: number) => page.getByTestId(`render-theme-${index}`).locator('pre .token').first()
  const light = await keyword(0).evaluate((node) => getComputedStyle(node).color)
  const dark = await keyword(1).evaluate((node) => getComputedStyle(node).color)
  expect(light).not.toBe(dark)
  await page.getByRole('combobox', { name: 'First theme' }).selectOption('3')
  await expect(keyword(0)).toHaveCSS('color', dark)
  await page.locator('html').evaluate((node) => node.setAttribute('data-theme', 'dark'))
  await expect(keyword(2)).toHaveCSS('color', light)
})

test('Foundation Markdown 故事真实展示四主题共享图表', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
  await page.getByTestId('playground-nav').getByRole('button', { name: '基础组件', exact: true }).click()
  await page.getByRole('tab', { name: 'Markdown 与资产', exact: true }).click()
  const gallery = page.getByTestId('foundation-markdown-themes')
  for (const study of THEME_STUDIES) {
    const scope = gallery.getByTestId(`foundation-markdown-${study.id}`)
    await expect(scope.locator('svg.flowchart')).toHaveCount(1)
    await expect(scope.locator('svg .node rect').first()).toHaveCSS('fill', rgb(study.colors.panel))
    await expect(scope.locator('pre').first()).toHaveCSS('background-color', rgb(study.colors.panel))
  }
  await gallery.screenshot({ path: testInfo.outputPath('foundation-markdown.png') })
})

for (const width of [1166, 600]) {
  test(`共享代码与 Mermaid 就近四主题 ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/__tests__/fixtures/markdown-theme.html')
    const colors: string[] = []
    for (const [index, study] of THEME_STUDIES.entries()) {
      const scope = page.getByTestId(`render-theme-${index}`)
      await expect(scope.locator('svg.flowchart')).toHaveCount(1)
      colors.push(await scope.locator('pre .token').first().evaluate((node) => getComputedStyle(node).color))
      await expect(scope.locator('svg .node rect').first()).toHaveCSS('fill', rgb(study.colors.panel))
      await expect(scope.locator('pre').first()).toHaveCSS('background-color', rgb(study.colors.panel))
      await expect(scope.locator('pre code').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      expect(await scope.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    expect(colors[0]).not.toBe(colors[1])
    expect(colors[0]).toBe(colors[2])
    expect(colors[1]).toBe(colors[3])
    const file = page.getByTestId('file-theme')
    await expect(file.locator('svg .node rect').first()).toHaveCSS('fill', rgb(THEME_STUDIES[1].colors.panel))
    expect(await file.locator('pre .token').first().evaluate((node) => getComputedStyle(node).color)).toBe(colors[1])
    await page.screenshot({ path: testInfo.outputPath('four-local-themes.png'), fullPage: true })
    await page.locator('html').evaluate((node) => node.setAttribute('data-theme', 'dark'))
    expect(await page.getByTestId('render-theme-0').locator('pre .token').first().evaluate((node) => getComputedStyle(node).color)).toBe(colors[0])
    await page.getByRole('combobox', { name: 'First theme' }).selectOption('3')
    await expect(page.getByTestId('render-theme-0').locator('svg .node rect').first()).toHaveCSS('fill', rgb(THEME_STUDIES[3].colors.panel))
    await expect(page.getByTestId('render-theme-1').locator('svg .node rect').first()).toHaveCSS('fill', rgb(THEME_STUDIES[1].colors.panel))
  })
}

test('Mermaid 语法修正可以恢复，快速更新不落入旧结果或污染其它实例', async ({ page }) => {
  await page.goto('/__tests__/fixtures/markdown-theme.html')
  const source = page.getByRole('textbox', { name: 'Graph source' })
  const graph = page.getByTestId('render-theme-0').getByTestId('graph')
  await expect(graph.locator('svg.flowchart')).toHaveCount(1)
  await source.fill('this is not a diagram')
  await expect(graph.locator('pre')).toBeVisible()
  await source.fill('flowchart LR\n X[Recovered] --> Y[Complete]')
  await expect(graph.locator('svg.flowchart')).toHaveCount(1)
  await expect(graph.locator('svg.flowchart')).toContainText('Recovered')
  await source.fill('flowchart LR\n A[Old] --> B[Result]')
  await source.fill('flowchart LR\n A[Latest] --> B[Result]')
  for (const index of [0, 1, 2, 3]) {
    const svg = page.getByTestId(`render-theme-${index}`).locator('svg.flowchart')
    await expect(svg).toContainText('Latest')
    await expect(svg).not.toContainText('Old')
  }
  await expect(page.getByTestId('file-theme').locator('svg.flowchart')).toContainText('Inspect')
  await source.fill('%%{init: {"theme":"dark","themeVariables":{"primaryColor":"#ffffff"},"securityLevel":"loose"}}%%\nflowchart LR\n A[Pinned] --> B[Theme]')
  for (const [index, study] of THEME_STUDIES.entries()) {
    const svg = page.getByTestId(`render-theme-${index}`).locator('svg.flowchart')
    await expect(svg).toContainText('Pinned')
    await expect(svg.locator('.node rect').first()).toHaveCSS('fill', rgb(study.colors.panel))
  }
  await expect(page.locator('[data-mermaid-measure]')).toHaveCount(0)
})

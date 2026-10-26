import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`主动消息 v3 不支持与失败 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 704 })
    await page.addInitScript(theme => { localStorage.setItem('theme', theme); localStorage.setItem('playground.active-tab', 'debug') }, theme)
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
    const panel = page.getByTestId('debug-candidate')
    const nav = panel.getByRole('navigation')
    await nav.getByRole('button', { name: '主动消息证据', exact: true }).click()
    if (await panel.getByTestId('debug-capability-candidate').isVisible()) await panel.getByRole('button', { name: '能力补齐样张', exact: true }).click()
    const proactive = panel.getByTestId('debug-evidence-proactive')
    const states = panel.getByRole('group', { name: 'Debug 样张状态' })
    const edge = async (value: string) => {
      await states.getByText('更多样张', { exact: true }).click()
      await states.getByRole('combobox', { name: '投递查询边缘样张' }).selectOption(value)
      await states.getByText('更多样张', { exact: true }).click()
    }
    await expect(proactive.getByRole('status')).toContainText('尚无独立投递记录源')
    await expect(proactive.locator('[data-record-id], input, select')).toHaveCount(0)
    await expect(proactive).not.toContainText('0 条')
    await expect(proactive).not.toContainText('下午问候')
    await expect(proactive.locator('.debug-proactive-boundary > p')).toHaveCSS('font-size', '14px')
    await expect(proactive.getByRole('button', { name: '查看朋友圈', exact: true })).toHaveCSS('font-size', '13px')
    await page.screenshot({ path: info.outputPath('proactive-v3-default.png') })
    await proactive.getByText('来源与边界', { exact: true }).click()
    await expect(proactive.locator('pre')).toContainText('"state": "unsupported"')
    await expect(proactive).toContainText('朋友圈是相关生活上下文，不是问候回执')
    await states.getByRole('button', { name: '刷新失败', exact: true }).click()
    await expect(proactive.getByRole('alert')).toContainText('保留上次查询边界')
    await expect(proactive.locator('pre')).toBeVisible()
    await proactive.getByRole('button', { name: '重试读取样张', exact: true }).click()
    await expect(proactive.locator('pre')).toBeVisible()
    for (const scenario of ['无记录', '历史截断']) {
      await states.getByRole('button', { name: scenario, exact: true }).click()
      await expect(proactive.getByRole('status')).toContainText('尚无独立投递记录源')
      await expect(proactive).not.toContainText('没有记录')
      await expect(proactive).not.toContainText('历史已截断')
    }
    for (const value of ['unavailable', 'error']) {
      await edge(value)
      await expect(proactive.getByRole('alert')).toBeVisible()
      await expect(proactive.locator('.debug-proactive-boundary')).toHaveCount(0)
      await expect(proactive.locator('pre')).toHaveCount(0)
    }
    await states.getByRole('button', { name: '未读取', exact: true }).click()
    await expect(proactive.getByRole('status').locator('p')).toHaveText('投递查询尚未读取')
    await states.getByRole('button', { name: '刷新失败', exact: true }).click()
    await expect(proactive.getByRole('alert')).toContainText('投递查询状态读取失败')
    await expect(proactive.locator('.debug-proactive-boundary')).toHaveCount(0)
    await states.getByRole('button', { name: '运行中', exact: true }).click()
    await expect(proactive.getByRole('status')).toHaveText('正在读取投递查询状态…')
    await expect(proactive.getByRole('button')).toHaveCount(0)
    await states.getByRole('button', { name: '默认记录', exact: true }).click()
    for (const scale of ['sm', 'lg']) {
      await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
      expect(await proactive.locator('.debug-proactive-boundary > p').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-font-scale', 'md'))
    await proactive.getByRole('button', { name: '查看朋友圈', exact: true }).click()
    await expect(panel.getByTestId('debug-evidence-moments')).toBeVisible()
    await expect(panel.getByTestId('debug-evidence-moments').getByRole('article', { name: '领域证据详情' })).toHaveCount(0)
  })
}

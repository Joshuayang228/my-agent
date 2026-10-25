import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式投递查询边界与失败 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __proactiveMode: string; __resolveProactive?: () => void; __proactiveCalls: number }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__proactiveMode = 'fail'; state.__proactiveCalls = 0
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string }) => {
          state.__proactiveCalls++
          const mode = state.__proactiveMode
          if (mode === 'fail') throw new Error('proactive query failure')
          if (mode === 'pending') await new Promise<void>(resolve => { state.__resolveProactive = resolve })
          return { ...query, records: mode === 'unexpected' ? [{ id: 'unexpected-record' }] : [], state: mode === 'unavailable' ? 'unavailable' : mode === 'unexpected' ? 'ready' : 'unsupported', timezone: 'Asia/Shanghai', source: 'read-only-contract', total: null, generatedAt: 1, hasMore: false, issues: [], boundary: '当前没有独立主动消息投递证据索引；普通消息不作为主动发送证明。' }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel'), nav = panel.getByRole('navigation')
    await nav.getByRole('button', { name: '主动消息证据', exact: true }).click()
    const proactive = panel.getByTestId('debug-evidence-proactive')
    await expect(proactive.getByRole('alert')).toContainText('读取失败')
    await expect(proactive.locator('.debug-proactive-boundary')).toHaveCount(0)
    await expect(proactive).not.toContainText('0 条')
    await page.evaluate(() => { (window as unknown as { __proactiveMode: string }).__proactiveMode = 'unsupported' })
    await proactive.getByRole('button', { name: '重试', exact: true }).click()
    await expect(proactive).toContainText('尚无独立投递记录源')
    await expect(proactive.locator('input,select,[data-record-id]')).toHaveCount(0)
    await expect(proactive).not.toContainText('没有记录')
    await page.screenshot({ path: info.outputPath('proactive-production-boundary.png') })
    await proactive.getByText('来源与边界', { exact: true }).click()
    await expect(proactive.locator('pre')).toContainText('"state": "unsupported"')
    await expect(proactive.locator('pre')).toContainText('read-only-contract')
    await expect(proactive).toContainText('朋友圈是相关生活上下文，不是问候回执')
    await page.evaluate(() => { (window as unknown as { __proactiveMode: string }).__proactiveMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(proactive.getByRole('alert')).toContainText('保留上次查询边界')
    await expect(proactive.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __proactiveMode: string }).__proactiveMode = 'unsupported' })
    await proactive.getByRole('button', { name: '重试', exact: true }).click()
    await expect(proactive.getByRole('alert')).toHaveCount(0)
    await expect(proactive.locator('pre')).toBeVisible()
    for (const mode of ['unexpected', 'unavailable']) {
      await page.evaluate(mode => { (window as unknown as { __proactiveMode: string }).__proactiveMode = mode }, mode)
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      await expect(proactive.getByRole('alert')).toContainText(mode === 'unexpected' ? '未将其解释为投递记录' : '当前诊断源不可用')
      await expect(proactive.locator('.debug-proactive-boundary,[data-record-id]')).toHaveCount(0)
    }
    await page.evaluate(() => { (window as unknown as { __proactiveMode: string }).__proactiveMode = 'pending' })
    await nav.getByRole('button', { name: '朋友圈', exact: true }).click()
    await nav.getByRole('button', { name: '主动消息证据', exact: true }).click()
    await expect(proactive).toContainText('正在读取投递查询状态')
    await expect(proactive.locator('.debug-proactive-boundary')).toHaveCount(0)
    await expect(proactive.getByRole('button')).toHaveCount(0)
    await page.evaluate(() => { (window as unknown as { __resolveProactive?: () => void }).__resolveProactive?.() })
    await expect(proactive).toContainText('尚无独立投递记录源')
    for (const scale of ['sm', 'lg']) {
      await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
      expect(await proactive.locator('.debug-proactive-boundary > p').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await page.screenshot({ path: info.outputPath('proactive-production-scaled.png') })
    await page.evaluate(() => { (window as unknown as { __proactiveMode: string }).__proactiveMode = 'unsupported' })
    await proactive.getByRole('button', { name: '查看朋友圈', exact: true }).click()
    await expect(panel.getByTestId('debug-evidence-moments')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __proactiveCalls: number }).__proactiveCalls)).toBeGreaterThan(1)
  })
}

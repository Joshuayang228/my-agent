import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式事项逐条阅读与分页 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 800 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __recentFail: boolean; __recentQueries: Array<{ date?: string; cursor?: string }> }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__recentFail = true; state.__recentQueries = []
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; cursor?: string; date?: string }) => {
          state.__recentQueries.push(query)
          if (state.__recentFail) throw new Error('contract failure')
          const id = query.cursor ? 'event-b' : 'event-a'
          return { ...query, state: 'ready', source: 'companion_events', timezone: 'Asia/Shanghai', total: null, generatedAt: Date.now(), hasMore: !query.cursor && query.roleId !== 'yu', nextCursor: query.cursor ? undefined : 'next', issues: [], boundary: '计划时间，不补造执行', records: query.roleId === 'yu' ? [] : [{ id, source: 'companion_events', roleId: query.roleId, kind: 'reading', title: query.cursor ? '第二条事项' : '阅读笔记', time: 1, status: 'published', body: '仅在详情显示的完整正文', truncated: false, data: { scheduled_at: query.cursor ? null : Date.parse('2026-10-25T06:30:00Z'), payload: { location: '书房', metadata: '完整原始字段' } }, links: [] }] }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    await panel.getByRole('navigation').getByRole('button', { name: '最近事项', exact: true }).click()
    const recent = panel.getByTestId('debug-evidence-recent')
    await expect(recent.getByRole('alert')).toContainText('读取失败')
    await expect(recent.getByLabel('事项范围计数')).toHaveCount(0)
    await page.evaluate(() => { (window as unknown as { __recentFail: boolean }).__recentFail = false })
    await recent.getByRole('button', { name: '重试', exact: true }).click()
    await expect(recent.getByLabel('事项范围计数')).toHaveText('1 条已读取 · 总数未知')
    await expect(recent.locator('.debug-recent-summary p')).toContainText('已发布')
    await expect(recent.locator('.debug-recent-time')).toContainText('14:30')
    await expect(recent.getByText('仅在详情显示的完整正文', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('recent-list.png') })
    await recent.getByRole('button', { name: '读取下一页', exact: true }).click()
    await expect(recent.getByLabel('事项范围计数')).toHaveText('2 条已读取 · 总数未知')
    await expect(recent.locator('.debug-recent-time').last()).toHaveText('时间未记录')
    await recent.getByRole('textbox', { name: '搜索当前页证据' }).fill('阅读笔记')
    const reading = recent.getByRole('button', { name: '阅读笔记', exact: true })
    await reading.click()
    const detail = recent.getByRole('article', { name: '领域证据详情' })
    await expect(detail).toContainText('已发布不证明活动完成')
    await expect(detail.locator('.debug-reading-body')).toHaveText('仅在详情显示的完整正文')
    await detail.getByText('记录标识与范围', { exact: true }).click()
    await expect(detail.locator('pre')).toContainText('完整原始字段')
    await page.screenshot({ path: info.outputPath('recent-detail.png') })
    await page.evaluate(() => { (window as unknown as { __recentFail: boolean }).__recentFail = true })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(recent.getByRole('alert')).toContainText('全部已读页')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __recentFail: boolean }).__recentFail = false })
    await recent.getByRole('button', { name: '重试', exact: true }).click()
    await expect(recent.getByRole('alert')).toHaveCount(0)
    const queries = await page.evaluate(() => (window as unknown as { __recentQueries: Array<{ cursor?: string }> }).__recentQueries)
    expect(queries.slice(-2).map(query => query.cursor)).toEqual([undefined, 'next'])
    await expect(detail.locator('pre')).toBeVisible()
    await detail.getByRole('button', { name: '返回列表', exact: true }).click()
    await expect(reading).toBeFocused()
    await recent.getByRole('textbox', { name: '搜索当前页证据' }).fill('未命中')
    await expect(recent).toContainText('没有匹配的证据')
    await recent.getByRole('textbox', { name: '搜索当前页证据' }).fill('')
    await recent.getByRole('textbox', { name: '证据日期' }).fill('2026-10-25')
    await expect(recent.getByLabel('事项范围计数')).toHaveText('1 条已读取 · 总数未知')
    expect(await page.evaluate(() => (window as unknown as { __recentQueries: Array<{ date?: string; cursor?: string }> }).__recentQueries.at(-1))).toMatchObject({ date: '2026-10-25' })
    await recent.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(recent).toContainText('此范围没有记录')
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  })
}

import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式足迹阅读与失败边界 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __tripMode: string; __tripQueries: Array<{ view: string; cursor?: string; recordId?: string }> }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__tripMode = 'fail'; state.__tripQueries = []
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; cursor?: string; recordId?: string }) => {
          state.__tripQueries.push(query)
          if (state.__tripMode === 'fail') throw new Error('trip contract failure')
          const record = (id: string, title: string, payload: Record<string, unknown>) => ({ id, roleId: query.roleId, kind: 'footprint', title, body: '', source: 'companion_assets', time: null, status: '', truncated: false, links: id === 'trip' ? [{ view: 'recent', id: 'event-real', label: '来源生活事件' }] : [], data: { payload, acquired_at: Date.parse('2026-10-25T06:00:00Z') } })
          const rows = [record('trip', '河边旅行', { recordType: 'trip', status: 'completed', destination: '河边', start: '2026-10-20', end: '2026-10-21', story: state.__tripMode === 'long' ? '旅行长正文。'.repeat(250) : '旅行经历正文', stops: [{ id: 'stop', name: '河边步道', story: '停留正文', date: '2026-10-20' }] }), record('plan', '海边计划', { recordType: 'trip', status: 'planned', destination: '海边' }), record('place', '旧地点', { recordType: 'place', story: '地点描述' }), record('unknown', '未知类型', { recordType: 'legacy', status: 'completed', savedField: '保留原始字段' }), record('bad', '日期损坏', { recordType: 'trip', status: 'completed', destination: '山边', start: '2026-02-30', stops: [null, { id: 'duplicate', name: '旧停留', story: '原文', date: 'bad' }, { id: 'duplicate', name: '重复停留', story: '也保留' }] })]
          const records = query.roleId === 'yu' ? [] : query.view === 'recent' ? [{ ...record('event-real', '来源事件', {}), source: 'companion_events', kind: 'reading', body: '来源事件正文', links: [], data: { scheduled_at: Date.parse('2026-10-25T06:00:00Z') } }] : query.view !== 'footprints' ? [] : query.recordId ? rows.filter(row => row.id === query.recordId) : query.cursor ? rows.slice(2) : rows.slice(0, 2)
          const hasMore = query.view === 'footprints' && !query.recordId && !query.cursor && query.roleId === 'lin'
          return { ...query, state: 'ready', source: 'companion_assets', timezone: 'Asia/Shanghai', total: null, generatedAt: Date.now(), records, hasMore, nextCursor: hasMore ? 'next' : undefined, issues: [], boundary: '只读，不推断日期' }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel'), nav = panel.getByRole('navigation')
    await nav.getByRole('button', { name: '足迹', exact: true }).click()
    const trips = panel.getByTestId('debug-evidence-footprints'), detail = trips.getByRole('article', { name: '领域证据详情' })
    const search = trips.getByRole('textbox', { name: '搜索当前页证据' })
    await expect(trips.getByRole('alert')).toContainText('读取失败')
    await expect(trips.locator('.debug-travel-range')).toHaveCount(0)
    await expect(search).toBeDisabled()
    await page.evaluate(() => { (window as unknown as { __tripMode: string }).__tripMode = 'ready' })
    await trips.getByRole('button', { name: '重试', exact: true }).click()
    await expect(trips.locator('.debug-travel-range')).toHaveText('2 项已读 · 总数未知')
    await expect(trips).not.toContainText('旅行经历正文')
    await trips.getByRole('button', { name: '海边计划', exact: true }).click()
    await expect(detail).toContainText('未确认实际出发')
    await expect(trips.locator('[data-record-id="plan"]')).toContainText('旅行日期未提供')
    await search.fill('旧地点')
    await expect(trips).toContainText('没有匹配的足迹资料')
    await trips.getByRole('button', { name: '读取下一页', exact: true }).click()
    await expect(trips.locator('.debug-travel-range')).toHaveText('1 项匹配 · 5 项已读 · 总数未知')
    await trips.getByRole('button', { name: '旧地点', exact: true }).click()
    await expect(detail).toContainText('地点资料不自动转换为旅行')
    await search.fill('')
    await expect(trips.locator('[data-travel-group="unknown"] [data-record-id="unknown"]')).toBeVisible()
    await expect(trips.locator('[data-record-id="bad"]')).toContainText('资料不完整')
    await trips.getByRole('button', { name: '日期损坏', exact: true }).click()
    await expect(detail).toContainText('不据此确认实际出发')
    await expect(detail.locator('.debug-travel-stop')).toHaveCount(3)
    await expect(detail.locator('.debug-travel-stop').first()).toContainText('日期未提供')
    await trips.getByRole('button', { name: '未知类型', exact: true }).click()
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await expect(detail.locator('pre')).toContainText('保留原始字段')
    await trips.getByRole('button', { name: '河边旅行', exact: true }).click()
    await expect(detail.locator('.debug-travel-body').first()).toHaveText('旅行经历正文')
    await detail.getByText('完整字段', { exact: true }).click()
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await expect(detail.locator('pre')).toContainText('stop')
    await page.evaluate(() => { (window as unknown as { __tripMode: string }).__tripMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(trips.getByRole('alert')).toContainText('保留上次资产与已加载页')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __tripMode: string }).__tripMode = 'ready' })
    await trips.getByRole('button', { name: '重试', exact: true }).click()
    await expect(trips.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __tripQueries: Array<{ cursor?: string }> }).__tripQueries.slice(-2).map(query => query.cursor))).toEqual([undefined, 'next'])
    await expect(detail.locator('pre')).toBeVisible()
    await detail.getByRole('button', { name: '返回列表', exact: true }).click()
    await expect(trips.getByRole('button', { name: '河边旅行', exact: true })).toBeFocused()
    await page.screenshot({ path: info.outputPath('footprints-production-list.png') })
    await trips.getByRole('button', { name: '河边旅行', exact: true }).click()
    await detail.getByRole('button', { name: '来源生活事件', exact: true }).click()
    await expect(panel.getByTestId('debug-evidence-recent').getByRole('article', { name: '领域证据详情' })).toContainText('来源事件正文')
    expect(await page.evaluate(() => (window as unknown as { __tripQueries: Array<{ view: string; recordId?: string }> }).__tripQueries.at(-1))).toMatchObject({ view: 'recent', recordId: 'event-real' })
    await nav.getByRole('button', { name: '足迹', exact: true }).click()
    await page.evaluate(() => { (window as unknown as { __tripMode: string }).__tripMode = 'long' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await trips.getByRole('button', { name: '河边旅行', exact: true }).click()
    await expect(detail.locator('.debug-travel-body').first()).toHaveText('旅行长正文。'.repeat(250))
    for (const scale of ['sm', 'lg']) {
      await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
      expect(await trips.locator('.debug-travel-name').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await page.screenshot({ path: info.outputPath('footprints-production-detail.png') })
    await trips.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(trips).toContainText('不推断人物从未到访')
    await expect(trips.locator('[data-record-id]')).toHaveCount(0)
  })
}

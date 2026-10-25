import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式关联读取 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __linksMode: string; __linksQueries: Array<{ cursor?: string; date?: string }> }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__linksMode = 'fail'; state.__linksQueries = []
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; cursor?: string; date?: string; recordId?: string }) => {
          state.__linksQueries.push(query)
          if (state.__linksMode === 'fail') throw new Error('links contract failure')
          const rows = ['asset', 'image', 'cast', 'person', 'future'].map((type, index) => ({ id: `link-${index}`, roleId: query.roleId, source: 'companion_event_links', kind: type, title: '不能代替保存名称', body: '', time: null, status: '', truncated: state.__linksMode === 'truncated', links: [], data: { event_id: index < 4 ? 'event-a' : 'event-b', target_id: type === 'image' ? 'a'.repeat(64) : `target-${index}`, target_type: type, relation: 'references', created_at: Date.parse('2026-10-26T06:00:00Z'), metadata: state.__linksMode === 'invalid' ? '原始非对象' : { name: index === 0 ? '相机旧保存名' : `保存名称${index}`, note: state.__linksMode === 'long' ? '完整关联备注。'.repeat(200) : '保存备注' } } }))
          Object.assign(rows[0], { links: [{ view: 'recent', id: 'event-a', label: '查看来源事件' }] })
          const records = query.view === 'recent' ? [{ ...rows[0], id: 'event-a', source: 'companion_events', body: '明确来源事件正文', data: { scheduled_at: Date.parse('2026-10-26T06:00:00Z') }, links: [{ view: 'links', id: 'missing-edge', label: '查看缺失关联' }] }] : query.roleId === 'yu' || query.date === '2026-10-25' ? [] : query.recordId ? rows.filter(row => row.id === query.recordId) : query.cursor ? rows.slice(2) : rows.slice(0, 2)
          const hasMore = records.length > 0 && !query.cursor && !query.recordId
          return { ...query, state: 'ready', source: 'companion_event_links', timezone: 'Asia/Shanghai', total: null, generatedAt: Date.now(), records, hasMore, nextCursor: hasMore ? 'next' : undefined, issues: [], boundary: '只读保存关联' }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    await panel.getByRole('navigation').getByRole('button', { name: '生活事件关联', exact: true }).click()
    const links = panel.getByTestId('debug-evidence-links'), rows = links.locator('[data-record-id]'), search = links.getByRole('textbox', { name: '搜索当前页证据' }), detail = links.getByRole('article', { name: '领域证据详情' })
    await expect(links.getByRole('alert')).toContainText('读取失败')
    await expect(links.locator('.debug-links-range')).toHaveCount(0)
    await expect(search).toBeDisabled()
    await page.evaluate(() => { (window as unknown as { __linksMode: string }).__linksMode = 'ready' })
    await links.getByRole('button', { name: '重试', exact: true }).click()
    await expect(rows).toHaveCount(2)
    const before = await page.evaluate(() => (window as unknown as { __linksQueries: unknown[] }).__linksQueries.length)
    await search.fill('无匹配搜索')
    await links.getByRole('button', { name: '清除筛选', exact: true }).click()
    await expect(rows).toHaveCount(2, { timeout: 1500 })
    expect(await page.evaluate(() => (window as unknown as { __linksQueries: unknown[] }).__linksQueries.length)).toBe(before)
    const camera = links.locator('[data-record-id="link-0"] button')
    await camera.click()
    await expect(detail).toContainText('相机旧保存名')
    await expect(detail).toContainText('未提供目标定位')
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await expect(detail.locator('pre')).toContainText('target-0')
    await links.getByRole('button', { name: '读取下一页关联', exact: true }).click()
    await expect(rows).toHaveCount(5)
    await expect(links.locator('[data-event-key="event-a"] [data-record-id]')).toHaveCount(4)
    await page.evaluate(() => { (window as unknown as { __linksMode: string }).__linksMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(links.getByRole('alert')).toContainText('保留原人物')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __linksMode: string }).__linksMode = 'ready' })
    await links.getByRole('button', { name: '重试', exact: true }).click()
    await expect(links.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __linksQueries: Array<{ cursor?: string }> }).__linksQueries.slice(-2).map(query => query.cursor))).toEqual([undefined, 'next'])
    await expect(detail.locator('pre')).toBeVisible()
    await detail.getByRole('button', { name: '返回列表', exact: true }).click()
    await expect(camera).toBeFocused()
    await page.screenshot({ path: info.outputPath('links-production-list.png') })
    for (const mode of ['invalid', 'truncated', 'long']) {
      await page.evaluate(mode => { (window as unknown as { __linksMode: string }).__linksMode = mode }, mode)
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      await links.locator('[data-record-id="link-0"] button').click()
      if (mode === 'invalid') await expect(detail).toContainText('元数据不是对象')
      if (mode === 'truncated') await expect(detail).toContainText('不能认定元数据完整')
      if (mode === 'long') {
        await expect(detail.locator('.debug-links-body').last()).toHaveText('完整关联备注。'.repeat(200))
        for (const scale of ['sm', 'lg']) {
          await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
          expect(await detail.locator('.debug-links-body').last().evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
          expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
        }
        await detail.evaluate(node => node.scrollIntoView({ block: 'start' }))
        await page.screenshot({ path: info.outputPath('links-production-detail.png') })
      }
    }
    await detail.getByRole('button', { name: '查看来源事件', exact: true }).click()
    const event = panel.getByTestId('debug-evidence-recent').getByRole('article', { name: '领域证据详情' })
    await expect(event).toContainText('明确来源事件正文')
    await event.getByRole('button', { name: '查看缺失关联', exact: true }).click()
    await expect(links).toContainText('未选择替代记录')
    await expect(detail).toHaveCount(0)
    await links.getByRole('button', { name: '返回当前领域列表', exact: true }).click()
    await links.getByRole('button', { name: '读取下一页关联', exact: true }).click()
    await expect(rows).toHaveCount(5)
    await links.locator('.debug-links-filter summary').click()
    await links.getByRole('combobox', { name: '关联目标类型' }).selectOption('unknown')
    await expect(rows).toHaveCount(1)
    await links.getByRole('textbox', { name: '关联创建日' }).fill('2026-10-25')
    await expect(links).toContainText('当前查询未返回关联记录')
    await links.getByRole('button', { name: '清除筛选', exact: true }).click()
    await expect(rows).toHaveCount(2)
    await links.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(links).toContainText('不推断事件从未有关联')
    await expect(rows).toHaveCount(0)
  })
}

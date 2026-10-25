import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式成长来源与正文 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __growthMode: string; __growthCursors: Array<string | undefined> }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__growthMode = 'fail'; state.__growthCursors = []
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; cursor?: string; recordId?: string }) => {
          state.__growthCursors.push(query.cursor)
          if (state.__growthMode === 'fail') throw new Error('growth contract failure')
          const record = (id: string, source: string, data: Record<string, unknown>, body = '') => ({ id, roleId: query.roleId, source, kind: source, data, body, title: id, status: '', time: null, truncated: false, links: [] })
          const savedAt = Date.parse('2026-10-25T06:00:00Z')
          const current = record('lin', 'companion_mutable', { version: 2, updated_at: 0 }, state.__growthMode === 'empty' ? '' : state.__growthMode === 'long' ? '当前成长长文。'.repeat(180) : '当前成长正文')
          const reflection = record('lin', 'companion_reflection_state', { last_run_at: 0, runs: state.__growthMode === 'bad' ? [null, { at: 0, changed: 'true', summary: '坏格式摘要' }] : [{ at: savedAt, changed: false, summary: '只保存结果摘要' }] })
          const history = [record('v2', 'companion_mutable_versions', { version: 2, created_at: savedAt + 1000, summary: '摘要二' }, '版本二全文'), record('v1', 'companion_mutable_versions', { version: 1, created_at: savedAt, summary: '摘要一' }, '版本一全文')]
          const records = query.view !== 'growth' ? [] : query.recordId ? history.filter(row => row.id === query.recordId) : query.roleId === 'yu' ? [record('yu:pack-default', 'Role Pack mutable.default', {}, '已读默认定义正文')] : query.cursor ? history.slice(1) : [current, ...(state.__growthMode === 'partial' ? [] : [reflection]), history[0]]
          const hasMore = query.view === 'growth' && query.roleId === 'lin' && !query.cursor && !query.recordId
          return { ...query, records, state: 'ready', timezone: 'Asia/Shanghai', source: 'companion_mutable_versions', total: null, generatedAt: Date.now(), hasMore, nextCursor: hasMore ? 'next' : undefined, issues: state.__growthMode === 'partial' ? ['记录 lin 格式损坏或超限'] : [], boundary: '只读成长来源' }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel'), nav = panel.getByRole('navigation')
    await nav.getByRole('button', { name: '成长与反思', exact: true }).click()
    const growth = panel.getByTestId('debug-evidence-growth'), detail = growth.getByRole('article', { name: '领域证据详情' })
    await expect(growth.getByRole('alert')).toContainText('读取失败')
    await expect(growth.locator('[data-record-id]')).toHaveCount(0)
    await page.evaluate(() => { (window as unknown as { __growthMode: string }).__growthMode = 'ready' })
    await growth.getByRole('button', { name: '重试', exact: true }).click()
    await expect(growth.locator('[data-record-id="lin"]')).toHaveCount(2)
    await expect(growth.locator('.debug-growth-current')).toContainText('当前成长正文')
    await expect(growth.locator('.debug-growth-current')).toContainText('未记录')
    await growth.getByRole('button', { name: '当前成长覆盖', exact: true }).click()
    await expect(detail.locator('.debug-growth-body')).toHaveText('当前成长正文')
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await expect(detail).toContainText('companion_mutable · lin')
    await growth.getByRole('button', { name: '反思运行结果', exact: true }).click()
    await expect(detail).toContainText('不是隐藏思维')
    await expect(detail).toContainText('只保存结果摘要')
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await expect(detail).toContainText('companion_reflection_state · lin')
    await detail.getByRole('button', { name: '返回列表', exact: true }).click()
    await expect(growth.getByRole('button', { name: '反思运行结果', exact: true })).toBeFocused()
    await growth.getByRole('button', { name: '读取下一页历史', exact: true }).click()
    await expect(growth.locator('.debug-growth-history')).toContainText('2 项已读历史')
    await growth.getByRole('button', { name: '历史版本 v1', exact: true }).click()
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await page.evaluate(() => { (window as unknown as { __growthMode: string }).__growthMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(growth.getByRole('alert')).toContainText('保留上次正文')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __growthMode: string }).__growthMode = 'ready' })
    await growth.getByRole('button', { name: '重试', exact: true }).click()
    await expect(growth.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __growthCursors: Array<string | undefined> }).__growthCursors.slice(-2))).toEqual([undefined, 'next'])
    await expect(detail.locator('pre')).toBeVisible()
    await detail.getByRole('button', { name: '返回列表', exact: true }).click()
    await page.screenshot({ path: info.outputPath('growth-production-list.png') })
    for (const mode of ['empty', 'bad', 'partial', 'long']) {
      await page.evaluate(mode => { (window as unknown as { __growthMode: string }).__growthMode = mode }, mode)
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      if (mode === 'empty') await expect(growth.locator('.debug-growth-current')).toContainText('未改用默认正文')
      if (mode === 'bad') {
        await growth.getByRole('button', { name: '反思运行结果', exact: true }).click()
        await expect(detail).toContainText('部分反思结果格式异常')
        await expect(detail).toContainText('变更状态未记录')
      }
      if (mode === 'partial') {
        await expect(growth).toContainText('未据此确认反思状态缺失')
        await expect(growth).not.toContainText('当前已读范围没有反思状态')
        await expect(detail).toHaveCount(0)
      }
      if (mode === 'long') {
        await growth.getByRole('button', { name: '当前成长覆盖', exact: true }).click()
        await expect(detail.locator('.debug-growth-body')).toHaveText('当前成长长文。'.repeat(180))
        expect((await growth.locator('.debug-growth-current > .debug-growth-body').innerText()).length).toBe(181)
        for (const scale of ['sm', 'lg']) {
          await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
          expect(await detail.locator('.debug-growth-body').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
          expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
        }
        await page.screenshot({ path: info.outputPath('growth-production-detail.png') })
      }
    }
    await growth.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(detail).toHaveCount(0)
    await expect(growth.locator('.debug-growth-current')).toContainText('不是用户覆盖')
    await expect(growth.locator('.debug-growth-current')).not.toContainText('v1')
  })
}

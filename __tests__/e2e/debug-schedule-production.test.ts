import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式日程时段阅读与范围恢复 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 800 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __scheduleMode: string; __dateCalls: number }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__scheduleMode = 'fail'; state.__dateCalls = 0
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; date?: string }) => {
          state.__dateCalls++
          if (state.__scheduleMode === 'fail') throw new Error('contract failure')
          const slots = [{ hour: 14, minute: 30, activity: '午后阅读', location: '书房', mood: '详情情绪' }, { hour: 9, minute: 15, activity: '早间整理', location: '阳台' }]
          const payload = { date: query.date, theme: '完整日剧本主题', slots: state.__scheduleMode === 'bad' ? { unexpected: 'broken-slots' } : state.__scheduleMode === 'reordered' ? slots.reverse() : slots }
          return { ...query, state: 'ready', source: 'companion_day_scripts', timezone: 'Asia/Shanghai', generatedAt: Date.now(), total: null, hasMore: false, issues: [], boundary: '只读计划，无执行索引', records: query.roleId === 'yu' ? [] : [{ id: 'day-test', source: 'companion_day_scripts', roleId: query.roleId, kind: 'day', title: '日剧本', time: null, body: '', status: 'published', truncated: false, links: [], data: { date: query.date, payload } }] }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    await panel.getByRole('navigation').getByRole('button', { name: '今日日程', exact: true }).click()
    const schedule = panel.getByTestId('debug-evidence-schedule')
    await expect(schedule.getByRole('alert')).toContainText('读取失败')
    await expect(schedule.getByLabel('计划时段计数')).toHaveCount(0)
    await page.evaluate(() => { (window as unknown as { __scheduleMode: string }).__scheduleMode = 'ready' })
    await schedule.getByRole('button', { name: '重试', exact: true }).click()
    await expect(schedule.locator('.debug-schedule-row time')).toHaveText(['09:15', '14:30'])
    await expect(schedule.getByText('详情情绪', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('production-schedule-list.png') })
    await schedule.getByRole('textbox', { name: '搜索当前页证据' }).fill('午后')
    await expect(schedule.getByLabel('计划时段计数')).toContainText('1 个计划时段')
    const row = schedule.getByRole('button', { name: '14:30 · 午后阅读', exact: true })
    await row.click()
    const detail = schedule.getByRole('article', { name: '领域证据详情' })
    await expect(detail).toContainText('本读取未提供执行证据')
    await expect(detail).toContainText('详情情绪')
    await page.screenshot({ path: info.outputPath('production-schedule-detail.png') })
    await detail.getByText('记录标识与范围', { exact: true }).click()
    await page.evaluate(() => { (window as unknown as { __scheduleMode: string }).__scheduleMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(schedule.getByRole('alert')).toContainText('保留原范围')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __scheduleMode: string }).__scheduleMode = 'ready' })
    await schedule.getByRole('button', { name: '重试', exact: true }).click()
    await expect(schedule.getByRole('alert')).toHaveCount(0)
    await expect(detail.locator('pre')).toBeVisible()
    await detail.getByRole('button', { name: '返回列表', exact: true }).click()
    await expect(row).toBeFocused()
    await schedule.getByRole('textbox', { name: '搜索当前页证据' }).fill('')
    await schedule.getByRole('button', { name: '09:15 · 早间整理', exact: true }).click()
    await page.evaluate(() => { (window as unknown as { __scheduleMode: string }).__scheduleMode = 'reordered' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(schedule).toContainText('原选中时段已变更')
    await expect(detail).toHaveCount(0)
    const date = schedule.getByRole('textbox', { name: '证据日期' })
    const calls = await page.evaluate(() => (window as unknown as { __dateCalls: number }).__dateCalls)
    await date.fill('')
    await expect(schedule.getByRole('status')).toHaveText('请选择计划日期。')
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    expect(await page.evaluate(() => (window as unknown as { __dateCalls: number }).__dateCalls)).toBe(calls)
    await page.evaluate(() => { (window as unknown as { __scheduleMode: string }).__scheduleMode = 'bad' })
    await date.fill('2026-10-25')
    await expect(schedule).toContainText('不是数组')
    await expect(schedule.getByLabel('计划时段计数')).toHaveText('计划时段数量未知')
    await schedule.getByText('日剧本与完整来源', { exact: true }).click()
    await expect(schedule.locator('pre')).toContainText('broken-slots')
    await schedule.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(schedule).toContainText('此范围没有记录')
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('production-schedule.png') })
  })
}

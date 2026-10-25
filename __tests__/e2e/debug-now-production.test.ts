import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式此刻快照与恢复 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 800 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __nowMode: string; __nowQueries: Array<{ view: string; recordId?: string }> }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__nowMode = 'fail'; state.__nowQueries = []
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; recordId?: string }) => {
          state.__nowQueries.push(query)
          if (state.__nowMode === 'fail') throw new Error('state contract failure')
          const fallback = state.__nowMode === 'fallback'
          const world = { currentActivity: fallback ? '' : '整理旅行照片', currentLocation: fallback ? '未设定' : '书房', mood: 65, energy: 72, socialNeed: 40, updatedAt: fallback ? 0 : Date.parse('2026-10-25T06:32:00Z'), timezone: 'Asia/Shanghai' }
          return { ...query, state: 'ready', source: 'companion_role_state', timezone: 'Asia/Shanghai', total: null, generatedAt: Date.now(), hasMore: false, issues: [], boundary: '只读解析快照，存储原文分别保留', records: query.roleId === 'yu' || query.recordId === 'missing' || query.view === 'schedule' ? [] : [{ id: 'lin', source: 'companion_role_state', roleId: 'lin', kind: 'state', title: '当前状态', time: 1, status: '', body: '', truncated: false, data: { world, storedWorld: fallback ? '存储世界 JSON 不可解析，运行时使用 codec 默认规则' : state.__nowMode === 'projection' ? {} : world, paused_at: state.__nowMode === 'paused' ? Date.parse('2026-10-25T06:33:00Z') : null, last_tick_at: fallback ? 0 : Date.parse('2026-10-25T06:30:00Z'), catchup_summary: state.__nowMode === 'long' ? '长补叙内容。'.repeat(500) : '生活摘要，不是独立日记。' }, links: query.view === 'location' ? [{ view: 'now', id: 'missing', label: '查看此刻引用' }] : [] }] }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    const nav = panel.getByRole('navigation')
    await nav.getByRole('button', { name: '此刻', exact: true }).click()
    const now = panel.getByTestId('debug-evidence-now')
    const detail = now.getByRole('article', { name: '领域证据详情' })
    const toggle = now.getByRole('button', { name: '当前状态 · 完整状态', exact: true })
    await expect(now.getByRole('alert')).toContainText('读取失败')
    await expect(now.locator('.debug-now-summary')).toHaveCount(0)
    await page.evaluate(() => { (window as unknown as { __nowMode: string }).__nowMode = 'ready' })
    await now.getByRole('button', { name: '重试', exact: true }).click()
    await expect(now.locator('.debug-now-activity')).toHaveText('整理旅行照片')
    await expect(detail).toHaveCount(0)
    await expect(now.locator('.debug-now-meta')).toContainText('14:32')
    await page.screenshot({ path: info.outputPath('now-production-summary.png') })
    await toggle.click()
    await expect(detail.getByText('65', { exact: true })).toBeVisible()
    await expect(detail.locator('.debug-now-body')).toContainText('不是独立日记')
    await detail.getByText('记录标识与原始来源', { exact: true }).click()
    await expect(detail.locator('pre')).toContainText('storedWorld')
    await page.evaluate(() => { (window as unknown as { __nowMode: string }).__nowMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(now.getByRole('alert')).toContainText('保留上次快照')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __nowMode: string }).__nowMode = 'paused' })
    await now.getByRole('button', { name: '重试', exact: true }).click()
    await expect(now.getByRole('alert')).toHaveCount(0)
    await expect(now.locator('.debug-now-warning')).toContainText('生活推进已暂停')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __nowMode: string }).__nowMode = 'projection' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(now.locator('.debug-now-warning')).toContainText('保存值与运行时解析快照存在差异')
    await page.evaluate(() => { (window as unknown as { __nowMode: string }).__nowMode = 'fallback' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(now.locator('.debug-now-warning')).toContainText('存储世界 JSON 不可解析')
    await expect(now.locator('.debug-now-activity')).toHaveText('未记录')
    await expect(now.locator('.debug-now-meta')).toContainText('更新时间未记录')
    await expect(detail).not.toContainText('1970')
    await page.evaluate(() => { (window as unknown as { __nowMode: string }).__nowMode = 'long' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(detail.locator('.debug-now-body')).toHaveText('长补叙内容。'.repeat(500))
    for (const scale of ['sm', 'lg']) {
      await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
      expect(await now.locator('.debug-now-activity').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-font-scale', 'md'))
    await page.screenshot({ path: info.outputPath('now-production-detail.png') })
    await detail.getByRole('button', { name: '查看今日计划', exact: true }).click()
    await expect(panel.getByRole('heading', { name: '今日日程', exact: true, level: 1 })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __nowQueries: Array<{ recordId?: string }> }).__nowQueries.at(-1)?.recordId)).toBeUndefined()
    await nav.getByRole('button', { name: '此刻', exact: true }).click()
    await expect(detail).toHaveCount(0)
    await toggle.click()
    await detail.getByRole('button', { name: '查看位置快照', exact: true }).click()
    await panel.locator('details.debug-production-record > summary').click()
    await panel.getByRole('button', { name: '查看此刻引用', exact: true }).click()
    await expect(now).toContainText('引用状态未在该人物范围找到，未选择替代快照。')
    await expect(now.locator('.debug-now-summary')).toHaveCount(0)
    await now.getByRole('button', { name: '返回当前领域列表', exact: true }).click()
    await now.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(now).toContainText('该人物没有状态记录；未补造默认世界。')
    await expect(now.locator('.debug-now-summary')).toHaveCount(0)
  })
}

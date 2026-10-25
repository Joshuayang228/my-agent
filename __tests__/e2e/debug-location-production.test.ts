import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式位置快照与来源 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __locationMode: string; __locationAssetFail: boolean }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__locationMode = 'fail'; state.__locationAssetFail = true
      const asset = (key: string, role: string, type: string, name: string) => ({ key, name, category: 'companion', assetType: type, ownership: 'role-pack', source: 'role-pack://test/world.default.json', version: '1', fingerprint: 'world-fingerprint', status: 'active', contentKind: 'data', mode: 'static', content: '真实世界定义', locale: 'zh-CN', locales: {}, slots: [], roleIds: [role] })
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        modelContextAssets: async () => {
          if (state.__locationAssetFail) throw new Error('world asset contract failure')
          return [asset('world-real-key', 'lin', 'companion-world', '真实世界来源'), asset('profile-wrong-key', 'lin', 'companion-profile', '人物资料来源'), asset('other-world-key', 'yu', 'companion-world', '另一人物世界')]
        },
        assetUsageQuery: async () => ({ records: [], total: 0 }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; recordId?: string }) => {
          if (state.__locationMode === 'fail') throw new Error('location contract failure')
          const fallback = state.__locationMode === 'fallback'
          const unset = state.__locationMode === 'unset'
          const long = state.__locationMode === 'long'
          const world = { currentLocation: fallback || unset ? '未设定' : '书房', locationDetail: fallback || unset ? '' : long ? '位置细节。'.repeat(15).slice(0, 80) : '书桌前', currentActivity: '整理照片', updatedAt: fallback || unset ? 0 : Date.parse('2026-10-25T06:32:00Z'), timezone: 'Asia/Shanghai' }
          const storedWorld = fallback ? { schemaVersion: 0, currentLocation: '旧结构地点' } : long ? { ...world, locationDetail: '完整保存细节。'.repeat(400) } : world
          return { ...query, state: 'ready', source: 'companion_role_state', timezone: 'Asia/Shanghai', total: null, generatedAt: Date.now(), hasMore: false, issues: [], boundary: '解析快照与保存原文分别解释', records: query.roleId === 'yu' || query.recordId === 'missing' || ['residence', 'footprints'].includes(query.view) ? [] : [{ id: 'lin', roleId: 'lin', kind: 'state', title: '当前位置', body: '', time: 1, source: 'companion_role_state', status: '', truncated: false, data: { world, storedWorld }, links: query.view === 'now' ? [{ view: 'location', id: 'missing', label: '查看缺失位置引用' }] : [] }] }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    const nav = panel.getByRole('navigation')
    await nav.getByRole('button', { name: '当前位置', exact: true }).click()
    const location = panel.getByTestId('debug-evidence-location')
    const toggle = location.getByRole('button', { name: /完整快照/ })
    const detail = location.getByRole('article', { name: '领域证据详情' })
    await expect(location.getByRole('alert')).toContainText('读取失败')
    await expect(location.locator('.debug-location-summary')).toHaveCount(0)
    await page.evaluate(() => { (window as unknown as { __locationMode: string }).__locationMode = 'ready' })
    await location.getByRole('button', { name: '重试', exact: true }).click()
    await expect(location.locator('.debug-location-place')).toHaveText('书房')
    await expect(location.locator('.debug-location-body')).toHaveText('书桌前')
    await expect(detail).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('location-production-summary.png') })
    await toggle.click()
    await expect(detail).toContainText('更新时间不是到达时间')
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await expect(detail.getByRole('alert')).toContainText('位置快照仍可阅读')
    await page.evaluate(() => { (window as unknown as { __locationAssetFail: boolean }).__locationAssetFail = false })
    await detail.getByRole('button', { name: '重试注册关联', exact: true }).click()
    await expect(detail.getByRole('alert')).toHaveCount(0)
    await expect(detail.getByRole('button', { name: /人物资料来源|另一人物世界/ })).toHaveCount(0)
    await detail.getByRole('button', { name: '查看注册定义 · 真实世界来源', exact: true }).click()
    await expect(panel.getByRole('article', { name: '资产详情' })).toContainText('真实世界定义')
    await nav.getByRole('button', { name: '当前位置', exact: true }).click()
    await toggle.click()
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await page.evaluate(() => { (window as unknown as { __locationMode: string }).__locationMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(location.getByRole('alert')).toContainText('保留上次位置快照')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __locationMode: string }).__locationMode = 'fallback' })
    await location.getByRole('button', { name: '重试', exact: true }).click()
    await expect(location.locator('.debug-location-warning')).toContainText('保存值与运行时解析快照存在差异')
    await expect(detail.locator('pre')).toContainText('旧结构地点')
    await expect(detail).not.toContainText('1970')
    await page.evaluate(() => { (window as unknown as { __locationMode: string }).__locationMode = 'unset' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(location.locator('.debug-location-meta').first()).toHaveText('位置细节未记录')
    await page.evaluate(() => { (window as unknown as { __locationMode: string }).__locationMode = 'long' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(detail.locator('pre')).toContainText('完整保存细节。'.repeat(400))
    expect((await location.locator('.debug-location-body').innerText()).length).toBeLessThanOrEqual(80)
    for (const scale of ['sm', 'lg']) {
      await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
      expect(await location.locator('.debug-location-place').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-font-scale', 'md'))
    await page.screenshot({ path: info.outputPath('location-production-source.png') })
    for (const [label, destination] of [['查看家居资料', 'residence'], ['查看足迹记录', 'footprints']] as const) {
      await detail.getByRole('button', { name: label, exact: true }).click()
      await expect(panel.getByTestId(`debug-evidence-${destination}`)).toContainText('此范围没有记录')
      await nav.getByRole('button', { name: '当前位置', exact: true }).click()
      await toggle.click()
    }
    await location.getByRole('combobox').selectOption('yu')
    await expect(location).toContainText('未补造默认地点')
    await expect(location.locator('.debug-location-summary')).toHaveCount(0)
  })
}

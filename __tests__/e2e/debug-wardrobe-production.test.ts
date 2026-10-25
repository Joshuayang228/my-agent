import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式衣柜槽位与状态 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __wardrobeMode: string; __wardrobeQueries: Array<{ view: string; cursor?: string; recordId?: string }> }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__wardrobeMode = 'fail'; state.__wardrobeQueries = []
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; cursor?: string; recordId?: string }) => {
          state.__wardrobeQueries.push(query)
          if (state.__wardrobeMode === 'fail') throw new Error('wardrobe contract failure')
          const at = Date.parse('2026-10-26T06:00:00Z')
          const record = (id: string, title: string, payload: Record<string, unknown>) => ({ id, roleId: query.roleId, kind: 'wardrobe', title, body: '', source: 'companion_assets', time: null, status: '', truncated: state.__wardrobeMode === 'truncated', links: id === 'coat' ? [{ view: 'recent', id: 'event-real', label: '来源生活事件' }] : [], data: { payload, acquired_at: state.__wardrobeMode === 'undated' ? 0 : at } })
          const slots = { top: state.__wardrobeMode === 'unread' ? 'unread-shirt' : state.__wardrobeMode === 'mismatch' ? 'coat' : state.__wardrobeMode === 'trimmed' ? ' shirt ' : 'shirt', bottom: 'pants', shoes: 'shoes', outerwear: 'coat' }
          const rows = [record('coat', '旅行外套', { recordType: state.__wardrobeMode === 'unknown' ? 'future-kind' : 'garment', category: 'outerwear', description: state.__wardrobeMode === 'long' ? '衣物长描述。'.repeat(220) : '外套描述', outfitVersion: 99 }), record('shirt', '浅色衬衫', { category: 'top', description: '旧单件描述' }), record('outfit', '出行套装', { recordType: 'outfit', slots: state.__wardrobeMode === 'invalid' ? {} : slots, outfitVersion: 2 }), record('state', '当前穿搭', { recordType: 'wear-state', slots: { top: 'shirt' }, outfitVersion: state.__wardrobeMode === 'version' ? 1.5 : 2 }), record('pants', '长裤', { recordType: 'garment', category: 'bottom' }), record('shoes', '步行鞋', { recordType: 'garment', category: 'shoes' }), record('unknown', '旧类型衣柜记录', { recordType: 'legacy', savedValue: '未知字段原文' })]
          if (state.__wardrobeMode === 'conflict') rows.push(record('state-conflict', '另一条穿搭状态', { recordType: 'wear-state', slots: { top: 'shirt' } }))
          const records = query.roleId === 'yu' ? [] : query.view === 'recent' ? [{ ...record('event-real', '来源事件', {}), source: 'companion_events', kind: 'reading', body: '来源事件正文', links: [{ view: 'wardrobe', id: 'missing', label: '查看缺失衣物' }], data: { scheduled_at: at } }] : query.view !== 'wardrobe' ? [] : query.recordId ? rows.filter(row => row.id === query.recordId) : query.cursor ? rows.slice(2) : rows.slice(0, 2)
          const hasMore = query.view === 'wardrobe' && query.roleId === 'lin' && !query.recordId && !query.cursor
          return { ...query, state: 'ready', source: 'companion_assets', timezone: 'Asia/Shanghai', total: null, generatedAt: Date.now(), records, hasMore, nextCursor: hasMore ? 'next' : undefined, issues: [], boundary: '只读衣柜，不推断当前穿着' }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel'), nav = panel.getByRole('navigation')
    await nav.getByRole('button', { name: '衣柜', exact: true }).click()
    const wardrobe = panel.getByTestId('debug-evidence-wardrobe'), detail = wardrobe.getByRole('article', { name: '领域证据详情' }), search = wardrobe.getByRole('textbox', { name: '搜索当前页证据' })
    const outfit = wardrobe.getByRole('button', { name: '出行套装', exact: true }), coat = wardrobe.getByRole('button', { name: '旅行外套', exact: true })
    await expect(wardrobe.getByRole('alert')).toContainText('读取失败')
    await expect(wardrobe.locator('.debug-wardrobe-range')).toHaveCount(0)
    await expect(search).toBeDisabled()
    await page.evaluate(() => { (window as unknown as { __wardrobeMode: string }).__wardrobeMode = 'ready' })
    await wardrobe.getByRole('button', { name: '重试', exact: true }).click()
    await expect(wardrobe).toContainText('未包含穿搭状态')
    await expect(wardrobe.locator('[data-record-id="coat"]')).not.toContainText('版本')
    await search.fill('出行套装')
    await expect(wardrobe).toContainText('没有匹配的衣柜资料')
    await wardrobe.getByRole('button', { name: '读取下一页', exact: true }).click()
    await expect(wardrobe.locator('.debug-wardrobe-range')).toHaveText('1 项匹配 · 7 项已读记录 · 总数未知')
    await outfit.click()
    await expect(detail.locator('.debug-wardrobe-slots > div')).toHaveCount(4)
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await expect(detail.locator('pre')).toContainText('shirt')
    await page.evaluate(() => { (window as unknown as { __wardrobeMode: string }).__wardrobeMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(wardrobe.getByRole('alert')).toContainText('保留上次资产与已加载页')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __wardrobeMode: string }).__wardrobeMode = 'ready' })
    await wardrobe.getByRole('button', { name: '重试', exact: true }).click()
    await expect(wardrobe.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __wardrobeQueries: Array<{ cursor?: string }> }).__wardrobeQueries.slice(-2).map(query => query.cursor))).toEqual([undefined, 'next'])
    await expect(search).toHaveValue('出行套装')
    await expect(detail.locator('pre')).toBeVisible()
    await detail.locator('.debug-wardrobe-slots').getByRole('button', { name: '浅色衬衫', exact: true }).click()
    await expect(search).toHaveValue('')
    await expect(detail.getByRole('heading')).toHaveText('浅色衬衫')
    await expect(detail).toContainText('旧单件描述')
    await detail.getByRole('button', { name: '返回列表', exact: true }).click()
    await expect(wardrobe.getByRole('button', { name: '浅色衬衫', exact: true })).toBeFocused()
    await page.screenshot({ path: info.outputPath('wardrobe-production-list.png') })
    for (const mode of ['unread', 'mismatch', 'trimmed', 'invalid', 'conflict', 'unknown', 'undated', 'version', 'truncated', 'long']) {
      await page.evaluate(mode => { (window as unknown as { __wardrobeMode: string }).__wardrobeMode = mode }, mode)
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      if (['unread', 'mismatch', 'trimmed', 'invalid'].includes(mode)) {
        await outfit.click()
        if (mode === 'unread') await expect(detail).toContainText('unread-shirt · 未在当前已读范围')
        if (mode === 'mismatch') await expect(detail).toContainText('分类与槽位不匹配')
        if (mode === 'trimmed') { await expect(detail).toContainText('原始保存值不一致'); await expect(detail.locator('.debug-wardrobe-slots button')).toHaveCount(0) }
        if (mode === 'invalid') await expect(detail).toContainText('有效衣物槽位')
      }
      if (mode === 'conflict') { await expect(wardrobe).toContainText('不推断哪条生效'); await expect(wardrobe.locator('[data-wardrobe-group="wear-state"] [data-record-id]')).toHaveCount(2) }
      if (mode === 'unknown') await expect(wardrobe.locator('[data-wardrobe-group="unknown"] [data-record-id]')).toHaveCount(2)
      if (mode === 'undated') {
        await wardrobe.getByRole('button', { name: '当前穿搭', exact: true }).click()
        await detail.getByText('完整字段', { exact: true }).click()
        await expect(detail.locator('.debug-candidate-facts')).toContainText('收录时间未记录')
      }
      if (mode === 'version') await expect(wardrobe.locator('[data-record-id="state"]')).toContainText('版本字段无效')
      if (mode === 'truncated') { await coat.click(); await expect(detail).toContainText('记录存在截断') }
      if (mode === 'long') {
        await coat.click()
        await expect(detail.locator('.debug-wardrobe-body')).toHaveText('衣物长描述。'.repeat(220))
        for (const scale of ['sm', 'lg']) {
          await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
          expect(await detail.locator('.debug-wardrobe-body').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
          expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
        }
        await detail.getByRole('heading').scrollIntoViewIfNeeded()
        await page.screenshot({ path: info.outputPath('wardrobe-production-detail.png') })
      }
    }
    await detail.getByRole('button', { name: '来源生活事件', exact: true }).click()
    const event = panel.getByTestId('debug-evidence-recent').getByRole('article', { name: '领域证据详情' })
    await expect(event).toContainText('来源事件正文')
    await event.getByRole('button', { name: '查看缺失衣物', exact: true }).click()
    await expect(wardrobe).toContainText('未选择替代记录')
    await expect(detail).toHaveCount(0)
    await wardrobe.getByRole('button', { name: '返回当前领域列表', exact: true }).click()
    await wardrobe.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(wardrobe).toContainText('不推断没有衣物或当前未穿着')
    await expect(wardrobe.locator('[data-record-id]')).toHaveCount(0)
  })
}

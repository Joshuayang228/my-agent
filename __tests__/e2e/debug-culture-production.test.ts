import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式文化作品与笔记 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __cultureMode: string; __cultureQueries: Array<{ view: string; cursor?: string; recordId?: string }> }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__cultureMode = 'fail'; state.__cultureQueries = []
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; cursor?: string; recordId?: string }) => {
          state.__cultureQueries.push(query)
          if (state.__cultureMode === 'fail') throw new Error('culture contract failure')
          const at = Date.parse('2026-10-26T06:00:00Z')
          const book: Record<string, unknown> = { author: '作者', readingStatus: 'reading', currentPage: 20, totalPages: 100, summary: '已保存作品说明', readingNotes: [{ id: 'note-new', text: '笔记二：车票', occurredAt: at }, { id: 'note-old', text: '笔记一', createdAt: at - 86400000 }] }
          if (state.__cultureMode === 'empty') { book.readingNotes = []; book.note = '不应复活旧笔记' }
          if (state.__cultureMode === 'legacy') { delete book.readingNotes; book.note = '没有独立时间的旧笔记' }
          if (state.__cultureMode === 'invalid-notes') { book.readingNotes = [{ id: 'same', text: '一' }, { id: 'same', text: '二' }]; book.note = '不应替代坏数组' }
          if (state.__cultureMode === 'progress') book.currentPage = 200
          if (state.__cultureMode === 'missing-fields') { delete book.author; delete book.readingStatus; book.readingNotes = [{ id: 'undated', text: '缺时间笔记' }] }
          if (state.__cultureMode === 'long') { book.summary = '作品长说明。'.repeat(180); book.readingNotes = [{ id: 'long', text: '阅读笔记长文。'.repeat(180) }] }
          const record = (id: string, kind: string, title: string, payload: Record<string, unknown>) => ({ id, roleId: query.roleId, kind, title, body: '', source: 'companion_assets', time: null, status: '', truncated: state.__cultureMode === 'truncated', links: id === 'book' ? [{ view: 'recent', id: 'event-real', label: '来源生活事件' }] : [], data: { payload, acquired_at: at } })
          const rows = [record('book', 'bookshelf', '旅行笔记', book), record('film', 'culture', '旅途影像', { type: 'film', watchStatus: 'watching', director: '导演', detail: '观影感受' }), record('music', 'culture', '午后旋律', { type: 'music', listeningStatus: 'revisiting', artist: '音乐人', detail: '听感正文', visibility: state.__cultureMode === 'archived' ? 'archived' : 'active' }), record('photo', 'culture', '步道照片', { type: state.__cultureMode === 'unknown' ? 'future' : 'photography', workStatus: 'published', description: '作品说明', locationName: '保存地点标记' }), record('unknown', 'culture', '旧类型作品', { type: 'legacy', savedValue: '未知原文' })]
          const records = query.roleId === 'yu' ? [] : query.view === 'recent' ? [{ ...record('event-real', 'reading', '来源事件', {}), source: 'companion_events', body: '来源事件正文', links: [{ view: 'items', id: 'missing', label: '查看缺失作品' }], data: { scheduled_at: at } }] : query.view !== 'items' ? [] : query.recordId ? rows.filter(row => row.id === query.recordId) : query.cursor ? rows.slice(2) : rows.slice(0, 2)
          const hasMore = query.view === 'items' && query.roleId === 'lin' && !query.recordId && !query.cursor
          return { ...query, state: 'ready', source: 'companion_assets', timezone: 'Asia/Shanghai', total: null, generatedAt: Date.now(), records, hasMore, nextCursor: hasMore ? 'next' : undefined, issues: [], boundary: '只读作品和已保存笔记' }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel'), nav = panel.getByRole('navigation')
    await nav.getByRole('button', { name: '文化角', exact: true }).click()
    const culture = panel.getByTestId('debug-evidence-items'), detail = culture.getByRole('article', { name: '领域证据详情' }), search = culture.getByRole('textbox', { name: '搜索当前页证据' }), tabs = culture.getByRole('tablist', { name: '文化分类' })
    const book = culture.locator('[data-record-id="book"] button')
    await expect(culture.getByRole('alert')).toContainText('读取失败')
    await expect(culture.locator('.debug-culture-range')).toHaveCount(0)
    await expect(search).toBeDisabled()
    await page.evaluate(() => { (window as unknown as { __cultureMode: string }).__cultureMode = 'ready' })
    await culture.getByRole('button', { name: '重试', exact: true }).click()
    await expect(culture.locator('[data-record-id]')).toHaveCount(2)
    await book.click()
    await expect(detail.locator('[data-note-id]')).toHaveCount(2)
    await expect(detail.locator('[data-note-id="note-new"]')).toContainText('发生时间：2026/10/26 14:00')
    await expect(detail.locator('[data-note-id="note-old"]')).toContainText('创建时间：2026/10/25 14:00')
    await expect(detail.locator(':scope > .debug-culture-body')).toHaveText('已保存作品说明')
    await detail.getByRole('button', { name: '返回列表', exact: true }).click()
    await expect(book).toBeFocused()
    await tabs.getByRole('tab', { name: '音乐', exact: true }).click()
    await expect(culture).toContainText('没有匹配的文化资料')
    await culture.getByRole('button', { name: '读取下一页', exact: true }).click()
    await expect(culture.locator('.debug-culture-range')).toHaveText('1 项匹配 · 5 项已读作品 · 总数未知')
    await culture.getByRole('button', { name: '午后旋律', exact: true }).click()
    await expect(detail).toContainText('听感正文')
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await page.evaluate(() => { (window as unknown as { __cultureMode: string }).__cultureMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(culture.getByRole('alert')).toContainText('保留上次资产与已加载页')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __cultureMode: string }).__cultureMode = 'ready' })
    await culture.getByRole('button', { name: '重试', exact: true }).click()
    await expect(culture.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __cultureQueries: Array<{ cursor?: string }> }).__cultureQueries.slice(-2).map(query => query.cursor))).toEqual([undefined, 'next'])
    await expect(tabs.getByRole('tab', { name: '音乐', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(detail.locator('pre')).toBeVisible()
    await tabs.getByRole('tab', { name: '全部', exact: true }).click()
    await search.fill('车票')
    await expect(culture.locator('[data-record-id]')).toHaveCount(1)
    await search.fill('')
    await page.screenshot({ path: info.outputPath('culture-production-list.png') })
    for (const mode of ['empty', 'legacy', 'invalid-notes', 'progress', 'missing-fields', 'archived', 'unknown', 'truncated', 'long']) {
      await page.evaluate(mode => { (window as unknown as { __cultureMode: string }).__cultureMode = mode }, mode)
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      await book.click()
      if (mode === 'empty') { await expect(detail.locator('.debug-culture-notes')).toContainText('未回退旧笔记'); await expect(detail.locator('[data-note-id]')).toHaveCount(0) }
      if (mode === 'legacy') await expect(detail.locator('[data-note-id="book:note"]')).toContainText('笔记时间：未记录')
      if (mode === 'invalid-notes') { await expect(detail).toContainText('笔记结构无效'); await expect(detail.locator('[data-note-id]')).toHaveCount(0) }
      if (mode === 'progress') await expect(detail).toContainText('当前进度不能超过总量')
      if (mode === 'missing-fields') { await expect(culture.locator('[data-record-id="book"]')).toContainText('状态未记录'); await expect(detail.locator('[data-note-id="undated"]')).toContainText('笔记时间：未记录') }
      if (mode === 'archived') await expect(culture.locator('[data-record-id="music"]')).toContainText('已归档记录')
      if (mode === 'unknown') {
        await tabs.getByRole('tab', { name: '未识别', exact: true }).click()
        await expect(culture.locator('[data-record-id]')).toHaveCount(2)
        await tabs.getByRole('tab', { name: '全部', exact: true }).click()
      }
      if (mode === 'truncated') await expect(detail).toContainText('不能认定为完整作品与笔记')
      if (mode === 'long') {
        await expect(detail.locator(':scope > .debug-culture-body')).toHaveText('作品长说明。'.repeat(180))
        await expect(detail.locator('[data-note-id] .debug-culture-body')).toHaveText('阅读笔记长文。'.repeat(180))
        for (const scale of ['sm', 'lg']) {
          await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
          expect(await detail.locator(':scope > .debug-culture-body').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
          expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
        }
        await detail.getByRole('heading', { level: 3 }).scrollIntoViewIfNeeded()
        await page.screenshot({ path: info.outputPath('culture-production-detail.png') })
      }
    }
    await detail.getByRole('button', { name: '来源生活事件', exact: true }).click()
    const event = panel.getByTestId('debug-evidence-recent').getByRole('article', { name: '领域证据详情' })
    await expect(event).toContainText('来源事件正文')
    await event.getByRole('button', { name: '查看缺失作品', exact: true }).click()
    await expect(culture).toContainText('未选择替代记录')
    await expect(detail).toHaveCount(0)
    await culture.getByRole('button', { name: '返回当前领域列表', exact: true }).click()
    await culture.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(culture).toContainText('不推断没有兴趣或从未体验')
    await expect(culture.locator('[data-record-id]')).toHaveCount(0)
  })
}

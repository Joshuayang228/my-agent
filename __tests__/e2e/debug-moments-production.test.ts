import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式朋友圈正文与互动 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __momentMode: string; __momentQueries: Array<{ view: string; date?: string; cursor?: string; recordId?: string }> }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__momentMode = 'fail'; state.__momentQueries = []
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; cursor?: string; recordId?: string; date?: string }) => {
          state.__momentQueries.push(query)
          if (state.__momentMode === 'fail') throw new Error('moment contract failure')
          const at = Date.parse('2026-10-25T06:00:00Z')
          const record = (id: string, data: Record<string, unknown>) => ({ id, roleId: query.roleId, source: 'companion_moments', kind: 'moment', data, body: '', title: '事件标题不当作发布正文', status: '', time: null, truncated: state.__momentMode === 'truncated', links: id === 'first' ? [{ view: 'recent', id: 'event-real', label: '来源生活事件' }] : [] })
          let rows = [record('first', { text: state.__momentMode === 'empty' ? '' : state.__momentMode === 'long' ? '动态长文内容。'.repeat(200) : '第一条已保存动态', published_at: state.__momentMode === 'undated' ? 0 : at, meta: { location: '河边', interactions: [{ kind: 'coframe', castName: '予' }, { kind: 'comment', castName: '予', text: '卡司评论' }, null] }, userInteractions: state.__momentMode === 'bad' ? [null, { actor_id: 'user', kind: 'unexpected', created_at: 0, text: '未知互动原文' }] : [{ actor_id: 'user', kind: 'like', created_at: at, text: null }, { actor_id: 'user', kind: 'comment', created_at: at, text: '用户评论正文' }] }), record('second', { text: '第二条动态', published_at: at - 86400000, meta: {}, userInteractions: [] }), record('third', { text: '旧车票笔记', published_at: at - 2 * 86400000, meta: {} })]
          if (state.__momentMode === 'partial') rows = rows.slice(1)
          if (query.date) rows = rows.filter(row => typeof row.data.published_at === 'number' && new Date(row.data.published_at).toISOString().slice(0, 10) === query.date)
          const records = query.roleId === 'yu' ? [] : query.view === 'recent' ? [{ ...record('event-real', { scheduled_at: at }), source: 'companion_events', kind: 'reading', body: '来源事件正文', links: [{ view: 'moments', id: 'missing', label: '查看缺失动态' }] }] : query.view !== 'moments' ? [] : query.recordId ? rows.filter(row => row.id === query.recordId) : query.cursor ? rows.slice(1) : rows.slice(0, 1)
          const hasMore = query.view === 'moments' && query.roleId === 'lin' && !query.cursor && !query.recordId && rows.length > 1
          return { ...query, records, state: 'ready', timezone: 'Asia/Shanghai', source: 'companion_moments', total: null, generatedAt: Date.now(), hasMore, nextCursor: hasMore ? 'next' : undefined, issues: state.__momentMode === 'partial' ? ['一条动态格式损坏'] : [], boundary: '只读发布资料' }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel'), nav = panel.getByRole('navigation')
    await nav.getByRole('button', { name: '朋友圈', exact: true }).click()
    const moments = panel.getByTestId('debug-evidence-moments'), detail = moments.getByRole('article', { name: '领域证据详情' }), search = moments.getByRole('textbox', { name: '搜索当前页证据' }), date = moments.getByLabel('动态发布日', { exact: true })
    await expect(moments.getByRole('alert')).toContainText('读取失败')
    await expect(moments.locator('.debug-moments-range')).toHaveCount(0)
    await expect(search).toBeDisabled()
    await page.evaluate(() => { (window as unknown as { __momentMode: string }).__momentMode = 'ready' })
    await moments.getByRole('button', { name: '重试', exact: true }).click()
    await expect(moments.locator('.debug-moments-range')).toHaveText('1 项已读动态 · 总数未知')
    await expect(moments).not.toContainText('卡司评论')
    await search.fill('车票')
    await expect(moments).toContainText('没有匹配的动态')
    await moments.getByRole('button', { name: '读取下一页动态', exact: true }).click()
    await expect(moments.locator('.debug-moments-range')).toHaveText('1 项匹配 · 3 项已读动态 · 总数未知')
    await moments.locator('[data-record-id="third"] button').click()
    await detail.getByText('互动记录', { exact: true }).click()
    await expect(detail).toContainText('本次查询未提供用户互动，数量未知')
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await page.evaluate(() => { (window as unknown as { __momentMode: string }).__momentMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(moments.getByRole('alert')).toContainText('保留原人物、发布日、筛选和已加载记录')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __momentMode: string }).__momentMode = 'ready' })
    await moments.getByRole('button', { name: '重试', exact: true }).click()
    await expect(moments.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __momentQueries: Array<{ cursor?: string }> }).__momentQueries.slice(-2).map(query => query.cursor))).toEqual([undefined, 'next'])
    await expect(search).toHaveValue('车票')
    await expect(detail.locator('pre')).toBeVisible()
    await detail.getByRole('button', { name: '返回列表', exact: true }).click()
    await expect(moments.locator('[data-record-id="third"] button')).toBeFocused()
    await search.fill('')
    await page.screenshot({ path: info.outputPath('moments-production-list.png') })
    await moments.locator('[data-record-id="second"] button').click()
    await detail.getByText('互动记录', { exact: true }).click()
    await expect(detail).toContainText('本次已读范围没有用户互动')
    await moments.locator('[data-record-id="first"] button').click()
    await detail.getByText('互动记录', { exact: true }).click()
    for (const text of ['予 · 同框记录', '卡司评论', '我 · 点赞', '用户评论正文', '部分卡司互动无法识别']) await expect(detail).toContainText(text)
    await detail.getByRole('button', { name: '来源生活事件', exact: true }).click()
    const event = panel.getByTestId('debug-evidence-recent').getByRole('article', { name: '领域证据详情' })
    await expect(event).toContainText('来源事件正文')
    await event.getByRole('button', { name: '查看缺失动态', exact: true }).click()
    await expect(moments).toContainText('未选择替代记录')
    await expect(detail).toHaveCount(0)
    await moments.getByRole('button', { name: '返回当前领域列表', exact: true }).click()
    await date.fill('2026-10-24')
    await expect(moments.locator('[data-record-id="second"]')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __momentQueries: Array<{ date?: string }> }).__momentQueries.at(-1)?.date)).toBe('2026-10-24')
    await date.fill('')
    for (const mode of ['empty', 'undated', 'bad', 'truncated', 'partial', 'long']) {
      await page.evaluate(mode => { (window as unknown as { __momentMode: string }).__momentMode = mode }, mode)
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      if (mode === 'partial') { await expect(moments).toContainText('条数仅含已读可用记录'); continue }
      await moments.locator('[data-record-id="first"] button').click()
      if (mode === 'empty') await expect(detail).toContainText('未补事件文案')
      if (mode === 'undated') await expect(detail).toContainText('发布：未记录')
      if (mode === 'bad') {
        await detail.getByText('互动记录', { exact: true }).click()
        await expect(detail).toContainText('部分用户互动格式异常')
        await expect(detail).toContainText('未识别的互动')
        await expect(detail).toContainText('未知互动原文')
      }
      if (mode === 'truncated') await expect(detail).toContainText('互动总数未知')
      if (mode === 'long') {
        await expect(detail.locator(':scope > .debug-moments-body')).toHaveText('动态长文内容。'.repeat(200))
        expect((await moments.locator('[data-record-id="first"] button').innerText()).length).toBe(141)
        for (const scale of ['sm', 'lg']) {
          await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
          expect(await detail.locator(':scope > .debug-moments-body').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
          expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
        }
        await page.screenshot({ path: info.outputPath('moments-production-detail.png') })
      }
    }
    await moments.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(detail).toHaveCount(0)
    await expect(moments).toContainText('不据此推断人物从未发布')
  })
}

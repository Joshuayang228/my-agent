import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式用户记忆阅读 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __memoryMode: string; __memoryQueries: Array<{ cursor?: string; recordId?: string }> }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }; state.__memoryMode = 'fail'; state.__memoryQueries = []
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; cursor?: string; recordId?: string }) => {
          state.__memoryQueries.push(query)
          if (state.__memoryMode === 'fail') throw new Error('memory contract failure')
          const rows = [['shared', '', 'preference', '共享表达偏好'], ['own', query.roleId, 'feedback', '当前人物反馈'], ['identity', '', 'identity', '共享身份来源'], ['unknown', query.roleId, 'constructor', '未知类别原文']].map(([id, roleId, kind, body]) => ({ id, roleId, kind, title: kind, body: id === 'own' && state.__memoryMode === 'long' ? '完整记忆正文。'.repeat(230) : id === 'own' && state.__memoryMode === 'empty-body' ? '' : body, source: 'memories', time: state.__memoryMode === 'unknown-time' ? null : Date.parse('2026-10-26T06:00:00Z'), status: '', truncated: state.__memoryMode === 'truncated', links: id === 'own' ? [{ view: 'profile', id: 'missing', label: '查看缺失画像来源' }] : [], data: { id, role_id: roleId, category: kind, content: body, extra: '原始附加字段' } }))
          const records = query.view !== 'memories' || state.__memoryMode === 'empty' || query.recordId === 'missing' ? [] : query.recordId ? rows.filter(row => row.id === query.recordId) : query.roleId === 'yu' ? rows.slice(0, 2) : query.cursor ? rows.slice(2) : rows.slice(0, 2)
          const hasMore = query.view === 'memories' && records.length > 0 && query.roleId === 'lin' && !query.cursor && !query.recordId
          return { ...query, state: state.__memoryMode === 'unavailable' ? 'unavailable' : 'ready', source: 'memories', timezone: 'Asia/Shanghai', total: null, generatedAt: Date.now(), records, hasMore, nextCursor: hasMore ? 'next' : undefined, issues: state.__memoryMode === 'partial' ? ['部分记忆未返回'] : [], boundary: '只读人物与显式共享记忆' }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel'), nav = panel.getByRole('navigation')
    await nav.getByRole('button', { name: '用户记忆', exact: true }).click()
    const memory = panel.getByTestId('debug-evidence-memories'), detail = memory.getByRole('article', { name: '记忆详情' }), search = memory.getByRole('textbox', { name: '搜索记忆' }), category = memory.getByRole('combobox', { name: '记忆类别' })
    const own = memory.locator('[data-record-id="own"] button')
    await expect(memory.getByRole('alert')).toContainText('读取失败')
    await expect(search).toBeDisabled()
    await expect(memory).not.toContainText('条当前已读记忆')
    await page.evaluate(() => { (window as unknown as { __memoryMode: string }).__memoryMode = 'ready' })
    await memory.getByRole('button', { name: '重试', exact: true }).click()
    await expect(memory.locator('[data-record-id]')).toHaveCount(2)
    for (const label of await memory.locator('.debug-memory-toolbar label').all()) expect(await label.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node.firstChild!); return range.getClientRects().length })).toBe(1)
    await category.selectOption('workflow')
    await expect(memory.locator('[data-record-id]')).toHaveCount(1)
    await own.click()
    await detail.getByText('来源与完整结构', { exact: true }).click()
    await expect(detail.locator('pre')).toContainText('原始附加字段')
    await memory.getByRole('button', { name: '读取下一页记忆', exact: true }).click()
    await expect(memory).toContainText('1 项匹配 · 4 条当前已读记忆')
    await page.evaluate(() => { (window as unknown as { __memoryMode: string }).__memoryMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(memory.getByRole('alert')).toContainText('保留原范围')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __memoryMode: string }).__memoryMode = 'ready' })
    await memory.getByRole('button', { name: '重试', exact: true }).click()
    await expect(memory.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __memoryQueries: Array<{ cursor?: string }> }).__memoryQueries.slice(-2).map(query => query.cursor))).toEqual([undefined, 'next'])
    await expect(category).toHaveValue('workflow')
    await expect(detail.locator('pre')).toBeVisible()
    await detail.getByRole('button', { name: '返回记忆列表', exact: true }).click()
    await expect(own).toBeFocused()
    await category.selectOption('all')
    await expect(memory.getByRole('heading', { name: '其他类别', exact: true })).toBeVisible()
    await memory.locator('[data-record-id="unknown"] button').click()
    await expect(detail.getByRole('heading', { name: 'constructor', exact: true })).toBeVisible()
    await detail.getByRole('button', { name: '返回记忆列表', exact: true }).click()
    await search.fill('无匹配内容')
    await expect(memory).toContainText('没有匹配的记忆')
    await search.fill('')
    await page.screenshot({ path: info.outputPath('memory-production-list.png') })
    await own.click()
    for (const mode of ['unknown-time', 'empty-body', 'truncated', 'partial', 'long']) {
      await page.evaluate(mode => { (window as unknown as { __memoryMode: string }).__memoryMode = mode }, mode)
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      if (mode === 'unknown-time') await expect(detail).toContainText('更新时间未记录')
      if (mode === 'empty-body') await expect(detail.locator('.debug-memory-body')).toHaveText('已读记录未返回正文')
      if (mode === 'truncated') await expect(detail).toContainText('返回内容有截断')
      if (mode === 'partial') await expect(memory).toContainText('部分记忆未返回')
      if (mode === 'long') {
        await expect(detail.locator('.debug-memory-body')).toHaveText('完整记忆正文。'.repeat(230))
        expect((await own.innerText()).length).toBeLessThan(200)
        for (const scale of ['sm', 'lg']) {
          await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
          expect(await detail.locator('.debug-memory-body').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
          expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
        }
        await detail.evaluate(node => node.scrollIntoView({ block: 'start' }))
        await page.screenshot({ path: info.outputPath('memory-production-detail.png') })
      }
    }
    await detail.getByRole('button', { name: '查看缺失画像来源', exact: true }).click()
    const profile = panel.getByTestId('debug-evidence-profile')
    await expect(profile).toContainText('未选择其他记忆代替')
    await nav.getByRole('button', { name: '用户记忆', exact: true }).click()
    await memory.getByRole('combobox', { name: '记忆人物范围' }).selectOption('yu')
    await expect(memory.locator('[data-record-id="shared"]')).toBeVisible()
    await expect(memory.locator('[data-record-id="identity"]')).toHaveCount(0)
    await page.evaluate(() => { (window as unknown as { __memoryMode: string }).__memoryMode = 'empty' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(memory).toContainText('不代表系统没有长期记忆')
    await page.evaluate(() => { (window as unknown as { __memoryMode: string }).__memoryMode = 'unavailable' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(memory).toContainText('诊断源暂不可用')
    await expect(memory.locator('[data-record-id]')).toHaveCount(0)
  })
}

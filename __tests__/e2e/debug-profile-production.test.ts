import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式画像来源阅读 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __profileMode: string; __profileQueries: Array<{ view: string; cursor?: string; recordId?: string }> }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }; state.__profileMode = 'fail'; state.__profileQueries = []
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; cursor?: string; recordId?: string }) => {
          state.__profileQueries.push(query)
          if (state.__profileMode === 'fail') throw new Error('profile contract failure')
          const row = (id: string, roleId: string, kind: string, body: string) => ({ id, roleId, kind, body, title: kind, source: 'memories', time: state.__profileMode === 'unknown-time' ? null : Date.parse('2026-10-26T06:00:00Z'), status: '', truncated: state.__profileMode === 'truncated', links: [], data: { id, role_id: roleId, category: kind, content: body } })
          const rows = [row('shared', '', 'identity', '明确身份来源'), row('own', query.roleId, 'feedback', state.__profileMode === 'long' ? '完整协作来源。'.repeat(220) : '明确协作来源'), row('foreign', 'zhou', 'voice', '其他保存桶的全局表达来源'), row('other', '', 'event', '其他类别已读原文')]
          const records = query.recordId === 'missing' || query.roleId === 'yu' ? [] : query.view === 'memories' ? rows.filter(row => row.id === query.recordId && (row.roleId === '' || row.roleId === query.roleId)) : query.recordId ? rows.filter(row => row.id === query.recordId) : query.cursor ? rows.slice(2) : rows.slice(0, 2)
          if (query.view === 'memories' && records[0]) Object.assign(records[0], { links: [{ view: 'profile', id: 'missing', label: '查看缺失画像来源' }] })
          return { ...query, state: 'ready', source: 'memories', timezone: 'Asia/Shanghai', total: null, generatedAt: Date.now(), records, hasMore: query.view === 'profile' && records.length > 0 && !query.cursor && !query.recordId, nextCursor: query.view === 'profile' && records.length > 0 && !query.cursor && !query.recordId ? 'next' : undefined, issues: state.__profileMode === 'partial' ? ['部分来源未返回'] : [], boundary: '有界画像来源；不证明实际注入。' }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    await panel.getByRole('navigation').getByRole('button', { name: '用户画像', exact: true }).click()
    const profile = panel.getByTestId('debug-evidence-profile'), detail = profile.getByRole('article', { name: '画像来源详情' })
    await expect(profile.getByRole('alert')).toContainText('读取失败')
    await expect(profile.getByRole('heading', { name: '身份', exact: true })).toHaveCount(0)
    await expect(profile.getByText('查询范围与其他入口', { exact: true })).toHaveCount(0)
    await page.evaluate(() => { (window as unknown as { __profileMode: string }).__profileMode = 'ready' })
    await profile.getByRole('button', { name: '重试', exact: true }).click()
    await expect(profile.locator('[data-record-id]')).toHaveCount(2)
    expect(await profile.locator('.debug-profile-toolbar label').evaluate(node => { const range = document.createRange(); range.selectNodeContents(node.firstChild!); return range.getClientRects().length })).toBe(1)
    for (const name of ['身份', '协作方式', '表达偏好']) await expect(profile.getByRole('heading', { name, exact: true })).toBeVisible()
    await profile.getByRole('button', { name: '读取下一页来源', exact: true }).click()
    await expect(profile.locator('[data-record-id]')).toHaveCount(4)
    await expect(profile.locator('[data-record-id="other"] button')).toBeHidden()
    await profile.locator('[data-record-id="foreign"] button').click()
    await expect(detail).toContainText('全局查询 · 保存桶 zhou')
    await expect(detail.getByRole('button', { name: '查看这条来源记忆', exact: true })).toHaveCount(0)
    await detail.getByRole('button', { name: '返回摘要', exact: true }).click()
    await expect(profile.locator('[data-record-id="foreign"] button')).toBeFocused()
    await page.screenshot({ path: info.outputPath('profile-production-summary.png') })
    await profile.getByText('其他类别来源 · 1 条已读记录', { exact: true }).click()
    await profile.locator('[data-record-id="other"] button').click()
    await expect(detail).toContainText('其他类别已读原文')
    await profile.locator('[data-record-id="own"] button').click()
    await detail.getByText('来源与完整记录', { exact: true }).click()
    await page.evaluate(() => { (window as unknown as { __profileMode: string }).__profileMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(profile.getByRole('alert')).toContainText('保留原人物')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __profileMode: string }).__profileMode = 'ready' })
    await profile.getByRole('button', { name: '重试', exact: true }).click()
    await expect(profile.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __profileQueries: Array<{ cursor?: string }> }).__profileQueries.slice(-2).map(query => query.cursor))).toEqual([undefined, 'next'])
    await expect(detail.locator('pre')).toBeVisible()
    for (const mode of ['unknown-time', 'truncated', 'partial', 'long']) {
      await page.evaluate(mode => { (window as unknown as { __profileMode: string }).__profileMode = mode }, mode)
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      if (mode === 'unknown-time') await expect(detail).toContainText('未记录')
      if (mode === 'truncated') await expect(detail).toContainText('返回内容有截断')
      if (mode === 'partial') await expect(profile).toContainText('部分来源未返回')
      if (mode === 'long') {
        await expect(detail.locator('.debug-profile-body')).toHaveText('完整协作来源。'.repeat(220))
        expect((await profile.locator('[data-record-id="own"] button').innerText()).length).toBeLessThan(180)
        for (const scale of ['sm', 'lg']) {
          await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
          expect(await detail.locator('.debug-profile-body').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
          expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
        }
        await detail.evaluate(node => node.scrollIntoView({ block: 'start' }))
        await page.screenshot({ path: info.outputPath('profile-production-detail.png') })
      }
    }
    await detail.getByRole('button', { name: '查看这条来源记忆', exact: true }).click()
    const memory = panel.getByTestId('debug-evidence-memories')
    await expect(memory).toContainText('完整协作来源。')
    await memory.getByRole('button', { name: '查看缺失画像来源', exact: true }).click()
    await expect(profile).toContainText('未选择其他记忆代替')
    await expect(detail).toHaveCount(0)
    await profile.getByRole('button', { name: '返回当前领域列表', exact: true }).click()
    await profile.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(profile).toContainText('不代表用户没有相关资料')
    await expect(profile.locator('[data-record-id]')).toHaveCount(0)
  })
}

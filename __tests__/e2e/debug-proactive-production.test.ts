import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式保存证据四页 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown>; companion: Record<string, unknown> }; __savedMode: string; __savedQueries: Record<string, unknown>[]; __savedEpoch: number; __late?: () => void }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug }, companion: { ...state.electronAPI?.companion } }
      state.__savedMode = 'fail'; state.__savedQueries = []; state.__savedEpoch = 1
      const querySaved = async (query: Record<string, unknown>, proactive = false) => {
        state.__savedQueries.push({ ...query, proactive })
        const mode = state.__savedMode
        if (mode === 'fail') throw new Error('fixture read failure')
        if (mode === 'pending') await new Promise<void>(resolve => { state.__late = resolve })
        const owner = String(query.roleId ?? 'lin')
        const cursor = `epoch-${state.__savedEpoch}`
        if (query.cursor && query.cursor !== cursor) throw new Error('stale cursor reused')
        const id = `${owner}-${query.cursor ? 'older' : 'newer'}`
        const row = proactive ? { id, roleId: owner, processRunId: 'run', localDay: '2026-10-26', status: 'presented', reason: 'ok', occurredAt: 1800000000000, updatedAt: 1800000001000, checks: 1, recipientCount: 1, sentCount: 1, failedCount: 0 } : { id, roleId: owner, processRunId: 'run', spanId: id, parentId: 'missing-parent', kind: query.kind, spanType: 'tool', caller: 'tool', occurredAt: 1800000000000, updatedAt: 1800000001000, status: 'ok', phase: 'ended', omittedFields: 0 }
        return { state: mode === 'unavailable' ? 'unavailable' : 'ready', records: mode === 'empty' || mode === 'unavailable' || query.recordId ? [] : [row], hasMore: !query.cursor && !query.recordId && mode !== 'empty' && mode !== 'unavailable', nextCursor: !query.cursor && !query.recordId ? cursor : undefined, boundary: '真实接口形状的隔离响应；最多七天，不含正文。', generatedAt: 1800000001000, coverage: { recordingSince: 1800000000000, retainedFrom: 1799999999000, processRunId: 'run', pending: 0, dropped: 0, pruned: 0, writeFailures: 0, invalidStored: 0, diskPending: false } }
      }
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'zhou', name: '周' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        historyQuery: (query: Record<string, unknown>) => querySaved(query),
        traces: async () => ({ spans: [], callerStats: {} }),
      })
      Object.assign(state.electronAPI.companion, { proactiveEvidenceQuery: (query: Record<string, unknown>) => querySaved(query, true) })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    for (const [label, view] of [['行为日志', 'activity'], ['主动消息证据', 'proactive'], ['调用链', 'traces'], ['实时事件', 'events']]) {
      await page.evaluate(() => { (window as unknown as { __savedMode: string }).__savedMode = 'fail' })
      await panel.getByRole('navigation').getByRole('button', { name: label, exact: true }).click()
      if (view === 'traces' || view === 'events') await panel.getByRole('button', { name: '查看保存历史', exact: true }).click()
      const body = panel.getByTestId(`saved-evidence-${view}`)
      await expect(body.getByRole('alert')).toContainText('尚未读到记录')
      await expect(body.locator('[data-record-id]')).toHaveCount(0)
      await page.evaluate(() => { (window as unknown as { __savedMode: string }).__savedMode = 'ready' })
      await body.getByRole('button', { name: '重试读取', exact: true }).click()
      await expect(body.locator('[data-record-id]')).toHaveCount(1)
      await body.locator('.debug-recent-title').first().click()
      const detail = body.getByRole('article', { name: '领域证据详情' })
      await expect(detail).toBeVisible()
      if (view === 'proactive') await expect(detail).toContainText('不证明用户看见或阅读')
      await detail.getByText(view === 'proactive' ? '投递依据与来源' : '关联与保存字段', { exact: true }).click()
      await expect(detail.locator('pre')).toContainText('lin-newer')
      await page.evaluate(() => { (window as unknown as { __savedMode: string }).__savedMode = 'fail' })
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      await expect(body.getByRole('alert')).toContainText('下方仍是刷新前的范围')
      await expect(detail.locator('pre')).toBeVisible()
      await page.evaluate(() => { (window as unknown as { __savedMode: string }).__savedMode = 'ready' })
      await body.getByRole('button', { name: '重试读取', exact: true }).click()
      await expect(body.getByRole('alert')).toHaveCount(0)
      await detail.getByRole('button', { name: '返回列表', exact: true }).click()
      await body.getByRole('button', { name: '读取更早记录', exact: true }).click()
      await expect(body.locator('[data-record-id]')).toHaveCount(2)
      await page.evaluate(() => { (window as unknown as { __savedEpoch: number }).__savedEpoch++ })
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      await expect.poll(() => page.evaluate(() => { const s = window as unknown as { __savedEpoch: number; __savedQueries: { cursor?: string }[] }; return s.__savedQueries.some(q => q.cursor === `epoch-${s.__savedEpoch}`) })).toBe(true)
      await expect(body.getByRole('alert')).toHaveCount(0)
      await expect(body.locator('[data-record-id]')).toHaveCount(2)
      if (view !== 'proactive') {
        await body.locator('.debug-recent-title').first().click()
        await detail.getByRole('button', { name: '查看父 Span', exact: true }).click()
        await expect(body).toContainText('指定记录不在当前已读范围')
        await expect(body.getByRole('article', { name: '领域证据详情' })).toHaveCount(0)
        await body.getByRole('button', { name: '返回上一记录范围', exact: true }).click()
        await expect(body.locator('[data-record-id]')).toHaveCount(2)
      }
      if (view === 'activity' || view === 'proactive') {
        await body.getByLabel('诊断人物', { exact: true }).selectOption('zhou')
        await expect(body.locator('[data-record-id="zhou-newer"]')).toBeVisible()
        await expect(body.locator('[data-record-id="lin-newer"]')).toHaveCount(0)
        await body.getByLabel('诊断人物', { exact: true }).selectOption('lin')
      }
      await page.evaluate(() => { (window as unknown as { __savedMode: string }).__savedMode = 'empty' })
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      await expect(body).toContainText(view === 'proactive' ? '此范围没有问候记录' : '此范围没有已保存记录')
      await expect(body.getByRole('button', { name: '读取更早记录', exact: true })).toHaveCount(0)
      await page.screenshot({ path: info.outputPath(`${view}-production-empty.png`) })
      for (const scale of ['sm', 'lg']) {
        await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
        expect(await panel.locator('main').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
      }
      await page.evaluate(() => document.documentElement.setAttribute('data-font-scale', 'md'))
    }
    const queries = await page.evaluate(() => (window as unknown as { __savedQueries: Record<string, unknown>[] }).__savedQueries)
    expect(queries.some(q => q.recordId === 'run:span:missing-parent')).toBe(true)
    expect(queries.some(q => q.kind === 'event')).toBe(true)
    expect(queries.some(q => q.roleId === 'zhou')).toBe(true)
  })
}

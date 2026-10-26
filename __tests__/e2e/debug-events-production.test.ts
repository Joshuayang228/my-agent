import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式事件接收摘要 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => {
      localStorage.setItem('theme', theme)
      const state = window as unknown as { electronAPI: Record<string, unknown>; __eventsTest: { started: boolean; emit: (event: Record<string, unknown>) => void; complete: () => void } }
      const noop = () => {}, listeners = new Set<(event: Record<string, unknown>) => void>()
      state.__eventsTest = { started: false, emit: () => {}, complete: () => {} }
      let sessionCount = 0
      state.electronAPI = {
        settings: { get: async () => ({ developerMode: 'true', llmApiKeyConfigured: 'true', llmConnectionReady: 'true', llmModel: 'isolated-test', executionMode: 'confirm-all', pinnedSessions: '[]' }), set: async () => ({ success: true }) },
        session: { list: async () => [], get: async () => null, create: async () => ({ id: `event-test-${++sessionCount}` }), onFileChange: () => noop, listFileChanges: async () => [] },
        companion: { getActive: async () => ({ id: 'lin', name: '测试伙伴', description: '隔离测试' }), listProtagonists: async () => [], getRoster: async () => ({ cast: [] }), getContacts: async () => ({ roleId: 'lin', people: [], relations: [], experiences: [] }), getAssets: async () => ({ roleId: 'lin', items: [] }), getMoments: async () => ({ roleId: 'lin', items: [] }), catchupStatus: async () => ({ roleId: 'lin', presence: '' }) },
        project: { get: async () => null, list: async () => [] },
        tasks: { sync: async () => ({ active: [], pendingNotify: [] }), onEvent: () => noop },
        chat: {
          onEvent: (listener: (event: Record<string, unknown>) => void) => { listeners.add(listener); return () => listeners.delete(listener) }, onConfirmRequest: () => noop,
          send: async (sessionId: string) => { state.__eventsTest.started = true; state.__eventsTest.emit = event => listeners.forEach(listener => listener({ ...event, sessionId })); await new Promise<void>(resolve => { state.__eventsTest.complete = () => { state.__eventsTest.emit({ type: 'done' }); resolve() } }) },
        },
        debug: { companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }], activeRoleId: 'lin', universeId: 'test', ready: true }), modelContextAssets: async () => [], traces: async () => ({ spans: [], callerStats: {} }) },
        mcp: {},
      }
    }, theme)
    const failures: string[] = []; page.on('pageerror', error => failures.push(error.message))
    await page.goto('/')
    await page.getByRole('textbox', { name: '消息', exact: true }).fill('隔离接收事件测试')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __eventsTest: { started: boolean } }).__eventsTest.started)).toBe(true)
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel'), nav = panel.getByRole('navigation'), events = panel.getByTestId('debug-evidence-events'), detail = events.getByRole('article', { name: '运行事件详情' }), rows = events.locator('[data-record-id]')
    await nav.getByRole('button', { name: '实时事件', exact: true }).click()
    await expect(events).toContainText('不代表运行时没有发生事件')
    await page.evaluate(() => {
      const state = (window as unknown as { __eventsTest: { emit: (event: Record<string, unknown>) => void } }).__eventsTest
      state.emit({ type: 'text', content: '文本片段。'.repeat(30) })
      state.emit({ type: 'error', message: '明确收到的错误摘要' })
      state.emit({ type: 'tool_end', callId: 'tool-id', name: '读取资料', isError: true, result: '未保存在摘要的完整工具输出' })
    })
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(2).getByRole('button')).toContainText('读取资料 → ERR')
    await expect(rows.first().locator('time')).toHaveText(/\d{2}:\d{2}:\d{2}/)
    expect.soft(await rows.first().getByRole('button').evaluate(node => getComputedStyle(node).justifyContent)).toBe('flex-start')
    expect.soft(await events.locator('.debug-events-toolbar label').evaluate(node => { const range = document.createRange(); range.selectNodeContents(node.firstChild!); return range.getClientRects().length })).toBe(1)
    await rows.nth(0).getByRole('button').click()
    await expect(detail.locator('.debug-events-body')).toHaveText('文本片段。'.repeat(30).slice(0, 80))
    await expect(detail).toContainText('窗口内标识（本次浏览）')
    await expect(detail).toContainText('未关联')
    await expect(detail.getByRole('button', { name: /查看调用链/ })).toHaveCount(0)
    await detail.getByRole('button', { name: '返回事件', exact: true }).click()
    await expect(rows.nth(0).getByRole('button')).toBeFocused()
    await events.getByRole('combobox', { name: '事件状态筛选' }).selectOption('失败')
    await expect(rows).toHaveCount(1)
    await rows.getByRole('button').click()
    await expect(detail.locator('.debug-events-body')).toHaveText('明确收到的错误摘要')
    await detail.getByText('已保存记录', { exact: true }).click()
    expect(await detail.locator('pre').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(11 / 15, 3)
    const selectedId = await rows.getAttribute('data-record-id')
    await page.evaluate(() => (window as unknown as { __eventsTest: { emit: (event: Record<string, unknown>) => void } }).__eventsTest.emit({ type: 'usage', promptTokens: 1, completionTokens: 2 }))
    await expect(events).toContainText('4 条缓存')
    await expect(detail.locator('pre')).toContainText('明确收到的错误摘要')
    expect(await rows.getAttribute('data-record-id')).toBe(selectedId)
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(detail.locator('pre')).toBeVisible()
    await expect(events.getByRole('combobox', { name: '事件状态筛选' })).toHaveValue('失败')
    await events.getByRole('combobox', { name: '事件状态筛选' }).selectOption('all')
    await page.screenshot({ path: info.outputPath('events-production-list.png') })
    await page.evaluate(() => (window as unknown as { __eventsTest: { emit: (event: Record<string, unknown>) => void } }).__eventsTest.emit({ type: 'error', message: '完整错误摘要。'.repeat(180) }))
    await rows.last().getByRole('button').click()
    await expect(detail.locator('.debug-events-body')).toHaveText('完整错误摘要。'.repeat(180))
    for (const scale of ['sm', 'lg']) {
      await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
      expect(await detail.locator('.debug-events-body').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await detail.evaluate(node => node.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: info.outputPath('events-production-detail.png') })
    await page.evaluate(() => {
      const state = (window as unknown as { __eventsTest: { emit: (event: Record<string, unknown>) => void } }).__eventsTest
      for (let index = 0; index < 510; index++) state.emit({ type: 'future_event', ignored: '不解析为正文' })
    })
    await expect(events).toContainText('501 条缓存')
    await expect(rows).toHaveCount(501)
    await expect(events).toContainText('未选择其他事件代替')
    await expect(detail).toHaveCount(0)
    await rows.last().getByRole('button').click()
    await expect(detail).toContainText('已保存摘要为空')
    await events.getByText('来源与诊断边界', { exact: true }).click()
    await expect(events).toContainText('前 80 字符')
    await events.getByRole('button', { name: '浏览当前调用链', exact: true }).click()
    await expect(panel.getByTestId('debug-evidence-traces')).toContainText('不代表运行时没有调用')
    await nav.getByRole('button', { name: '实时事件', exact: true }).click()
    await expect(rows).toHaveCount(501)
    await page.evaluate(() => (window as unknown as { __eventsTest: { complete: () => void } }).__eventsTest.complete())
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click()
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '新对话', exact: true }).click()
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    await nav.getByRole('button', { name: '实时事件', exact: true }).click()
    await expect(events).toContainText('0 条缓存')
    await expect(rows).toHaveCount(0)
    expect(failures).toEqual([])
  })
}

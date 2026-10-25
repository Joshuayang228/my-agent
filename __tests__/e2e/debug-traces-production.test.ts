import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式调用链阅读 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __traceMode: string; __traceRequests: string[] }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }; state.__traceMode = 'fail'; state.__traceRequests = []
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        traces: async () => {
          if (state.__traceMode === 'fail') throw new Error('trace contract failure')
          const span = (id: string, type: string, parentId?: string) => ({ id, name: id === 'root' ? '主交互' : id === 'llm' ? '模型请求' : id, type, caller: 'main', parentId, startTime: Date.parse('2026-10-26T06:00:00Z'), duration: 12, status: 'ok', attributes: { assetKeys: ['missing-asset'], note: '完整保存属性' }, links: id === 'background' ? ['root'] : undefined })
          let spans = [span('root', 'interaction'), span('llm', 'llm_request', 'root'), span('tool', 'tool', 'llm'), span('background', 'subagent')]
          if (state.__traceMode === 'orphan') spans[2].parentId = 'missing-parent'
          if (state.__traceMode === 'cycle') { spans[0].parentId = 'llm'; spans[1].parentId = 'root' }
          if (state.__traceMode === 'unknown') spans[2].type = 'future_'.repeat(60)
          if (state.__traceMode === 'long') { spans[1].name = '长名称与依据。'.repeat(80); spans[1].attributes.note = 'longAttribute'.repeat(160) }
          if (state.__traceMode === 'truncated') Object.assign(spans[1].attributes, { truncated: true })
          if (state.__traceMode === 'timing') { delete (spans[1] as { duration?: number }).duration; delete (spans[1] as { startTime?: number }).startTime; spans[1].status = 'running' }
          if (state.__traceMode === 'empty' || state.__traceMode === 'removed') spans = state.__traceMode === 'empty' ? [] : spans.filter(span => span.id !== 'llm')
          return { spans, callerStats: { main: { count: 6, totalMs: 120, avgMs: 20, totalInputTokens: 0, totalOutputTokens: 1 } }, ...(state.__traceMode === 'timing' ? {} : { dailyTokenUsage: 0, tokenLanes: { foreground: { inputTokens: 0, outputTokens: 1 }, background: { inputTokens: 0, outputTokens: 0 } } }) }
        },
        modelContextAssets: async () => [],
        llmLogsQuery: async () => ({ records: [], total: 0, storageBytes: 0 }),
        onLLMCallEvent: () => () => {},
        llmLogGet: async (id: string) => { state.__traceRequests.push(id); return null },
        assetUsageQuery: async () => ({ records: [], hasMore: false }),
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel'), nav = panel.getByRole('navigation'), traces = panel.getByTestId('debug-evidence-traces'), detail = traces.getByRole('article', { name: 'Span 详情' })
    await nav.getByRole('button', { name: '调用链', exact: true }).click()
    await expect(traces.getByRole('alert')).toContainText('读取失败')
    await expect(traces).not.toContainText('条已读 Span')
    await page.evaluate(() => { (window as unknown as { __traceMode: string }).__traceMode = 'ready' })
    await traces.getByRole('button', { name: '重试', exact: true }).click()
    await expect(traces.locator('[data-record-id]')).toHaveCount(4)
    await expect(traces.getByText('统计与使用量', { exact: true })).toBeVisible()
    await expect(traces.locator('.debug-trace-source pre').first()).toBeHidden()
    await traces.locator('[data-record-id="background"] button').click()
    await expect(detail).toContainText('关联 Span')
    await expect(detail).toContainText('root')
    await expect(detail.getByRole('button', { name: '查看请求记录', exact: true })).toHaveCount(0)
    await detail.getByRole('button', { name: '返回调用链', exact: true }).click()
    await expect(traces.locator('[data-record-id="background"] button')).toBeFocused()
    await page.screenshot({ path: info.outputPath('traces-production-tree.png') })
    await traces.locator('[data-record-id="llm"] button').click()
    await detail.getByText('属性与原始结构', { exact: true }).click()
    await expect(detail.locator('pre')).toContainText('完整保存属性')
    await page.evaluate(() => { (window as unknown as { __traceMode: string }).__traceMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(traces.getByRole('alert')).toContainText('保留原调用树')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __traceMode: string }).__traceMode = 'ready' })
    await traces.getByRole('button', { name: '重试', exact: true }).click()
    await expect(traces.getByRole('alert')).toHaveCount(0)
    await expect(detail.locator('pre')).toBeVisible()
    for (const mode of ['orphan', 'cycle', 'unknown', 'truncated', 'timing', 'long']) {
      await page.evaluate(mode => { (window as unknown as { __traceMode: string }).__traceMode = mode }, mode)
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      await expect(traces.locator('[data-record-id]')).toHaveCount(4)
      if (mode === 'orphan') await expect(traces).toContainText('父级未在当前返回范围')
      if (mode === 'cycle') await expect(traces).toContainText('循环父级引用')
      if (mode === 'unknown') await expect(traces).toContainText('未识别 Span 类型')
      if (mode === 'truncated') await expect(traces).toContainText('属性读取有界')
      if (mode === 'timing') { await expect(detail).toContainText('耗时未记录'); await traces.getByText('统计与使用量', { exact: true }).click(); await expect(traces).toContainText('未记录') }
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
      if (mode === 'long') {
        await expect(detail.locator('pre')).toContainText('longAttribute'.repeat(160))
        await traces.getByText('来源与诊断边界', { exact: true }).click()
        expect(await traces.locator(':scope > .debug-trace-source pre').last().evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(11 / 15, 3)
        expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
        for (const scale of ['sm', 'lg']) {
          await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
          expect(await detail.getByRole('heading', { level: 3 }).evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(15 / 15, 3)
          expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
        }
        await detail.evaluate(node => node.scrollIntoView({ block: 'start' }))
        await page.screenshot({ path: info.outputPath('traces-production-detail.png') })
      }
    }
    await detail.getByRole('button', { name: '查看资产 missing-asset', exact: true }).click()
    await expect(panel).toContainText('引用的资产未在目录中找到')
    await nav.getByRole('button', { name: '调用链', exact: true }).click()
    await traces.locator('[data-record-id="llm"] button').click()
    await detail.getByRole('button', { name: '查看请求记录', exact: true }).click()
    await expect(panel).toContainText('未选择其他调用代替')
    expect(await page.evaluate(() => (window as unknown as { __traceRequests: string[] }).__traceRequests)).toContain('llm')
    await nav.getByRole('button', { name: '调用链', exact: true }).click()
    await traces.locator('[data-record-id="llm"] button').click()
    await page.evaluate(() => { (window as unknown as { __traceMode: string }).__traceMode = 'removed' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(traces).toContainText('未选择其他 Span 代替')
    await expect(detail).toHaveCount(0)
    await page.evaluate(() => { (window as unknown as { __traceMode: string }).__traceMode = 'empty' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(traces).toContainText('不代表运行时没有调用')
  })
}

import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`日程呈现 v3 范围与失败 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 704 })
    await page.addInitScript(theme => { localStorage.setItem('theme', theme); localStorage.setItem('playground.active-tab', 'debug') }, theme)
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
    const panel = page.getByTestId('debug-candidate')
    await panel.getByRole('navigation').getByRole('button', { name: '今日日程', exact: true }).click()
    const schedule = panel.getByTestId('debug-evidence-schedule')
    const states = panel.getByRole('group', { name: 'Debug 样张状态' })
    const search = schedule.getByRole('textbox', { name: '搜索当前页证据' })
    const count = schedule.getByLabel('计划时段计数')
    const first = schedule.getByRole('button', { name: '09:00 · 整理旅行照片', exact: true })
    const chooseEdge = async (value: string) => {
      await states.getByText('更多样张', { exact: true }).click()
      await states.getByRole('combobox', { name: '日程边缘样张' }).selectOption(value)
      await states.getByText('更多样张', { exact: true }).click()
    }
    await expect(count).toHaveText('3 个计划时段')
    await expect(first.locator('time')).toHaveCSS('font-size', '14px')
    await expect(schedule.getByText('平静', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('schedule-v3-default.png') })
    await schedule.getByRole('combobox', { name: '诊断人物' }).selectOption('all')
    await expect(schedule.locator('.debug-schedule-row time')).toHaveText(['09:00', '11:00', '14:00', '19:00'])
    await schedule.getByRole('combobox', { name: '诊断人物' }).selectOption('lin')
    await search.fill('ASIA/SHANGHAI')
    await expect(count).toHaveText('3 个计划时段 · 当前筛选')
    await search.fill('旅行笔记')
    await expect(count).toContainText('1 个计划时段')
    const afternoon = schedule.getByRole('button', { name: '14:00 · 阅读旅行笔记', exact: true })
    await afternoon.click()
    const detail = schedule.getByRole('article', { name: '领域证据详情' })
    await expect(detail).toContainText('执行结果未记录')
    await states.getByRole('button', { name: '刷新失败', exact: true }).click()
    await expect(schedule.getByRole('alert')).toContainText('保留上次日程')
    await expect(search).toHaveValue('旅行笔记')
    await expect(detail).toBeVisible()
    await detail.getByRole('button', { name: '返回列表', exact: true }).click()
    await expect(afternoon).toBeFocused()
    await schedule.getByRole('button', { name: '重试读取样张', exact: true }).click()
    await search.fill('无匹配活动样张')
    await expect(schedule.getByRole('status')).toContainText('没有匹配的证据')
    await search.fill('')
    await schedule.getByRole('textbox', { name: '证据日期' }).fill('2026-10-12')
    await expect(schedule.getByRole('button', { name: '10:00 · 整理书架', exact: true })).toBeVisible()
    await schedule.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(schedule.getByRole('status')).toContainText('此范围没有记录')
    await schedule.getByRole('textbox', { name: '证据日期' }).fill('')
    await expect(schedule.getByRole('status')).toHaveText('请选择计划日期。')
    await expect(count).toHaveCount(0)
    await schedule.getByRole('textbox', { name: '证据日期' }).fill('2026-10-13')
    await expect(schedule.getByRole('button', { name: '11:00 · 阅读', exact: true })).toBeVisible()
    await states.getByRole('button', { name: '运行中', exact: true }).click()
    await expect(schedule.getByRole('status')).toHaveText('正在读取日程…')
    await expect(count).toHaveCount(0)
    await states.getByRole('button', { name: '未读取', exact: true }).click()
    await expect(count).toHaveCount(0)
    await expect(search).toBeDisabled()
    await states.getByRole('button', { name: '刷新失败', exact: true }).click()
    await expect(schedule.getByRole('alert')).toContainText('日程读取失败')
    await expect(schedule.locator('[data-record-id]')).toHaveCount(0)
    await schedule.getByRole('button', { name: '读取日程样张', exact: true }).click()
    for (const edge of ['unavailable', 'error', 'invalid', 'missing']) {
      await chooseEdge(edge)
      await expect(schedule.getByRole(edge === 'unavailable' || edge === 'error' ? 'alert' : 'status')).toBeVisible()
      await expect(detail).toHaveCount(0)
    }
    await chooseEdge('long')
    await schedule.getByRole('combobox', { name: '诊断人物' }).selectOption('lin')
    const row = schedule.locator('.debug-schedule-row').first()
    expect(await row.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await row.click()
    await expect(detail.locator('dd').filter({ hasText: '虚构住所内靠窗的长桌与临时资料整理区' })).toBeVisible()
    await detail.getByRole('button', { name: '返回列表', exact: true }).click()
    for (const scale of ['sm', 'lg']) {
      await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
      expect(await row.locator('time').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-font-scale', 'md'))
    await page.screenshot({ path: info.outputPath('schedule-v3-long.png') })
    await states.getByRole('button', { name: '无记录', exact: true }).click()
    await expect(count).toHaveText('0 个计划时段')
    await expect(schedule.getByRole('status')).toContainText('此范围没有记录')
  })
}

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`提示词呈现 v3 完整状态 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 704 })
    await page.addInitScript(theme => { localStorage.setItem('theme', theme); localStorage.setItem('playground.active-tab', 'debug') }, theme)
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
    const panel = page.getByTestId('debug-candidate')
    const prompt = panel.getByTestId('debug-prompt-workbench')
    const edge = panel.getByRole('combobox', { name: '提示词边缘样张' })
    const chooseEdge = async (value: string) => {
      await panel.getByText('更多样张', { exact: true }).click()
      await edge.selectOption(value)
      await panel.getByText('更多样张', { exact: true }).click()
    }
    const states = panel.getByRole('group', { name: 'Debug 样张状态' })
    await expect(panel.getByRole('heading', { name: '提示词管理器', exact: true })).toHaveCSS('font-size', '15px')
    await expect(panel.getByRole('navigation').getByRole('button', { name: '提示词管理器', exact: true })).toHaveCSS('font-size', '13px')
    await prompt.getByRole('textbox').fill('role_voice')
    await prompt.getByRole('button', { name: /主对话语义编译/ }).click()
    const body = prompt.locator('.debug-candidate-body')
    await expect(body).toHaveCSS('font-size', '14px')
    const original = await body.textContent()
    await prompt.getByText('版本与来源 · 样张 v3', { exact: true }).click()
    await expect(prompt.locator('.debug-prompt-provenance dd').first()).toHaveCSS('font-size', '12px')
    await prompt.getByText('版本与来源 · 样张 v3', { exact: true }).click()
    await states.getByRole('button', { name: '刷新失败', exact: true }).click()
    await expect(prompt.getByRole('alert')).toContainText('刷新失败，保留上次目录')
    await expect(body).toHaveText(original!)
    await prompt.getByRole('button', { name: '重试读取样张', exact: true }).click()
    await expect(body).toHaveText(original!)
    await chooseEdge('usage-error')
    await expect(prompt.getByRole('alert')).toContainText('调用数量未知')
    await expect(body).toBeVisible()
    await expect(prompt.getByText('相关调用 · 未读取', { exact: true })).toBeVisible()
    await chooseEdge('missing')
    await expect(prompt.getByText('引用的资产未在目录中找到', { exact: true })).toBeVisible()
    await expect(prompt.locator('.debug-prompt-entry[aria-pressed="true"]')).toHaveCount(0)
    await expect(body).toHaveCount(0)
    await prompt.getByRole('button', { name: '返回目录', exact: true }).click()
    for (const state of ['unavailable', 'error']) {
      await chooseEdge(state)
      await expect(panel.getByTestId('playground-page-header')).toContainText('目录未读取')
      await expect(prompt.getByRole('textbox')).toBeDisabled()
      await expect(prompt.getByText('此范围没有资产', { exact: true })).toHaveCount(0)
      await expect(prompt.locator('.debug-prompt-directory')).toHaveCount(0)
      await states.getByRole('button', { name: '刷新失败', exact: true }).click()
      await expect(prompt.getByText('目录读取失败', { exact: true })).toBeVisible()
      await expect(prompt.locator('.debug-prompt-directory')).toHaveCount(0)
      await prompt.getByRole('button', { name: '读取目录样张', exact: true }).click()
    }
    await chooseEdge('long')
    await prompt.getByRole('textbox').fill('role_voice')
    await prompt.getByRole('button', { name: /长名称、自然语言正文/ }).click()
    await expect(body).toContainText('隔离长正文演示 12')
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('prompt-v3-long.png') })
    for (const scale of ['sm', 'lg']) {
      await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
      const ratio = await body.evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))
      expect(ratio).toBeCloseTo(14 / 15, 3)
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-font-scale', 'md'))
    await panel.getByRole('navigation').getByRole('button', { name: '今日日程', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '今日日程', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '最近事项', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '最近事项', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '行为日志', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '行为日志', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '此刻', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '此刻', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '人物档案', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '人物档案', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '当前位置', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '当前位置', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '家居', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '家居', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '足迹', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '足迹', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '成长与反思', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '成长与反思', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '朋友圈', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '朋友圈', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '通讯录', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '通讯录', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '主动消息证据', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '主动消息证据', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '衣柜', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '衣柜', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '文化角', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '文化角', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '生活事件关联', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '生活事件关联', exact: true })).toHaveCSS('font-size', '13px')
    await panel.getByRole('navigation').getByRole('button', { name: '上下文', exact: true }).click()
    await expect(panel.getByRole('navigation').getByRole('button', { name: '上下文', exact: true })).toHaveCSS('font-size', '13px')
  })
}

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1280, 600]) {
  test(`正式 Debug 阅读与完整证据 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    // 背景：浏览器不连接 Electron；意图：在真实生产组件上注入 IPC 契约响应而非候选数据。
    // 约束：本测试不证明数据库读取；数据库只读与范围隔离由 debug-companion-evidence Unit 覆盖。
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __debugFail?: boolean }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      const record = (id: string, kind: string, body: string, payload: Record<string, unknown> = {}) => ({ id, kind, title: id, body, data: { payload }, roleId: 'lin', time: null, status: 'published', source: 'test-contract', truncated: false, links: [] })
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        modelContextAssets: async () => {
          if (state.__debugFail) throw new Error('test failure')
          return [{ key: 'test.prompt', name: '主对话', category: 'system', assetType: 'prompt', ownership: 'builtin', source: 'production#prompt', version: '1', fingerprint: 'fingerprint-proof', status: 'active', contentKind: 'template', mode: 'dynamic', content: '请先阅读用户材料。{{context}}', locale: 'zh-CN', locales: {}, slots: [{ name: 'context', source: 'assembler', lifecycle: 'turn' }], roleIds: [] }]
        },
        assetUsageQuery: async () => ({ records: [], total: 0 }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; date?: string }) => {
          if (state.__debugFail) throw new Error('test failure')
          return { ...query, state: 'ready', source: 'test-contract', timezone: 'Asia/Shanghai', generatedAt: Date.now(), total: null, hasMore: false, issues: [], boundary: '只读范围证据', records: query.view === 'schedule' ? [record('day-proof', 'day', '', { theme: '不应默认显示的主题', slots: [{ hour: 9, minute: 15, activity: '阅读材料', location: '书房', mood: '完整详情情绪' }] })] : query.view === 'profile' ? [record('identity', 'identity', '身份摘要'), record('workflow', 'workflow', '先看结论'), record('voice', 'voice', '表达简洁')] : query.view === 'footprints' ? [record('已完成旅行', 'footprint', '旅行经历', { recordType: 'trip', status: 'completed', destination: '杭州' }), record('下周计划', 'footprint', '计划经历', { recordType: 'trip', status: 'planned' }), record('地点资料', 'footprint', '', { recordType: 'place' })] : [] }
        },
        llmLogsQuery: async () => ({ records: [{ id: 'call-proof', model: 'test-model', provider: 'test', caller: 'main', startedAt: Date.now(), status: 'success', promptTokens: 1, completionTokens: 1, totalTokens: 2, durationMs: 1, toolCallCount: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }], total: 1, storageBytes: 1 }),
        llmLogGet: async () => ({ id: 'call-proof', model: 'test-model', provider: 'test', caller: 'main', startedAt: Date.now(), status: 'success', promptTokens: 1, completionTokens: 1, totalTokens: 2, durationMs: 1, toolCallCount: 0, cacheReadTokens: 0, cacheCreationTokens: 0, requestMessages: [{ role: 'system', content: 'system-proof' }, { role: 'user', content: 'user-proof' }], requestTools: [], requestExtra: {}, responseContent: 'response-proof', responseToolCalls: [] }),
        onLLMCallEvent: () => () => {},
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    const nav = panel.getByRole('navigation', { name: '调试分区' })
    await expect(panel.locator('.workspace-page-header')).toContainText('1 项生产资产')
    await panel.getByRole('button', { name: /平台 \/ 行为/ }).click()
    await panel.getByRole('button', { name: '模板 主对话', exact: true }).click()
    await expect(panel.getByText('请先阅读用户材料。{{context}}', { exact: true })).toBeVisible()
    await expect(panel.getByText('fingerprint-proof', { exact: true })).toBeHidden()
    await panel.getByText('变量说明 · 1', { exact: true }).click()
    await expect(panel.getByText('{{context}}', { exact: true })).toBeVisible()
    await panel.getByText('来源与版本 · 1', { exact: true }).click()
    await expect(panel.getByText('fingerprint-proof', { exact: true })).toBeVisible()
    if (width === 600) {
      await panel.getByRole('button', { name: '返回目录', exact: true }).click()
      await expect(panel.getByRole('button', { name: '模板 主对话', exact: true })).toBeFocused()
    }
    await nav.getByRole('button', { name: '今日日程', exact: true }).click()
    const scheduleSummary = panel.getByRole('button', { name: '09:15 · 阅读材料', exact: true })
    await expect(scheduleSummary.getByText('09:15', { exact: true })).toBeVisible()
    await expect(scheduleSummary.locator('.debug-schedule-activity')).toContainText('阅读材料')
    await expect(scheduleSummary.locator('.debug-schedule-activity')).toBeVisible()
    await expect(scheduleSummary.getByText('书房', { exact: true })).toBeVisible()
    await expect(panel.getByText('不应默认显示的主题', { exact: true })).toBeHidden()
    await scheduleSummary.click()
    await expect(panel.getByText('不应默认显示的主题', { exact: true })).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __debugFail: boolean }).__debugFail = true })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(panel.getByText('刷新失败，保留原范围及全部已读页；下方不是最新结果。')).toBeVisible()
    await expect(panel.getByRole('article', { name: '领域证据详情' }).getByRole('heading')).toContainText('09:15')
    await page.evaluate(() => { (window as unknown as { __debugFail: boolean }).__debugFail = false })
    await nav.getByRole('button', { name: '用户画像', exact: true }).click()
    for (const label of ['身份', '协作方式', '表达偏好']) await expect(panel.getByRole('heading', { name: label, exact: true })).toBeVisible()
    await expect(panel.getByText('先看结论', { exact: true }).first()).toBeVisible()
    await expect(panel.locator('[data-record-id="workflow"]')).toBeVisible()
    await expect(panel.getByRole('article', { name: '画像来源详情' })).toHaveCount(0)
    await panel.locator('[data-record-id="workflow"] button').click()
    await expect(panel.getByRole('article', { name: '画像来源详情' })).toContainText('先看结论')
    await panel.getByText('来源与完整记录', { exact: true }).click()
    await expect(panel.getByRole('article', { name: '画像来源详情' })).toContainText('workflow')
    await nav.getByRole('button', { name: '足迹', exact: true }).click()
    for (const label of [/^实际旅行/, /^旅行计划/, /^地点资料/]) await expect(panel.getByRole('heading', { name: label })).toBeVisible()
    await nav.getByRole('button', { name: 'LLM 调用', exact: true }).click()
    const tabs = panel.getByRole('tablist', { name: '调用详情' })
    await expect(tabs.getByRole('tab')).toHaveCount(7)
    await tabs.getByRole('tab', { name: 'System 1', exact: true }).click()
    await expect(panel.getByText('system-proof', { exact: true })).toBeVisible()
    await expect(panel.getByText('system-proof', { exact: true })).toHaveCSS('font-size', '14px')
    await expect(panel.getByText('system-proof', { exact: true })).toHaveCSS('line-height', '24.5px')
    await tabs.getByRole('tab', { name: 'System 1', exact: true }).press('ArrowRight')
    await expect(tabs.getByRole('tab', { name: 'Messages 2', exact: true })).toBeFocused()
    await expect(panel.getByText('user-proof', { exact: true })).toBeVisible()
    await tabs.getByRole('tab', { name: '响应', exact: true }).click()
    await expect(panel.getByText('response-proof', { exact: true })).toBeVisible()
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('production-debug.png') })
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click()
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
    await page.getByTestId('playground-nav').getByRole('button', { name: '基础组件', exact: true }).click()
    await page.getByRole('tab', { name: '布局与滚动', exact: true }).click()
    const headerStory = page.getByTestId('foundation-story-page-header')
    await expect(headerStory.getByRole('heading', { name: '诊断记录', exact: true })).toBeVisible()
    const narrow = headerStory.getByTestId('page-header-narrow')
    await expect(narrow.getByRole('button', { name: '刷新', exact: true })).toBeVisible()
    expect(await narrow.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  })
}

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1280, 600]) {
  test(`Debug 证据浏览 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(theme => {
      localStorage.setItem('theme', theme)
      localStorage.setItem('playground.active-tab', 'debug')
    }, theme)
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
    const panel = page.getByTestId('debug-candidate')
    const nav = panel.getByRole('navigation', { name: 'Debug 候选导航' })
    await expect(page.getByTestId('playground-nav')).toHaveCount(0)
    await expect(panel.getByRole('heading', { name: '提示词管理器', exact: true })).toBeVisible()
    await expect(panel.getByTestId('playground-page-header')).toContainText('20 项演示资产')
    await expect(nav.getByRole('region')).toHaveCount(7)
    await expect(nav.getByLabel('内核分区').getByRole('button', { name: '今日日程', exact: true })).toBeVisible()
    const prompt = panel.getByTestId('debug-prompt-workbench')
    await expect(prompt).toContainText('选择左侧条目查看详情')
    await prompt.getByRole('textbox', { name: '搜索提示词与资产' }).fill('小册子')
    await expect(prompt.getByRole('button', { name: /稳定身份 · 林/ })).toBeVisible()
    await expect(prompt.getByRole('button', { name: /主对话语义编译/ })).toHaveCount(0)
    await prompt.getByRole('textbox', { name: '搜索提示词与资产' }).fill('role_voice')
    await prompt.getByRole('button', { name: /主对话语义编译/ }).click()
    await expect(prompt.getByRole('article', { name: '资产详情' })).toContainText('{{role_voice}}')
    await expect(prompt.getByRole('article', { name: '资产详情' })).toContainText('样张 v3')
    await expect(prompt.getByRole('article', { name: '资产详情' })).toContainText('模板正文')
    await expect(prompt.locator('.debug-prompt-variables > div')).toBeHidden()
    await prompt.getByText('变量说明 · 3', { exact: true }).click()
    await expect(prompt.locator('.debug-prompt-variables > div')).toBeVisible()
    await expect(prompt.locator('textarea')).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('debug-prompts.png') })
    if (width === 600) {
      await prompt.getByRole('button', { name: '返回目录' }).click()
      await expect(prompt.getByRole('textbox')).toHaveValue('role_voice')
    }
    await prompt.getByRole('textbox', { name: '搜索提示词与资产' }).fill('')
    await prompt.getByRole('group', { name: '资产人物筛选' }).getByRole('button', { name: '林 · 样张' }).click()
    await prompt.getByRole('button', { name: /身份，/ }).click()
    await expect(prompt.getByRole('button', { name: /人物清单 · 予/ })).toHaveCount(0)
    await expect(prompt.getByRole('button', { name: /稳定身份 · 林/ })).toBeVisible()
    const runNav = nav.getByRole('button', { name: 'LLM 调用', exact: true })
    await runNav.click()
    await expect(panel.getByTestId('debug-call-detail')).toHaveCount(0)
    const runs = panel.getByTestId('debug-evidence-runs')
    await runs.locator('[data-record-id="demo-call-03"] button').click()
    await expect(panel.getByTestId('debug-call-detail')).toContainText('本次请求未获得回复')
    const initialBox = await runNav.boundingBox()
    await runNav.hover(); await runNav.focus()
    expect(await runNav.boundingBox()).toEqual(initialBox)
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('debug-overview.png') })
    await runs.getByRole('button', { name: '查看资产来源', exact: true }).click()
    await prompt.getByRole('textbox', { name: '搜索提示词与资产' }).fill('主对话语义编译')
    await panel.getByRole('button', { name: /主对话语义编译/ }).click()
    const asset = panel.getByRole('article', { name: '资产详情' })
    await asset.getByText(/版本与来源 ·/).click()
    await expect(asset).toContainText('demo.prompt.main')
    await page.screenshot({ path: info.outputPath('debug-assets.png') })
    if (width === 600) {
      await panel.getByRole('button', { name: '返回目录', exact: true }).click()
      await expect(panel.locator('.debug-prompt-entry').filter({ hasText: '主对话语义编译' })).toBeFocused()
      await panel.locator('.debug-prompt-entry').filter({ hasText: '主对话语义编译' }).click()
    }
    await panel.getByText('相关调用 · 2', { exact: true }).click()
    await panel.getByRole('button', { name: /读取旅行记录/ }).click()
    await expect(panel.getByTestId('debug-call-detail')).toContainText('demo-call-02')
    await runs.getByRole('button', { name: '查看调用链', exact: true }).click()
    // 此用例继续核对保留的当前快照；新增保存历史由独立四页用例验收。
    if (await panel.getByTestId('debug-capability-candidate').isVisible()) await panel.getByRole('button', { name: '能力补齐样张', exact: true }).click()
    const traces = panel.getByTestId('debug-evidence-traces')
    await traces.locator('[data-record-id="demo-span-tool"] button').click()
    await expect(traces.getByRole('article', { name: 'Span 详情' })).toContainText('tool')
    await traces.getByText('属性与原始结构', { exact: true }).click()
    await expect(traces.locator('pre')).toContainText('read-only')
    await page.screenshot({ path: info.outputPath('debug-execution.png') })
    await runNav.click()
    await runs.getByRole('textbox', { name: '搜索调用记录' }).fill('no-such-request')
    await expect(runs).toContainText('当前没有调用记录，不代表系统未发生请求')
    await runs.getByRole('textbox', { name: '搜索调用记录' }).fill('读取旅行记录')
    await expect(runs.locator('[data-record-id]')).toHaveCount(1)
    await runs.getByRole('textbox', { name: '搜索调用记录' }).fill('')
    await runs.locator('[data-record-id="demo-call-03"] button').click()
    const states = panel.getByRole('group', { name: 'Debug 样张状态' })
    await states.getByRole('button', { name: '刷新失败', exact: true }).click()
    await expect(runs).toContainText('刷新失败，保留原调用列表与详情')
    await expect(panel.getByTestId('debug-call-detail')).toContainText('demo-call-03')
    await runs.getByRole('button', { name: '重试读取样张', exact: true }).click()
    await states.getByRole('button', { name: '运行中', exact: true }).click()
    await expect(runs).toContainText('正在读取调用记录')
    await expect(panel.getByTestId('debug-call-detail')).toHaveCount(0)
    await states.getByRole('button', { name: '无记录', exact: true }).click()
    await expect(runs).toContainText('不代表系统未发生请求')
    await states.getByRole('button', { name: '默认记录', exact: true }).click()
    await nav.getByRole('button', { name: 'Skill 验收', exact: true }).click()
    await panel.locator('[data-case-id="skill-boundary"] button').click()
    await expect(panel).toContainText('允许工具：read')
    await expect(panel).toContainText('实际尝试：write')
    await expect(panel).toContainText('权限边界阻止')
    await page.screenshot({ path: info.outputPath('debug-quality.png') })
    await nav.getByRole('button', { name: '人格验收', exact: true }).click()
    await panel.locator('[data-case-id="persona-voice"] button').click()
    await expect(panel).toContainText('人工审阅：未审阅')
    await nav.getByRole('button', { name: '此刻', exact: true }).click()
    await panel.getByRole('button', { name: /完整状态/ }).click()
    await panel.getByText('记录标识与原始样张', { exact: true }).click()
    await expect(panel.getByRole('article', { name: '领域证据详情' })).toContainText('companion_role_state')
    await nav.getByRole('button', { name: '今日日程', exact: true }).click()
    await panel.getByRole('button', { name: /14:00 · 阅读旅行笔记/ }).click()
    await expect(panel.getByRole('article', { name: '领域证据详情' })).toContainText('执行结果未记录')
    await page.screenshot({ path: info.outputPath('debug-schedule.png') })
    await panel.getByRole('button', { name: '查看关联生活事件' }).click()
    await expect(panel.getByRole('article', { name: '领域证据详情' })).toContainText('demo-event-reading')
    await panel.getByRole('button', { name: '查看物品关联记录' }).click()
    await panel.getByRole('button', { name: '查看明确关联的资产' }).click()
    await expect(panel.getByRole('article', { name: '领域证据详情' })).toContainText('demo-item-camera')
    await nav.getByRole('button', { name: '今日日程', exact: true }).click()
    await panel.getByRole('textbox', { name: '证据日期' }).fill('2026-10-12')
    await panel.getByRole('button', { name: /10:00 · 整理书架/ }).click()
    await expect(panel.getByRole('article', { name: '领域证据详情' })).toContainText('10:00')
    if (width === 600) await panel.getByRole('button', { name: '返回列表' }).click()
    await panel.getByRole('textbox', { name: '证据日期' }).fill('2026-10-11')
    await expect(panel.getByTestId('debug-evidence-schedule').getByRole('status')).toContainText('此范围没有记录')
    await panel.getByRole('button', { name: '清除筛选' }).click()
    await nav.getByRole('button', { name: '用户记忆', exact: true }).click()
    await panel.getByRole('combobox', { name: '记忆人物范围' }).selectOption('lin')
    await expect(panel.locator('[data-record-id="demo-memory-yu"]')).toHaveCount(0)
    await expect(panel.getByRole('button', { name: /使用简体中文/ })).toBeVisible()
    await panel.locator('[data-record-id="demo-memory-lin"] button').click()
    await expect(panel.getByRole('article', { name: '记忆详情' })).toContainText('用户明确表示希望先听短结论')
    // 背景：首版有证据但缺领域入口；意图：按合同逐页实际点开；约束：不能只校验导航元素存在。
    for (const [label, id] of [
      ['最近事项', 'recent'], ['行为日志', 'activity'], ['当前位置', 'location'], ['家居', 'residence'],
      ['人物档案', 'character'], ['足迹', 'footprints'], ['朋友圈', 'moments'], ['成长与反思', 'growth'], ['通讯录', 'relations'],
      ['衣柜', 'wardrobe'], ['文化角', 'items'], ['生活事件关联', 'links'],
      ['用户画像', 'profile'], ['调用链', 'traces'], ['实时事件', 'events'], ['技能与工具', 'tools'],
    ]) {
      await nav.getByRole('button', { name: label, exact: true }).click()
      const evidence = panel.getByTestId(`debug-evidence-${id}`)
      await expect(evidence).toBeVisible()
      if (id === 'character') await evidence.getByRole('button', { name: /完整资料/ }).click()
      else await evidence.locator('[data-record-id]').getByRole('button').first().click()
      const detailName = id === 'profile' ? '画像来源详情' : id === 'traces' ? 'Span 详情' : id === 'events' ? '运行事件详情' : id === 'tools' ? '能力详情' : '领域证据详情'
      await expect(evidence.getByRole('article', { name: detailName, exact: true })).toBeVisible()
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await nav.getByRole('button', { name: '主动消息证据', exact: true }).click()
    await expect(panel.getByTestId('debug-evidence-proactive').getByRole('status')).toContainText('尚无独立投递记录源')
    await expect(panel.getByTestId('debug-evidence-proactive').locator('[data-record-id]')).toHaveCount(0)
    await panel.getByTestId('debug-evidence-proactive').getByRole('button', { name: '查看朋友圈', exact: true }).click()
    await expect(panel.getByTestId('debug-evidence-moments').getByRole('article', { name: '领域证据详情' })).toHaveCount(0)
    await nav.getByRole('button', { name: '调用链', exact: true }).click()
    await panel.locator('[data-record-id="demo-span-03"] button').click()
    await panel.getByRole('button', { name: '查看请求记录', exact: true }).click()
    await expect(panel.getByTestId('debug-call-detail')).toContainText('demo-call-03')
    await nav.getByRole('button', { name: '系统状态', exact: true }).click()
    await nav.getByRole('button', { name: '系统状态', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(panel.getByTestId('debug-evidence-system')).toContainText('系统诊断边界')
    await panel.getByRole('button', { name: '返回 Playground' }).click()
    await expect(page.getByTestId('playground-nav')).toBeVisible()
  })
}

for (const theme of ['porcelain-blue', 'yao-stone']) {
  test(`Debug 本项目生活面与无滚动条导航 ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1096, height: 704 })
    await page.addInitScript(theme => {
      localStorage.setItem('theme', theme)
      localStorage.setItem('playground.active-tab', 'debug')
    }, theme)
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
    const panel = page.getByTestId('debug-candidate')
    const nav = panel.getByRole('navigation', { name: 'Debug 候选导航' })
    const groups = nav.locator('.debug-candidate-nav-groups')
    const prompt = panel.getByTestId('debug-prompt-workbench')
    await prompt.getByRole('button', { name: /平台 \/ 行为，/ }).click()
    await prompt.getByRole('button', { name: /主对话语义编译/ }).click()
    const split = prompt.locator('.debug-prompt-split')
    expect((await split.boundingBox())!.height).toBeGreaterThanOrEqual(420)
    expect((await prompt.locator('.debug-prompt-directory').boundingBox())!.width).toBe(340)
    expect((await prompt.getByRole('button', { name: /主对话语义编译/ }).boundingBox())!.height).toBeLessThan(105)
    const body = prompt.locator('.debug-candidate-body')
    const bodyBox = (await body.boundingBox())!
    const splitBox = (await split.boundingBox())!
    expect(bodyBox.y + bodyBox.height).toBeLessThanOrEqual(splitBox.y + splitBox.height)
    expect(await body.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(14)
    // 背景：浅色样张文字曾低对比难读；意图：测量实际主题色而非检查 token 名；约束：按浏览器解析后的前景 / 背景计算普通文字 4.5:1。
    const contrast = await body.evaluate(node => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d')!
      const luminance = () => {
        const values = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
          const channel = value / 255
          return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
        })
        return .2126 * values[0] + .7152 * values[1] + .0722 * values[2]
      }
      // 背景：选中底色带 12% 透明度；意图：从祖先向内合成真实背景；约束：不能拿透明底色的 RGB 当不透明颜色，否则两主题都产生假失败。
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1, 1)
      const ancestors: Element[] = []
      for (let current: Element | null = node; current; current = current.parentElement) ancestors.push(current)
      for (const ancestor of ancestors.reverse()) {
        ctx.fillStyle = getComputedStyle(ancestor).backgroundColor; ctx.fillRect(0, 0, 1, 1)
      }
      const bg = luminance()
      ctx.fillStyle = getComputedStyle(node).color; ctx.fillRect(0, 0, 1, 1)
      const fg = luminance()
      return { foreground: getComputedStyle(node).color, background: getComputedStyle(node.closest('article')!).backgroundColor, ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) }
    })
    expect(contrast.ratio, JSON.stringify(contrast)).toBeGreaterThanOrEqual(4.5)
    await page.screenshot({ path: info.outputPath('debug-prompt-readable.png') })
    await prompt.getByText(/版本与来源 ·/).click()
    await expect(prompt.getByRole('article')).toContainText('自动指纹')
    expect(await groups.evaluate(node => getComputedStyle(node).scrollbarWidth)).toBe('none')
    expect(await groups.evaluate(node => getComputedStyle(node, '::-webkit-scrollbar').display)).toBe('none')
    await nav.getByRole('button', { name: '提示词管理器', exact: true }).focus()
    for (let i = 0; i < 25; i++) await page.keyboard.press('Tab')
    await expect(nav.getByRole('button', { name: '人格验收', exact: true })).toBeFocused()
    expect(await groups.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
    await page.keyboard.press('Enter')
    await expect(panel.getByRole('heading', { name: '人格验收', exact: true })).toBeVisible()
    await groups.hover()
    await page.mouse.wheel(0, -2000)
    await expect.poll(() => groups.evaluate(node => node.scrollTop)).toBe(0)

    await nav.getByRole('button', { name: '家居', exact: true }).click()
    await panel.getByRole('button', { name: /小相机/ }).click()
    const detail = panel.getByRole('article', { name: '领域证据详情' })
    await detail.getByText('完整字段', { exact: true }).click()
    await expect(detail).toContainText('displayInHome = true')
    await expect(detail).toContainText('展示依据demo-event-reading')
    await page.screenshot({ path: info.outputPath('debug-home.png') })
    await panel.getByRole('button', { name: '查看所属空间' }).click()
    await expect(detail).toContainText('所属住所demo-residence-home')
    await panel.getByRole('button', { name: '查看所属住所' }).click()
    await expect(detail).toContainText('记录类型residence')
    await panel.getByRole('button', { name: /备用收纳盒/ }).click()
    await expect(detail).toContainText('空间未归置')
    await expect(detail).toContainText('displayInHome = false')
    await nav.getByRole('button', { name: '足迹', exact: true }).click()
    await panel.getByRole('button', { name: /河边旅行/ }).click()
    await expect(detail).toContainText('demo-stop-river')
    await expect(detail).toContainText('2026-10-10')
    await expect(detail).toContainText('停留经历样张')
    await page.screenshot({ path: info.outputPath('debug-footprints.png') })
    await panel.getByRole('button', { name: /海边旅行计划/ }).click()
    await expect(detail).toContainText('不纳入实际旅行')
    await panel.getByRole('button', { name: /旧地点/ }).click()
    await expect(detail).toContainText('访问日期未记录')
    await panel.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(panel).toContainText('没有已读取足迹资产')
    await nav.getByRole('button', { name: '用户画像', exact: true }).click()
    await panel.locator('[data-record-id="demo-profile-workflow"] button').click()
    const profileDetail = panel.getByRole('article', { name: '画像来源详情' })
    await expect(profileDetail).toContainText('全局查询 · 保存桶 lin')
    await profileDetail.getByText('来源与完整记录', { exact: true }).click()
    await expect(profileDetail).toContainText('非反馈资料沿全局范围读取；反馈只属于当前人物')
    await nav.getByRole('button', { name: '朋友圈', exact: true }).click()
    await panel.getByRole('button', { name: /查看动态：.*翻到上次旅途/ }).click()
    await detail.getByText('互动记录', { exact: true }).click()
    await expect(detail).toContainText('想看看这本小册子 · 样张')
    await expect(detail).toContainText('同框记录')
    await panel.getByRole('button', { name: '查看发布来源事件' }).click()
    await expect(detail).toContainText('没有完成证据')
  })
}

// 背景：导航覆盖不能证明核心事实默认可读；意图：验证各阅读任务和失败语义。
// 约束：不点击记录就检查摘要；展开来源后再跳转，窄屏返回恢复原筛选与焦点。
for (const theme of ['porcelain-blue', 'yao-stone']) {
  test(`Debug 阅读任务与读取边界 ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1096, height: 704 })
    await page.addInitScript(theme => { localStorage.setItem('theme', theme); localStorage.setItem('playground.active-tab', 'debug') }, theme)
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
    const panel = page.getByTestId('debug-candidate')
    const nav = panel.getByRole('navigation', { name: 'Debug 候选导航' })
    const states = panel.getByRole('group', { name: 'Debug 样张状态' })
    await states.getByRole('button', { name: '未读取', exact: true }).click()
    await expect(panel.getByText('目录尚未读取', { exact: true })).toBeVisible()
    await expect(panel.getByTestId('debug-prompt-workbench').getByRole('textbox')).toBeDisabled()
    await expect(panel.locator('.debug-prompt-directory')).toHaveCount(0)
    await states.getByRole('button', { name: '无记录', exact: true }).click()
    await expect(panel.getByText('此范围没有资产')).toBeVisible()
    await states.getByRole('button', { name: '刷新失败', exact: true }).click()
    await expect(panel.getByText('此范围没有资产')).toBeVisible()
    await panel.getByRole('button', { name: '重试读取样张' }).click()
    await states.getByRole('button', { name: '历史截断', exact: true }).click()
    await expect(panel.getByRole('status').filter({ hasText: '全量总数未知' })).toBeVisible()
    await states.getByRole('button', { name: '默认记录', exact: true }).click()
    const prompt = panel.getByTestId('debug-prompt-workbench')
    await prompt.getByRole('group', { name: '资产人物筛选' }).getByRole('button', { name: '林 · 样张', exact: true }).click()
    await expect(prompt.getByRole('button', { name: /平台共用，/ })).toBeVisible()
    await prompt.getByRole('button', { name: /身份，/ }).click()
    await expect(prompt.getByRole('button', { name: /稳定身份 · 林/ })).toBeVisible()
    await nav.getByRole('button', { name: '今日日程', exact: true }).click()
    for (const time of ['09:00', '14:00', '19:00']) await expect(panel.getByRole('button', { name: new RegExp(time) })).toBeVisible()
    await page.screenshot({ path: info.outputPath('debug-reading-schedule.png') })
    await nav.getByRole('button', { name: '用户画像', exact: true }).click()
    await expect(panel.getByRole('textbox', { name: '搜索当前页证据' })).toHaveCount(0)
    await expect(panel.getByRole('combobox', { name: '诊断人物' })).toHaveValue('lin')
    await expect(panel).toContainText('全局资料与当前人物的协作反馈')
    await expect(panel).toContainText('以下仅整理已读来源，不是全量画像')
    for (const title of ['身份', '协作方式', '表达偏好']) await expect(panel.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(panel.locator('[data-record-id="demo-feedback-yu"]')).toHaveCount(0)
    await panel.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(panel.locator('[data-record-id="demo-feedback-yu"]')).toBeVisible()
    await panel.locator('[data-record-id="demo-profile-workflow"] button').click()
    await expect(panel.getByRole('article', { name: '画像来源详情' })).toContainText('全局查询')
    await page.screenshot({ path: info.outputPath('debug-reading-profile.png') })
    await nav.getByRole('button', { name: '家居', exact: true }).click()
    await expect(panel.locator('.debug-home-residence .debug-home-space [data-record-id="demo-item-camera"]')).toBeVisible()
    await expect(panel.getByRole('heading', { name: '其他已读记录', exact: true })).toBeVisible()
    await panel.getByRole('button', { name: '小相机', exact: true }).click()
    await expect(panel.getByRole('article', { name: '领域证据详情' }).locator('.debug-home-body')).toContainText('日常整理旅行照片使用')
    await page.screenshot({ path: info.outputPath('debug-reading-home.png') })
    await nav.getByRole('button', { name: '足迹', exact: true }).click()
    await expect(panel.getByRole('heading', { name: /实际旅行 · 2/ })).toBeVisible()
    await expect(panel.locator('[data-record-id="demo-trip-completed"]')).toContainText('2026-10-10')
    await panel.getByRole('button', { name: '河边旅行', exact: true }).click()
    await expect(panel.getByText('2026-10-10 · 河边步道', { exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath('debug-reading-travel.png') })
    await page.setViewportSize({ width: 600, height: 704 })
    await panel.getByRole('button', { name: /河边旅行/ }).click()
    await expect(panel.getByRole('article', { name: '领域证据详情' })).toBeVisible()
    await panel.getByRole('button', { name: '返回列表', exact: true }).click()
    await expect(panel.getByRole('button', { name: /河边旅行/ })).toBeFocused()
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  })
}


test('正式 Debug 首次调用失败不显示零值或成功空态', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const api = window as unknown as { electronAPI: { debug: Record<string, unknown> } }
    api.electronAPI = { ...api.electronAPI, debug: { ...api.electronAPI?.debug } }
    window.electronAPI.debug.llmLogsQuery = async () => { throw new Error('contract failure') }
    window.electronAPI.debug.onLLMCallEvent = () => () => {}
  })
  await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
  await page.getByRole('navigation', { name: '调试分区' }).getByRole('button', { name: 'LLM 调用', exact: true }).click()
  const calls = page.getByTestId('llm-calls-panel')
  await expect(calls.getByRole('alert')).toContainText('调用清单读取失败')
  await expect(calls).toContainText('数量未读取')
  await expect(calls.getByText('没有匹配的 LLM 调用。', { exact: true })).toHaveCount(0)
  await expect(calls.getByText(/第 .*共 0 条/)).toBeHidden()
})

test('正式 Debug 快速切换调用不被迟到详情覆盖，局部资产失败保留正文', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const api = window as unknown as { electronAPI: { debug: Record<string, unknown> } }
    api.electronAPI = { ...api.electronAPI, debug: { ...api.electronAPI?.debug } }
    const state = window as unknown as { __releaseAlpha: () => void; __alphaRead: boolean; __alphaFinished: boolean }
    const base = { provider: 'test', caller: 'main', startedAt: Date.now(), status: 'success' as const, promptTokens: 1, completionTokens: 1, totalTokens: 2, durationMs: 1, toolCallCount: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }
    const summaries = ['alpha', 'beta'].map(id => ({ ...base, id, model: id }))
    window.electronAPI.debug.llmLogsQuery = async () => ({ records: summaries, total: 2, storageBytes: 10 })
    window.electronAPI.debug.onLLMCallEvent = () => () => {}
    window.electronAPI.debug.assetUsageQuery = async ({ spanId } = {}) => {
      if (spanId === 'beta') throw new Error('asset contract failure')
      return { records: [], total: 0 }
    }
    window.electronAPI.debug.llmLogGet = async id => {
      if (id === 'alpha') { state.__alphaRead = true; await new Promise<void>(resolve => { state.__releaseAlpha = resolve }); state.__alphaFinished = true }
      return { ...base, id, model: id, requestMessages: [], requestTools: [], requestExtra: {}, responseContent: `${id}-response`, responseToolCalls: [] }
    }
  })
  await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
  await page.getByRole('navigation', { name: '调试分区' }).getByRole('button', { name: 'LLM 调用', exact: true }).click()
  const calls = page.getByTestId('llm-calls-panel')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __alphaRead: boolean }).__alphaRead)).toBe(true)
  await calls.getByRole('button').filter({ hasText: 'beta' }).click()
  await expect(calls.getByRole('alert')).toContainText('关联资产读取失败')
  await calls.getByRole('tab', { name: '响应', exact: true }).click()
  await expect(calls.getByText('beta-response', { exact: true })).toBeVisible()
  await page.evaluate(() => (window as unknown as { __releaseAlpha: () => void }).__releaseAlpha())
  await expect.poll(() => page.evaluate(() => (window as unknown as { __alphaFinished: boolean }).__alphaFinished)).toBe(true)
  await expect(calls.getByText('beta-response', { exact: true })).toBeVisible()
  await expect(calls.getByText('alpha-response', { exact: true })).toHaveCount(0)
})


for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式 Debug 上下文专用阅读与恢复 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 704 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __contextFail: boolean; __contextDetailFail: boolean }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__contextFail = true
      const base = { provider: 'test', caller: 'main', startedAt: Date.now(), status: 'success', promptTokens: 1, completionTokens: 1, totalTokens: 2, durationMs: 1, toolCallCount: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }
      Object.assign(state.electronAPI.debug, {
        llmLogsQuery: async () => {
          if (state.__contextFail) throw new Error('list failure')
          return { records: ['alpha', 'beta'].map(id => ({ ...base, id, model: id })), total: 2, storageBytes: 10 }
        },
        llmLogGet: async (id: string) => {
          if (state.__contextDetailFail) throw new Error('detail failure')
          return { ...base, id, model: id, requestMessages: id === 'beta' ? { unexpected: 'test-malformed' } : Array.from({ length: 12 }, (_, i) => ({ role: i === 0 ? 'system' : 'user', content: '（正文未持久化）', contentLength: i === 0 ? 2400 : 50 })), requestTools: [], requestExtra: {}, responseContent: `${id}-raw`, responseToolCalls: [] }
        },
        assetUsageQuery: async () => ({ records: [], total: 0 }),
        onLLMCallEvent: () => () => {},
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    await panel.getByRole('navigation').getByRole('button', { name: '上下文', exact: true }).click()
    const context = panel.getByTestId('debug-evidence-context')
    await expect(panel.getByTestId('llm-calls-panel')).toHaveCount(0)
    await expect(context.getByRole('alert')).toContainText('调用清单读取失败')
    await expect(context.getByRole('combobox')).toHaveCount(0)
    await expect(context).not.toContainText('条已读调用')
    await page.evaluate(() => { (window as unknown as { __contextFail: boolean }).__contextFail = false })
    await context.getByRole('button', { name: '重试读取调用清单', exact: true }).click()
    await expect(context.locator('.debug-context-message')).toHaveCount(8)
    await expect(context).toContainText('保存长度 2400 字符')
    await context.getByRole('button', { name: '显示其余 4 条消息', exact: true }).click()
    const first = context.locator('.debug-context-message').first()
    await first.locator(':scope > summary').click()
    await first.getByText('完整消息结构', { exact: true }).click()
    await page.evaluate(() => { (window as unknown as { __contextFail: boolean }).__contextFail = true })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(context.getByRole('alert')).toContainText('调用清单读取失败')
    await expect(context.locator('.debug-context-message')).toHaveCount(12)
    await expect(first.locator('pre')).toBeVisible()
    await context.getByRole('tab', { name: '工具', exact: true }).click()
    await expect(context).toContainText('不代表当前可执行权限')
    await page.evaluate(() => { (window as unknown as { __contextFail: boolean }).__contextFail = false })
    await context.getByRole('button', { name: '重试读取调用清单', exact: true }).click()
    await expect(context.getByRole('alert')).toHaveCount(0)
    await expect(context.getByRole('tab', { name: '工具', exact: true })).toHaveAttribute('aria-selected', 'true')
    await context.getByRole('combobox', { name: '选择保存的调用' }).selectOption('beta')
    await context.getByRole('tab', { name: '消息', exact: true }).click()
    await expect(context).toContainText('消息结构不是数组')
    await context.getByText('来源与完整保存结构', { exact: true }).click()
    await expect(context.locator('.debug-context-source pre')).toContainText('test-malformed')
    await page.evaluate(() => { (window as unknown as { __contextDetailFail: boolean }).__contextDetailFail = true })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(context.getByRole('alert')).toContainText('详情读取失败')
    await expect(context.locator('.debug-context-source pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __contextDetailFail: boolean }).__contextDetailFail = false })
    await context.getByRole('button', { name: '重试详情', exact: true }).click()
    await expect(context.getByRole('alert')).toHaveCount(0)
    for (const scale of ['sm', 'lg']) {
      await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
      expect(await context.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await page.screenshot({ path: info.outputPath('production-context.png') })
    await context.getByRole('button', { name: '查看这次调用', exact: true }).click()
    await panel.getByRole('tab', { name: '响应', exact: true }).click()
    await expect(panel.getByText('beta-raw', { exact: true })).toBeVisible()
  })
}


test('正式 Debug 系统与能力分源读取，局部失败不遮挡已读工具', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __systemFail: boolean; __tracesCalls: number }
    state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
    state.__systemFail = true; state.__tracesCalls = 0
    Object.assign(state.electronAPI.debug, {
      systemInfo: async () => {
        if (state.__systemFail) throw new Error('system failure')
        return { electron: 'test', node: 'test', chrome: 'test', platform: 'test', arch: 'test', appVersion: 'v-test', uptime: 12, memoryUsage: { rss: 10, heapUsed: 2, heapTotal: 5 }, toolCount: 1,
          settings: { model: 'registered-model', baseUrl: 'https://test.invalid', activeRoleId: 'lin', hasApiKey: false, hasCustomPrompt: false, sandboxMode: 'read-only', executionMode: 'auto', sessionTokenBudget: 0, dailyTokenBudget: 0 },
          permissionRules: { total: 0, enabled: 0, items: [], truncated: false }, skills: { total: 1, items: [{ name: 'same-name', source: 'builtin', description: 'skill-description' }], truncated: false },
          mcp: [{ id: 'test-mcp', name: 'test-mcp', status: 'error', toolCount: 0, error: '连接失败' }] }
      },
      tools: async () => [{ name: 'same-name', description: 'tool-description', parameters: { proof: 'schema-proof' }, metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true } }],
      traces: async () => { state.__tracesCalls++; throw new Error('unrelated trace failure') },
    })
  })
  await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
  const panel = page.getByTestId('dev-panel'), nav = panel.getByRole('navigation')
  await nav.getByRole('button', { name: '技能与工具', exact: true }).click()
  const tools = panel.getByTestId('debug-evidence-tools')
  await expect(panel.getByRole('alert')).toContainText('系统快照读取失败')
  await tools.locator('[data-record-id="tool:same-name"] button').click()
  await expect(tools.getByRole('article', { name: '能力详情' })).toContainText('tool-description')
  await tools.getByText('工具 Schema', { exact: true }).click()
  await expect(tools.locator('pre').first()).toContainText('schema-proof')
  await expect(panel.getByText('LLM 配置', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __tracesCalls: number }).__tracesCalls)).toBe(0)
  await page.evaluate(() => { (window as unknown as { __systemFail: boolean }).__systemFail = false })
  await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
  await expect(panel.getByRole('alert')).toHaveCount(0)
  await expect(tools.locator('[data-record-id="skill:same-name"]')).toBeVisible()
  await expect(tools.locator('pre').first()).toBeVisible()
  await tools.getByRole('combobox', { name: '工具形态筛选' }).selectOption('MCP')
  await tools.locator('[data-record-id="mcp:test-mcp"] button').click()
  await expect(tools.getByRole('article', { name: '能力详情' })).toContainText('工具数量未知')
  await nav.getByRole('button', { name: '系统状态', exact: true }).click()
  const system = panel.getByTestId('debug-evidence-system')
  await expect(system.locator('.debug-system-summary')).toContainText('registered-model')
  await expect(system.getByText('https://test.invalid', { exact: true })).toBeHidden()
  await system.locator('.debug-system-section > summary').filter({ hasText: '模型与执行' }).click()
  await expect(system.getByText('https://test.invalid', { exact: true })).toBeVisible()
  await page.evaluate(() => { (window as unknown as { __systemFail: boolean }).__systemFail = true })
  await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
  await expect(panel.getByRole('alert').first()).toContainText('系统快照读取失败')
  await expect(system.getByText('https://test.invalid', { exact: true })).toBeVisible()
  await expect(system.locator('[data-record-id]')).toHaveCount(0)
})

// 背景：生产日志不保存响应正文，缺字段不能冒充模型返回空字符串。
// 意图：沿正式调用页验证未返回、显式空字符串与实际已保存正文的三种读法；约束：不改变日志保留策略。
test('正式 LLM 响应区区分未保存与已保存空字符串', async ({ page }, info) => {
  await page.goto('/')
  await page.evaluate(() => {
    const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __responseMode: string }
    state.__responseMode = 'missing'
    const record = { id: 'saved-call-proof', model: 'saved-model', provider: 'test', caller: 'main', startedAt: 1, status: 'success', promptTokens: 1, completionTokens: 1, totalTokens: 2, durationMs: 1, toolCallCount: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }
    state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug,
      llmLogsQuery: async () => ({ records: [record], total: 1, storageBytes: 1 }),
      llmLogGet: async () => ({ ...record, requestMessages: [{ role: 'system', content: '（正文未持久化）', contentLength: 4096 }], requestTools: [], requestExtra: {}, responseToolCalls: [], ...(state.__responseMode === 'missing' ? {} : { responseContent: state.__responseMode === 'null' ? null : state.__responseMode === 'empty' ? '' : '原始已保存响应' }) }),
      assetUsageQuery: async () => ({ records: [], total: 0 }), onLLMCallEvent: () => () => {},
    } }
  })
  await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
  const panel = page.getByTestId('dev-panel')
  await panel.getByRole('navigation').getByRole('button', { name: 'LLM 调用', exact: true }).click()
  const calls = panel.getByTestId('llm-calls-panel')
  await calls.getByRole('tab', { name: '响应', exact: true }).click()
  await expect(calls).toContainText('响应正文未持久化或未返回')
  await expect(calls.getByText('（空）', { exact: true })).toHaveCount(0)
  for (const [mode, expected] of [['null', '响应正文未持久化或未返回'], ['empty', '（已保存空字符串）'], ['saved', '原始已保存响应']]) {
    await page.evaluate(mode => { (window as unknown as { __responseMode: string }).__responseMode = mode }, mode)
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(calls).toContainText(expected)
  }
  const prose = calls.locator('section').filter({ has: page.getByText('正文', { exact: true }) }).locator('pre')
  await expect(prose).toHaveCSS('font-size', '14px')
  await expect(prose).toHaveCSS('line-height', '24.5px')
  await expect(prose).toHaveCSS('font-family', await calls.evaluate(node => getComputedStyle(node).fontFamily))
  await calls.getByRole('tab', { name: 'System 1', exact: true }).click()
  await expect(calls).toContainText('正文未持久化 · 保存长度 4096 字符')
  for (const [theme, width] of [['porcelain-blue', 1096], ['yao-stone', 600]] as const) {
    await page.setViewportSize({ width, height: 850 })
    await page.evaluate(theme => { document.documentElement.setAttribute('data-theme', theme); (window as unknown as { __responseMode: string }).__responseMode = 'missing' }, theme)
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await calls.getByRole('tab', { name: '响应', exact: true }).click()
    await expect(calls).toContainText('响应正文未持久化或未返回')
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`llm-response-scope-${theme}.png`) })
    await calls.getByRole('tab', { name: 'System 1', exact: true }).click()
    await expect(calls).toContainText('保存长度 4096 字符')
    await page.screenshot({ path: info.outputPath(`llm-message-scope-${theme}.png`) })
  }

})

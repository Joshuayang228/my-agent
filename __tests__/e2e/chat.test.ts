/**
 * E2E 测试 — UI 交互测试（Vite dev server 环境）
 *
 * 这些测试通过浏览器验证 UI 渲染和交互逻辑。
 * IPC/LLM 相关功能在 electron.test.ts 中测试。
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { expectSharedCodeSurface } from './shared-code-surface'

for (const outerTheme of ['porcelain-blue', 'yao-stone']) {
  for (const width of [1166, 600]) {
    test(`设置主题与基础四主题同源 ${outerTheme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 731 })
      await page.addInitScript((value) => localStorage.setItem('theme', value), outerTheme)
      await page.goto('/')
      await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
      const nav = page.getByTestId('playground-nav')
      await nav.getByRole('button', { name: '设计语言', exact: true }).click()
      await page.getByRole('button', { name: '主题对照', exact: true }).click()
      const studies = await page.getByTestId('theme-study-grid').locator('article').evaluateAll((nodes) => nodes.map((node) => ({
        id: node.getAttribute('data-testid')!.replace('theme-study-', ''),
        label: node.querySelector('h4')!.textContent!,
        app: (node as HTMLElement).style.getPropertyValue('--study-app'),
        accent: (node as HTMLElement).style.getPropertyValue('--study-accent'),
        text: (node as HTMLElement).style.getPropertyValue('--study-text'),
      })))
      expect(studies.map((study) => study.label)).toEqual(['瓷青', '曜石', '松烟', '绛紫'])
      await nav.getByRole('button', { name: '设置', exact: true }).click()
      const settings = page.getByTestId('settings-candidate')
      const choices = settings.getByTestId('settings-candidate-theme-card')
      await expect(choices.getByRole('button')).toHaveCount(4)
      const savedBefore = await page.evaluate(() => JSON.stringify({ ...localStorage }))
      for (const study of studies) {
        const option = choices.getByTestId(`settings-candidate-theme-${study.id}`)
        await expect(option).toContainText(study.label)
        await option.focus()
        await page.keyboard.press('Enter')
        await expect(option).toHaveAttribute('aria-pressed', 'true')
        await expect(settings).toHaveAttribute('data-playground-theme', study.id)
        await expect(choices.locator('[aria-pressed="true"]')).toHaveCount(1)
        const colors = await settings.evaluate((node) => { const style = getComputedStyle(node); return ['--bg-primary', '--accent', '--text-primary'].map((token) => style.getPropertyValue(token).trim()) })
        expect(colors).toEqual([study.app, study.accent, study.text])
        expect(await choices.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
        await expect(page.locator('html')).toHaveAttribute('data-theme', outerTheme)
        expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(savedBefore)
        await choices.scrollIntoViewIfNeeded()
        await page.screenshot({ path: testInfo.outputPath(`theme-${study.id}.png`), animations: 'disabled' })
      }
      await settings.getByRole(width < 768 ? 'tab' : 'button', { name: '权限与自动化', exact: true }).click()
      await settings.getByRole(width < 768 ? 'tab' : 'button', { name: '外观与界面', exact: true }).click()
      await expect(choices.getByTestId('settings-candidate-theme-deep-plum')).toHaveAttribute('aria-pressed', 'true')
    })
  }
}

for (const theme of ['porcelain-blue', 'yao-stone']) {
  for (const width of [1166, 600]) {
    test(`记忆清单背景验收 ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 731 })
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
      await page.goto('/')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
      await page.getByTestId('playground-nav').getByRole('button', { name: '设置', exact: true }).click()
      const candidate = page.getByTestId('settings-surface-candidate')
      await candidate.getByTestId('settings-candidate-theme-card').getByRole('button', { name: theme === 'yao-stone' ? /曜石/ : /瓷青/ }).click()
      await candidate.getByRole(width < 640 ? 'tab' : 'button', { name: '记忆', exact: true }).click()
      const memory = page.getByTestId('memory-surface-candidate')
      await expect(memory).toContainText('正在做一款人格化桌面 Agent。')
      await expect(memory).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(memory).toHaveCSS('box-shadow', 'none')
      await expect(candidate.locator('.playground-experience-stage')).toHaveCount(0)
      expect(await memory.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      await memory.scrollIntoViewIfNeeded()
      const item = memory.getByTestId('memory-item-memory-user-identity')
      const date = item.getByTestId('memory-item-date-memory-user-identity')
      const actions = item.getByTestId('memory-item-actions-memory-user-identity')
      const controls = item.getByTestId('memory-item-controls-memory-user-identity')
      const geometry = () => item.evaluate((node) => {
        const card = node.getBoundingClientRect()
        const content = node.querySelector('p')!.getBoundingClientRect()
        const slot = node.querySelector('[data-testid^="memory-item-controls-"]')!.getBoundingClientRect()
        return { height: card.height, textX: content.x - card.x, textY: content.y - card.y, textWidth: content.width, slotX: slot.x - card.x, slotY: slot.y - card.y, slotWidth: slot.width, slotHeight: slot.height }
      })
      await page.mouse.move(0, 0)
      await expect(date).toHaveCSS('opacity', '1')
      await expect(actions).toHaveCSS('opacity', '0')
      const originalLayout = await geometry()
      expect(originalLayout.slotY).toBe(originalLayout.textY)
      expect(originalLayout.height).toBeLessThan(90)
      await page.screenshot({ path: testInfo.outputPath('memory-list.png'), animations: 'disabled' })
      await item.hover()
      await expect(date).toHaveCSS('opacity', '0')
      await expect(actions).toHaveCSS('opacity', '1')
      await expect(memory.getByTestId('memory-item-date-memory-user-background')).toHaveCSS('opacity', '1')
      expect(await geometry()).toEqual(originalLayout)
      await page.screenshot({ path: testInfo.outputPath('memory-hover.png'), animations: 'disabled' })
      await page.mouse.move(0, 0)
      await expect(date).toHaveCSS('opacity', '1')
      await item.getByRole('button', { name: /^编辑记忆 / }).focus()
      await expect(actions).toHaveCSS('opacity', '1')
      await expect(date).toHaveCSS('opacity', '0')
      await memory.getByRole('button', { name: /^编辑记忆 / }).first().click()
      await expect(memory.locator('input, textarea')).toBeVisible()
      await expect(date).toHaveCSS('opacity', '0')
      await expect(controls.getByRole('button', { name: /^保存记忆 / })).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('memory-edit.png'), animations: 'disabled' })
      await memory.getByRole('button', { name: /^取消编辑 / }).click()
      await page.getByRole('tab', { name: '长记忆', exact: true }).click()
      await expect(item).toContainText('在讨论一款需要长期使用的产品时')
      await expect(item).toContainText('这些偏好适用于日常协作')
      await page.mouse.move(0, 0)
      await expect(date).toHaveCSS('opacity', '1')
      const longLayout = await geometry()
      expect(longLayout.height).toBeGreaterThan(200)
      expect(longLayout.slotY).toBe(longLayout.textY)
      expect(await item.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('memory-long.png'), animations: 'disabled' })
      await item.hover()
      await expect(date).toHaveCSS('opacity', '0')
      await expect(actions).toHaveCSS('opacity', '1')
      expect(await geometry()).toEqual(longLayout)
      await page.screenshot({ path: testInfo.outputPath('memory-long-hover.png'), animations: 'disabled' })
      await item.getByRole('button', { name: /^编辑记忆 / }).click()
      await expect(item.locator('textarea')).toBeVisible()
      expect(await item.locator('textarea').evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThan(100)
      await item.getByRole('button', { name: /^取消编辑 / }).click()
      await controls.getByRole('button', { name: /^删除记忆 / }).click()
      await expect(controls.getByRole('button', { name: /^确认删除记忆 / })).toBeVisible()
      expect(await geometry()).toEqual(longLayout)
      await controls.getByRole('button', { name: /^取消删除 / }).click()
      await page.getByRole('tab', { name: '敏感项', exact: true }).click()
      const sensitiveCard = memory.getByTestId('memory-item-memory-sensitive')
      const warning = sensitiveCard.getByTestId('memory-sensitive-warning-memory-sensitive')
      await expect(warning).toHaveText('敏感信息：涉及健康隐私，请谨慎保留。')
      await expect(sensitiveCard.locator(':scope > :first-child')).toHaveAttribute('data-testid', 'memory-sensitive-warning-memory-sensitive')
      await expect(sensitiveCard).not.toContainText('敏感·健康')
      await expect(sensitiveCard).not.toContainText('你可以编辑或删除')
      await sensitiveCard.scrollIntoViewIfNeeded()
      expect(await sensitiveCard.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('memory-sensitive.png'), animations: 'disabled' })
      await sensitiveCard.hover()
      const warningBox = await warning.boundingBox()
      await sensitiveCard.getByRole('button', { name: /^编辑记忆 / }).click()
      await expect(warning).toBeVisible()
      expect(await warning.boundingBox()).toEqual(warningBox)
      await sensitiveCard.getByRole('button', { name: /^取消编辑 / }).click()
      await page.getByRole('tab', { name: '空态', exact: true }).click()
      await expect(memory).toContainText('还没有任何记忆')
      await memory.getByRole('button', { name: '添加一条记忆', exact: true }).click()
      await expect(memory.getByLabel('新记忆内容')).toBeVisible()
      expect(await memory.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('memory-empty-add.png'), animations: 'disabled' })
    })
  }
}

for (const theme of ['porcelain-blue', 'yao-stone']) {
  for (const width of [1166, 600]) {
    test(`自定义规则折叠与添加 ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 731 })
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
      await page.goto('/')
      await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
      await page.getByTestId('playground-nav').getByRole('button', { name: '设置', exact: true }).click()
      const candidate = page.getByTestId('settings-surface-candidate')
      await candidate.getByTestId('settings-candidate-theme-card').getByRole('button', { name: theme === 'yao-stone' ? /曜石/ : /瓷青/ }).click()
      await candidate.getByRole(width < 640 ? 'tab' : 'button', { name: '权限与自动化', exact: true }).click()
      const rules = candidate.getByTestId('settings-candidate-rules-existing')
      const toggle = rules.getByTestId('settings-candidate-rules-existing-toggle')
      const add = rules.getByTestId('settings-candidate-add-rule')
      const pattern = rules.getByLabel('规则匹配内容', { exact: true })
      const save = rules.getByTestId('settings-candidate-save-rule')
      const list = rules.getByRole('list', { name: '自定义规则列表' })
      await expect(toggle).toContainText('自定义规则')
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await expect(candidate.getByTestId('settings-candidate-rules-create')).toHaveCount(0)
      await expect(add).toHaveCount(0)
      await expect(list).toHaveCount(0)
      await page.screenshot({ path: testInfo.outputPath('rules-collapsed.png'), animations: 'disabled' })
      await toggle.focus()
      await page.keyboard.press('Enter')
      await expect(list.getByRole('listitem')).toHaveCount(1)
      await expect(pattern).toHaveCount(0)
      await expect(add).toBeVisible()
      // 展开表单会滚动页面，故比较容器内坐标；新增规则可推低入口，但展开和取消不能改变其位置。
      const measureRuleLayout = () => rules.evaluate((node) => {
        const card = node.getBoundingClientRect()
        const item = node.querySelector('li')!.getBoundingClientRect()
        const button = node.querySelector('[data-testid="settings-candidate-add-rule"]')!.getBoundingClientRect()
        return { x: item.x - card.x, y: item.y - card.y, width: item.width, height: item.height, buttonWidth: button.width, buttonHeight: button.height }
      })
      const measureAddPosition = () => add.evaluate((node) => {
        const section = node.closest('[data-testid="settings-candidate-rules-existing"]')!.getBoundingClientRect()
        const button = node.getBoundingClientRect()
        return { x: button.x - section.x, y: button.y - section.y }
      })
      const expectAddBelowList = async () => {
        expect(await rules.evaluate((node) => {
          const list = node.querySelector('ul')!
          const button = node.querySelector('[data-testid="settings-candidate-add-rule"]')!
          return Boolean(list.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING)
            && button.getBoundingClientRect().top >= list.getBoundingClientRect().bottom + 8
        })).toBe(true)
      }
      await expect(rules).toHaveCSS('border-top-width', '0px')
      await expect(rules).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      const ruleCard = list.getByTestId('settings-candidate-rule-card').first()
      await expect(ruleCard).toHaveCSS('border-top-width', '1px')
      await expect(ruleCard).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(ruleCard).not.toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')
      await expectAddBelowList()
      const initialLayout = await measureRuleLayout()
      const initialAddPosition = await measureAddPosition()
      await page.screenshot({ path: testInfo.outputPath('rules-expanded.png'), animations: 'disabled' })
      await add.click()
      await expect(add).toHaveAccessibleName('取消添加')
      await expect(add).toHaveAttribute('aria-expanded', 'true')
      expect(await measureRuleLayout()).toEqual(initialLayout)
      expect(await measureAddPosition()).toEqual(initialAddPosition)
      await add.click()
      await expect(pattern).toHaveCount(0)
      await expect(add).toHaveAccessibleName('添加')
      expect(await measureRuleLayout()).toEqual(initialLayout)
      expect(await measureAddPosition()).toEqual(initialAddPosition)
      await add.click()
      await expect(save).toBeDisabled()
      await pattern.fill('   ')
      await expect(save).toBeDisabled()
      await pattern.fill('cancelled-command')
      await rules.getByRole('button', { name: '取消', exact: true }).click()
      await expect(pattern).toHaveCount(0)
      expect(await measureRuleLayout()).toEqual(initialLayout)
      expect(await measureAddPosition()).toEqual(initialAddPosition)
      await expect(list.getByRole('listitem')).toHaveCount(1)
      await add.click()
      await expect(pattern).toHaveValue('')
      await toggle.click()
      await toggle.click()
      await expect(pattern).toHaveCount(0)
      await add.click()
      await pattern.fill('git push')
      await rules.getByLabel('规则处理方式', { exact: true }).selectOption('需要确认')
      await page.screenshot({ path: testInfo.outputPath('rules-form.png'), animations: 'disabled' })
      await save.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await expect(toggle).toContainText('2 条')
      await expect(pattern).toHaveCount(0)
      await expect(add).toBeVisible()
      await expect(add).toHaveAccessibleName('添加')
      expect(await measureRuleLayout()).toEqual(initialLayout)
      await expect(list.getByRole('listitem')).toHaveCount(2)
      await expectAddBelowList()
      await expect(list).toContainText('npm publish')
      await expect(list).toContainText('git push')
      await expect(list).not.toContainText('cancelled-command')
      await add.click()
      await rules.getByLabel('规则操作类型', { exact: true }).selectOption('修改文件')
      await pattern.fill(`src/${'long-path-'.repeat(24)}.ts`)
      await save.click()
      await expect(list.getByRole('listitem')).toHaveCount(3)
      await expectAddBelowList()
      expect(await rules.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('rules-saved.png'), animations: 'disabled' })
    })
  }
}

/**
 * 正式 Chat 右坞的 UI 契约测试只替身 Electron 边界，不替身右坞本身。
 * 这样可以验证真实 App → ChatRightDock → FileBrowser 的状态共享，同时不连接本机会话、文件系统或模型。
 */
async function installProductionElectronStub(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const noopCleanup = () => {}
    ;(window as any).electronAPI = {
      session: {
        list: async () => [],
        get: async () => null,
        create: async () => ({ id: 'e2e-session' }),
        delete: async () => ({ success: true }),
        rename: async () => ({ success: true }),
        onFileChange: () => noopCleanup,
        listFileChanges: async () => [],
        getFileChangeDiff: async () => ({ diff: '' }),
        clearFileChanges: async () => ({ success: true }),
      },
      settings: {
        get: async () => ({ llmApiKeyConfigured: 'true', llmModel: 'e2e-model', executionMode: 'confirm-all', pinnedSessions: '[]' }),
        set: async () => ({ success: true }),
      },
      companion: {
        getActive: async () => ({ id: 'lin', name: '测试伙伴', description: '测试用伙伴' }),
        listProtagonists: async () => [],
        getRoster: async () => ({ cast: [] }),
      },
      project: {
        get: async () => ({ path: 'C:\\\\e2e-project', name: '测试项目' }),
        list: async () => [{ path: 'C:\\\\e2e-project', name: '测试项目' }],
        listFiles: async () => ([
          { name: 'src', path: 'C:\\\\e2e-project\\\\src', isDir: true, children: [
            { name: 'App.tsx', path: 'C:\\\\e2e-project\\\\src\\\\App.tsx', isDir: false },
          ] },
        ]),
        readFile: async (filePath: string) => ({ kind: 'text', content: 'const ready = true', languageHint: filePath.endsWith('.tsx') ? 'typescript' : 'text', size: 18 }),
        openExternal: async () => ({ ok: true }),
      },
      tasks: { sync: async () => ({ active: [], pendingNotify: [] }), onEvent: () => noopCleanup },
      chat: { onEvent: () => noopCleanup, onConfirmRequest: () => noopCleanup },
      mcp: {},
    }
  })
}


test('正式 MCP 设置在缺少状态订阅时仍可打开', async ({ page }) => {
  await installProductionElectronStub(page)
  await page.goto('/')
  await page.getByTestId('primary-sidebar').getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('button', { name: 'MCP', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'MCP', exact: true })).toBeVisible()
  await expect(page.getByText('暂无 MCP 服务器', { exact: false })).toBeVisible()
})

test('MCP 共享表单取消迟到结果、字段失效和重测', async ({ page }, testInfo) => {
  await installProductionElectronStub(page)
  await page.addInitScript(() => {
    const state = { requests: [] as string[], cancelled: [] as string[], pending: {} as Record<string, (value: unknown) => void>, failCancel: false }
    ;(window as any).__mcpLifecycle = state
    const api = (window as any).electronAPI.mcp
    api.testConnection = (id: string) => { state.requests.push(id); return new Promise((resolve) => { state.pending[id] = resolve }) }
    api.cancelTest = async (id: string) => {
      if (state.failCancel) { state.failCancel = false; return { ok: false } }
      state.cancelled.push(id); return { ok: true }
    }
  })
  await page.goto('/')
  await page.getByTestId('primary-sidebar').getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('button', { name: 'MCP', exact: true }).click()
  await page.getByRole('button', { name: '+ 添加', exact: true }).click()
  const form = page.getByTestId('mcp-connection-form')
  const testButton = form.getByRole('button', { name: '测试连接', exact: true })
  await form.getByLabel('连接名称').fill('研究资料')
  await form.getByLabel('服务 URL').fill('https://example.com/mcp')
  const before = await testButton.boundingBox()
  await testButton.hover()
  expect(await testButton.boundingBox()).toEqual(before)
  await testButton.click()
  await expect(form.getByRole('button', { name: '本地服务', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '+ 添加', exact: true })).toBeDisabled()
  const pending = await testButton.boundingBox()
  expect({ width: pending!.width, height: pending!.height }).toEqual({ width: before!.width, height: before!.height })
  await page.evaluate(() => { (window as any).__mcpLifecycle.failCancel = true })
  await form.getByRole('button', { name: '取消测试', exact: true }).click()
  await expect(form.getByRole('alert')).toContainText('未能确认测试连接关闭')
  await expect(testButton).toBeDisabled()
  await form.getByRole('button', { name: '取消测试', exact: true }).click()
  await expect(testButton).toBeEnabled()
  await expect(form.getByLabel('连接名称')).toHaveValue('研究资料')
  await page.evaluate(() => { const s = (window as any).__mcpLifecycle; s.pending[s.requests[0]]({ ok: true, tools: [{ name: 'stale', description: '过期结果' }] }) })
  await expect(form.getByText('过期结果')).toHaveCount(0)
  await expect(form.getByRole('button', { name: '保存连接', exact: true })).toBeDisabled()
  await testButton.click()
  const resolveLatest = () => page.evaluate(() => { const s = (window as any).__mcpLifecycle; s.pending[s.requests.at(-1)]({ ok: true, tools: [{ name: 'search_docs', description: '搜索文档' }] }) })
  await resolveLatest()
  await expect(form.getByText('已获取 1 个工具')).toBeVisible()
  await form.getByLabel('连接名称').fill('修改后的资料')
  await expect(form.getByRole('button', { name: '保存连接', exact: true })).toBeDisabled()
  await expect(testButton).toBeEnabled()
  await testButton.click()
  await resolveLatest()
  await expect(form.getByText('已获取 1 个工具')).toBeVisible()
  await testButton.click()
  await expect(form.getByText('正在连接并获取工具…')).toBeVisible()
  await resolveLatest()
  await expect(form.getByText('已获取 1 个工具')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('mcp-shared-form-ready.png'), animations: 'disabled' })
  await form.getByRole('button', { name: '关闭添加连接', exact: true }).click()
  await expect(form).toHaveCount(0)
  expect(await page.evaluate(() => { const s = (window as any).__mcpLifecycle; return { requests: s.requests.length, cancelled: s.cancelled.length, unique: new Set(s.requests).size } })).toEqual({ requests: 4, cancelled: 4, unique: 4 })
})

test('MCP 重测等待清理时离开页面不会启动新连接', async ({ page }) => {
  await installProductionElectronStub(page)
  await page.addInitScript(() => {
    const state = { tests: 0, pending: [] as Array<() => void> }
    ;(window as any).__mcpUnmount = state
    const api = (window as any).electronAPI.mcp
    api.testConnection = async () => { state.tests++; return { ok: true, tools: [] } }
    api.cancelTest = () => new Promise((resolve) => { state.pending.push(() => resolve({ ok: true })) })
  })
  await page.goto('/')
  await page.getByTestId('primary-sidebar').getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('button', { name: 'MCP', exact: true }).click()
  await page.getByRole('button', { name: '+ 添加', exact: true }).click()
  const form = page.getByTestId('mcp-connection-form')
  await form.getByLabel('连接名称').fill('文档服务')
  await form.getByLabel('服务 URL').fill('https://example.com/mcp')
  await form.getByRole('button', { name: '测试连接', exact: true }).click()
  await expect(form.getByText('已获取 0 个工具')).toBeVisible()
  await form.getByRole('button', { name: '测试连接', exact: true }).click()
  await expect(form.getByText('正在取消测试…')).toBeVisible()
  await page.getByRole('button', { name: '外观与界面', exact: true }).click()
  await expect(form).toHaveCount(0)
  await page.evaluate(async () => { const state = (window as any).__mcpUnmount; state.pending.forEach((resolve: () => void) => resolve()); await new Promise((resolve) => setTimeout(resolve, 0)) })
  expect(await page.evaluate(() => (window as any).__mcpUnmount.tests)).toBe(1)
})

test('MCP 已保存但刷新失败只重试刷新，不重复保存', async ({ page }) => {
  await installProductionElectronStub(page)
  await page.addInitScript(() => {
    const state = { saves: 0, failRefresh: false }
    ;(window as any).__mcpRefresh = state
    const api = (window as any).electronAPI
    const get = api.settings.get
    api.settings.get = async () => { if (state.failRefresh) { state.failRefresh = false; throw new Error('fixture refresh failure') }; return get() }
    api.mcp.testConnection = async () => ({ ok: true, tools: [] })
    api.mcp.cancelTest = async () => ({ ok: true })
    api.mcp.saveTested = async () => { state.saves++; state.failRefresh = true; return { ok: false, savedServerId: 'saved', error: '连接已保存，但未能启用，请在服务列表中重试。' } }
  })
  await page.goto('/')
  await page.getByTestId('primary-sidebar').getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('button', { name: 'MCP', exact: true }).click()
  await page.getByRole('button', { name: '+ 添加', exact: true }).click()
  const form = page.getByTestId('mcp-connection-form')
  await form.getByLabel('连接名称').fill('零工具服务')
  await form.getByLabel('服务 URL').fill('https://example.com/mcp')
  await form.getByRole('button', { name: '测试连接', exact: true }).click()
  await expect(form.getByText('已获取 0 个工具')).toBeVisible()
  await form.getByRole('button', { name: '保存连接', exact: true }).dblclick()
  await expect(form.getByRole('alert')).toContainText('连接已保存，但列表刷新失败')
  await form.getByRole('button', { name: '刷新列表', exact: true }).click()
  await expect(form).toHaveCount(0)
  expect(await page.evaluate(() => (window as any).__mcpRefresh.saves)).toBe(1)
})

for (const theme of ['porcelain-blue', 'yao-stone', 'song-smoke', 'deep-plum']) {
  for (const width of [1166, 600]) {
    test(`正式 MCP 共享服务卡与操作恢复 ${theme} ${width}`, async ({ page }, testInfo) => {
      await installProductionElectronStub(page)
      await page.addInitScript((theme) => {
        localStorage.setItem('theme', theme)
        const api = (window as any).electronAPI
        const harness = { readError: false, saveError: false, toolError: false, status: 'error', connects: 0, disconnects: 0, finish: () => {},
          servers: [{ id: 'service', name: '测试服务', enabled: true, command: 'secret-command-not-for-card', args: ['secret-argument'], allowedTools: ['read'], env: {}, transport: 'stdio' }],
          tools: [{ serverId: 'service', serverName: '测试服务', name: 'read', description: '工具说明'.repeat(1000), allowed: true }] }
        ;(window as any).__mcpHarness = harness
        const get = api.settings.get
        api.settings.get = async () => ({ ...await get(), mcpServers: JSON.stringify(harness.servers) })
        api.settings.set = async (key: string, value: string) => { if (key === 'mcpServers') { if (harness.saveError) throw new Error('synthetic save rejection'); harness.servers = JSON.parse(value) } }
        api.mcp.status = async () => { if (harness.readError) throw new Error('synthetic status failure'); return [{ id: 'service', name: '测试服务', status: harness.status, toolCount: 1 }] }
        api.mcp.listTools = async () => harness.tools
        api.mcp.connect = async () => { harness.connects++; harness.status = 'connecting'; return new Promise((resolve) => { harness.finish = () => { harness.status = 'connected'; resolve({ success: true }) } }) }
        api.mcp.disconnect = async () => { harness.disconnects++; harness.status = 'disconnected'; return { success: true } }
        api.mcp.setToolAllowed = async (_id: string, name: string, allowed: boolean) => {
          if (harness.toolError) return { success: false, error: '测试许可保存失败' }
          harness.tools = harness.tools.map((tool) => tool.name === name ? { ...tool, allowed } : tool)
          harness.servers[0].allowedTools = harness.tools.filter((tool) => tool.allowed).map((tool) => tool.name)
          return { success: true }
        }
      }, theme)
      await page.setViewportSize({ width, height: 731 })
      await page.goto('/')
      await page.getByTestId('primary-sidebar').getByRole('button', { name: '设置', exact: true }).click()
      await page.getByRole(width < 640 ? 'tab' : 'button', { name: 'MCP', exact: true }).click()
      const card = page.getByTestId('settings-mcp-server-service')
      await expect(card.getByRole('status')).toHaveText('连接失败')
      await expect(card).not.toContainText('secret-command')
      const toggle = card.getByRole('switch')
      const before = await toggle.boundingBox()
      await card.getByRole('button', { name: '重试', exact: true }).click()
      await expect(card.getByRole('status')).toHaveText('连接中')
      await expect(toggle).toBeDisabled()
      expect(await toggle.boundingBox()).toEqual(before)
      await page.evaluate(() => (window as any).__mcpHarness.finish())
      await expect(card.getByRole('status')).toHaveText('已连接')
      const permission = card.getByRole('checkbox', { name: '允许read', exact: true })
      await page.evaluate(() => { (window as any).__mcpHarness.toolError = true })
      await permission.click()
      await expect(permission).toBeChecked()
      await page.evaluate(() => { (window as any).__mcpHarness.toolError = false })
      await permission.uncheck()
      await expect(permission).not.toBeChecked()
      await page.evaluate(() => { (window as any).__mcpHarness.readError = true })
      await permission.click()
      await expect(page.getByRole('alert').filter({ hasText: '连接状态或工具清单读取失败' })).toBeVisible()
      await expect(card).toContainText('工具清单尚未获取')
      await expect(card).not.toContainText('0 个工具')
      await page.evaluate(() => { (window as any).__mcpHarness.readError = false })
      await page.getByRole('button', { name: '刷新', exact: true }).click()
      await expect(permission).toBeChecked()
      await permission.uncheck()
      await expect(permission).not.toBeChecked()
      expect(await card.locator('ul').evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('mcp-service.png'), animations: 'disabled' })
      await page.evaluate(() => { (window as any).__mcpHarness.saveError = true })
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-checked', 'true')
      expect(await page.evaluate(() => (window as any).__mcpHarness.disconnects)).toBe(0)
      await page.evaluate(() => { (window as any).__mcpHarness.saveError = false })
      await toggle.click()
      await expect(card.getByRole('status')).toHaveText('已停用')
      expect(await page.evaluate(() => (window as any).__mcpHarness.servers[0].allowedTools)).toEqual([])
      expect(await card.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      await page.evaluate(() => { (window as any).__mcpHarness.saveError = true })
      await card.getByRole('button', { name: '删除测试服务', exact: true }).click()
      await expect(card).toBeVisible()
      expect(await page.evaluate(() => (window as any).__mcpHarness.disconnects)).toBe(1)
      await page.evaluate(() => { (window as any).__mcpHarness.saveError = false })
      await card.getByRole('button', { name: '删除测试服务', exact: true }).click()
      await expect(card).toHaveCount(0)
      expect(await page.evaluate(() => (window as any).__mcpHarness.servers)).toEqual([])
    })

    test(`正式 MCP Streamable HTTP 配置展示 ${theme} ${width}`, async ({ page }, testInfo) => {
      await installProductionElectronStub(page)
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem('theme', selectedTheme)
        const api = (window as any).electronAPI
        const get = api.settings.get
        api.settings.get = async () => ({ ...await get(), mcpServers: JSON.stringify([{
          id: 'remote', name: '远程文档服务', command: '', args: [], enabled: true,
          transport: 'streamable-http', url: 'https://example.com/mcp', bearerToken: '__MY_AGENT_REDACTED__',
        }]) })
        api.mcp.status = async () => [{ id: 'remote', name: '远程文档服务', status: 'connected', toolCount: 0 }]
        api.mcp.listTools = async () => []
      }, theme)
      await page.setViewportSize({ width, height: 731 })
      await page.goto('/')
      await page.getByTestId('primary-sidebar').getByRole('button', { name: '设置', exact: true }).click()
      await page.getByRole(width < 640 ? 'tab' : 'button', { name: 'MCP', exact: true }).click()
      const card = page.getByTestId('settings-mcp-server-remote')
      await expect(card.getByRole('status')).toHaveText('已连接')
      await expect(card).toContainText('远程 · Streamable HTTP')
      await expect(card).toContainText('0 个工具')
      await expect(card).not.toContainText('__MY_AGENT_REDACTED__')
      expect(await card.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('mcp-streamable-http.png'), animations: 'disabled' })
    })

    test(`正式 MCP 添加连接先测后存 ${theme} ${width}`, async ({ page }) => {
      await installProductionElectronStub(page)
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem('theme', selectedTheme)
        const api = (window as any).electronAPI
        const state = { tested: false, cancelled: false, saved: false, failSave: true }
        ;(window as any).__mcpAddHarness = state
        api.mcp.testConnection = async (_requestId: string, config: any) => { state.tested = true; return { ok: true, tools: [{ name: 'search_docs', description: '搜索文档' }] } }
        api.mcp.cancelTest = async () => { state.cancelled = true; state.tested = false; return { ok: true } }
        api.mcp.saveTested = async (_requestId: string, allowed: string[]) => {
          if (!state.tested) return { ok: false, error: '测试结果已失效，请重新测试连接。' }
          if (state.failSave) { state.failSave = false; return { ok: false, error: '连接未保存，请重试；当前测试结果仍保留。' } }
          state.saved = true
          return { ok: true, serverId: 'new-remote' }
        }
        const getSettings = api.settings.get
        api.settings.get = async () => ({ ...await getSettings(), mcpServers: '[]' })
      }, theme)
      await page.setViewportSize({ width, height: 731 })
      await page.goto('/')
      await page.getByTestId('primary-sidebar').getByRole('button', { name: '设置', exact: true }).click()
      await page.getByRole(width < 640 ? 'tab' : 'button', { name: 'MCP', exact: true }).click()
      await page.getByRole('button', { name: '+ 添加', exact: true }).click()
      const form = page.getByTestId('mcp-connection-form')
      await form.getByLabel('连接名称').fill('文档服务')
      await form.getByLabel('服务 URL').fill('https://example.com/mcp')
      await form.getByRole('button', { name: '测试连接', exact: true }).click()
      await expect(form.getByText('已获取 1 个工具')).toBeVisible()
      expect(await page.evaluate(() => (window as any).__mcpAddHarness.cancelled)).toBe(false)
      await form.getByRole('checkbox', { name: '允许search_docs', exact: true }).uncheck()
      await form.getByRole('button', { name: '保存连接', exact: true }).click()
      expect(await page.evaluate(() => (window as any).__mcpAddHarness.saved)).toBe(false)
      await expect(form.getByRole('alert')).toContainText('连接未保存')
      await form.getByRole('button', { name: '保存连接', exact: true }).click()
      await expect(form).toHaveCount(0)
      expect(await page.evaluate(() => (window as any).__mcpAddHarness.saved)).toBe(true)
      await page.screenshot({ path: `var/verification/mcp-add-${theme}-${width}.png`, animations: 'disabled' })
    })

    test(`正式 MCP 异常断开订阅恢复 ${theme} ${width}`, async ({ page }) => {
      await installProductionElectronStub(page)
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem('theme', selectedTheme)
        const api = (window as any).electronAPI
        const listeners = []
        const harness = {
          status: 'connected',
          reconnecting: false,
          error: undefined,
          connects: 0,
          emit() {
            const snapshot = [{
              id: 'service',
              name: '文档服务',
              status: harness.status,
              toolCount: harness.status === 'connected' ? 1 : 0,
              reconnecting: harness.reconnecting,
              error: harness.error,
            }]
            for (const listener of listeners) listener(snapshot)
          },
        }
        ;(window as any).__mcpDisconnectHarness = harness
        harness.pendingStatus = []
        harness.delayStatus = true
        const getSettings = api.settings.get
        api.settings.get = async () => ({ ...await getSettings(), mcpServers: JSON.stringify([{
          id: 'service', name: '文档服务', enabled: true, command: 'npx', args: [], transport: 'stdio',
        }]) })
        api.mcp.status = async () => {
          const snapshot = [{
            id: 'service', name: '文档服务', status: harness.status, toolCount: harness.status === 'connected' ? 1 : 0,
            reconnecting: harness.reconnecting, error: harness.error,
          }]
          return harness.delayStatus ? new Promise((resolve) => harness.pendingStatus.push(() => resolve(snapshot))) : snapshot
        }
        api.mcp.listTools = async () => harness.status === 'connected'
          ? [{ serverId: 'service', serverName: '文档服务', name: 'search_docs', description: '搜索文档', allowed: true }]
          : []
        api.mcp.onStatusChanged = (callback) => {
          listeners.push(callback)
          return () => {
            const index = listeners.indexOf(callback)
            if (index >= 0) listeners.splice(index, 1)
          }
        }
        api.mcp.connect = async () => {
          harness.connects += 1
          harness.status = 'connecting'
          harness.reconnecting = false
          harness.error = undefined
          harness.emit()
          harness.status = 'connected'
          harness.emit()
          return { success: true }
        }
      }, theme)
      await page.setViewportSize({ width, height: 731 })
      await page.goto('/')
      await page.getByTestId('primary-sidebar').getByRole('button', { name: '设置', exact: true }).click()
      await page.getByRole(width < 640 ? 'tab' : 'button', { name: 'MCP', exact: true }).click()
      const card = page.getByTestId('settings-mcp-server-service')
      await page.evaluate(() => (window as any).__mcpDisconnectHarness.emit())
      await expect(card.getByRole('status')).toHaveText('已连接')
      await page.evaluate(() => {
        const harness = (window as any).__mcpDisconnectHarness
        harness.status = 'error'
        harness.reconnecting = true
        harness.error = '服务意外断开，正在尝试重新连接。'
        harness.emit()
      })
      await expect(card.getByRole('status')).toHaveText('连接失败')
      await expect(card).toContainText('服务意外断开，正在尝试重新连接。')
      await page.evaluate(async () => {
        const harness = (window as any).__mcpDisconnectHarness
        harness.delayStatus = false
        harness.pendingStatus.forEach((resolve) => resolve())
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      await expect(card.getByRole('status')).toHaveText('连接失败')
      await expect(card.getByRole('button', { name: '重试', exact: true })).toBeVisible()
      await card.getByRole('button', { name: '重试', exact: true }).click()
      await expect(card.getByRole('status')).toHaveText('已连接')
      expect(await page.evaluate(() => (window as any).__mcpDisconnectHarness.connects)).toBe(1)
    })
  }
}

for (const theme of ['porcelain-blue', 'yao-stone', 'song-smoke', 'deep-plum']) {
  for (const width of [1166, 600]) {
    test(`正式文化家居足迹响应映射与失败恢复 ${theme} ${width}`, async ({ page }, testInfo) => {
      await installProductionElectronStub(page)
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem('theme', selectedTheme)
        const harness = { fail: false, mismatch: false, roleId: 'lin', empty: false }
        ;(window as any).__worldDetailsHarness = harness
        const api = (window as any).electronAPI.companion
        api.getActive = async () => ({ id: harness.roleId, name: harness.roleId === 'lin' ? '测试伙伴' : '另一位伙伴', description: '' })
        api.catchupStatus = async () => ({ roleId: harness.roleId, presence: '正在房间读书' })
        api.getMoments = async () => ({ roleId: harness.roleId, items: harness.empty ? [] : [
          { id: 'visit-1', roleId: harness.roleId, publishedAt: Date.UTC(2026, 8, 1, 8), text: '记下了今天散步的经过。'.repeat(80), meta: { location: '实际到过的公园' } },
          { id: 'visit-2', roleId: harness.roleId, publishedAt: Date.UTC(2026, 8, 2, 8), text: '第二次到访，另一段经历。', meta: { location: '实际到过的公园' } },
        ] })
        api.getAssets = async () => {
          if (harness.fail) throw new Error('测试读取失败')
          return { roleId: harness.mismatch ? 'wrong-role' : harness.roleId, items: harness.empty ? [] : [
            { id: 'home-a', kind: 'home', name: `${harness.roleId}的住所`, payload: { residence: '真实住所描述', interior: '很长的房间描述。\n'.repeat(80) } },
            { id: 'lamp-a', kind: 'furniture', name: '真实台灯', payload: { description: '已记录的桌上物件' } },
            { id: 'place-a', kind: 'footprint', name: '常去图书馆', payload: { description: '只记录常去，不代表今天到访', city: '记录中的城市' } },
            { id: 'wanted-a', kind: 'footprint', name: '想去的山谷', payload: { visitStatus: 'wanted', description: '尚未去过' } },
            { id: 'clothes-a', kind: 'wardrobe', name: '不属于家居的外套', payload: {} },
            ...['reading', 'music', 'film', 'photography'].map((type) => ({ id: type, kind: 'culture', name: `已记录作品-${type}`, payload: { type, detail: `已记录摘要-${type}`, note: type === 'reading' ? '长读书笔记。\n'.repeat(80) : '' } })),
            { id: 'book-a', kind: 'bookshelf', name: '已有书架作品', payload: { author: '书架作者', note: '书架笔记不能丢' } },
          ] }
        }
      }, theme)
      await page.setViewportSize({ width, height: 731 })
      await page.goto('/')
      await page.getByTestId('primary-sidebar').getByRole('button', { name: '人物世界', exact: true }).click()
      await page.getByTestId('world-tab-home').click()
      const details = page.getByTestId('world-details')
      await expect(details.locator('[data-world-content="home"]')).toBeVisible()
      await expect(details).toContainText('lin的住所')
      await expect(details).toContainText('真实台灯')
      await expect(details).not.toContainText('不属于家居的外套')
      const panel = page.locator('#world-panel-home')
      expect(await panel.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true)
      expect(await details.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      const refresh = details.getByRole('button', { name: '刷新生活面', exact: true })
      const geometry = await refresh.boundingBox()
      await page.evaluate(() => { (window as any).__worldDetailsHarness.fail = true })
      await refresh.click()
      await expect(details.getByRole('alert')).toContainText('请重试')
      await expect(details).toContainText('真实台灯')
      const retry = details.getByRole('button', { name: '重试生活面', exact: true })
      expect(await retry.boundingBox()).toEqual(geometry)
      await page.evaluate(() => { (window as any).__worldDetailsHarness.fail = false })
      await retry.click()
      await expect(details.getByRole('alert')).toHaveCount(0)
      await page.screenshot({ path: testInfo.outputPath('world-home.png'), animations: 'disabled' })
      await page.getByTestId('world-tab-footprints').click()
      await expect(details.locator('[data-world-content="footprints"]')).toBeVisible()
      await expect(details).toContainText('常去图书馆')
      await expect(details.getByRole('region', { name: '想去的地方' })).toContainText('想去的山谷')
      await expect(details.getByRole('region', { name: '常去地点' })).not.toContainText('想去的山谷')
      await expect(details.locator('time')).toHaveCount(2)
      await expect(details.locator('time').first()).toHaveText('2026/9/1')
      await expect(details).toContainText('第二次到访，另一段经历。')
      expect(await details.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('world-footprints.png'), animations: 'disabled' })
      await page.getByTestId('world-tab-culture').click()
      const culture = details.locator('[data-world-content="culture"]')
      await expect(culture).toBeVisible()
      for (const label of ['读书', '音乐', '电影', '摄影', '读书笔记', '书架笔记不能丢', '已记录摘要-reading']) await expect(culture).toContainText(label)
      await expect(culture.getByRole('article')).toHaveCount(5)
      await expect(culture.locator('article article')).toHaveCount(0)
      await expect(culture).not.toContainText('真实台灯')
      expect(await culture.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      expect(await page.locator('#world-panel-culture').evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('world-culture.png'), animations: 'disabled' })
      await page.getByTestId('world-tab-footprints').click()
      await page.evaluate(() => { (window as any).__worldDetailsHarness.mismatch = true })
      await details.getByRole('button', { name: '刷新生活面' }).click()
      await expect(page.getByTestId('world-details')).toHaveCount(0)
      await expect(page.getByRole('button', { name: '重试生活面' })).toBeVisible()
      await page.evaluate(() => { Object.assign((window as any).__worldDetailsHarness, { mismatch: false, roleId: 'zhou', empty: true }) })
      await page.getByRole('button', { name: '重试生活面' }).click()
      await expect(details).toContainText('另一位伙伴的足迹')
      await expect(details).toContainText('还没有记录到生活地点。')
      await expect(details).not.toContainText('实际到过的公园')
      await page.getByTestId('world-tab-culture').click()
      await expect(details).toContainText('还没有记录文化生活。')
      await expect(details).not.toContainText('已记录作品')
    })
  }
}

async function installTerminalLifecycleStub(page: import('@playwright/test').Page) {
  await installProductionElectronStub(page)
  await page.addInitScript(() => {
    const api = (window as any).electronAPI
    const stdout = new Set<(event: any) => void>()
    const stderr = new Set<(event: any) => void>()
    const exit = new Set<(event: any) => void>()
    const pending = new Map<string, (value: any) => void>()
    const pendingKills = new Map<string, (value: any) => void>()
    const harness = {
      runMode: 'normal', killMode: 'normal',
      runs: [] as { id: string; command: string; cwd?: string }[], kills: [] as string[],
      resolveRun: (id: string) => pending.get(id)?.({ ok: true, runId: id }),
      resolveKill: (id: string) => pendingKills.get(id)?.({ ok: true }),
      emit: (kind: string, event: any) => (kind === 'stdout' ? stdout : kind === 'stderr' ? stderr : exit).forEach((listener) => listener(event)),
      listeners: () => stdout.size + stderr.size + exit.size,
    }
    ;(window as any).__terminalHarness = harness
    api.terminal = {
      run: async (input: { command: string; cwd?: string }) => {
        const id = 'run-' + (harness.runs.length + 1)
        harness.runs.push({ id, ...input })
        if (harness.runMode === 'reject') throw new Error('synthetic IPC failure')
        if (harness.runMode === 'blocked') return { ok: false, error: '命令未获批准' }
        if (harness.runMode === 'pending') return new Promise((resolve) => pending.set(id, resolve))
        return { ok: true, runId: id }
      },
      ready: async () => ({ ok: true }),
      kill: async (id: string) => {
        harness.kills.push(id)
        if (harness.killMode === 'reject') throw new Error('synthetic kill failure')
        if (harness.killMode === 'pending') return new Promise((resolve) => pendingKills.set(id, resolve))
        return { ok: harness.killMode === 'normal' }
      },
      onStdout: (listener: (event: any) => void) => { stdout.add(listener); return () => stdout.delete(listener) },
      onStderr: (listener: (event: any) => void) => { stderr.add(listener); return () => stderr.delete(listener) },
      onExit: (listener: (event: any) => void) => { exit.add(listener); return () => exit.delete(listener) },
    }
    api.mcp.status = async () => []
    api.project.list = async () => [{ path: 'C:\\\\e2e-project', name: '测试项目' }, { path: 'C:/second-project', name: '第二项目' }]
    api.project.set = async () => ({ ok: true })
  })
}

test.describe('My Agent UI', () => {
  test('应用标题和基础 UI 可见', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('[data-testid="chat-messages"] h1')).toContainText('我是')
    await expect(page.locator('[data-testid="primary-sidebar"]')).toBeVisible()

    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()
    await expect(textarea).toHaveAttribute('placeholder', /说说/)

    const sendBtn = page.getByTitle('发送')
    await expect(sendBtn).toBeVisible()
    await expect(sendBtn).toBeDisabled()
  })

  test('侧边栏搜索在原入口行内展开', async ({ page }) => {
    await page.goto('/')

    const sidebar = page.locator('[data-testid="primary-sidebar"]')
    const toolbar = sidebar.getByTestId('sidebar-toolbar')
    await expect(sidebar.getByTitle('搜索会话')).toBeVisible()
    await expect(sidebar.getByTestId('sidebar-session-search')).toHaveCount(0)

    await sidebar.getByTitle('搜索会话').click()
    const search = sidebar.getByTestId('sidebar-session-search')
    await expect(search).toBeVisible()
    await expect(sidebar.getByRole('button', { name: '新对话', exact: true })).toHaveCount(0)
    await expect(toolbar.locator('input')).toHaveCount(1)
    await expect.poll(async () => search.evaluate((input) => {
      const field = input.parentElement
      const row = field?.closest('[data-testid="sidebar-toolbar"]')
      if (!field || !row) return null
      return Math.abs(field.getBoundingClientRect().top - row.getBoundingClientRect().top)
    })).toBeLessThan(1)

    await search.fill('测试')
    await expect(search).toHaveValue('测试')
    await search.press('Escape')
    await expect(search).toHaveCount(0)
    await expect(sidebar.getByTitle('搜索会话')).toBeVisible()
  })

  test('侧边栏可见且可折叠', async ({ page }) => {
    await page.goto('/')

    const sidebar = page.locator('[data-testid="primary-sidebar"]')
    const sidebarShell = page.getByTestId('sidebar-transition-shell')
    await expect(sidebar).toBeVisible()
    await expect(page.getByRole('button', { name: '新对话', exact: true })).toBeVisible()
    await expect(sidebar.getByRole('button', { name: '记忆', exact: true })).toHaveCount(0)
    await expect(page.locator('[data-testid="secondary-nav"]')).toHaveCount(0)
    await expect(page.getByTestId('conversation-debug-toggle')).toHaveCount(0)
    await expect(sidebarShell).toHaveCSS('transition-property', /width/)
    await expect(sidebarShell).toHaveCSS('transition-property', /transform/)
    await expect(sidebarShell).toHaveCSS('transition-duration', /0.22s/)
    await expect(sidebarShell.getByRole('separator')).toBeVisible()

    const openWidth = await sidebarShell.evaluate((element) => getComputedStyle(element).width)
    await page.getByTitle('收起侧栏 Ctrl+B').click()
    await expect(sidebarShell).toHaveAttribute('data-open', 'false')
    await expect.poll(() => sidebarShell.evaluate((element) => getComputedStyle(element).width)).not.toBe(openWidth)
    await expect.poll(() => sidebarShell.evaluate((element) => getComputedStyle(element).width)).toBe('0px')
    await expect(sidebar).not.toBeVisible()

    await page.getByTitle('展开侧边栏 (Ctrl+B)').click()
    await expect(sidebarShell).toHaveAttribute('data-open', 'true')
    await expect(sidebar).toBeVisible()
  })

  test('输入框支持文本输入和清除', async ({ page }) => {
    await page.goto('/')

    const textarea = page.locator('textarea')
    const sendBtn = page.getByTitle('发送')

    await expect(sendBtn).toBeDisabled()

    await textarea.fill('测试消息')
    await expect(sendBtn).toBeEnabled()

    await textarea.fill('')
    await expect(sendBtn).toBeDisabled()
  })

  test('空白消息区显示欢迎内容', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('[data-testid="chat-messages"] h1')).toContainText('我是')
    await expect(page.getByRole('button', { name: '打个招呼', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '换个主角 →', exact: true })).toHaveCount(0)
  })


  for (const theme of ['porcelain-blue', 'yao-stone']) {
    for (const width of [900, 1440]) {
      test('正式工作区折叠几何与主题 ' + theme + ' ' + width, async ({ page }, testInfo) => {
        await installProductionElectronStub(page)
        await page.setViewportSize({ width, height: 800 })
        await page.goto('/')
        await page.evaluate((value) => { document.documentElement.setAttribute('data-theme', value) }, theme)
        const toggle = page.getByRole('button', { name: '打开工作区', exact: true })
        const before = await toggle.boundingBox()
        await toggle.click()
        const dock = page.getByTestId('chat-right-dock')
        const close = page.getByRole('button', { name: '收起工作区', exact: true })
        await expect(close).toHaveAttribute('aria-controls', 'chat-right-dock')
        await expect(dock).toHaveCSS('border-left-width', '1px')
        await close.hover()
        const hover = await close.boundingBox()
        expect(hover?.width).toBe(before?.width)
        expect(hover?.height).toBe(before?.height)
        await page.screenshot({ path: testInfo.outputPath('production-dock-open.png'), animations: 'disabled' })
        await close.press('Enter')
        await expect(dock).toBeHidden()
        const restored = page.getByRole('button', { name: '打开工作区', exact: true })
        await expect(restored).toBeFocused()
        await expect(restored).toHaveAttribute('aria-expanded', 'false')
        await page.screenshot({ path: testInfo.outputPath('production-dock-collapsed.png'), animations: 'disabled' })
      })
    }
  }


  test('正式终端切换保留多实例并在关闭时分别清理', async ({ page }) => {
    await installTerminalLifecycleStub(page)
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    const first = dock.getByRole('tabpanel', { name: '终端', exact: true })
    const firstInput = first.getByPlaceholder('输入命令…')
    await firstInput.fill('echo first')
    await firstInput.press('Enter')
    await expect(firstInput).toBeDisabled()
    const node = await firstInput.elementHandle()
    await dock.getByRole('tab', { name: '文件', exact: true }).click()
    expect(await node!.evaluate((element) => element.isConnected)).toBe(true)
    expect(await page.evaluate(() => (window as any).__terminalHarness.kills)).toEqual([])
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    const second = dock.getByRole('tabpanel', { name: '终端 2', exact: true })
    await second.getByPlaceholder('输入命令…').fill('echo second')
    await second.getByPlaceholder('输入命令…').press('Enter')
    await expect(second.getByPlaceholder('输入命令…')).toBeDisabled()
    await page.evaluate(() => {
      const harness = (window as any).__terminalHarness
      harness.emit('stdout', { runId: 'run-1', chunk: 'background-first' })
      harness.emit('stdout', { runId: 'run-2', chunk: 'foreground-second' })
    })
    await expect(second).toContainText('foreground-second')
    await expect(second).not.toContainText('background-first')
    await dock.getByRole('tab', { name: '终端', exact: true }).click()
    await expect(first).toContainText('background-first')
    await expect(first).not.toContainText('foreground-second')
    await dock.getByRole('button', { name: '关闭终端', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).__terminalHarness.kills)).toEqual(['run-1'])
    await dock.getByRole('tab', { name: '终端 2', exact: true }).click()
    await expect(second).toContainText('foreground-second')
    await dock.getByRole('button', { name: '关闭终端 2', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).__terminalHarness.kills)).toEqual(['run-1', 'run-2'])
    await dock.getByRole('button', { name: '关闭文件', exact: true }).click()
    await expect(dock).toHaveCount(0)
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    await expect(dock.getByRole('tab', { name: '文件', exact: true })).toBeVisible()
    expect(await page.evaluate(() => (window as any).__terminalHarness.listeners())).toBe(0)
  })

  test('正式命令控制台可回看当前实例命令历史', async ({ page }) => {
    await installTerminalLifecycleStub(page)
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    const input = dock.getByPlaceholder('输入命令…')
    await input.fill('echo first')
    await input.press('Enter')
    await expect(dock.getByTestId('workspace-terminal-status')).toHaveText('运行中')
    await page.evaluate(() => (window as any).__terminalHarness.emit('exit', { runId: 'run-1', code: 0 }))
    await expect(dock.getByTestId('workspace-terminal-status')).toHaveText('已完成')
    await expect(input).toBeEnabled()
    await input.fill('echo second')
    await input.press('Enter')
    await page.evaluate(() => (window as any).__terminalHarness.emit('exit', { runId: 'run-2', code: 0 }))
    await expect(input).toBeEnabled()
    await input.press('ArrowUp')
    await expect(input).toHaveValue('echo second')
    await input.press('ArrowUp')
    await expect(input).toHaveValue('echo first')
    await input.press('ArrowDown')
    await expect(input).toHaveValue('echo second')
    await input.press('ArrowDown')
    await expect(input).toHaveValue('')
  })
  test('正式工作区跨设置与 Playground 保留但项目切换清理', async ({ page }) => {
    await installTerminalLifecycleStub(page)
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    const input = dock.getByPlaceholder('输入命令…')
    await input.fill('echo retain')
    await input.press('Enter')
    const node = await input.elementHandle()
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '设置', exact: true }).click()
    await expect(page.getByTitle('返回聊天', { exact: true })).toBeVisible()
    await expect(dock).toBeHidden()
    expect(await node!.evaluate((element) => element.isConnected)).toBe(true)
    await page.getByTitle('返回聊天', { exact: true }).click()
    await expect(input).toBeDisabled()
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
    await expect(page.getByTestId('playground-nav')).toBeVisible()
    await expect(dock).toBeHidden()
    expect(await node!.evaluate((element) => element.isConnected)).toBe(true)
    await page.getByTitle('返回聊天', { exact: true }).click()
    expect(await page.evaluate(() => (window as any).__terminalHarness.kills)).toEqual([])
    await page.getByRole('button', { name: '测试项目', exact: true }).click()
    await page.getByRole('button', { name: '第二项目', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).__terminalHarness.kills)).toEqual(['run-1'])
    await expect(dock.getByRole('tab', { name: '终端', exact: true })).toHaveCount(0)
    await expect(dock.getByRole('tab', { name: '文件', exact: true })).toBeVisible()
  })

  test('正式终端启动失败可重试且保留命令', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await installTerminalLifecycleStub(page)
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    const input = dock.getByPlaceholder('输入命令…')
    await input.fill('echo retry')
    for (const mode of ['reject', 'blocked']) {
      await page.evaluate((mode) => { (window as any).__terminalHarness.runMode = mode }, mode)
      await input.press('Enter')
      await expect(dock).toContainText(mode === 'reject' ? '启动失败，请重试' : '命令未获批准')
      await expect(input).toBeEnabled()
      await expect(input).toHaveValue('echo retry')
    }
    await page.evaluate(() => { (window as any).__terminalHarness.runMode = 'normal' })
    await dock.getByRole('button', { name: '运行', exact: true }).click()
    await expect(input).toBeDisabled()
    await page.evaluate(() => (window as any).__terminalHarness.emit('exit', { runId: 'run-3', code: 0 }))
    await expect(input).toBeEnabled()
    await expect(dock).toContainText('[命令已完成]')
    expect(errors).toEqual([])
  })

  test('正式终端等待启动时可取消并保持操作槽尺寸', async ({ page }) => {
    await installTerminalLifecycleStub(page)
    await page.goto('/')
    await page.evaluate(() => { (window as any).__terminalHarness.runMode = 'pending' })
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    const input = dock.getByPlaceholder('输入命令…')
    await input.fill('echo cancel')
    const initial = await dock.getByRole('button', { name: '运行', exact: true }).boundingBox()
    await input.press('Enter')
    const stop = dock.getByRole('button', { name: '终止', exact: true })
    await stop.hover()
    expect(await stop.boundingBox()).toEqual(initial)
    await stop.click()
    await expect(dock.getByRole('button', { name: '正在终止', exact: true })).toBeDisabled()
    expect(await dock.getByRole('button', { name: '正在终止', exact: true }).boundingBox()).toEqual(initial)
    await expect(input).toBeDisabled()
    expect(await page.evaluate(() => (window as any).__terminalHarness.kills)).toEqual([])
    await page.evaluate(() => (window as any).__terminalHarness.resolveRun('run-1'))
    await expect.poll(() => page.evaluate(() => (window as any).__terminalHarness.kills)).toEqual(['run-1'])
    await expect(input).toBeEnabled()
    expect(await dock.getByRole('button', { name: '运行', exact: true }).boundingBox()).toEqual(initial)
    expect(await page.evaluate(() => (window as any).__terminalHarness.runs.length)).toBe(1)
  })

  test('正式终端终止失败不伪装成功且可重试', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await installTerminalLifecycleStub(page)
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    const input = dock.getByPlaceholder('输入命令…')
    await input.fill('echo stop')
    await input.press('Enter')
    for (const mode of ['reject', 'failed']) {
      await page.evaluate((mode) => { (window as any).__terminalHarness.killMode = mode }, mode)
      await dock.getByRole('button', { name: '终止', exact: true }).click()
      await expect(dock.getByRole('button', { name: '终止', exact: true })).toBeEnabled()
      await expect(input).toBeDisabled()
      await expect(dock).toContainText('终止失败，请重试')
      await expect(dock).not.toContainText('已发送终止请求')
    }
    await page.evaluate(() => { (window as any).__terminalHarness.killMode = 'normal' })
    await dock.getByRole('button', { name: '终止', exact: true }).click()
    await expect(input).toBeEnabled()
    expect(await page.evaluate(() => (window as any).__terminalHarness.kills)).toEqual(['run-1', 'run-1', 'run-1'])
    expect(errors).toEqual([])
  })

  test('正式终端旧终止响应不影响新命令且取消项目会清理', async ({ page }) => {
    await installTerminalLifecycleStub(page)
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    const input = dock.getByPlaceholder('输入命令…')
    await input.fill('echo old')
    await input.press('Enter')
    await page.evaluate(() => { (window as any).__terminalHarness.killMode = 'pending' })
    await dock.getByRole('button', { name: '终止', exact: true }).click()
    await page.evaluate(() => (window as any).__terminalHarness.emit('exit', { runId: 'run-1', code: 0 }))
    await expect(input).toBeEnabled()
    await input.fill('echo new')
    await input.press('Enter')
    await page.evaluate(() => (window as any).__terminalHarness.resolveKill('run-1'))
    await expect(input).toBeDisabled()
    await page.evaluate(() => (window as any).__terminalHarness.emit('stdout', { runId: 'run-2', chunk: 'new-output' }))
    await expect(dock).toContainText('new-output')
    await page.evaluate(() => { (window as any).__terminalHarness.killMode = 'normal' })
    await page.getByRole('button', { name: '测试项目', exact: true }).click()
    await page.getByRole('button', { name: '不使用项目', exact: true }).click()
    await expect(dock).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => (window as any).__terminalHarness.kills)).toEqual(['run-1', 'run-2'])
    expect(await page.evaluate(() => (window as any).__terminalHarness.listeners())).toBe(0)
  })

  test('正式终端关闭后清理迟到的启动响应', async ({ page }) => {
    await installTerminalLifecycleStub(page)
    await page.goto('/')
    await page.evaluate(() => { (window as any).__terminalHarness.runMode = 'pending' })
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    await dock.getByPlaceholder('输入命令…').fill('echo late')
    await dock.getByPlaceholder('输入命令…').press('Enter')
    await expect.poll(() => page.evaluate(() => (window as any).__terminalHarness.runs.length)).toBe(1)
    await dock.getByRole('button', { name: '关闭终端', exact: true }).click()
    await page.evaluate(() => (window as any).__terminalHarness.resolveRun('run-1'))
    await expect.poll(() => page.evaluate(() => (window as any).__terminalHarness.kills)).toEqual(['run-1'])
    expect(await page.evaluate(() => (window as any).__terminalHarness.listeners())).toBe(0)
  })

  test('正式五功能入口顺序与面板无转义残留', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await expect(dock.getByRole('menuitem')).toHaveText(['审阅', '浏览器', '文件', '终端', '侧边聊天'])
    await dock.getByRole('menuitem', { name: '浏览器', exact: true }).click()
    const browser = dock.getByRole('tabpanel', { name: '浏览器', exact: true })
    await expect(browser).toBeVisible()
    await expect(browser).not.toContainText('\\n')
    await expect(browser.locator('iframe, webview')).toHaveCount(0)
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
    const chat = dock.getByRole('tabpanel', { name: '侧边聊天', exact: true })
    await expect(chat).not.toContainText('\\n')
    await expect(chat).not.toContainText('样张回复')
    await dock.getByRole('button', { name: '关闭浏览器', exact: true }).click()
    await expect(chat).toBeVisible()
  })

  for (const theme of ['porcelain-blue', 'yao-stone']) {
    for (const width of [900, 1440]) {
    test(`正式审阅原始代码不被 Markdown 解释 ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 731 })
      const source = ['```', '# 原样标题', '<aside>不得移出代码的内容</aside>', '[原样链接](https://example.invalid/)', '```mermaid', 'graph TD; A-->B', '```', 'x'.repeat(500), ...Array.from({ length: 80 }, (_, i) => `line ${i}`)].join('\n')
      await installProductionElectronStub(page)
      await page.addInitScript(({ source, theme }) => {
        localStorage.setItem('theme', theme)
        const api = (window as any).electronAPI
        api.session.listFileChanges = async () => [{ path: 'C:/e2e-project/sample.md', toolName: 'write_file', updatedAt: 1, hasBefore: false }]
        api.session.getFileChangeDiff = async () => ({ after: source })
      }, { source, theme })
      await page.goto('/')
      await page.getByTestId('primary-sidebar').getByRole('button', { name: '新对话', exact: true }).click()
      await page.getByRole('button', { name: '打开工作区', exact: true }).click()
      const dock = page.getByTestId('chat-right-dock')
      await dock.getByTestId('right-dock-add-tab').click()
      await dock.getByRole('menuitem', { name: '审阅', exact: true }).click()
      const review = dock.getByRole('tabpanel', { name: '审阅', exact: true })
      await review.getByRole('button', { name: /sample.md/ }).click()
      await expect(review.locator('code')).toHaveCount(1)
      expect(await review.locator('code').textContent()).toBe(source)
      await expect(review.locator('h1, a, svg[id^="mermaid"]')).toHaveCount(0)
      const block = review.locator('[data-foundation="code-block"]')
      await expect(block).toHaveCount(1)
      await expectSharedCodeSurface(block)
      await expect(block.locator('code')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(block.locator('pre')).toHaveCSS('background-color', theme === 'yao-stone' ? 'rgb(26, 29, 36)' : 'rgb(223, 233, 238)')
      expect(await block.locator('pre').evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true)
      expect(await dock.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      const scroll = block.locator('xpath=../..')
      expect(await scroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
      await scroll.evaluate((node) => { node.scrollTop = node.scrollHeight })
      expect(await scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
      await scroll.evaluate((node) => { node.scrollTop = 0 })
      await page.evaluate(() => {
        let attempts = 0
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          writeText: async (text: string) => {
            if (++attempts === 1) throw new Error('clipboard denied for test')
            ;(window as any).__copiedReview = text
          },
        } })
      })
      const copy = block.getByRole('button', { name: '复制', exact: true })
      const initial = await copy.boundingBox()
      await copy.hover()
      expect(await copy.boundingBox()).toEqual(initial)
      await copy.click()
      await expect(block.getByRole('status')).toHaveText('复制失败，请重试')
      expect(await copy.boundingBox()).toEqual(initial)
      await copy.click()
      await expect(block.getByRole('button', { name: '已复制', exact: true })).toBeVisible()
      expect(await block.getByRole('button').boundingBox()).toEqual(initial)
      expect(await page.evaluate(() => (window as any).__copiedReview)).toBe(source)
      await page.screenshot({ path: testInfo.outputPath(`review-raw-${theme}.png`), animations: 'disabled' })
    })
    }
  }

  test('正式工作区侧聊上下文跟随选中文件且清理已关闭来源', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      const listeners = new Set<(event: unknown) => void>()
      const state = { pending: {} as Record<string, (value: unknown) => void>, sent: [] as unknown[] }
      ;(window as any).__focusHarness = state
      api.project.listFiles = async () => ['a.ts', 'b.ts'].map((name) => ({ name, path: name, isDir: false }))
      api.project.readFile = (path: string) => new Promise((resolve) => { state.pending[path] = resolve })
      api.session.createWorkspace = async () => ({ id: 'focus-sidechat' })
      api.chat.onEvent = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
      api.chat.send = async (id, _message, context) => {
        state.sent.push(context.focus ?? null)
        listeners.forEach((listener) => listener({ type: 'done', sessionId: id }))
      }
    })
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '新对话', exact: true }).click()
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    const tree = dock.getByTestId('file-browser-tree')
    await tree.getByRole('button', { name: 'a.ts', exact: true }).click()
    await tree.getByRole('button', { name: 'b.ts', exact: true }).click()
    await page.evaluate(() => {
      const pending = (window as any).__focusHarness.pending
      pending['b.ts']({ kind: 'text', content: 'selected B', languageHint: 'text' })
      pending['a.ts']({ kind: 'text', content: 'background A', languageHint: 'text' })
    })
    await expect(dock.getByRole('tabpanel', { name: 'b.ts', exact: true })).toContainText('selected B')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
    const sendFocus = async (expected: unknown) => {
      const chat = dock.getByTestId('workspace-sidechat-panel')
      await chat.getByRole('textbox', { name: '侧边聊天消息' }).fill('检查当前文件')
      await chat.getByRole('button', { name: '发送消息', exact: true }).click()
      await expect.poll(() => page.evaluate(() => (window as any).__focusHarness.sent.at(-1))).toEqual(expected)
    }
    await sendFocus({ kind: 'file', path: 'b.ts', content: 'selected B' })
    await dock.getByRole('tab', { name: '文件', exact: true }).click()
    await dock.getByRole('tablist', { name: '文件预览' }).getByRole('tab', { name: 'a.ts' }).click()
    await dock.getByRole('tab', { name: '侧边聊天', exact: true }).click()
    await sendFocus({ kind: 'file', path: 'a.ts', content: 'background A' })
    await dock.getByRole('tab', { name: '文件', exact: true }).click()
    await tree.getByRole('button', { name: 'b.ts', exact: true }).click()
    await dock.getByRole('tab', { name: '侧边聊天', exact: true }).click()
    await sendFocus({ kind: 'file', path: 'b.ts', content: 'selected B' })
    await dock.getByRole('button', { name: '关闭文件', exact: true }).click()
    await sendFocus(null)
  })

  test('正式文件多预览隔离乱序与关闭重开', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      api.project.listFiles = async () => ['a.ts', 'b.md', 'fail.txt'].map((name) => ({ name, path: name, isDir: false }))
      const pending: Record<string, Array<(value: unknown) => void>> = {}
      ;(window as any).__filePending = pending
      api.project.readFile = (path: string) => new Promise((resolve) => { (pending[path] ??= []).push(resolve) })
    })
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    const tree = dock.getByTestId('file-browser-tree')
    const previews = dock.getByRole('tablist', { name: '文件预览' })
    const resolve = async (path: string, content: string, error = false) => page.evaluate(({ path, content, error }) => {
      (window as any).__filePending[path].shift()(error ? { error: content } : { kind: 'text', content, languageHint: 'text' })
    }, { path, content, error })
    await tree.getByRole('button', { name: 'a.ts', exact: true }).click()
    await tree.getByRole('button', { name: 'b.md', exact: true }).click()
    await resolve('b.md', 'second file')
    await resolve('a.ts', 'first file')
    await expect(previews.getByRole('tab', { name: 'b.md' })).toHaveAttribute('aria-selected', 'true')
    await expect(dock.getByRole('tabpanel', { name: 'b.md', exact: true })).toContainText('second file')
    await tree.getByRole('button', { name: 'a.ts', exact: true }).click()
    await expect(previews.getByRole('tab')).toHaveCount(2)
    const left = (await dock.getByTestId('workspace-file-tree').boundingBox())!
    const right = (await dock.getByTestId('workspace-file-preview').boundingBox())!
    expect(right.x).toBeGreaterThanOrEqual(left.x + left.width - 1)
    expect(Math.abs(right.y - left.y)).toBeLessThan(2)
    await previews.getByRole('button', { name: '关闭b.md' }).click()
    await expect(previews.getByRole('tab', { name: 'a.ts' })).toHaveAttribute('aria-selected', 'true')
    await tree.getByRole('button', { name: 'b.md', exact: true }).click()
    await previews.getByRole('button', { name: '关闭b.md' }).click()
    await tree.getByRole('button', { name: 'b.md', exact: true }).click()
    await resolve('b.md', 'stale read')
    await expect(dock.getByRole('tabpanel', { name: 'b.md', exact: true })).not.toContainText('stale read')
    await resolve('b.md', 'fresh read')
    await expect(dock.getByRole('tabpanel', { name: 'b.md', exact: true })).toContainText('fresh read')
    await tree.getByRole('button', { name: 'fail.txt', exact: true }).click()
    await resolve('fail.txt', '读取失败', true)
    await dock.getByRole('button', { name: '重新读取' }).click()
    await resolve('fail.txt', 'recovered')
    await expect(dock.getByRole('tabpanel', { name: 'fail.txt', exact: true })).toContainText('recovered')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '审阅', exact: true }).click()
    await dock.getByRole('tab', { name: '文件', exact: true }).click()
    await expect(previews.getByRole('tab')).toHaveCount(3)
    await expect(previews.getByRole('tab', { name: 'fail.txt' })).toHaveAttribute('aria-selected', 'true')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '文件', exact: true }).click()
    await expect(dock.getByRole('tabpanel', { name: '文件 2', exact: true }).getByTestId('workspace-file-preview')).toHaveCount(0)
    await dock.getByRole('tab', { name: '文件', exact: true }).click()
    await expect(previews.getByRole('tab')).toHaveCount(3)
  })

  test('正式审阅支持真实旧稿并排视图且忽略过期 diff 响应', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      const pending: Record<string, Array<(value: unknown) => void>> = {}
      api.session.listFileChanges = async () => [
        { path: 'C:/e2e-project/old.ts', toolName: 'file_edit', updatedAt: 1, hasBefore: true },
        { path: 'C:/e2e-project/new.ts', toolName: 'file_write', updatedAt: 2, hasBefore: true },
      ]
      api.session.getFileChangeDiff = (sessionId: string, path: string) => new Promise((resolve) => { (pending[path] ??= []).push(resolve) })
      ;(window as any).__reviewPending = pending
    })
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '新对话', exact: true }).click()
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '审阅', exact: true }).click()
    const review = dock.getByRole('tabpanel', { name: '审阅', exact: true })
    await expect(review.getByText('old.ts', { exact: true })).toBeVisible()
    await review.getByRole('button', { name: /old.ts/ }).click()
    await expect(review.getByText('加载中…', { exact: true })).toBeVisible()
    await review.getByRole('button', { name: /new.ts/ }).click()
    await page.evaluate(() => {
      const pending = (window as any).__reviewPending
      pending['C:/e2e-project/new.ts'].shift()({ diff: '--- new\n+++ new\n', before: 'old new', after: 'new new', hasBefore: true })
      pending['C:/e2e-project/old.ts'].shift()({ diff: '--- old\n+++ old\n', before: 'old old', after: 'old changed', hasBefore: true })
    })
    await expect(review).toContainText('new.ts')
    await expect(review).not.toContainText('old changed')
    await expect(review.getByRole('button', { name: '并排差异', exact: true })).toBeEnabled()
    await review.getByRole('button', { name: '并排差异', exact: true }).click()
    await expect(review).toContainText('修改前')
    await expect(review).toContainText('修改后')
    await expect(review).toContainText('old new')
    await expect(review).toContainText('new new')
    await expect(review).not.toContainText('old old')
    await expect(review.getByRole('button', { name: '统一差异', exact: true })).toBeEnabled()
  })

  test('正式审阅失败和清空后不再把旧内容发送给侧聊', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      const listeners = new Set<(event: unknown) => void>()
      const state = { sent: [] as unknown[], failClear: true, delayDiff: false, resolveDiff: null as null | ((value: unknown) => void) }
      ;(window as any).__reviewFocusHarness = state
      let parentSequence = 0
      api.session.create = async () => ({ id: `review-parent-${++parentSequence}` })
      api.session.listFileChanges = async () => [
        { path: 'C:/e2e-project/ok.ts', toolName: 'file_edit', updatedAt: 1, hasBefore: true },
        { path: 'C:/e2e-project/fail.ts', toolName: 'file_edit', updatedAt: 2, hasBefore: true },
      ]
      api.session.getFileChangeDiff = async (_session: string, path: string) => state.delayDiff
        ? new Promise((resolve) => { state.resolveDiff = resolve })
        : path.endsWith('fail.ts')
        ? { error: '读取失败' }
        : { diff: '--- ok\n+++ ok\n@@\n+selected review', before: 'before', after: 'selected review', hasBefore: true }
      api.session.clearFileChanges = async () => {
        if (state.failClear) { state.failClear = false; throw new Error('test clear failure') }
      }
      api.session.onFileChange = () => () => undefined
      api.session.createWorkspace = async () => ({ id: 'review-sidechat' })
      api.chat.onEvent = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
      api.chat.send = async (id: string, _message: string, context: { focus?: unknown }) => {
        state.sent.push(context.focus ?? null)
        listeners.forEach((listener) => listener({ type: 'done', sessionId: id }))
      }
    })
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '新对话', exact: true }).click()
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '审阅', exact: true }).click()
    const review = dock.getByRole('tabpanel', { name: '审阅', exact: true })
    await review.getByRole('button', { name: /ok\.ts/ }).click()
    await expect(review).toContainText('selected review')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
    const chat = dock.getByTestId('workspace-sidechat-panel')
    const send = async (expected: unknown) => {
      await chat.getByRole('textbox', { name: '侧边聊天消息' }).fill('检查审阅上下文')
      await chat.getByRole('button', { name: '发送消息', exact: true }).click()
      await expect.poll(() => page.evaluate(() => (window as any).__reviewFocusHarness.sent.at(-1))).toEqual(expected)
    }
    await send({ kind: 'review', path: 'C:/e2e-project/ok.ts', content: '--- ok\n+++ ok\n@@\n+selected review' })
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '审阅', exact: true }).click()
    await expect(dock.getByRole('tabpanel', { name: '审阅 2', exact: true })).toContainText('选择文件查看 diff')
    await dock.getByRole('tab', { name: '侧边聊天', exact: true }).click()
    await send(null)
    await dock.getByRole('tab', { name: '审阅', exact: true }).click()
    await dock.getByRole('tab', { name: '侧边聊天', exact: true }).click()
    await send({ kind: 'review', path: 'C:/e2e-project/ok.ts', content: '--- ok\n+++ ok\n@@\n+selected review' })
    await dock.getByRole('button', { name: '关闭审阅 2', exact: true }).click()
    await dock.getByRole('tab', { name: '审阅', exact: true }).click()
    await review.getByRole('button', { name: /fail\.ts/ }).click()
    await expect(review.getByText('读取失败', { exact: true })).toBeVisible()
    await dock.getByRole('tab', { name: '侧边聊天', exact: true }).click()
    await send(null)
    await dock.getByRole('tab', { name: '审阅', exact: true }).click()
    await review.getByRole('button', { name: /ok\.ts/ }).click()
    await expect(review).toContainText('selected review')
    await review.getByRole('button', { name: '清空列表', exact: true }).click()
    await expect(review).toContainText('清空文件变更失败，请重试')
    await expect(review.getByRole('button', { name: /ok\.ts/ })).toBeVisible()
    await expect(review).toContainText('selected review')
    await page.evaluate(() => { (window as any).__reviewFocusHarness.delayDiff = true })
    await review.getByRole('button', { name: /ok\.ts/ }).click()
    await expect(review.getByText('加载中…', { exact: true })).toBeVisible()
    await review.getByRole('button', { name: '清空列表', exact: true }).click()
    await expect(review).toContainText('Agent 写入 / 编辑文件后，会显示在这里')
    await page.evaluate(() => { (window as any).__reviewFocusHarness.resolveDiff({ after: 'late cleared diff' }) })
    await dock.getByRole('tab', { name: '侧边聊天', exact: true }).click()
    await send(null)
    await dock.getByRole('tab', { name: '审阅', exact: true }).click()
    await expect(review).not.toContainText('late cleared diff')
    await page.evaluate(() => { (window as any).__reviewFocusHarness.delayDiff = false })
    await review.getByRole('button', { name: '刷新', exact: true }).click()
    await review.getByRole('button', { name: /ok\.ts/ }).click()
    await expect(review).toContainText('selected review')
    await dock.getByRole('tab', { name: '侧边聊天', exact: true }).click()
    await send({ kind: 'review', path: 'C:/e2e-project/ok.ts', content: '--- ok\n+++ ok\n@@\n+selected review' })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '新对话', exact: true }).click()
    await send(null)
  })

  for (const theme of ['porcelain-blue', 'yao-stone']) {
    for (const width of [1166, 600]) {
      test(`Foundation 差异查看器真实切换与有界长文件 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 731 })
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
        await page.goto('/')
        await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
        await page.getByTestId('playground-nav').getByRole('button', { name: '基础组件', exact: true }).click()
        await page.getByRole('tab', { name: '文件与差异', exact: true }).click()
        const story = page.getByTestId('foundation-diff-code')
        const viewer = story.locator('[data-foundation="diff-viewer"]')
        const unified = story.getByRole('button', { name: '统一差异', exact: true })
        const split = story.getByRole('button', { name: '并排差异', exact: true })
        await expect(viewer).toHaveAttribute('data-mode', 'split')
        const size = await split.evaluate((node) => ({ width: node.clientWidth, height: node.clientHeight }))
        await unified.focus()
        await page.keyboard.press('Enter')
        await expect(viewer).toHaveAttribute('data-mode', 'unified')
        await split.click()
        await story.getByRole('combobox', { name: '差异样张' }).selectOption('empty')
        await expect(viewer.locator('pre code')).toHaveCount(2)
        expect(await viewer.locator('pre code').first().textContent()).toBe('')
        await story.getByRole('combobox', { name: '差异样张' }).selectOption('long')
        const scroll = story.getByTestId('foundation-diff-scroll')
        expect(await scroll.evaluate((node) => node.clientHeight <= 320 && node.scrollHeight > node.clientHeight)).toBe(true)
        await scroll.evaluate((node) => { node.scrollTop = node.scrollHeight })
        expect(await scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
        expect(await viewer.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
        await scroll.evaluate((node) => { node.scrollTop = 0 })
        await split.hover()
        expect(await split.evaluate((node) => ({ width: node.clientWidth, height: node.clientHeight }))).toEqual(size)
        await story.screenshot({ path: testInfo.outputPath('foundation-diff.png') })
      })
    }
  }

  test('正式审阅空稿可并排，切换无旧稿文件不会留下空白', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      api.session.listFileChanges = async () => ['empty-before.txt', 'empty-after.txt', 'new.txt'].map((name) => ({ path: `C:/e2e-project/${name}`, toolName: 'file_write', updatedAt: 1, hasBefore: name !== 'new.txt' }))
      api.session.getFileChangeDiff = async (_session: string, path: string) => path.endsWith('empty-before.txt')
        ? { diff: '+created', before: '', after: 'created' }
        : path.endsWith('empty-after.txt') ? { diff: '-removed', before: 'removed', after: '' } : { after: 'new file content' }
    })
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '新对话', exact: true }).click()
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '审阅', exact: true }).click()
    const review = dock.getByRole('tabpanel', { name: '审阅', exact: true })
    const split = review.getByRole('button', { name: '并排差异', exact: true })
    for (const [file, contents] of [['empty-before.txt', ['', 'created']], ['empty-after.txt', ['removed', '']]] as const) {
      await review.getByRole('button', { name: new RegExp(file) }).click()
      await expect(split).toBeEnabled()
      await split.click()
      await expect(review.locator('pre code')).toHaveCount(2)
      expect(await review.locator('pre code').allTextContents()).toEqual(contents)
    }
    await review.getByRole('button', { name: /new.txt/ }).click()
    await expect(split).toBeDisabled()
    await expect(review.getByRole('button', { name: '统一差异', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(review.locator('pre code')).toHaveText('new file content')
  })

  test('正式浏览器工作区加载失败可重试并保持地址栏布局', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      let calls = 0
      api.browser = { load: async (url: string, _requestId: string) => {
        calls++
        if (calls === 1) return { ok: false, error: '网页加载失败，请检查地址或网络连接' }
        return { ok: true, url, contentType: 'text/html', body: '<!doctype html><html><body><h1>安全文档</h1><p>只读网页内容</p><script>window.__shouldNotRun = true</script></body></html>' }
      }, cancel: async () => ({ ok: true }) }
      ;(window as any).__browserCalls = () => calls
    })
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '浏览器', exact: true }).click()
    const browser = dock.getByTestId('workspace-browser-panel')
    const address = browser.getByRole('textbox', { name: '浏览器地址' })
    const refresh = browser.getByRole('button', { name: '刷新页面', exact: true })
    const initial = await refresh.boundingBox()
    await address.fill('https://example.com/docs')
    await address.press('Enter')
    await expect(browser.getByRole('alert')).toHaveText('网页加载失败，请检查地址或网络连接')
    await expect(browser.getByRole('button', { name: '重新加载', exact: true })).toBeVisible()
    await expect(address).toHaveValue('https://example.com/docs')
    await expect(browser.getByRole('button', { name: '重新加载', exact: true })).toBeEnabled()
    await browser.getByRole('button', { name: '重新加载', exact: true }).click()
    await expect(browser.locator('iframe[title="网页内容"]')).toBeVisible()
    await expect(browser.locator('iframe[title="网页内容"]').contentFrame().getByText('安全文档')).toBeVisible()
    await expect(browser.locator('iframe[title="网页内容"]').contentFrame().locator('script')).toHaveCount(1)
    expect(await browser.locator('iframe[title="网页内容"]').contentFrame().locator('body').evaluate(() => (window as any).__shouldNotRun)).toBeUndefined()
    expect(await page.evaluate(() => (window as any).__browserCalls())).toBe(2)
    await address.fill('https://example.com/changed')
    await address.press('Escape')
    await expect(address).toHaveValue('https://example.com/docs')
    await refresh.hover()
    expect(await refresh.boundingBox()).toEqual(initial)
  })

  test('正式侧边聊天创建失败可以重新创建会话', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      let creates = 0
      ;(window as any).__allowWorkspaceCreate = false
      api.session.createWorkspace = async () => {
        ;(window as any).__workspaceCreates = ++creates
        if (!(window as any).__allowWorkspaceCreate) throw new Error('fixture creation failed')
        return { id: 'workspace-recovered', messages: [], sessionKind: 'workspace' }
      }
      api.chat.send = async (id: string) => { (window as any).__recoveredSend = id }
    })
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
    const panel = dock.getByTestId('workspace-sidechat-panel')
    await expect(panel.getByRole('alert')).toContainText('侧边聊天暂时无法打开')
    const attempts = await page.evaluate(() => (window as any).__workspaceCreates as number)
    await page.evaluate(() => { (window as any).__allowWorkspaceCreate = true })
    await panel.getByRole('button', { name: '重试', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).__workspaceCreates)).toBeGreaterThan(attempts)
    await expect(panel.getByRole('alert')).toHaveCount(0)
    await panel.getByRole('textbox', { name: '侧边聊天消息' }).fill('恢复后发送')
    await panel.getByRole('button', { name: '发送消息', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).__recoveredSend)).toBe('workspace-recovered')
  })

  test('正式侧边聊天切换父会话清空旧状态并隔离迟到失败', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      let creates = 0
      const events = new Set<(event: any) => void>()
      const confirmations = new Set<(event: any) => void>()
      const deleted: string[] = []
      api.session.createWorkspace = async () => ({ id: 'workspace-parent-' + ++creates, messages: [], sessionKind: 'workspace' })
      api.session.delete = async (id: string) => { deleted.push(id) }
      api.chat.onEvent = (listener: (event: any) => void) => { events.add(listener); return () => events.delete(listener) }
      api.chat.onConfirmRequest = (listener: (event: any) => void) => { confirmations.add(listener); return () => confirmations.delete(listener) }
      api.chat.send = async () => new Promise((_resolve, reject) => { (window as any).__rejectOldSend = () => reject(new Error('old request failed')) })
      ;(window as any).__parentHarness = { deleted, creates: () => creates, emit: (event: any) => events.forEach((listener) => listener(event)), confirm: (event: any) => confirmations.forEach((listener) => listener(event)) }
    })
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
    const panel = dock.getByTestId('workspace-sidechat-panel')
    const input = panel.getByRole('textbox', { name: '侧边聊天消息' })
    await expect(input).toBeEnabled()
    const previousCreates = await page.evaluate(() => (window as any).__parentHarness.creates() as number)
    await input.fill('上一段侧聊消息')
    await panel.getByRole('button', { name: '发送消息', exact: true }).click()
    await input.fill('上一段侧聊草稿')
    await page.evaluate((sessionId) => (window as any).__parentHarness.confirm({ sessionId, requestId: 'old-confirm', name: 'shell_exec', args: { command: 'echo old' } }), 'workspace-parent-' + previousCreates)
    await expect(panel.getByTestId('permission-confirm-card')).toBeVisible()
    await page.getByRole('button', { name: '新对话', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).__parentHarness.creates())).toBeGreaterThan(previousCreates)
    await expect(panel).not.toContainText('上一段侧聊消息')
    await expect(input).toBeEmpty()
    await expect(panel.getByTestId('permission-confirm-card')).toHaveCount(0)
    await expect(panel.getByRole('button', { name: '发送消息', exact: true })).toBeVisible()
    await page.evaluate((oldId) => {
      ;(window as any).__rejectOldSend()
      ;(window as any).__parentHarness.emit({ sessionId: oldId, type: 'text', content: '迟到旧回复' })
    }, 'workspace-parent-' + previousCreates)
    await expect(panel.getByRole('alert')).toHaveCount(0)
    await expect(panel).not.toContainText('迟到旧回复')
    await expect.poll(() => page.evaluate(() => (window as any).__parentHarness.deleted)).toContain('workspace-parent-' + previousCreates)
  })

  test('正式侧边聊天错误后重试会再次发送消息', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      const listeners = new Set<(event: any) => void>()
      let sends = 0
      api.session.createWorkspace = async () => ({ id: 'workspace-retry-session', messages: [], createdAt: Date.now(), roleId: 'lin', sessionKind: 'workspace' })
      api.session.delete = async () => {}
      api.chat.onEvent = (listener: (event: any) => void) => { listeners.add(listener); return () => listeners.delete(listener) }
      api.chat.send = async (id: string, message: any) => {
        sends++
        ;(window as any).__retrySends = sends
        if (sends === 1) setTimeout(() => listeners.forEach((listener) => listener({ sessionId: id, type: 'error', message: '第一次发送失败' })), 0)
        else setTimeout(() => listeners.forEach((listener) => listener({ sessionId: id, type: 'done', reason: 'completed' })), 0)
      }
      api.chat.abort = async () => {}
    })
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
    const panel = dock.getByTestId('workspace-sidechat-panel')
    const input = panel.getByRole('textbox', { name: '侧边聊天消息' })
    await input.fill('请重试这次修改')
    await panel.getByRole('button', { name: '发送消息', exact: true }).click()
    await expect(panel.getByRole('alert')).toContainText('第一次发送失败')
    await panel.getByRole('button', { name: '重试', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).__retrySends)).toBe(2)
    await expect(panel.getByRole('button', { name: '发送消息', exact: true })).toBeVisible()
  })

  test('正式侧边聊天使用独立工作区会话并支持流式回复与停止', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      const listeners = new Set<(event: any) => void>()
      const deleted: string[] = []
      let sends = 0
      let created = 0
      api.session.createWorkspace = async () => { created++; return { id: 'workspace-session-' + created, messages: [], createdAt: Date.now(), roleId: 'lin', sessionKind: 'workspace' } }
      api.session.delete = async (id: string) => { deleted.push(id) }
      api.chat.onEvent = (listener: (event: any) => void) => { listeners.add(listener); return () => listeners.delete(listener) }
      api.chat.send = async (id: string, message: any, context: any) => { sends++; (window as any).__sideChatMessage = { id, message, context } }
      api.chat.abort = async (id: string) => { (window as any).__sideChatAbort = id }
      ;(window as any).__sideChatHarness = { emit: (event: any) => listeners.forEach((listener) => listener(event)), deleted, active: () => 'workspace-session-' + created, sends: () => sends, listeners: () => listeners.size }
    })
    await page.goto('/')
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
    const panel = dock.getByTestId('workspace-sidechat-panel')
    await expect(panel.getByText('从当前工作区开始聊聊', { exact: true })).toBeVisible()
    const input = panel.getByRole('textbox', { name: '侧边聊天消息' })
    await input.fill('请解释这次修改')
    const action = panel.getByRole('button', { name: '发送消息', exact: true })
    const initial = await action.boundingBox()
    await action.click()
    await expect(input).toBeEmpty()
    await expect.poll(() => page.evaluate(() => (window as any).__sideChatMessage?.context)).toBeDefined()
    await expect(panel.getByRole('button', { name: '停止生成', exact: true })).toBeVisible()
    const activeSession = await page.evaluate(() => (window as any).__sideChatHarness.active())
    await page.evaluate(() => (window as any).__sideChatHarness.emit({ sessionId: 'wrong-session', type: 'text', content: '错误消息' }))
    await expect(panel).not.toContainText('错误消息')
    await page.evaluate((sessionId) => (window as any).__sideChatHarness.emit({ sessionId, type: 'text', content: '这是流式回复' }), activeSession)
    await expect(panel).toContainText('这是流式回复')
    await panel.getByRole('button', { name: '停止生成', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).__sideChatAbort)).toBe(activeSession)
    expect(await panel.getByRole('button', { name: '停止生成', exact: true }).boundingBox()).toEqual(initial)
    await page.evaluate((sessionId) => (window as any).__sideChatHarness.emit({ sessionId, type: 'done', reason: 'completed' }), activeSession)
    await expect(panel.getByRole('button', { name: '发送消息', exact: true })).toBeVisible()
    await dock.getByRole('button', { name: '关闭侧边聊天', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).__sideChatHarness.deleted)).toContain(activeSession)
    expect(await page.evaluate(() => (window as any).__sideChatHarness.sends())).toBe(1)
    expect(await page.evaluate(() => (window as any).__sideChatHarness.listeners())).toBe(0)
  })

  test('正式右坞文件内部预览与折叠状态保留', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.goto('/')

    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.locator('[data-testid="chat-right-dock"]')
    await expect(dock.getByTestId('right-dock-tab-preview')).toHaveCount(0)
    await expect(dock).not.toContainText('隔离样张')
    await expect(dock.getByTestId('right-dock-tab-files')).toBeVisible()
    await dock.getByTestId('file-browser-tree').getByRole('button', { name: 'App.tsx', exact: true }).click()
    await expect(dock.getByTestId('file-browser-tree')).toContainText('App.tsx')

    await expect(dock.getByRole('tablist', { name: '文件预览' }).getByRole('tab', { name: 'App.tsx' })).toBeVisible()
    await expect(dock.getByTestId('file-browser-preview')).toContainText('const ready = true')
    await expect(dock.getByTestId('file-browser-preview').locator('[data-foundation="code-block"] code')).toHaveText('const ready = true')
    await expectSharedCodeSurface(dock.getByTestId('file-browser-preview'))
    await expect(dock.getByTestId('file-browser-preview')).toContainText('App.tsx')

    const workspaceToggle = page.getByTitle('收起工作区')
    await expect(workspaceToggle).toHaveAttribute('aria-expanded', 'true')
    await workspaceToggle.click()
    await expect(page.getByTitle('打开工作区')).toBeVisible()
    await expect(dock).toHaveCount(1)
    await expect(dock).toBeHidden()
    expect(await dock.evaluate((node) => node.getBoundingClientRect().width)).toBe(0)
    await page.getByTitle('打开工作区').click()
    await expect(page.getByTitle('收起工作区')).toBeVisible()
    await expect(dock.getByTestId('right-dock-tab-files')).toBeVisible()
    await expect(dock.getByTestId('file-browser-preview')).toContainText('App.tsx')

    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '审阅', exact: true }).click()
    await expect(dock.getByText('无活跃会话', { exact: true })).toBeVisible()
    await expect(dock).not.toContainText('隔离样张')

    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    await expect(dock.getByText('命令控制台（非完整终端）', { exact: false })).toBeVisible()
    const command = dock.getByPlaceholder('输入命令…')
    await expect(command).toBeVisible()
    await command.fill('echo retained-draft')
    const terminalInput = await command.elementHandle()
    await page.getByRole('button', { name: '收起工作区', exact: true }).click()
    await expect(dock).toBeHidden()
    expect(await terminalInput!.evaluate((node) => node.isConnected)).toBe(true)
    await expect(command).toHaveValue('echo retained-draft')
    await page.getByRole('button', { name: '打开工作区', exact: true }).press('Enter')
    await expect(command).toBeVisible()
    await expect(command).toHaveValue('echo retained-draft')
    expect(await terminalInput!.evaluate((node) => node.isConnected)).toBe(true)
    const tabs = dock.getByRole('tablist', { name: '已打开的工作区' })
    await expect(tabs).toHaveAttribute('data-foundation', 'tabs')
    await expect(dock.getByTitle('关闭当前 Tab')).toHaveCount(0)
    const backgroundTab = dock.getByTestId('right-dock-tab-item').filter({ has: page.getByTestId('right-dock-tab-files') })
    const bounds = await backgroundTab.boundingBox()
    await backgroundTab.hover()
    expect((await backgroundTab.boundingBox())?.width).toBe(bounds?.width)
    await expect(backgroundTab.getByRole('button', { name: '关闭文件', exact: true })).toBeVisible()
    await backgroundTab.getByRole('button', { name: '关闭文件', exact: true }).click()
    await expect(tabs.getByRole('tab', { name: '终端', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(command).toHaveValue('echo retained-draft')
    expect(await terminalInput!.evaluate((node) => node.isConnected)).toBe(true)
    await tabs.getByRole('tab', { name: '终端', exact: true }).press('Home')
    await expect(tabs.getByRole('tab', { name: '审阅', exact: true })).toBeFocused()
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '审阅', exact: true }).click()
    await expect(tabs.getByRole('tab', { name: '审阅 2', exact: true })).toHaveAttribute('aria-selected', 'true')
    await tabs.getByRole('button', { name: '关闭审阅', exact: true }).click()
    await expect(tabs.getByRole('tab', { name: '审阅 2', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(dock).not.toContainText('隔离样张')
  })


  test('Playground 基础与产品体验分层且可独立验收', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()

    const nav = page.locator('[data-testid="playground-nav"]')
    await expect(page.locator('[data-testid="primary-sidebar"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="primary-sidebar"]')).toBeHidden()
    await expect(page.getByRole('switch', { name: '显示已采用' })).toHaveCount(0)
    await expect(page.locator('section[aria-label="基础"]')).toBeVisible()
    await expect(page.locator('section[aria-label="产品体验"]')).toBeVisible()
    await expect(page.locator('section[aria-label="Agent 实验"]')).toBeVisible()
    await expect(nav.getByRole('button', { name: '基础组件', exact: true })).toBeVisible()
    await expect(nav.getByRole('button', { name: '人物世界', exact: true })).toBeVisible()
    await expect(nav.getByRole('button', { name: '业务状态', exact: true })).toHaveCount(0)
    await expect(nav.getByRole('button', { name: '组件目录', exact: true })).toHaveCount(0)
    await expect(nav.getByRole('button', { name: '页面组合', exact: true })).toHaveCount(0)

    await nav.getByRole('button', { name: '基础组件', exact: true }).click()
    await expect(page.locator('[data-testid="foundation-components-panel"]')).toBeVisible()
    await expect(page.getByTestId('foundation-state-matrix')).toContainText('键盘 / ARIA')
    await expect(page.locator('[data-testid="playground-story-nav"]')).toBeVisible()
    await expect(page.locator('[data-testid="playground-story-nav"] [role="tablist"]')).toHaveCount(1)
    await expect(page.getByRole('tab', { name: '组件索引', exact: true })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: '记忆引用', exact: true })).toHaveCount(0)
    for (const tab of ['按钮', '输入与表单', '标签与选择', '弹层', '菜单与提示', '徽标与标签', '状态反馈', '加载与进度', '工具卡', 'Markdown 与资产', '文件与差异', '布局与滚动', '卡片']) {
      await expect(page.getByRole('tab', { name: tab, exact: true })).toBeVisible()
    }
    await expect(page.locator('[data-testid="foundation-asset-inventory"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="playground-story-nav"]')).not.toContainText('基础控件')
    await expect(page.getByText('生成动作', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Markdown 与资产', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^正文与代码块/ })).toBeVisible()
    const markdownStory = page.locator('section').filter({ hasText: '正文与代码块' }).first()
    const markdownCodeBlock = markdownStory.getByTestId('markdown-code-block')
    await expect(markdownCodeBlock).toBeVisible()
    await expectSharedCodeSurface(markdownCodeBlock)
    await expect(markdownCodeBlock).toHaveCSS('background-color', /^(?!rgb\(255, 255, 255\)$)/)
    await page.getByRole('tab', { name: '文件与差异', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^文件树/ })).toBeVisible()
    const foundationDiff = page.getByTestId('foundation-diff-code')
    await expect(foundationDiff.locator('[data-foundation="code-block"]')).toHaveCount(2)
    await expectSharedCodeSurface(foundationDiff)
    await page.getByRole('tab', { name: '标签与选择', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^标签切换/ })).toBeVisible()
    const foundationTabs = page.getByRole('tablist', { name: 'Foundation 标签样张' })
    await foundationTabs.getByRole('tab', { name: '产品体验', exact: true }).click()
    await expect(foundationTabs.getByRole('tab', { name: '产品体验', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('产品体验只负责语义、数据和页面组合。', { exact: true })).toBeVisible()
    await expect(foundationTabs).toHaveAttribute('data-foundation', 'tabs')
    await foundationTabs.getByRole('tab', { name: '产品体验', exact: true }).press('ArrowRight')
    await expect(foundationTabs.getByRole('tab', { name: 'Agent 实验', exact: true })).toBeFocused()
    await foundationTabs.getByRole('tab', { name: 'Agent 实验', exact: true }).press('Home')
    await expect(foundationTabs.getByRole('tab', { name: '基础', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: /^下拉选择/ })).toBeVisible()
    await page.getByRole('tab', { name: '弹层', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^对话框/ })).toBeVisible()
    await page.getByRole('tab', { name: '菜单与提示', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^下拉菜单/ })).toBeVisible()
    await page.getByRole('tab', { name: '状态反馈', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^Chat 空态/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^进度条/ })).toHaveCount(0)
    await page.getByRole('tab', { name: '加载与进度', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^进度条/ })).toBeVisible()
    await page.getByRole('tab', { name: '卡片', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^通用卡片/ })).toBeVisible()
    await page.getByRole('tab', { name: '徽标与标签', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^徽标与标签/ })).toBeVisible()
    await page.getByRole('tab', { name: '按钮', exact: true }).click()
    await expect(page.getByRole('heading', { name: '图标按钮', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: '布局与滚动', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^分隔线/ })).toBeVisible()
    await expect(page.getByTestId('divider-boundary-samples')).toBeVisible()
    await expect(page.getByText('分隔线的边界', { exact: true })).toHaveCount(0)

    await nav.getByRole('button', { name: '设计语言', exact: true }).click()
    const designSource = page.getByTestId('playground-source')
    await expect(designSource).toBeVisible()
    await expect(designSource).toHaveAttribute('title', /DesignSystemPanel\.tsx/)
    await expect(designSource).toHaveClass(/w-\[18rem\]/)
    await expect(page.getByTestId('color-role-groups')).toBeVisible()
    await expect(page.getByTestId('color-interaction-matrix')).toContainText('focus / disabled')
    await page.getByRole('button', { name: '主题对照', exact: true }).click()
    await expect(page.getByTestId('theme-study-grid')).toBeVisible()
    for (const studyId of ['porcelain-blue', 'yao-stone', 'song-smoke', 'deep-plum']) {
      await expect(page.getByTestId(`theme-study-${studyId}`)).toBeVisible()
    }
    await expect(page.getByTestId('theme-study-selection')).toContainText('瓷青')
    await page.getByTestId('theme-study-yao-stone').getByRole('button', { name: '设为比较', exact: true }).click()
    await expect(page.getByTestId('theme-study-selection')).toContainText('曜石')
    await expect(page.getByTestId('theme-study-yao-stone')).toContainText('当前比较')
    await expect(page.getByTestId('production-theme-strip')).toContainText('瓷青')
    await page.getByRole('button', { name: '形态与动效', exact: true }).click()
    const radiusSlider = page.getByTestId('radius-controls').getByRole('slider', { name: '自定义圆角', exact: true })
    await expect(radiusSlider).toBeVisible()
    await radiusSlider.fill('24')
    await expect(radiusSlider).toHaveValue('24')
    await expect(page.getByTestId('material-studies')).toBeVisible()
    await expect(page.getByTestId('material-mask')).toContainText('仅浮层')
    const motionSamples = page.getByTestId('motion-samples')
    await expect(motionSamples).toBeVisible()
    await expect(page.getByText('点击播放', { exact: true })).toHaveCount(0)
    await expect(page.getByText('150ms', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '标准', exact: true })).toBeVisible()
    const motionSwitch = motionSamples.getByRole('switch', { name: '动效播放', exact: true })
    await expect(motionSwitch).toHaveAttribute('aria-checked', 'true')
    await expect(motionSamples.getByTestId('motion-sample-motion-fast').getByTestId('motion-sample-bar')).not.toHaveCSS('animation-name', 'none')
    await motionSwitch.click()
    await expect(motionSwitch).toHaveAttribute('aria-checked', 'false')
    await expect(motionSamples.getByTestId('motion-sample-motion-fast').getByTestId('motion-sample-bar')).toHaveCSS('animation-name', 'none')

    await nav.getByRole('button', { name: '图标与视觉', exact: true }).click()
    const visualTitleRow = page.getByTestId('playground-page-title-row')
    const visualSource = page.getByTestId('playground-source')
    await expect(visualSource).toHaveAttribute('title', /UiControlsPanel\.tsx/)
    await expect(visualTitleRow).toContainText('图标与视觉')
    const visualTitleBox = await visualTitleRow.locator('h1').boundingBox()
    const visualSourceBox = await visualSource.boundingBox()
    expect(visualTitleBox).not.toBeNull()
    expect(visualSourceBox).not.toBeNull()
    expect(Math.abs((visualTitleBox?.y ?? 0) - (visualSourceBox?.y ?? 0))).toBeLessThan(12)
    const iconInventory = page.locator('[data-testid="icon-inventory"]')
    await expect(iconInventory).toBeVisible()
    await expect(iconInventory.getByTestId('icon-count')).toBeVisible()
    const iconStory = iconInventory.locator('section').filter({ hasText: 'Lucide 语义图标目录' }).last()
    const iconHeading = iconStory.locator('h4').filter({ hasText: 'Lucide 语义图标目录' }).first()
    const iconCount = iconStory.getByTestId('icon-count')
    await expect(iconStory.getByTestId('story-block-header').getByRole('button', { name: '打开图标搜索', exact: true })).toBeVisible()
    await expect(iconStory.locator('code')).toContainText('src/shared/icon-registry.ts')
    await expect(iconStory.getByTestId('icon-source')).toHaveAttribute('title', /src\/shared\/icon-registry\.ts/)
    await expect(iconStory.getByTestId('icon-source')).toHaveClass(/w-\[10rem\]/)
    const [headingBox, countBox] = await Promise.all([iconHeading.boundingBox(), iconCount.boundingBox()])
    expect(headingBox).not.toBeNull()
    expect(countBox).not.toBeNull()
    expect(Math.abs((headingBox?.y ?? 0) - (countBox?.y ?? 0))).toBeLessThan(4)
    const iconSizeControls = iconInventory.getByTestId('icon-size-controls')
    await expect(iconSizeControls).toBeVisible()
    await expect(iconSizeControls.getByTestId('icon-size-scale')).toContainText('12px')
    await expect(iconSizeControls.getByTestId('icon-size-scale')).toContainText('20px')
    const catalogIcon = iconInventory.getByTestId('icon-catalog-grid').locator('div.flex.h-8.w-8 svg').first()
    await expect(catalogIcon).toHaveAttribute('width', '16')
    const iconSlider = iconSizeControls.getByRole('slider', { name: '自定义图标尺寸', exact: true })
    await expect(iconSlider).toBeVisible()
    await iconSlider.fill('24')
    await expect(iconSlider).toHaveValue('24')
    await expect(iconSizeControls.getByTestId('icon-custom-preview')).toContainText('24px')
    await expect(iconSizeControls.getByTestId('icon-custom-preview').locator('svg').first()).toHaveAttribute('width', '24')
    await expect(catalogIcon).toHaveAttribute('width', '16')
    await iconInventory.getByRole('button', { name: '打开图标搜索', exact: true }).click()
    await expect(page.getByPlaceholder('搜索中文或 English')).toBeVisible()
    await expect(page.getByText('navigation.search', { exact: true })).toHaveCount(0)
    await expect(page.getByText('菜单', { exact: true }).first()).toBeVisible()
    const menuIcon = page.locator('[data-testid="icon-inventory"] div').filter({ hasText: /^菜单Menu$/ }).first()
    await expect(menuIcon).toBeVisible()
    const adoptionMark = menuIcon.getByTestId('adoption-mark')
    await expect(adoptionMark).toBeVisible()
    const markPosition = await menuIcon.evaluate((card) => {
      const mark = card.querySelector('[data-testid="adoption-mark"]')
      if (!mark) throw new Error('adoption mark missing')
      const cardBox = card.getBoundingClientRect()
      const markBox = mark.getBoundingClientRect()
      return { topDelta: markBox.top - cardBox.top, rightDelta: cardBox.right - markBox.right }
    })
    expect(markPosition.topDelta).toBeLessThan(24)
    expect(markPosition.rightDelta).toBeLessThan(24)
    await expect(page.getByText('Menu', { exact: true }).first()).toBeVisible()

    await nav.getByRole('button', { name: 'Chat', exact: true }).click()
    const chatDependencies = page.locator('[data-testid="product-experience-dependencies"]')
    await expect(page.locator('[data-testid="playground-page-header"]').getByTestId('product-experience-dependencies')).toHaveCount(1)
    await expect(page.locator('[data-testid="playground-main"] > div > .view-transition > [data-testid="product-experience-dependencies"]')).toHaveCount(0)
    await expect(chatDependencies).toContainText('基础引用')
    await expect(chatDependencies.getByTestId('experience-foundation-parts')).toContainText('空状态')
    await expect(chatDependencies.getByTestId('experience-foundation-parts')).not.toContainText('Markdown 渲染器')
    await expect(chatDependencies).not.toContainText('experience.chat')
    await expect(chatDependencies).not.toContainText('主侧栏')
    await expect(chatDependencies.getByTestId('experience-source')).toContainText('src/App.tsx')
    await expect(page.getByText('页面基线', { exact: true })).toHaveCount(0)
    await expect(page.getByText('页面组合样张', { exact: true })).toHaveCount(0)
    const titleRow = page.getByTestId('playground-page-title-row')
    await expect(titleRow).toContainText('Chat')
    await expect(titleRow).toContainText('确认伙伴身份、会话导航、欢迎区与消息流的组合关系。')
    await expect(page.getByText('聊天、朋友圈和衣柜都跟着当前主角；对话进行中不能换人。', { exact: true })).toHaveCount(0)
    const titleBox = await titleRow.locator('h1').boundingBox()
    const descriptionBox = await titleRow.locator('p').boundingBox()
    expect(titleBox).not.toBeNull()
    expect(descriptionBox).not.toBeNull()
    expect(Math.abs((titleBox?.y ?? 0) - (descriptionBox?.y ?? 0))).toBeLessThan(8)
    const chatToolbar = page.getByTestId('chat-surface-toolbar')
    await expect(chatToolbar).toBeVisible()
    await expect(chatToolbar).not.toContainText('src/App.tsx')
    await expect(page.getByText('隔离实验', { exact: true })).toHaveCount(0)
    const candidate = page.locator('[data-testid="surface-sidebar-candidate"]')
    await expect(candidate).toBeVisible()
    await expect(candidate.getByTitle('记忆')).toHaveCount(0)
    await expect(candidate.getByTitle('人物世界')).toBeVisible()
    await expect(candidate.getByTitle('设置')).toBeVisible()
    await expect(page.locator('[data-testid="chat-surface-main"]').getByText('新对话', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('tablist', { name: 'Chat 主旅程' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '初次进入', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('button', { name: '换个主角 →', exact: true })).toHaveCount(0)
    await expect(page.getByTestId('chat-journey-quick-action')).toHaveCount(3)
    await page.getByTestId('chat-journey-quick-action').filter({ hasText: '看看朋友圈' }).click()
    await expect(nav.getByRole('button', { name: '人物世界', exact: true })).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('playground-world-experience')).toBeVisible()
    await expect(page.getByTestId('world-open-memory')).toHaveCount(0)
    await expect(page.getByText('看记忆', { exact: true })).toHaveCount(0)
    await expect(page.getByText('近期生活', { exact: true })).toHaveCount(0)
    await nav.getByRole('button', { name: '设置', exact: true }).click()
    await expect(nav.getByRole('button', { name: '设置', exact: true })).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('settings-surface-candidate')).toBeVisible()
    await page.getByTestId('settings-candidate-nav-memory').click()
    await expect(page.getByTestId('settings-candidate-nav-memory')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('memory-surface-candidate')).toBeVisible()
    await nav.getByRole('button', { name: 'Chat', exact: true }).click()
    await expect(nav.getByRole('button', { name: 'Chat', exact: true })).toHaveAttribute('data-active', 'true')
    await nav.getByRole('button', { name: 'Chat', exact: true }).click()
    await expect(page.getByRole('tab', { name: '初次进入', exact: true })).toHaveAttribute('aria-selected', 'true')

    await page.getByRole('tab', { name: '正在聊天', exact: true }).click()
    await expect(page.getByTestId('chat-surface-message-flow')).toBeVisible()
    await expect(page.getByText('帮我把今天的事情理一下，先做最重要的。', { exact: true })).toBeVisible()
    await expect(page.getByTestId('chat-surface-task-card')).toHaveCount(0)

    await page.getByRole('tab', { name: '处理中', exact: true }).click()
    await expect(page.getByTestId('chat-surface-task-card')).toHaveCount(0)
    await expect(page.getByTestId('chat-surface-workspace')).toBeVisible()
    await expect(page.getByTestId('chat-surface-workspace').getByTestId('workspace-dock-candidate')).toBeVisible()
    await expect(page.getByTestId('chat-surface-workspace').getByTestId('right-dock-tab-preview')).toHaveCount(0)
    await expect(page.getByTestId('chat-surface-workspace').getByRole('tab', { name: '文件 1', exact: true })).toBeVisible()
    await expect(page.getByTestId('chat-surface-workspace')).toContainText('notes.md')
    await expect(page.getByTestId('chat-surface-workspace').getByLabel('添加工作区内容')).toBeVisible()
    await page.getByRole('tab', { name: '需确认', exact: true }).click()
    await expect(page.getByTestId('chat-surface-confirmation-overlay')).toBeVisible()
    await expect(page.getByTestId('chat-surface-confirmation')).toBeVisible()
    await expect(page.getByTestId('chat-surface-message-flow').getByTestId('permission-confirm-card')).toHaveCount(0)
    await expect(page.getByTestId('permission-confirm-card')).toContainText('file_write')
    await expect(page.getByTestId('chat-surface-workspace')).toHaveCount(0)
    await page.getByTestId('permission-confirm-card').getByRole('button', { name: '允许执行', exact: true }).click()
    await expect(page.getByRole('tab', { name: '处理中', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('chat-surface-workspace')).toBeVisible()
    await page.getByRole('tab', { name: '已完成', exact: true }).click()
    await expect(page.getByTestId('chat-surface-completed-reply')).toBeVisible()
    await expect(page.getByTestId('chat-surface-completed-reply')).toContainText('已经整理好优先顺序')
    await expect(page.getByTestId('chat-surface-task-card')).toHaveCount(0)
    await expect(page.getByTestId('chat-surface-workspace')).toHaveCount(0)
    await expect(page.getByTestId('chat-surface-message-flow')).toBeVisible()

    await page.getByRole('tab', { name: '未完成', exact: true }).click()
    await expect(page.getByTestId('chat-surface-failed')).toBeVisible()
    await expect(page.getByTestId('chat-surface-workspace')).toHaveCount(0)
    await page.getByTestId('chat-surface-failed').getByTestId('chat-surface-retry-task').click()
    await expect(page.getByRole('tab', { name: '处理中', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('chat-surface-workspace')).toBeVisible()
    await page.getByRole('tab', { name: '需确认', exact: true }).click()
    await expect(page.getByTestId('chat-surface-confirmation-overlay')).toBeVisible()
    await page.getByTestId('permission-confirm-card').getByRole('button', { name: '拒绝', exact: true }).click()
    await expect(page.getByTestId('chat-surface-failed')).toBeVisible()
    await page.getByTestId('chat-surface-failed').getByTestId('chat-surface-return-to-conversation').click()
    await expect(page.getByTestId('chat-surface-message-flow')).toBeVisible()

    await page.getByRole('tab', { name: '初次进入', exact: true }).click()
    await expect(page.getByTestId('chat-surface-message-flow')).toHaveCount(0)
    await expect(page.getByTestId('chat-surface-workspace')).toHaveCount(0)

    await nav.getByRole('button', { name: '设置', exact: true }).click()
    const settingsCandidate = page.getByTestId('settings-surface-candidate')
    await expect(settingsCandidate).toBeVisible()
    await expect(settingsCandidate.getByTestId('settings-nav')).toBeVisible()
    await expect(settingsCandidate.getByRole('button', { name: '记忆', exact: true })).toBeVisible()

    await nav.getByRole('button', { name: '工作区', exact: true }).click()
    const workspaceDependencies = page.locator('[data-testid="product-experience-dependencies"]')
    await expect(page.locator('[data-testid="playground-page-header"]').getByTestId('product-experience-dependencies')).toHaveCount(1)
    await expect(page.locator('[data-testid="playground-main"] > div > .view-transition > [data-testid="product-experience-dependencies"]')).toHaveCount(0)
    await expect(workspaceDependencies).toContainText('基础引用')
    await expect(workspaceDependencies.getByTestId('experience-foundation-parts')).toContainText('文件树')
    await expect(workspaceDependencies.getByTestId('experience-foundation-parts')).toContainText('Markdown 渲染器')
    await expect(workspaceDependencies.getByTestId('experience-source')).toContainText('WorkspaceExperienceCandidate.tsx')
    await expect(workspaceDependencies).not.toContainText('experience.workspace')
    await expect(workspaceDependencies).not.toContainText('右侧工作坞')
    const workspace = page.getByTestId('workspace-experience-candidate')
    await expect(workspace.getByRole('tablist', { name: '工作区功能' }).getByRole('tab')).toHaveCount(5)
    await expect(workspace).not.toContainText('文件任务')
    await expect(workspace).not.toContainText('完成结果')
    await workspace.getByRole('tab', { name: '文件', exact: true }).click()
    await expect(workspace).toContainText('notes.md')
    await workspace.getByRole('tab', { name: '审阅', exact: true }).click()
    await expect(workspace.getByTestId('workspace-diff')).toContainText('spacing')

    await nav.getByRole('button', { name: '人物世界', exact: true }).click()
    await expect(page.getByTestId('playground-moments-profile')).toBeVisible()
    await expect(page.getByTestId('playground-moments-profile')).toContainText('小林')
    await expect(page.getByText('把窗帘拉开了一点，泡了杯乌龙茶，准备先把桌面清出一块。', { exact: true })).toBeVisible()
    await expect(page.locator('.moments-social-feed.moments-alice-feed')).toBeVisible()
    await expect(page.getByTestId('moment-post')).toHaveCount(3)
    await expect(page.getByTestId('moment-post').first()).not.toContainText('生活动态')
    const firstMomentImage = page.getByTestId('moment-post').first().getByTestId('moment-media-image')
    await expect(firstMomentImage).toBeVisible()
    await expect(firstMomentImage).toHaveAttribute('alt', '窗边的乌龙茶、笔记和远处山影')
    const firstMomentLocation = page.getByTestId('moment-post').first().getByTestId('moment-location')
    await expect(firstMomentLocation).toHaveText('家中')
    expect(await firstMomentImage.evaluate((image, location) => Boolean(location && (image.compareDocumentPosition(location as Node) & Node.DOCUMENT_POSITION_FOLLOWING)), await firstMomentLocation.elementHandle())).toBe(true)
    const momentImageBox = await firstMomentImage.boundingBox()
    expect(momentImageBox).not.toBeNull()
    expect(momentImageBox?.width ?? 0).toBeLessThanOrEqual(500)
    expect((momentImageBox?.width ?? 0) / (momentImageBox?.height ?? 1)).toBeCloseTo(1.5, 1)
    await expect(page.getByText('路过河边的时候记下了一个想法：慢一点，反而能看见今天真正想做的事。', { exact: true })).toBeVisible()

    await nav.getByRole('button', { name: '设置', exact: true }).click()
    await page.getByTestId('settings-candidate-nav-memory').click()
    await expect(page.getByTestId('settings-candidate-nav-memory')).toHaveAttribute('aria-current', 'page')
    const memorySurface = page.getByTestId('memory-surface-candidate')
    await expect(page.getByTestId('memory-group-identity')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('memory-group-identity')).toContainText('3')
    await expect(page.getByTestId('memory-group-collaboration')).toContainText('工作方式')
    await expect(page.getByTestId('memory-group-communication')).toContainText('沟通偏好')
    await expect(page.getByTestId('memory-group-relationship')).toContainText('我们之间')
    await expect(memorySurface).toContainText('正在做一款人格化桌面 Agent。')
    await expect(memorySurface).toContainText('长期关注人格化体验，以及产品设计与工程落地之间的关系。')
    await expect(memorySurface.getByRole('button', { name: '添加一条记忆', exact: true })).toBeVisible()
    await expect(memorySurface.getByRole('button', { name: /^编辑记忆 / })).toHaveCount(3)
    await expect(memorySurface.getByRole('button', { name: /^删除记忆 / })).toHaveCount(3)
    await expect(memorySurface.getByText('编辑', { exact: true })).toHaveCount(0)
    await expect(memorySurface.getByText('删除', { exact: true })).toHaveCount(0)
    await expect(memorySurface).not.toContainText('先研究现有实现，再形成判断和施工方案。')
    await expect(memorySurface).not.toContainText('偏好直接、清楚、有判断依据的回答。')
    await expect(memorySurface.getByTestId('memory-preview-source-memory-user-identity')).toHaveCount(0)
    await expect(page.getByTestId('memory-show-source')).toHaveCount(0)
    await expect(memorySurface).not.toContainText('之后会：')
    await expect(memorySurface).not.toContainText('向量')
    await expect(memorySurface).not.toContainText('召回分数')
    await expect(memorySurface.locator('[data-testid^="memory-sensitive-warning-"]')).toHaveCount(0)
    await expect(page.getByTestId('memory-actions')).toBeVisible()
    await expect(page.getByTestId('memory-group-description')).toHaveCount(0)
    await expect(memorySurface).not.toContainText('稳定背景、角色与长期关注。')
    await expect(memorySurface).not.toContainText('推进工作、决策与验收的稳定方式。')
    await page.getByTestId('memory-group-communication').click()
    await page.getByTestId('memory-add-row').getByRole('button', { name: '添加一条记忆', exact: true }).click()
    const memoryAddForm = page.getByTestId('memory-add-row')
    const newMemoryInput = memoryAddForm.getByLabel('新记忆内容', { exact: true })
    await newMemoryInput.focus()
    await expect(newMemoryInput).toHaveCSS('outline-style', 'none')
    const addFocusColor = await newMemoryInput.evaluate((node) => getComputedStyle(node).borderColor)
    expect(addFocusColor.replace(/\s+/g, '')).not.toMatch(/rgb\(0,0,0\)|#000|#000000/i)
    await newMemoryInput.fill('我希望复杂任务先给结论，再展开步骤。')
    await expect(memoryAddForm.getByRole('button', { name: '保存', exact: true })).toHaveCount(0)
    await expect(memoryAddForm.getByRole('button', { name: '取消', exact: true })).toHaveCount(0)
    await memoryAddForm.getByRole('button', { name: '保存新记忆', exact: true }).click()
    await expect(page.getByTestId('memory-group-communication')).toContainText('4')
    await expect(memorySurface).toContainText('我希望复杂任务先给结论，再展开步骤。')
    await page.getByRole('button', { name: '搜索记忆', exact: true }).click()
    await expect(page.getByRole('button', { name: '搜索记忆', exact: true })).toHaveCount(0)
    const memorySearch = page.locator('input[aria-label="搜索记忆"]')
    await expect(memorySearch).toBeVisible()
    await expect(page.getByRole('button', { name: '清除搜索', exact: true })).toBeVisible()
    await memorySearch.fill('复杂任务')
    await expect(memorySurface).toContainText('我希望复杂任务先给结论，再展开步骤。')
    await expect(memorySurface).not.toContainText('希望新增卡片和入口前，先说明它解决什么问题。')
    await page.getByRole('button', { name: '清除搜索', exact: true }).click()
    await expect(page.getByRole('button', { name: '搜索记忆', exact: true })).toBeVisible()
    await expect(memorySurface).toContainText('我希望复杂任务先给结论，再展开步骤。')
    const addedMemory = memorySurface.getByText('我希望复杂任务先给结论，再展开步骤。', { exact: true })
    await addedMemory.hover()
    await memorySurface.getByRole('button', { name: /^编辑记忆 / }).last().click()
    const editedInput = memorySurface.locator('input').last()
    const editingDate = memorySurface.locator('[data-testid^="memory-item-date-memory-custom-"]').last()
    const dateBefore = await editingDate.boundingBox()
    await editedInput.fill('我希望复杂任务先给结论，再展开关键步骤。')
    await expect(memorySurface.getByRole('button', { name: /^保存记忆 / })).toBeVisible()
    await expect(memorySurface.getByRole('button', { name: /^取消编辑 / })).toBeVisible()
    await expect(memorySurface.getByRole('button', { name: '保存', exact: true })).toHaveCount(0)
    const dateWhileEditing = await editingDate.boundingBox()
    expect(Math.abs((dateWhileEditing?.y ?? 0) - (dateBefore?.y ?? 0))).toBeLessThan(2)
    await memorySurface.getByRole('button', { name: /^保存记忆 / }).click()
    await expect(memorySurface).toContainText('我希望复杂任务先给结论，再展开关键步骤。')
    await memorySurface.getByText('我希望复杂任务先给结论，再展开关键步骤。', { exact: true }).hover()
    await memorySurface.getByRole('button', { name: /^删除记忆 / }).last().click()
    await expect(memorySurface).toContainText('我希望复杂任务先给结论，再展开关键步骤。')
    await expect(memorySurface.getByRole('button', { name: /^确认删除记忆 / })).toBeVisible()
    await expect(page.locator('[data-testid="chat-surface-confirmation-overlay"]')).toHaveCount(0)
    await memorySurface.getByRole('button', { name: /^确认删除记忆 / }).click()
    await expect(memorySurface).not.toContainText('我希望复杂任务先给结论，再展开关键步骤。')

    await page.getByRole('tab', { name: '敏感项', exact: true }).click()
    await expect(memorySurface.getByTestId('memory-sensitive-warning-memory-sensitive')).toBeVisible()
    const sensitiveWarning = memorySurface.getByTestId('memory-sensitive-warning-memory-sensitive')
    await expect(sensitiveWarning).toHaveText('敏感信息：涉及健康隐私，请谨慎保留。')
    const sensitiveCard = memorySurface.getByTestId('memory-item-memory-sensitive')
    await expect(sensitiveCard.locator(':scope > :first-child')).toHaveAttribute('data-testid', 'memory-sensitive-warning-memory-sensitive')
    await sensitiveCard.hover()
    const warningBeforeEdit = await sensitiveWarning.boundingBox()
    await sensitiveCard.getByRole('button', { name: /^编辑记忆 / }).click()
    await expect(sensitiveWarning).toBeVisible()
    expect(await sensitiveWarning.boundingBox()).toEqual(warningBeforeEdit)
    await sensitiveCard.getByRole('button', { name: /^取消编辑 / }).click()
    await expect(memorySurface).not.toContainText('请确认是否需要长期保留')
    await expect(memorySurface).not.toContainText('你可以编辑或删除')
    await expect(memorySurface).not.toContainText('敏感·健康')

    await page.getByTestId('memory-debug-mode').click()
    await expect(page.getByTestId('memory-debug-mode')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('memory-show-source')).toHaveAttribute('aria-checked', 'false')
    await page.getByTestId('memory-show-source').click()
    await expect(memorySurface.getByTestId('memory-preview-source-memory-user-voice')).toHaveText('你对回复方式给出的反馈（隔离样张）')
    await expect(memorySurface).not.toContainText('来自：')
    await page.getByTestId('memory-debug-mode').click()
    await expect(page.getByTestId('memory-show-source')).toHaveCount(0)
    await expect(memorySurface.getByTestId('memory-preview-source-memory-user-voice')).toHaveCount(0)

    await page.getByTestId('memory-group-collaboration').click()
    await expect(page.getByTestId('memory-group-collaboration')).toContainText('4')
    await expect(memorySurface).toContainText('交付不能只做到能运行，也要达到应有的审美与完成度。')
    await expect(memorySurface).not.toContainText('不喜欢无意义的层级、重复说明和打扰式提示。')

    await page.getByTestId('memory-group-communication').click()
    await expect(memorySurface).toContainText('希望新增卡片和入口前，先说明它解决什么问题。')
    await expect(memorySurface).toContainText('不喜欢无意义的层级、重复说明和打扰式提示。')
    await expect(memorySurface).not.toContainText('复杂改动要先写施工合同，并按步骤验收。')

    await page.getByTestId('memory-group-relationship').click()
    await expect(page.getByTestId('memory-group-relationship')).toHaveAttribute('aria-selected', 'true')
    await expect(memorySurface).toContainText('我们约定：先参考 Alice 和项目现状，再形成自己的判断。')
    await expect(memorySurface).toContainText('我们共同确定：人物世界呈现伙伴生活，记忆管理长期信息。')
    await expect(memorySurface).not.toContainText('正在做一款人格化桌面 Agent。')

    await page.getByTestId('memory-group-collaboration').click()
    await page.getByRole('tab', { name: '纠正记忆', exact: true }).click()
    const correction = memorySurface.locator('input').first()
    await expect(correction).toHaveCSS('font-size', '13px')
    const displayMemory = memorySurface.getByText('复杂改动要先写施工合同，并按步骤验收。', { exact: true })
    await expect(displayMemory).toHaveCSS('font-size', '13px')
    await correction.fill('先在 Playground 验证，再由用户决定是否回流正式 UI。')
    await memorySurface.getByRole('button', { name: /^保存记忆 / }).first().click()
    await expect(memorySurface).toContainText('先在 Playground 验证，再由用户决定是否回流正式 UI。')
    await expect(memorySurface.getByTestId('memory-add-row')).toBeVisible()

    await expect(nav.getByRole('button', { name: '设置', exact: true })).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('settings-candidate-nav-memory')).toHaveAttribute('aria-current', 'page')
    const settingsSurface = page.getByTestId('settings-surface-candidate')
    await expect(settingsSurface.getByTestId('settings-main')).toContainText('记忆')
    await expect(settingsSurface).not.toContainText('向量召回')
    await nav.getByRole('button', { name: 'Chat', exact: true }).click()
    await expect(nav.getByRole('button', { name: 'Chat', exact: true })).toHaveAttribute('data-active', 'true')
  })

  for (const theme of ['yao-stone', 'porcelain-blue']) {
    for (const width of [1166, 900]) {
      test(`Chat 工作区分隔与开关 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 731 })
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
        await page.goto('/')
        await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
        await page.getByTestId('playground-nav').getByRole('button', { name: 'Chat', exact: true }).click()
        await page.getByRole('tab', { name: '处理中', exact: true }).click()
        const panel = page.getByTestId('chat-surface-workspace')
        const toggle = page.getByTestId('chat-surface-workspace-toggle')
        const main = page.getByTestId('chat-surface-main')
        await expect(panel).toHaveCSS('border-left-width', '1px')
        await expect(panel).not.toHaveCSS('border-left-color', 'rgba(0, 0, 0, 0)')
        await expect(toggle).toHaveAttribute('aria-expanded', 'true')
        await expect(toggle.locator('svg')).toHaveClass(/lucide-panel-right/)
        await panel.getByLabel('添加工作区内容', { exact: true }).click()
        await panel.getByRole('menuitem', { name: '浏览器', exact: true }).click()
        await expect(panel.getByRole('tab', { name: '浏览器 1', exact: true })).toHaveAttribute('aria-selected', 'true')
        // 分栏开关会改变对话宽度，因此按右上角相对坐标验证固定操作槽，不能比较绝对横坐标。
        const geometry = () => toggle.evaluate((node) => {
          const button = node.getBoundingClientRect()
          const main = node.closest('[data-testid="chat-surface-main"]')!.getBoundingClientRect()
          return { width: button.width, height: button.height, right: main.right - button.right, top: button.top - main.top }
        })
        const initial = await geometry()
        expect(initial.right).toBeGreaterThanOrEqual(0)
        expect(Math.abs((await panel.boundingBox())!.height - (await main.boundingBox())!.height)).toBeLessThan(2)
        await toggle.hover()
        expect(await geometry()).toEqual(initial)
        await page.screenshot({ path: testInfo.outputPath('chat-workspace-open.png'), animations: 'disabled' })
        await toggle.click()
        await expect(panel).toBeHidden()
        await expect(toggle).toHaveAccessibleName('打开工作区')
        await expect(toggle).toHaveAttribute('aria-expanded', 'false')
        await expect(page.getByRole('tab', { name: '处理中', exact: true })).toHaveAttribute('aria-selected', 'true')
        await expect(main.getByTestId('chat-surface-message-flow')).toBeVisible()
        expect(await geometry()).toEqual(initial)
        await page.screenshot({ path: testInfo.outputPath('chat-workspace-closed.png'), animations: 'disabled' })
        await toggle.press('Enter')
        await expect(panel).toBeVisible()
        await expect(toggle).toHaveAccessibleName('收起工作区')
        await expect(panel.getByRole('tab', { name: '浏览器 1', exact: true })).toHaveAttribute('aria-selected', 'true')
        await expect(panel.getByRole('tab', { name: '文件 1', exact: true })).toBeVisible()
        expect(await geometry()).toEqual(initial)
        await page.getByRole('button', { name: '分栏窄宽', exact: true }).click()
        await expect(toggle).toBeVisible()
        await expect(panel).toBeVisible()
        await toggle.click()
        await page.getByRole('tab', { name: '已完成', exact: true }).click()
        await expect(toggle).toHaveCount(0)
        await expect(panel).toHaveCount(0)
        await page.getByRole('tab', { name: '处理中', exact: true }).click()
        await expect(panel).toBeVisible()
        await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      })
    }
  }

  for (const theme of ['yao-stone', 'porcelain-blue']) {
    for (const width of [1166, 600]) {
      test(`Playground Skills 真实样张 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 731 })
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
        await page.goto('/')
        await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
        await page.getByTestId('playground-nav').getByRole('button', { name: '设置', exact: true }).click()
        const candidate = page.getByTestId('settings-surface-candidate')
        await candidate.getByTestId('settings-candidate-theme-card').getByRole('button', { name: theme === 'yao-stone' ? /曜石/ : /瓷青/ }).click()
        await candidate.getByRole(width < 640 ? 'tab' : 'button', { name: 'Skills', exact: true }).click()
        await candidate.getByRole('tab', { name: '多个', exact: true }).click()
        await expect(candidate.getByRole('tab', { name: '多个', exact: true })).toHaveAttribute('aria-selected', 'true')
        await page.screenshot({ path: testInfo.outputPath('skills-list.png'), animations: 'disabled' })
        for (const name of ['code-review', 'content-creator']) {
          await candidate.getByRole('button', { name, exact: true }).click()
          const detail = candidate.getByTestId('settings-candidate-skill-detail')
          const heading = detail.getByRole('heading', { name, exact: true })
          const toggle = detail.getByRole('switch')
          const titleBox = await heading.boundingBox()
          const toggleBox = await toggle.boundingBox()
          const backBox = await detail.getByTestId('settings-candidate-skill-back').boundingBox()
          expect(backBox!.y + backBox!.height).toBeLessThan(titleBox!.y)
          expect(Math.abs(titleBox!.y + titleBox!.height / 2 - toggleBox!.y - toggleBox!.height / 2)).toBeLessThan(2)
          await toggle.click()
          const checked = await toggle.getAttribute('aria-checked')
          await expect(detail.getByText(checked === 'true' ? '已启用' : '未启用', { exact: true })).toBeVisible()
          await expect(detail.getByText('未声明', { exact: true })).toBeVisible()
          await expect(detail).not.toContainText('确认约束')
          const raw = readFileSync(`electron/skills-builtin/${name}/SKILL.md`, 'utf8').replace(/\r\n/g, '\n')
          const preview = detail.getByTestId('settings-candidate-skill-file-preview')
          expect((await preview.textContent())?.replace(/\r\n/g, '\n')).toBe(raw)
          await expect(preview).toHaveCSS('overflow-y', 'auto')
          await expect(preview).toHaveCSS('overscroll-behavior-y', 'contain')
          expect(await preview.evaluate((node) => ({
            bounded: node.getBoundingClientRect().height <= window.innerHeight * 0.48 + 1,
            scrollable: node.scrollHeight > node.clientHeight,
            fitsWidth: node.scrollWidth <= node.clientWidth,
          }))).toEqual({ bounded: true, scrollable: true, fitsWidth: true })
          await preview.scrollIntoViewIfNeeded()
          await preview.focus()
          const measureOuterLayout = () => detail.evaluate((node) => ({
            height: node.getBoundingClientRect().height,
            scrolls: Array.from((function* () {
              for (let parent = node.parentElement; parent; parent = parent.parentElement) yield parent
            })()).map((parent) => parent.scrollTop),
          }))
          const outerLayout = await measureOuterLayout()
          await preview.press('ArrowDown')
          await expect.poll(() => preview.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
          await preview.press('Control+End')
          await expect.poll(() => preview.evaluate((node) => Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop))).toBeLessThan(2)
          await preview.hover()
          await page.mouse.wheel(0, 500)
          // 等待浏览器处理边界滚轮，验证不能把剩余滚动量传给外层；只读正文必须完整保留。
          await page.waitForTimeout(200)
          expect(await measureOuterLayout()).toEqual(outerLayout)
          await preview.press('Control+Home')
          await expect.poll(() => preview.evaluate((node) => node.scrollTop)).toBe(0)
          const trigger = detail.locator('p').first()
          await expect(trigger).toContainText('不适用于：')
          expect((await trigger.boundingBox())!.y).toBeLessThan((await detail.locator('p').nth(1).boundingBox())!.y)
          expect(await detail.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
          await page.screenshot({ path: testInfo.outputPath(`skills-${name}.png`), animations: 'disabled' })
          await detail.getByTestId('settings-candidate-skill-back').click()
          await expect(candidate.getByTestId(`settings-candidate-skill-card-${name}`).getByRole('switch')).toHaveAttribute('aria-checked', checked!)
        }
      })
    }
  }

  for (const theme of ['yao-stone', 'porcelain-blue']) {
    for (const width of [1166, 600]) {
      test(`Playground MCP 场景直达 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 731 })
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
        await page.goto('/')
        await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
        await page.getByTestId('playground-nav').getByRole('button', { name: '设置', exact: true }).click()
        const candidate = page.getByTestId('settings-surface-candidate')
        await candidate.getByTestId('settings-candidate-theme-card').getByRole('button', { name: theme === 'yao-stone' ? /曜石/ : /瓷青/ }).click()
        await candidate.getByRole(width < 640 ? 'tab' : 'button', { name: 'MCP', exact: true }).click()
        const preview = candidate.getByTestId('settings-candidate-mcp-scenes')
        const tabs = preview.getByRole('tablist', { name: 'MCP 样张场景' })
        await expect(tabs.getByRole('tab')).toHaveCount(17)
        for (const [label, serverCount, toolCount] of [
          ['未添加', 0, 0], ['1 个 MCP', 1, 3], ['2 个 MCP', 2, 4],
          ['连接中', 1, 0], ['待确认', 1, 3], ['1 个工具', 1, 1],
          ['2 个工具', 1, 2], ['3 个工具', 1, 3], ['无工具', 1, 0],
          ['已停用', 1, 0], ['连接失败', 1, 0], ['待登录', 1, 0],
        ] as const) {
          await tabs.getByRole('tab', { name: label, exact: true }).click()
          await expect(preview.locator('section')).toHaveCount(serverCount)
          await expect(preview.getByTestId('mcp-tool-row')).toHaveCount(toolCount)
          await expect(preview.locator('section section')).toHaveCount(0)
          if (label === '连接中' || label === '待登录') await expect(preview).not.toContainText('0 个工具')
          if (label === '无工具') await expect(preview).toContainText('已连接，服务未提供工具。')
          expect(await preview.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
          if (['2 个 MCP', '待确认', '连接失败', '未添加'].includes(label)) {
            await tabs.scrollIntoViewIfNeeded()
            await page.screenshot({ path: testInfo.outputPath(`mcp-${label}.png`), animations: 'disabled' })
            if (label === '待确认') {
              await expect(preview).toContainText('3 个已选择')
              await preview.getByRole('button', { name: '确认连接', exact: true }).scrollIntoViewIfNeeded()
              await page.screenshot({ path: testInfo.outputPath('mcp-confirm-actions.png'), animations: 'disabled' })
            }
          }
        }
        await tabs.getByRole('tab', { name: '2 个 MCP', exact: true }).click()
        await preview.getByTestId('mcp-enabled-files').click()
        await expect(preview.getByTestId('mcp-enabled-files')).toHaveAttribute('aria-checked', 'false')
        await expect(preview.getByTestId('mcp-enabled-docs')).toHaveAttribute('aria-checked', 'true')
        await expect(preview.getByTestId('settings-candidate-mcp-server-docs')).toContainText('已连接')
        await tabs.getByRole('tab', { name: '待确认', exact: true }).click()
        await preview.getByRole('checkbox', { name: '允许读取文件', exact: true }).uncheck()
        await preview.getByRole('button', { name: '确认连接', exact: true }).click()
        await expect(preview).toContainText('2 个已允许')
        await expect(preview.getByTestId('mcp-tool-row').filter({ hasText: 'read_file' })).toContainText('未允许')
        await tabs.getByRole('tab', { name: '待确认', exact: true }).click()
        await expect(preview.getByRole('checkbox', { name: '允许读取文件', exact: true })).toBeChecked()
        await preview.getByRole('button', { name: '取消', exact: true }).click()
        await expect(preview.getByTestId('settings-candidate-mcp-empty')).toBeVisible()
        await tabs.getByRole('tab', { name: '连接失败', exact: true }).click()
        await preview.getByRole('button', { name: '重试', exact: true }).click()
        await expect(preview.getByRole('status')).toHaveText('连接中')
        await preview.getByRole('button', { name: '取消', exact: true }).click()
        await expect(preview.getByRole('status')).toHaveText('已停用')
        for (const label of ['添加连接', '本地填写', '校验失败', '添加连接中', '获取工具成功']) {
          await tabs.getByRole('tab', { name: label, exact: true }).click()
          const form = preview.getByTestId('mcp-connection-form')
          await expect(form).toBeVisible()
          if (label === '校验失败') await expect(form.getByRole('alert')).toContainText('请输入连接名称')
          if (label === '添加连接中') await expect(form.getByRole('button', { name: '保存连接' })).toBeDisabled()
          if (label === '本地填写') await expect(form.getByLabel('启动命令')).toHaveValue('npx')
          await form.scrollIntoViewIfNeeded()
          await page.screenshot({ path: testInfo.outputPath(`mcp-form-${label}.png`), animations: 'disabled' })
          expect(await form.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
        }
        await tabs.getByRole('tab', { name: '2 个 MCP', exact: true }).click()
        await preview.getByTestId('settings-candidate-mcp-add').click()
        const form = preview.getByTestId('mcp-connection-form')
        await form.getByLabel('服务 URL').fill('file:///tmp')
        await form.getByRole('button', { name: '测试连接', exact: true }).click()
        await expect(form.getByRole('alert')).toContainText('HTTP')
        await form.getByLabel('服务 URL').fill('https://docs.example.com/mcp')
        await form.getByLabel('认证方式').selectOption('bearer')
        await form.getByRole('button', { name: '测试连接', exact: true }).click()
        await expect(form.getByRole('alert')).toContainText('访问令牌')
        await form.getByLabel('认证方式').selectOption('none')
        await form.getByRole('button', { name: '测试连接', exact: true }).click()
        await expect(form.getByRole('status')).toContainText('已获取')
        await form.getByLabel('连接名称').fill('研究资料')
        await expect(form.getByRole('button', { name: '保存连接' })).toBeDisabled()
        await form.getByRole('button', { name: '测试连接', exact: true }).click()
        await expect(form.getByRole('status')).toContainText('已获取')
        await form.getByLabel('允许search_docs', { exact: true }).uncheck()
        await form.getByRole('button', { name: '保存连接' }).click()
        await expect(preview.locator('section')).toHaveCount(3)
        await expect(preview.locator('section').filter({ hasText: '研究资料' })).toContainText('未允许')
        await preview.getByTestId('settings-candidate-mcp-add').click()
        await form.getByRole('button', { name: '本地服务', exact: true }).click()
        await form.getByLabel('环境变量（每行 NAME=value）').fill('invalid')
        await form.getByRole('button', { name: '测试连接', exact: true }).click()
        await expect(form.getByRole('alert')).toContainText('NAME=value')
        await form.getByRole('button', { name: '取消', exact: true }).click()
        await expect(preview.locator('section')).toHaveCount(3)
      })
    }
  }

  for (const theme of ['yao-stone', 'porcelain-blue']) {
    for (const width of [1166, 600]) {
      test(`Playground 工作区五功能 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 800 })
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
        await page.goto('/')
        await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
        await page.getByTestId('playground-nav').getByRole('button', { name: '工作区', exact: true }).click()
        const work = page.getByTestId('workspace-experience-candidate')
        const views = work.getByRole('tablist', { name: '工作区功能' })
        const scenes = work.getByRole('tablist', { name: '工作区形态样张' })
        const panel = work.getByTestId('workspace-tool-panel')
        await expect(views.getByRole('tab')).toHaveText(['审阅', '浏览器', '文件', '终端', '侧边聊天'])
        for (const [view, variants] of [
          ['审阅', ['行内差异', '并排差异', '多文件', '无变更']],
          ['浏览器', ['网页', '窄屏网页', '加载中', '加载失败']],
          ['文件', ['Markdown', '代码', '图片', '空目录', '无法预览']],
          ['终端', ['输出', '运行中', '报错', '多终端']],
          ['侧边聊天', ['空态', '对话', '生成中', '发送失败']],
        ] as const) {
          await views.getByRole('tab', { name: view, exact: true }).click()
          for (const scene of variants) {
            await scenes.getByRole('tab', { name: scene, exact: true }).click()
            await expect(scenes.getByRole('tab', { name: scene, exact: true })).toHaveAttribute('aria-selected', 'true')
            expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
            if (view === '浏览器' && ['网页', '窄屏网页'].includes(scene)) {
              const frame = page.frameLocator('iframe[title="浏览器网页样张"]')
              await expect(frame.getByRole('heading', { name: '窗边的一杯茶' })).toBeVisible()
              await expect.poll(() => frame.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
            }
            if (view === '文件' && scene === '图片') await expect.poll(() => panel.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
            if (scene === variants[0] || scene === '并排差异' || scene === '图片') {
              await panel.scrollIntoViewIfNeeded()
              await page.screenshot({ path: testInfo.outputPath(`workspace-${view}-${scene}.png`), animations: 'disabled' })
            }
          }
        }
        await views.getByRole('tab', { name: '审阅', exact: true }).click()
        await scenes.getByRole('tab', { name: '行内差异', exact: true }).click()
        await expectSharedCodeSurface(work.getByTestId('workspace-diff'))
        await scenes.getByRole('tab', { name: '并排差异', exact: true }).click()
        await expectSharedCodeSurface(work.getByTestId('workspace-diff'))
        await scenes.getByRole('tab', { name: '多文件', exact: true }).click()
        await work.getByLabel('审阅文件').selectOption('notes.md')
        await expect(work.getByTestId('workspace-diff')).toContainText('核对页面')
        await expectSharedCodeSurface(work.getByTestId('workspace-diff'))
        await views.getByRole('tab', { name: '终端', exact: true }).click()
        await scenes.getByRole('tab', { name: '多终端', exact: true }).click()
        await work.getByLabel('终端样张命令').fill('pwd')
        await work.getByLabel('运行样张命令').click()
        await expect(work.getByTestId('workspace-terminal-output')).toContainText('/workspace/my-agent')
        await work.getByRole('button', { name: '终端 2', exact: true }).click()
        await expect(work.getByTestId('workspace-terminal-output')).not.toContainText('/workspace/my-agent')
        await scenes.getByRole('tab', { name: '运行中', exact: true }).click()
        await work.getByLabel('停止运行').click()
        await expect(work.getByTestId('workspace-terminal-output')).toContainText('已停止')
        await views.getByRole('tab', { name: '侧边聊天', exact: true }).click()
        await work.getByLabel('侧边聊天消息').fill('解释这处改动')
        await work.getByLabel('发送消息', { exact: true }).click()
        await expect(work.getByTestId('workspace-sidechat-messages')).toContainText('解释这处改动')
        await scenes.getByRole('tab', { name: '发送失败', exact: true }).click()
        await work.getByRole('button', { name: '重试', exact: true }).click()
        await expect(panel).not.toContainText('消息未发送')
        await scenes.getByRole('tab', { name: '生成中', exact: true }).click()
        await work.getByLabel('停止生成').click()
        await expect(panel).not.toContainText('正在生成')
        await views.getByRole('tab', { name: '浏览器', exact: true }).click()
        await scenes.getByRole('tab', { name: '加载失败', exact: true }).click()
        await work.getByRole('button', { name: '重新加载', exact: true }).click()
        await expect(page.frameLocator('iframe').getByRole('heading', { name: '窗边的一杯茶' })).toBeVisible()
        await work.getByRole('button', { name: '窄栏', exact: true }).click()
        expect((await panel.boundingBox())!.width).toBeLessThanOrEqual(380)
        await page.screenshot({ path: testInfo.outputPath('workspace-narrow.png'), animations: 'disabled' })
        await expect(work).not.toContainText('任务产生的文件')
        await expect(work).not.toContainText('完成结果')
        const chat = work.getByTestId('workspace-main-chat')
        await expect(chat).toBeVisible()
        await chat.getByLabel('主对话样张消息').fill('看看这些文件')
        await chat.getByLabel('发送主对话样张').click()
        await expect(chat).toContainText('看看这些文件')
        await chat.getByRole('button', { name: '收起工作区' }).click()
        await expect(panel).toBeHidden()
        await chat.getByRole('button', { name: '打开工作区' }).click()
        await expect(panel).toBeVisible()
        await panel.getByRole('button', { name: '添加工作区内容', exact: true }).click()
        await expect(panel.getByRole('menuitem')).toHaveText(['审阅', '浏览器', '文件', '终端', '侧边聊天'])
        await page.keyboard.press('Escape')
        await expect(panel.getByRole('menu')).toHaveCount(0)
        await panel.getByRole('button', { name: '添加工作区内容', exact: true }).click()
        await page.screenshot({ path: testInfo.outputPath('workspace-add-menu.png'), animations: 'disabled' })
        await panel.getByRole('menuitem', { name: '文件', exact: true }).click()
        const filePanel = panel.getByRole('tabpanel', { name: /^文件 / })
        await expect(filePanel.getByTestId('workspace-file-preview')).toHaveCount(0)
        await filePanel.getByTestId('file-browser-tree').getByText('notes.md', { exact: true }).click()
        await filePanel.getByTestId('file-browser-tree').getByText('theme.ts', { exact: true }).click()
        await filePanel.getByTestId('file-browser-tree').getByText('notes.md', { exact: true }).click()
        await expect(filePanel.getByRole('tablist', { name: '文件预览' }).getByRole('tab')).toHaveCount(2)
        const treeBox = (await filePanel.getByTestId('workspace-file-tree').boundingBox())!
        const previewBox = (await filePanel.getByTestId('workspace-file-preview').boundingBox())!
        expect(previewBox.x).toBeGreaterThanOrEqual(treeBox.x + treeBox.width - 1)
        expect(Math.abs(previewBox.y - treeBox.y)).toBeLessThan(2)
        await page.screenshot({ path: testInfo.outputPath('workspace-files-side-by-side.png'), animations: 'disabled' })
        await expect(filePanel.getByLabel('关闭文件预览')).toHaveCount(0)
        const notesTab = filePanel.getByTestId('workspace-file-preview-tab').filter({ hasText: 'notes.md' }).first()
        const notesLabelBox = (await notesTab.getByRole('tab', { name: 'notes.md' }).boundingBox())!
        const notesCloseBox = (await notesTab.getByLabel('关闭notes.md').boundingBox())!
        expect(notesCloseBox.x).toBeGreaterThan(notesLabelBox.x)
        expect(Math.abs(notesCloseBox.y - notesLabelBox.y)).toBeLessThan(6)
        await notesTab.getByLabel('关闭notes.md').click()
        await expect(filePanel.getByRole('tab', { name: 'theme.ts' })).toHaveAttribute('aria-selected', 'true')
        await panel.getByRole('button', { name: '添加工作区内容', exact: true }).click()
        await panel.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
        const opened = panel.getByRole('tablist', { name: '已打开的工作区' })
        await expect(opened.getByRole('tab')).toHaveCount(3)
        await opened.getByRole('tab', { name: /^文件 / }).click()
        await expect(filePanel.getByRole('tab', { name: 'theme.ts' })).toHaveAttribute('aria-selected', 'true')
        await panel.getByLabel('关闭文件 1', { exact: true }).click()
        await expect(opened.getByRole('tab')).toHaveCount(2)
        await expect(panel.getByRole('button', { name: '收起工作区' })).toHaveCount(0)
        await expect(opened.getByRole('tab', { name: '侧边聊天 1' })).toHaveAttribute('aria-selected', 'true')
        await opened.getByRole('button', { name: '关闭浏览器 1', exact: true }).click()
        await expect(opened.getByRole('tab', { name: '侧边聊天 1' })).toHaveAttribute('aria-selected', 'true')
        await panel.getByRole('button', { name: '添加工作区内容', exact: true }).click()
        await panel.getByRole('menuitem', { name: '浏览器', exact: true }).click()
        const address = panel.getByRole('textbox', { name: '浏览器地址' })
        await expect(address).toHaveCSS('text-align', 'center')
        await address.fill('file:///private')
        await address.press('Enter')
        await expect(panel.getByRole('alert')).toContainText('HTTP')
        await address.press('Escape')
        await expect(address).toHaveValue('https://notes.example.com/')
        await address.fill('https://other.example.com/')
        await address.press('Enter')
        await expect(panel).toContainText('此地址没有本地页面样张')
        await address.fill('notes.example.com')
        await address.press('Enter')
        await expect(page.frameLocator('iframe[title="浏览器网页样张"]').getByRole('heading', { name: '窗边的一杯茶' })).toBeVisible()
        for (const tab of await opened.getByTestId('workspace-open-tab').all()) {
          await expect(tab).toHaveCSS('border-top-width', '0px')
          await expect(tab.getByRole('button', { name: /^关闭/ })).toBeVisible()
        }
        await page.screenshot({ path: testInfo.outputPath('workspace-borderless-tabs.png'), animations: 'disabled' })
        await panel.getByRole('button', { name: '添加工作区内容', exact: true }).click()
        await page.screenshot({ path: testInfo.outputPath('workspace-borderless-menu.png'), animations: 'disabled' })
      })
    }
  }

  for (const theme of ['yao-stone', 'porcelain-blue']) {
    for (const width of [1166, 600]) {
      test(`Playground 状态切换统一 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 800 })
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
        await page.goto('/')
        await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
        const nav = page.getByTestId('playground-nav')
        let baseline: unknown
        const check = async (label: string) => {
          const controls = page.locator('[data-playground-switcher]').filter({ visible: true })
          expect(await controls.count()).toBeGreaterThan(0)
          for (const group of await controls.all()) {
            await expect(group).toHaveCSS('gap', '4px')
            await expect(group).toHaveCSS('flex-wrap', 'wrap')
            for (const button of await group.locator(':scope > button').all()) {
              const style = await button.evaluate((element) => {
                const css = getComputedStyle(element)
                return { height: css.height, font: css.fontSize, line: css.lineHeight, padding: css.padding, radius: css.borderRadius, border: css.borderTopWidth }
              })
              baseline ??= style
              expect(style).toEqual(baseline)
              expect(style.height).toBe('32px')
              expect(style.font).toBe('11px')
            }
          }
          await controls.first().scrollIntoViewIfNeeded()
          await page.screenshot({ path: testInfo.outputPath(`switchers-${label}.png`), animations: 'disabled' })
        }
        await nav.getByRole('button', { name: 'Chat', exact: true }).click()
        await page.getByRole('tab', { name: '正在聊天', exact: true }).click()
        await expect(page.getByRole('tab', { name: '正在聊天', exact: true })).toHaveAttribute('aria-selected', 'true')
        await check('chat')
        await nav.getByRole('button', { name: '设置', exact: true }).click()
        const settings = page.getByTestId('settings-surface-candidate')
        for (const label of ['记忆', '模型', 'Skills', 'MCP']) {
          await settings.getByRole(width < 640 ? 'tab' : 'button', { name: label, exact: true }).click()
          await check(label)
        }
        await nav.getByRole('button', { name: '工作区', exact: true }).click()
        await check('workspace')
        await page.getByRole('tab', { name: '浏览器', exact: true }).click()
        await expect(page.getByRole('textbox', { name: '浏览器地址' })).toBeVisible()
        await expect(page.getByTestId('workspace-open-tab')).toHaveCSS('border-top-width', '0px')
        await nav.getByRole('button', { name: '基础组件', exact: true }).click()
        await check('foundation')
      })
    }
  }

  test('Playground 设置候选覆盖新的信息架构与隔离交互', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    const nav = page.locator('[data-testid="playground-nav"]')
    await nav.getByRole('button', { name: '设置', exact: true }).click()

    const candidate = page.getByTestId('settings-surface-candidate')
    await expect(candidate).toBeVisible()
    await expect(candidate.getByTestId('settings-nav')).toBeVisible()
    await expect(candidate.getByRole('button', { name: '外观与界面', exact: true })).toBeVisible()
    await expect(candidate.getByRole('button', { name: '伙伴与相处', exact: true })).toBeVisible()
    await expect(candidate.getByRole('button', { name: '权限与自动化', exact: true })).toBeVisible()
    await expect(candidate.getByRole('button', { name: 'Skills', exact: true })).toBeVisible()
    await expect(candidate.getByRole('button', { name: 'MCP', exact: true })).toBeVisible()
    await expect(candidate.getByRole('button', { name: '扩展与工具', exact: true })).toHaveCount(0)
    await expect(candidate).not.toContainText('MUTABLE')
    await expect(candidate).not.toContainText('L3')
    await expect(candidate.getByRole('button', { name: 'Debug', exact: true })).toHaveCount(0)
    await expect(candidate).not.toContainText('Debug / Playground 使用应用全局入口，不在这里复制第二套导航。')

    await candidate.getByRole('button', { name: '伙伴与相处', exact: true }).click()
    const companion = candidate.getByTestId('settings-companion-content')
    const momentTips = companion.getByTestId('settings-candidate-settings-switch-moment-tips')
    await expect(momentTips).toHaveAttribute('aria-checked', 'true')
    await expect(companion.getByText('回答方式', { exact: true })).toBeVisible()
    await expect(companion.getByText('例如：简单问题直接回答，复杂问题补充步骤。', { exact: true })).toBeVisible()
    await expect(companion.getByRole('switch', { name: '生活动态提醒' })).toBeVisible()
    await momentTips.click()
    await expect(momentTips).toHaveAttribute('aria-checked', 'false')
    await expect(companion.getByRole('switch', { name: '生活动态提醒' })).toBeVisible()

    await candidate.getByRole('button', { name: '模型', exact: true }).click()
    await candidate.getByTestId('settings-candidate-model-advanced-toggle').click()
    await expect(candidate.getByLabel('Temperature', { exact: true })).toBeVisible()
    await candidate.getByTestId('settings-candidate-model-test').click()
    await expect(candidate.getByTestId('settings-candidate-model-status')).toContainText('连接配置看起来可用')
    const modelBudget = candidate.getByTestId('settings-candidate-model-budget')
    await expect(modelBudget).toContainText('运行预算')
    await expect(modelBudget.getByText('全局', { exact: true })).toBeVisible()
    await expect(modelBudget).toContainText('当前：不限制')
    await modelBudget.getByLabel('会话预算（Token）', { exact: true }).fill('12000')
    await expect(modelBudget).toContainText('当前：12000 Token')
    await expect(candidate.getByTestId('settings-candidate-model-state-tabs')).toBeVisible()
    await expect(candidate.getByTestId('settings-candidate-model-current')).toContainText('模型使用安排')
    await expect(candidate.getByTestId('settings-candidate-route-primary')).toContainText('OpenAI 主账号 · gpt-4o')
    await expect(candidate.getByTestId('settings-candidate-route-auxiliary')).toContainText('OpenAI 主账号 · gpt-4o-mini')
    await expect(candidate.getByTestId('settings-candidate-route-image')).toContainText('OpenAI 主账号 · image-model-id')
    await expect(candidate.getByTestId('settings-candidate-model-current').getByLabel('添加主对话模型', { exact: true })).toBeVisible()
    await expect(candidate.getByTestId('settings-candidate-model-current')).not.toContainText('模型用途')
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('连接与模型清单')
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('3 个')
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('OpenAI 主账号')
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('image-model-id')
    await expect(candidate.getByTestId('settings-candidate-fetch-models-connection-openai-0')).toBeVisible()
    await candidate.getByTestId('settings-candidate-fetch-models-connection-openai-0').click()
    const fetchedModels = candidate.getByTestId('settings-candidate-fetched-models-connection-openai-0')
    await expect(fetchedModels).toBeVisible()
    await fetchedModels.getByRole('button', { name: 'o3-mini', exact: true }).click()
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('4 个')

    await candidate.getByTestId('settings-candidate-model-add').click()
    await expect(candidate.getByTestId('settings-candidate-model-add-form')).toBeVisible()
    await expect(candidate.getByLabel('连接名称', { exact: true })).toBeVisible()
    await expect(candidate.getByLabel('聚合 / 中转服务', { exact: true })).toBeVisible()
    await expect(candidate.getByLabel('聚合 / 中转服务', { exact: true })).toContainText('OpenRouter')
    await candidate.getByLabel('聚合 / 中转服务', { exact: true }).selectOption('openrouter')
    await expect(candidate.getByLabel('连接名称', { exact: true })).toHaveValue('OpenRouter 聚合')
    await candidate.getByRole('radio', { name: '官方服务商', exact: true }).click()
    await expect(candidate.getByLabel('官方服务商', { exact: true })).toBeVisible()
    await candidate.getByRole('radio', { name: '本地模型', exact: true }).click()
    await expect(candidate.getByLabel('本地服务', { exact: true })).toBeVisible()
    await candidate.getByRole('radio', { name: '自定义连接', exact: true }).click()
    await expect(candidate.getByLabel('连接适配器', { exact: true })).toBeVisible()
    await candidate.getByLabel('连接名称', { exact: true }).fill('中转备用配置')
    await candidate.getByLabel('连接适配器', { exact: true }).selectOption('anthropic')
    await candidate.getByLabel('Base URL', { exact: true }).fill('https://relay.example/v1')
    await candidate.getByLabel('API Key', { exact: true }).fill('fixture-key')
    await expect(candidate.getByLabel('首个模型', { exact: true })).toHaveCount(0)
    await candidate.getByRole('button', { name: '保存连接', exact: true }).click()
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('中转备用配置')
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('Anthropic')
    await candidate.getByRole('button', { name: '编辑连接 OpenAI 主账号', exact: true }).click()
    const editForm = candidate.getByTestId('settings-candidate-model-profile-connection-openai-0').getByTestId('settings-candidate-model-add-form')
    await expect(editForm).toContainText('编辑连接')
    await expect(candidate.getByTestId('settings-candidate-model-connections').locator(':scope > section')).toHaveCount(0)
    await expect(editForm.getByLabel('连接名称', { exact: true })).toHaveValue('OpenAI 主账号')
    await expect(editForm.getByLabel('官方服务商', { exact: true })).toBeVisible()
    await editForm.getByLabel('连接名称', { exact: true }).fill('OpenAI 办公账号')
    await editForm.getByRole('button', { name: '保存连接', exact: true }).click()
    await expect(candidate.getByTestId('settings-candidate-model-add-form')).toHaveCount(0)
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('OpenAI 办公账号')
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('gpt-4o')
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('image-model-id')
    await candidate.getByTestId('settings-candidate-model-state-empty').click()
    await expect(candidate.getByTestId('settings-candidate-model-empty')).toBeVisible()
    await candidate.getByTestId('settings-candidate-model-state-two').click()
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('国际流动')
    await candidate.getByTestId('settings-candidate-model-state-one').click()
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('1 个连接入口')
    await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('模型清单 · 3 个')

    await candidate.getByRole('button', { name: '权限与自动化', exact: true }).click()
    await expect(candidate.getByTestId('settings-candidate-rules-existing')).toBeVisible()
    await candidate.getByTestId('settings-candidate-rules-existing-toggle').click()
    await expect(candidate.getByText('拒绝 · 命令', { exact: true })).toBeVisible()
    await expect(candidate.getByLabel('规则匹配内容', { exact: true })).toHaveCount(0)
    await candidate.getByTestId('settings-candidate-add-rule').click()
    await candidate.getByLabel('规则匹配内容', { exact: true }).fill('git push')
    await candidate.getByLabel('规则处理方式', { exact: true }).selectOption({ label: '需要确认' })
    await candidate.getByTestId('settings-candidate-save-rule').click()
    await expect(candidate.getByText('需要确认 · 命令', { exact: true })).toBeVisible()
    await expect(candidate.getByText('git push', { exact: true })).toBeVisible()

    await candidate.getByRole('button', { name: 'Skills', exact: true }).click()
    await expect(candidate.getByTestId('settings-candidate-section-skills')).toContainText('Skills')
    await expect(candidate.getByTestId('settings-candidate-skills-enabled')).toHaveAttribute('aria-checked', 'true')
    await expect(candidate.getByTestId('settings-candidate-section-skills')).toContainText('code-review')
    await expect(candidate.getByTestId('settings-candidate-section-skills')).not.toContainText('启用代码审查 全局')
    await expect(candidate.getByTestId('settings-candidate-skill-card-code-review').getByText('code-review', { exact: true })).toHaveCount(1)
    await expect(candidate.getByTestId('settings-candidate-skills-enabled')).toHaveText('')
    const skillsStates = candidate.getByTestId('settings-candidate-skills-states')
    await skillsStates.getByRole('tab', { name: '多个', exact: true }).click()
    await expect(candidate.getByTestId('settings-candidate-skill-card-content-creator')).toContainText('content-creator')
    await candidate.getByTestId('settings-candidate-skill-toggle-content-creator').click()
    await expect(candidate.getByTestId('settings-candidate-skill-toggle-content-creator')).toHaveAttribute('aria-checked', 'true')
    await expect(candidate.getByTestId('settings-candidate-skills-enabled')).toHaveAttribute('aria-checked', 'true')
    await skillsStates.getByRole('tab', { name: '详情', exact: true }).click()
    await expect(candidate.getByTestId('settings-candidate-skill-detail')).toContainText('作者')
    const source = readFileSync('electron/skills-builtin/code-review/SKILL.md', 'utf8').replace(/\r\n/g, '\n')
    expect((await candidate.getByTestId('settings-candidate-skill-file-preview').textContent())?.replace(/\r\n/g, '\n')).toBe(source)
    await candidate.getByTestId('settings-candidate-skills-enabled').click()
    await expect(candidate.getByTestId('settings-candidate-skill-detail').getByText('未启用', { exact: true })).toBeVisible()
    await candidate.getByTestId('settings-candidate-skill-back').click()
    await expect(candidate.getByTestId('settings-candidate-skills-enabled')).toHaveAttribute('aria-checked', 'false')
    await candidate.getByRole('button', { name: 'content-creator', exact: true }).click()
    expect((await candidate.getByTestId('settings-candidate-skill-file-preview').textContent())?.replace(/\r\n/g, '\n')).toBe(readFileSync('electron/skills-builtin/content-creator/SKILL.md', 'utf8').replace(/\r\n/g, '\n'))
    await skillsStates.getByRole('tab', { name: '单个', exact: true }).click()
    await candidate.getByRole('button', { name: 'MCP', exact: true }).click()
    await expect(candidate.getByTestId('settings-candidate-section-mcp')).toContainText('MCP')
    await expect(candidate.getByTestId('settings-candidate-mcp-empty')).toBeVisible()
    await candidate.getByTestId('settings-candidate-mcp-add').click()
    await candidate.getByTestId('mcp-connection-form').getByRole('button', { name: '测试连接', exact: true }).click()
    await expect(candidate.getByTestId('mcp-connection-form').getByRole('status')).toContainText('已获取')
    await candidate.getByRole('button', { name: '保存连接', exact: true }).click()
    await expect(candidate.getByTestId('settings-candidate-mcp-server-added-1').getByRole('status')).toHaveText('已连接')
    await expect(candidate).not.toContainText('不和记忆混在一起')

    await candidate.getByRole('button', { name: '记忆', exact: true }).click()
    await expect(candidate.getByTestId('settings-candidate-section-memory')).toBeVisible()
    await expect(candidate.getByTestId('memory-surface-candidate')).toBeVisible()
    await expect(candidate.getByText('回答方式', { exact: true })).toHaveCount(0)

    await candidate.getByRole('button', { name: '关于 My Agent', exact: true }).click()
    await expect(candidate.getByText('品牌标语待定', { exact: true })).toBeVisible()
    await expect(candidate.getByText('查看版本、运行环境和本机数据位置。', { exact: true })).toBeVisible()
    await expect(candidate).not.toContainText('越探索，越着迷。')
    const candidateSwitch = candidate.getByTestId('settings-candidate-settings-developer-mode')
    await expect(candidateSwitch).toHaveAttribute('aria-checked', 'false')
    await candidateSwitch.click()
    await expect(candidateSwitch).toHaveAttribute('aria-checked', 'true')

    await candidate.getByRole('button', { name: '数据与隐私', exact: true }).click()
    await candidate.getByTestId('settings-candidate-export').click()
    await expect(candidate.getByRole('status')).toContainText('已模拟导出')
  })
  for (const theme of ['yao-stone', 'porcelain-blue']) {
    for (const width of [1165, 520]) {
      test(`Playground 编程套餐完整交互 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 })
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
        await page.goto('/')
        await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
        await page.getByTestId('playground-nav').getByRole('button', { name: '设置', exact: true }).click()
        const candidate = page.getByTestId('settings-surface-candidate')
        await candidate.getByTestId('settings-candidate-theme-card').getByRole('button', { name: theme === 'yao-stone' ? /曜石/ : /瓷青/ }).click()
        await candidate.getByRole(width < 640 ? 'tab' : 'button', { name: '模型', exact: true }).click()
        const routes = candidate.getByTestId('settings-candidate-model-current')
        const initialRoutes = await routes.innerText()
        await candidate.getByTestId('settings-candidate-model-add').click()
        const form = candidate.getByTestId('settings-candidate-model-add-form')
        const name = form.getByLabel('连接名称', { exact: true })
        const url = form.getByLabel('Base URL', { exact: true })
        const key = form.getByLabel('API Key', { exact: true })
        await expect(name).toHaveValue('OpenRouter 聚合')
        await expect(url).toHaveValue('https://openrouter.ai/api/v1')
        const relay = form.getByLabel('聚合 / 中转服务', { exact: true })
        for (const label of ['阿里云百炼', '硅基流动', '火山引擎 Ark']) await expect(relay).toContainText(label)
        await expect(relay).not.toContainText('米羊')
        await form.getByRole('radio', { name: '官方服务商', exact: true }).click()
        await expect(name).toHaveValue('OpenAI 连接')
        await expect(url).toHaveValue('https://api.openai.com/v1')
        await expect(form.getByLabel('官方服务商', { exact: true })).not.toContainText('火山引擎')
        await form.getByRole('radio', { name: '本地模型', exact: true }).click()
        await expect(name).toHaveValue('Ollama')
        await expect(url).toHaveValue('http://localhost:11434/v1')
        await form.getByLabel('本地服务', { exact: true }).selectOption('lmstudio')
        await expect(name).toHaveValue('LM Studio')
        await expect(url).toHaveValue('http://localhost:1234/v1')
        await form.getByRole('radio', { name: '编程套餐', exact: true }).click()
        const plan = form.getByLabel('编程套餐', { exact: true })
        await expect(plan.locator('option')).toHaveCount(6)
        await expect(name).toHaveValue('Kimi Code Plan 连接')
        const plans = [
          ['kimi_coding', 'Kimi Code Plan', 'https://api.kimi.com/coding/v1'],
          ['aliyun_coding', '阿里云 Coding Plan', 'https://coding.dashscope.aliyuncs.com/v1'],
          ['zhipu_coding', '智谱 GLM Coding Plan', 'https://open.bigmodel.cn/api/coding/paas/v4'],
          ['volces_coding', '火山方舟 Coding Plan', 'https://ark.cn-beijing.volces.com/api/coding/v3'],
          ['xiaomi_coding', '小米 MiMo Token Plan', 'https://token-plan-cn.xiaomimimo.com/v1'],
          ['minimax_coding', 'MiniMax Token Plan', 'https://api.minimaxi.com/anthropic/v1'],
        ]
        for (const [id, label, baseUrl] of plans) {
          await plan.selectOption(id)
          await expect(name).toHaveValue(`${label} 连接`)
          await expect(url).toHaveValue(baseUrl)
        }
        await expect(form.getByLabel('连接适配器', { exact: true })).toHaveCount(0)
        await expect(form.locator('input')).toHaveCount(3)
        expect(await form.locator('input').evaluateAll((inputs) => inputs.map((input) => input.getAttribute('aria-label')))).toEqual(['连接名称', 'Base URL', 'API Key'])
        await expect(key).toHaveAttribute('type', 'password')
        const nameBox = await name.boundingBox()
        const planBox = await plan.boundingBox()
        expect(nameBox).not.toBeNull()
        expect(planBox).not.toBeNull()
        if (width > 640) expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(planBox!.x)
        else expect(nameBox!.y + nameBox!.height).toBeLessThanOrEqual(planBox!.y)
        expect(await form.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
        await form.scrollIntoViewIfNeeded()
        await page.screenshot({ path: testInfo.outputPath(`coding-${theme}-${width}.png`) })
        await form.getByRole('button', { name: '保存连接', exact: true }).click()
        await expect(routes).toHaveText(initialRoutes, { useInnerText: true })
        const profile = candidate.locator('[data-testid^="settings-candidate-model-profile-"]').filter({ hasText: 'MiniMax Token Plan 连接' })
        await expect(profile).toContainText('编程套餐')
        await expect(profile).toContainText('模型清单 · 0 个')
        await expect(profile).not.toContainText('OpenAI Compatible')
        await profile.getByRole('button', { name: '获取已有模型', exact: true }).click()
        await expect(profile.getByRole('status')).toContainText('获取失败')
        const manual = profile.getByRole('textbox')
        await manual.fill('plan-model-fixture')
        await profile.getByRole('button', { name: '手动添加模型', exact: true }).click()
        await expect(manual).toHaveValue('')
        await expect(profile).toContainText('模型清单 · 1 个')
        await routes.getByLabel('添加主对话模型', { exact: true }).selectOption({ label: 'MiniMax Token Plan 连接 · plan-model-fixture' })
        await expect(candidate.getByTestId('settings-candidate-route-primary').getByRole('switch', { name: 'MiniMax Token Plan 连接 · plan-model-fixture已启用', exact: true })).toHaveAttribute('aria-checked', 'true')
        await expect(candidate.getByTestId('settings-candidate-route-image').getByRole('switch', { name: /plan-model-fixture/ })).toHaveCount(0)
        await candidate.getByTestId('settings-candidate-model-add').click()
        await form.getByRole('radio', { name: '自定义连接', exact: true }).click()
        await expect(form.getByRole('button', { name: '保存连接', exact: true })).toBeDisabled()
        await name.fill('自定义套餐')
        await url.fill('https://relay.example/custom/v1')
        for (const adapter of ['anthropic', 'google', 'openai-compatible']) {
          await form.getByLabel('连接适配器', { exact: true }).selectOption(adapter)
          await expect(name).toHaveValue('自定义套餐')
          await expect(url).toHaveValue('https://relay.example/custom/v1')
        }
        await key.fill('fixture-only')
        await form.getByRole('button', { name: '取消', exact: true }).click()
        await candidate.getByTestId('settings-candidate-model-add').click()
        await expect(name).toHaveValue('OpenRouter 聚合')
        await expect(key).toHaveValue('')
        await form.getByRole('radio', { name: '编程套餐', exact: true }).click()
        await key.fill('fixture-only')
        await plan.selectOption('aliyun_coding')
        await expect(key).toHaveValue('')
        await form.getByRole('button', { name: '取消', exact: true }).click()
        await expect(candidate.getByTestId('settings-candidate-model-connections')).toContainText('2 个连接入口')
      })
    }
  }

  for (const theme of ['yao-stone', 'porcelain-blue']) {
    for (const width of [1165, 520]) {
      test(`Playground 连接卡片头部操作与模型候选 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 730 })
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
        await page.goto('/')
        await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
        await page.getByTestId('playground-nav').getByRole('button', { name: '设置', exact: true }).click()
        const candidate = page.getByTestId('settings-surface-candidate')
        await candidate.getByTestId('settings-candidate-theme-card').getByRole('button', { name: theme === 'yao-stone' ? /曜石/ : /瓷青/ }).click()
        await candidate.getByRole(width < 640 ? 'tab' : 'button', { name: '模型', exact: true }).click()
        const profile = candidate.getByTestId('settings-candidate-model-profile-connection-openai-0')
        const header = profile.getByTestId('settings-candidate-connection-header-connection-openai-0')
        const fetch = header.getByRole('button', { name: '获取已有模型', exact: true })
        const testConnection = header.getByRole('button', { name: '测试连接', exact: true })
        const input = profile.getByLabel('手动添加模型 OpenAI 主账号', { exact: true })
        const add = profile.getByRole('button', { name: '手动添加模型', exact: true })
        await header.scrollIntoViewIfNeeded()
        const headerBox = await header.boundingBox()
        const fetchBox = await fetch.boundingBox()
        const testBox = await testConnection.boundingBox()
        expect(headerBox && fetchBox && testBox).toBeTruthy()
        expect(fetchBox!.x + fetchBox!.width).toBeLessThanOrEqual(testBox!.x)
        expect(testBox!.x + testBox!.width).toBeGreaterThan(headerBox!.x + headerBox!.width - 20)
        expect(testBox!.y + testBox!.height).toBeLessThanOrEqual(headerBox!.y + headerBox!.height)
        await expect(input).toBeVisible()
        await expect(add).toBeDisabled()
        await expect(add).toHaveText('')
        await expect(add.locator('svg')).toHaveCount(1)
        await fetch.click()
        await expect(header.getByRole('button', { name: '正在获取…', exact: true })).toBeDisabled()
        await expect(input).toBeVisible()
        const fetched = profile.getByTestId('settings-candidate-fetched-models-connection-openai-0')
        await expect(fetched).toBeVisible()
        await expect(profile).toContainText('模型清单 · 3 个')
        await expect(fetched.getByRole('button', { name: 'gpt-4o', exact: true })).toBeDisabled()
        await fetched.getByRole('button', { name: 'o3-mini', exact: true }).click()
        await expect(profile).toContainText('模型清单 · 4 个')
        await expect(fetched.getByRole('button', { name: 'o3-mini', exact: true })).toBeDisabled()
        await input.fill(' o3-mini ')
        await expect(add).toBeDisabled()
        await expect(profile.getByRole('status')).toContainText('已在清单')
        await input.press('Enter')
        await expect(profile).toContainText('模型清单 · 4 个')
        await input.fill('custom-model-not-in-discovery')
        await input.press('Enter')
        await expect(profile).toContainText('模型清单 · 5 个')
        await testConnection.click()
        await expect(profile.getByRole('status')).toContainText('连接测试通过（样张）')
        expect(await profile.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
        await profile.scrollIntoViewIfNeeded()
        await page.screenshot({ path: testInfo.outputPath(`connection-picker-${theme}-${width}.png`) })
        await candidate.getByTestId('settings-candidate-model-state-two').click()
        await input.fill('first-connection-draft')
        const other = candidate.getByTestId('settings-candidate-model-profile-connection-openrouter-1')
        await expect(other.getByRole('textbox')).toHaveValue('')
        await other.getByRole('textbox').fill('second-connection-draft')
        await expect(input).toHaveValue('first-connection-draft')
        await fetch.click()
        await candidate.getByTestId('settings-candidate-model-state-empty').click()
        await candidate.getByTestId('settings-candidate-model-state-one').click()
        await page.waitForTimeout(650)
        await expect(input).toHaveValue('')
        await expect(profile).toContainText('模型清单 · 3 个')
      })
    }
  }

  test('Playground 设置候选在窄宽下保留可滚动导航与键盘可达性', async ({ page }) => {
    await page.setViewportSize({ width: 520, height: 900 })
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    await page.getByTestId('playground-nav').getByRole('button', { name: '设置', exact: true }).click()

    const candidate = page.getByTestId('settings-surface-candidate')
    const mobileNav = candidate.getByTestId('settings-candidate-mobile-nav')
    await expect(mobileNav).toBeVisible()
    await expect(mobileNav.getByRole('tab')).toHaveText(['外观与界面', '伙伴与相处', '模型', '记忆', '数据与隐私', '权限与自动化', 'Skills', 'MCP', '关于'])
    await expect(mobileNav.getByRole('tab', { name: '外观与界面', exact: true })).toHaveAttribute('aria-controls', 'settings-candidate-panel-appearance')

    const modelTab = mobileNav.getByRole('tab', { name: '模型', exact: true })
    await modelTab.focus()
    await page.keyboard.press('Enter')
    await expect(modelTab).toHaveAttribute('aria-selected', 'true')
    await expect(candidate.getByTestId('settings-candidate-section-model')).toBeVisible()
    await expect(candidate.getByTestId('settings-candidate-content')).toHaveAttribute('role', 'tabpanel')
    await expect(candidate.getByTestId('settings-candidate-content')).toHaveAttribute('aria-label', '模型')

    const scrollMetrics = await mobileNav.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
    expect(scrollMetrics.scrollWidth).toBeGreaterThanOrEqual(scrollMetrics.clientWidth)
  })

  test('Playground 角色架入口真实可达且设置预览不触发生产读取', async ({ page }) => {
    await page.addInitScript(() => {
      const original = window.localStorage.getItem('playground.active-tab')
      window.localStorage.setItem('playground.active-tab', 'chat')
      window.addEventListener('beforeunload', () => {
        if (original === null) window.localStorage.removeItem('playground.active-tab')
        else window.localStorage.setItem('playground.active-tab', original)
      })
    })
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    const nav = page.locator('[data-testid="playground-nav"]')
    await page.locator('[data-testid="surface-sidebar-candidate"]').getByTitle('打开角色架').click()
    await expect(nav.getByRole('button', { name: '设置', exact: true })).toHaveAttribute('data-active', 'true')
    const roleShelfSettings = page.getByTestId('settings-surface-candidate')
    await expect(roleShelfSettings).toBeVisible()
    await expect(roleShelfSettings.getByTestId('settings-nav')).toBeVisible()
    await expect(roleShelfSettings.getByTestId('settings-candidate-nav-companion')).toHaveAttribute('aria-current', 'page')
    await expect(roleShelfSettings.getByTestId('settings-role-shelf-fixture')).toBeVisible()

    await nav.getByRole('button', { name: '设置', exact: true }).click()
    await expect(page.getByTestId('settings-surface-candidate')).toBeVisible()
    await expect(page.locator('[data-testid="settings-nav"]')).toBeVisible()
    await expect(page.getByText('受 Alice 项目启发', { exact: true })).toHaveCount(0)
  })

  test('Playground 当前主角贯穿 Chat、人物世界六个生活面', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    const nav = page.locator('[data-testid="playground-nav"]')

    await nav.getByRole('button', { name: '设置', exact: true }).click()
    await page.getByTestId('settings-candidate-nav-companion').click()
    await page.getByTestId('settings-candidate-open-role-shelf').click()
    await page.getByTestId('settings-persona-option-yao').click()
    await expect(page.getByTestId('settings-persona-option-yao')).toHaveAttribute('aria-pressed', 'true')

    await nav.getByRole('button', { name: 'Chat', exact: true }).click()
    await expect(page.getByTestId('surface-sidebar-candidate')).toContainText('阿遥')
    await expect(page.getByText('嗨，我是阿遥', { exact: true })).toBeVisible()

    await nav.getByRole('button', { name: '人物世界', exact: true }).click()
    await expect(page.getByTestId('playground-moments-profile')).toContainText('阿遥')
    await expect(page.getByTestId('moment-post').first()).toContainText('阿遥')
    const worldTabs = page.getByTestId('world-hub').getByRole('tab')
    await expect(worldTabs).toHaveCount(6)
    const worldTabLabels = await worldTabs.evaluateAll((tabs) => tabs.map((tab) => tab.textContent?.trim()))
    expect(worldTabLabels).toEqual(['朋友圈', '衣柜', '文化角', '家居', '通讯录', '足迹'])
    await page.getByTestId('world-tab-wardrobe').click()
    await expect(page.getByTestId('world-wardrobe-fixture')).toHaveAttribute('data-persona-id', 'yao')
    await expect(page.getByTestId('world-wardrobe-fixture')).toContainText('灰绿帆布包')
    await expect(page.getByTestId('world-wardrobe-wearing')).toContainText('米白针织衫')
    await expect(page.getByTestId('world-wardrobe-wearing')).not.toContainText('灰绿帆布包')
    await page.getByTestId('world-tab-culture').click()
    await expect(page.getByTestId('world-culture-fixture')).toHaveAttribute('data-persona-id', 'yao')
    await expect(page.getByTestId('world-culture-fixture')).toContainText('《瓦尔登湖》')
    await expect(page.getByTestId('world-culture-fixture')).toContainText('旅行的意义')
    await expect(page.getByTestId('world-culture-fixture')).toContainText('《海街日记》')
    await expect(page.getByTestId('world-culture-fixture')).toContainText('窗边的光')
    await page.getByTestId('world-tab-home').click()
    await expect(page.getByTestId('world-home-fixture')).toHaveAttribute('data-persona-id', 'yao')
    await expect(page.getByTestId('world-home-fixture')).toContainText('当前空间')
    await page.getByTestId('world-tab-cast').click()
    await expect(page.getByTestId('world-cast-fixture')).toHaveAttribute('data-persona-id', 'yao')
    await expect(page.getByTestId('world-cast-fixture')).toContainText('阿遥')
    await page.getByTestId('world-tab-footprints').click()
    await expect(page.getByTestId('world-footprints-fixture')).toHaveAttribute('data-persona-id', 'yao')
    await expect(page.getByTestId('world-footprints-fixture')).toContainText('杭州 · 西湖边')
    await expect(page.getByTestId('world-footprints-fixture').getByRole('region', { name: '想去的地方' })).toContainText('北海')
    await expect(page.getByTestId('world-footprints-fixture').getByRole('region', { name: '常去地点' })).not.toContainText('北海')
  })

  test('Playground Toast 四态关闭按钮沿统一右边界对齐', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    await page.locator('[data-testid="playground-nav"]').getByRole('button', { name: '基础组件', exact: true }).click()
    await page.getByRole('tab', { name: '状态反馈', exact: true }).click()

    const toastStory = page.locator('section').filter({ hasText: 'Toast 四态' }).first()
    const closeButtons = toastStory.getByRole('button', { name: '关闭通知' })
    await expect(closeButtons).toHaveCount(4)
    const rightEdges = await closeButtons.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().right))
    expect(Math.max(...rightEdges) - Math.min(...rightEdges)).toBeLessThan(1)
  })

  test('正式人物世界提供六个生活面入口', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: '人物世界', exact: true }).click()
    const world = page.getByTestId('world-hub')
    const tabs = [
      ['moments', '朋友圈'],
      ['wardrobe', '衣柜'],
      ['culture', '文化角'],
      ['home', '家居'],
      ['cast', '通讯录'],
      ['footprints', '足迹'],
    ] as const
    for (const [id, label] of tabs) {
      await expect(world.getByTestId(`world-tab-${id}`)).toHaveText(label)
    }
    for (const [id] of tabs.slice(1)) {
      const tab = world.getByTestId(`world-tab-${id}`)
      await tab.click()
      await expect(tab).toHaveAttribute('aria-selected', 'true')
    }
  })
  test('正式朋友圈赞评走真实 IPC 替身且评论槽几何不变', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const moment = {
        id: 'moment-desk',
        roleId: 'lin',
        eventId: 'event-desk',
        publishedAt: Date.UTC(2026, 8, 1, 8),
        text: '今天把书桌收拾出来了。',
        meta: {
          location: '家中',
          interactions: [
            { kind: 'comment', castId: 'chen', castName: '陈晨', text: '这桌面终于能看见了' },
            { kind: 'coframe', castId: 'ayu', castName: '阿雨' },
          ],
        },
      }
      const state = {
        liked: false,
        comments: [] as Array<{ id: string; actorName: string; text: string; createdAt: number }>,
        commentCalls: [] as string[],
        failComment: false,
        release: null as null | (() => void),
      }
      const social = () => ({
        liked: state.liked,
        likeCount: state.liked ? 1 : 0,
        comments: state.comments.map((item) => ({ ...item })),
        commentCount: state.comments.length,
      })
      ;(window as any).__momentSocial = state
      const api = (window as any).electronAPI.companion
      api.getActive = async () => ({ id: 'lin', name: '测试伙伴', description: '' })
      api.catchupStatus = async () => ({ roleId: 'lin', presence: '', catchupSummary: '' })
      api.getMoments = async () => ({
        roleId: 'lin',
        items: [{ ...moment, meta: { ...moment.meta, interactions: [...moment.meta.interactions] } }],
        socialByMomentId: { [moment.id]: social() },
      })
      api.toggleMomentLike = async (momentId: string) => {
        if (momentId !== moment.id) return { ok: false, error: '动态不存在', code: 'NOT_FOUND' }
        state.liked = !state.liked
        return { ok: true, social: social() }
      }
      api.addMomentComment = async (momentId: string, text: string) => {
        state.commentCalls.push(text)
        await new Promise<void>((resolve) => { state.release = resolve })
        if (state.failComment) return { ok: false, error: '评论不能为空', code: 'INVALID' }
        const normalized = String(text).replace(/\r\n/g, '\n').trim()
        if (!normalized) return { ok: false, error: '评论不能为空', code: 'INVALID' }
        const comment = { id: `user-${state.comments.length + 1}`, actorName: '我', text: normalized, createdAt: Date.now() }
        state.comments = [...state.comments, comment]
        return { ok: true, social: social() }
      }
    })
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '人物世界', exact: true }).click()
    const post = page.getByTestId('moment-post').first()
    await expect(post).toContainText('今天把书桌收拾出来了。')
    await expect(post.getByTestId('moment-comment')).toHaveText(['陈晨：这桌面终于能看见了'])
    const composer = post.getByTestId('moment-comment-composer')
    const closedBox = await composer.boundingBox()
    await post.getByTestId('moment-comment-button').click()
    await expect(post.getByTestId('moment-comment-button')).toHaveAttribute('aria-pressed', 'true')
    expect(await composer.boundingBox()).toEqual(closedBox)
    const input = post.getByTestId('moment-comment-input')
    await expect(input).toBeVisible()
    await input.fill('  先把窗帘拉开  ')
    await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229 })
    expect(await page.evaluate(() => (window as any).__momentSocial.commentCalls)).toEqual([])
    await page.evaluate(() => { (window as any).__momentSocial.failComment = true })
    await post.getByTestId('moment-comment-submit').evaluate((node: HTMLButtonElement) => { node.click(); node.click() })
    await expect(post.getByTestId('moment-comment-submit')).toBeDisabled()
    expect(await page.evaluate(() => (window as any).__momentSocial.commentCalls)).toEqual(['  先把窗帘拉开  '])
    await page.evaluate(() => (window as any).__momentSocial.release())
    await expect(post.getByTestId('moment-comment-error')).toContainText('评论不能为空')
    await expect(input).toHaveValue('  先把窗帘拉开  ')
    await page.evaluate(() => { (window as any).__momentSocial.failComment = false })
    await post.getByTestId('moment-comment-submit').click()
    await expect.poll(() => page.evaluate(() => (window as any).__momentSocial.commentCalls.length)).toBe(2)
    await page.evaluate(() => (window as any).__momentSocial.release())
    await expect(post.getByTestId('moment-comment')).toHaveText(['陈晨：这桌面终于能看见了', '我：先把窗帘拉开'])
    await expect(input).toHaveValue('')
    await post.getByTestId('moment-like-button').click()
    await expect(post.getByTestId('moment-like-button')).toHaveAttribute('aria-label', '取消赞')
    await post.getByTestId('moment-like-button').click()
    await expect(post.getByTestId('moment-like-button')).toHaveAttribute('aria-label', '赞')
  })

  test('正式关于页开发者模式开关控制侧栏入口，候选不写生产设置', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      const stored: Record<string, string> = { llmApiKeyConfigured: 'true', llmModel: 'e2e-model', executionMode: 'confirm-all', pinnedSessions: '[]', developerMode: 'false' }
      const harness = { writes: [] as Array<[string, string]>, stored }
      ;(window as any).__developerModeSettings = harness
      api.settings.get = async () => ({ ...stored })
      api.settings.set = async (key: string, value: string) => {
        harness.writes.push([key, value])
        stored[key] = value
      }
    })
    await page.goto('/')
    await expect(page.getByTestId('sidebar-developer-nav')).toBeVisible()
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-about').click()
    const productionSwitch = page.getByTestId('settings-developer-mode')
    await expect(productionSwitch).toHaveAttribute('aria-checked', 'false')
    await productionSwitch.click()
    await expect.poll(async () => page.evaluate(() => (window as any).__developerModeSettings.stored.developerMode)).toBe('true')
    await expect.poll(async () => page.evaluate(() => (window as any).__developerModeSettings.writes)).toEqual([['developerMode', 'true']])
    await page.getByTestId('settings-back').click()
    await expect(page.getByTestId('sidebar-developer-nav')).toBeVisible()
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-about').click()
    await expect(page.getByTestId('settings-developer-mode')).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('settings-developer-mode').click()
    await expect.poll(async () => page.evaluate(() => (window as any).__developerModeSettings.stored.developerMode)).toBe('false')
    await page.getByTestId('settings-back').click()
    await expect(page.getByTestId('sidebar-developer-nav')).toBeVisible()
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    await page.locator('[data-testid="playground-nav"]').getByRole('button', { name: '设置', exact: true }).click()
    const candidate = page.getByTestId('settings-surface-candidate')
    await candidate.getByRole('button', { name: '关于 My Agent', exact: true }).click()
    const candidateSwitch = candidate.getByTestId('settings-candidate-settings-developer-mode')
    await expect(candidateSwitch).toHaveAttribute('aria-checked', 'false')
    await candidateSwitch.click()
    await expect(candidateSwitch).toHaveAttribute('aria-checked', 'true')
    expect(await page.evaluate(() => (window as any).__developerModeSettings.stored.developerMode)).toBe('false')
    expect(await page.evaluate(() => (window as any).__developerModeSettings.writes.filter(([key]: [string]) => key === 'developerMode'))).toEqual([['developerMode', 'true'], ['developerMode', 'false']])
  })

  test('Debug 与 Playground 采用一级任务导航', async ({ page }) => {
    await page.goto('/')

    const developerNav = page.locator('[data-testid="sidebar-developer-nav"]')
    const sessionList = page.locator('[data-testid="sidebar-session-list"]')
    const primarySidebar = page.locator('[data-testid="primary-sidebar"]')
    await expect(primarySidebar).not.toContainText('开发')
    await expect(primarySidebar).not.toContainText('产品')
    await expect(developerNav).toBeVisible()
    await expect(sessionList).toBeVisible()
    expect(await sessionList.evaluate((element, dev) => Boolean(element.compareDocumentPosition(dev as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await developerNav.elementHandle())).toBe(true)

    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: '设置', exact: true }).click()
    const settingsPanel = page.locator('[data-testid="settings-panel"]')
    await expect(settingsPanel).toBeVisible()
    await expect(settingsPanel.locator('[data-testid="settings-nav"]').getByRole('button', { name: '记忆', exact: true })).toBeVisible()
    await expect(settingsPanel.locator('[data-testid="settings-nav"]').getByRole('button', { name: 'Skills', exact: true })).toBeVisible()
    await page.getByTestId('settings-back').click()
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Debug', exact: true }).click()
    await expect(page.locator('[data-testid="dev-panel"]')).toBeVisible()
    const debugNav = page.locator('[data-testid="dev-panel"] nav')
    await expect(debugNav.getByRole('button', { name: '运行概览', exact: true })).toBeVisible()
    await expect(page.locator('[data-testid="debug-overview"]')).toBeVisible()
    await debugNav.getByRole('button', { name: '运行概览', exact: true }).click()
    await expect(page.getByText('真实证据入口', { exact: true })).toBeVisible()
    await expect(debugNav.getByRole('button', { name: '提示词管理器', exact: true })).toBeVisible()
    await expect(debugNav.getByText('Debug', { exact: true })).toHaveCount(0)
    await expect(debugNav.getByRole('button', { name: '请求与运行', exact: true })).toBeVisible()
    await expect(debugNav.getByRole('button', { name: '伙伴状态', exact: true })).toBeVisible()
    await expect(debugNav.getByRole('button', { name: '质量 / Eval', exact: true })).toBeVisible()
    await expect(debugNav.getByRole('button', { name: '上下文', exact: true })).not.toBeVisible()
    await expect(debugNav.getByRole('button', { name: 'LLM 调用', exact: true })).not.toBeVisible()
    await debugNav.getByRole('button', { name: '提示词管理器', exact: true }).click()
    await expect(page.locator('[data-testid="prompt-manager-panel"]')).toBeVisible()
    await expect(page.getByText('统一查看生产 Prompt、伙伴与人格资产、记忆策略、权限与沙箱策略、模型 Provider、Tool schema、Skill、Eval Case / Grader、Eval Judge 与当前 MCP 工具。', { exact: false })).toBeVisible()
    const contextCategories = page.getByLabel('生产资产分类')
    await expect(contextCategories.getByRole('button', { name: '内置工具', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: '伙伴世界', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: '记忆策略', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: '权限与沙箱', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: '模型 Provider', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: 'Skills', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: 'Eval Judge', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: '外部 / MCP', exact: true })).toBeVisible()

    await debugNav.getByRole('button', { name: '质量 / Eval', exact: true }).click()
    await expect(page.locator('[data-testid="skill-eval-panel"]')).toBeVisible()
    await expect(page.getByText('验证 Skill 的触发、指南注入、工具边界和回复约束', { exact: false })).toBeVisible()
    await expect(page.getByText('还没有 Skill Eval 报告', { exact: true })).toBeVisible()
    await expect(page.locator('[data-testid="persona-eval-panel"]')).toBeVisible()
    await expect(page.getByText('还没有 Persona Eval 报告', { exact: true })).toBeVisible()

    await debugNav.getByRole('button', { name: '请求与运行', exact: true }).click()
    await expect(page.locator('[data-testid="request-runtime-panel"]')).toBeVisible()
    await expect(page.locator('h2:has-text("请求与运行")')).toBeVisible()

    await page.locator('[data-testid="dev-panel"] button[title="返回聊天"]').click()
    await expect(page.getByTestId('open-global-debug')).toBeVisible()
    await page.getByTestId('open-global-debug').click()
    await expect(page.locator('[data-testid="dev-panel"]')).toBeVisible()
    await expect(page.getByTestId('conversation-debug-toggle')).toHaveCount(0)
    await page.locator('[data-testid="dev-panel"] button[title="返回聊天"]').click()
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    const playgroundShell = page.locator('[data-testid="playground-shell"]')
    await expect(playgroundShell).toBeVisible()
    const playgroundBox = await playgroundShell.boundingBox()
    expect(playgroundBox?.y).toBeLessThan(4)
    expect(playgroundBox?.x).toBeLessThan(4)
    await expect(page.locator('[data-testid="primary-sidebar"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="primary-sidebar"]')).toBeHidden()
    await expect(page.locator('section[aria-label="基础"]')).toBeVisible()
    await expect(page.locator('section[aria-label="产品体验"]')).toBeVisible()
    await expect(page.locator('section[aria-label="Agent 实验"]')).toBeVisible()
    const playgroundNav = page.locator('[data-testid="playground-nav"]')
    await expect(playgroundNav.getByRole('button', { name: '设计语言', exact: true })).toBeVisible()
    await expect(page.locator('[data-testid="design-system-panel"]').getByRole('button', { name: '重新读取', exact: true })).toHaveCount(0)
    await expect(playgroundNav.getByRole('button', { name: '基础组件', exact: true })).toBeVisible()
    await expect(playgroundNav.getByRole('button', { name: '模型能力', exact: true })).toBeVisible()
    await expect(playgroundNav.getByRole('button', { name: '组件目录', exact: true })).toHaveCount(0)
    await expect(playgroundNav.getByRole('button', { name: '页面组合', exact: true })).toHaveCount(0)

    await playgroundNav.getByRole('button', { name: '基础组件', exact: true }).click()
    await expect(page.locator('[data-testid="playground-page-header"]')).toContainText('基础组件')
    await expect(page.locator('[data-testid="foundation-components-panel"]')).toBeVisible()
    await expect(page.getByRole('tab', { name: '组件索引', exact: true })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: '记忆引用', exact: true })).toHaveCount(0)
    for (const tab of ['按钮', '输入与表单', '标签与选择', '弹层', '菜单与提示', '徽标与标签', '状态反馈', '加载与进度', '工具卡', 'Markdown 与资产', '文件与差异', '布局与滚动', '卡片']) {
      await expect(page.getByRole('tab', { name: tab, exact: true })).toBeVisible()
    }
    await expect(page.locator('[data-testid="foundation-asset-inventory"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="playground-story-nav"] [role="tablist"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="playground-story-nav"]')).not.toContainText('基础控件')
    await expect(page.getByText('生成动作', { exact: true })).toBeVisible()
    await playgroundNav.getByRole('button', { name: '图标与视觉', exact: true }).click()
    const iconInventory = page.locator('[data-testid="icon-inventory"]')
    await expect(iconInventory).toBeVisible()
    await iconInventory.getByRole('button', { name: '打开图标搜索', exact: true }).click()
    await expect(page.getByPlaceholder('搜索中文或 English')).toBeVisible()
    await expect(page.getByText('navigation.search', { exact: true })).toHaveCount(0)
    await expect(page.locator('[data-testid="ui-controls-panel"] > div').first()).not.toContainText('基础组件样式')

    const playgroundMain = page.locator('[data-testid="playground-main"]')
    await playgroundNav.getByRole('button', { name: '模型能力', exact: true }).click()
    await expect(playgroundMain.getByRole('heading', { name: '模型能力', exact: true })).toBeVisible()
    await playgroundNav.getByRole('button', { name: '对话试验', exact: true }).click()
    await expect(playgroundMain.getByRole('heading', { name: '对话试验', exact: true })).toBeVisible()
    await playgroundNav.getByRole('button', { name: '工具手测', exact: true }).click()
    await expect(playgroundMain.getByRole('heading', { name: '工具手测', exact: true })).toBeVisible()
  })

  test('Playground 产品体验页面保持基础引用边界', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    const nav = page.locator('[data-testid="playground-nav"]')

    await nav.getByRole('button', { name: '工作区', exact: true }).click()
    const workspaceDependencies = page.locator('[data-testid="product-experience-dependencies"]')
    await expect(page.locator('[data-testid="playground-page-header"]').getByTestId('product-experience-dependencies')).toHaveCount(1)
    await expect(page.locator('[data-testid="playground-main"] > div > .view-transition > [data-testid="product-experience-dependencies"]')).toHaveCount(0)
    await expect(workspaceDependencies).toContainText('基础引用')
    await expect(workspaceDependencies.getByTestId('experience-foundation-parts')).toContainText('文件树')
    await expect(workspaceDependencies).not.toContainText('experience.workspace')
    await expect(workspaceDependencies).not.toContainText('右侧工作坞')
    const dock = page.getByTestId('workspace-experience-candidate')
    await expect(dock.getByRole('tablist', { name: '工作区功能' }).getByRole('tab')).toHaveText(['审阅', '浏览器', '文件', '终端', '侧边聊天'])
    await dock.getByRole('tab', { name: '文件', exact: true }).click()
    await expect(dock).toContainText('my-agent')
    await expect(dock).toContainText('notes.md')
    await expect(dock).toContainText('项目笔记')
    await expect(dock).not.toContainText('任务产生的文件')

    await nav.getByRole('button', { name: '人物世界', exact: true }).click()
    await expect(page.getByText('生活广播（非日志表）', { exact: false })).toHaveCount(0)
    await expect(page.getByText('CATCH-UP', { exact: true })).toHaveCount(0)
    await expect(page.getByText('把窗帘拉开了一点，泡了杯乌龙茶，准备先把桌面清出一块。', { exact: true })).toBeVisible()
    await expect(page.getByText('仅展示近期动态 · 内容由主角的生活事件自然派生', { exact: true })).toBeVisible()
    await expect(page.getByTestId('moment-social-actions')).toHaveCount(3)
    const firstMoment = page.getByTestId('moment-post').first()
    const firstLike = firstMoment.getByTestId('moment-like-button')
    const firstComment = firstMoment.getByTestId('moment-comment-button')
    const momentBox = await firstMoment.boundingBox()
    const likeBox = await firstLike.boundingBox()
    expect(momentBox).not.toBeNull()
    expect(likeBox).not.toBeNull()
    expect(likeBox?.x ?? Number.POSITIVE_INFINITY).toBeLessThan((momentBox?.x ?? 0) + (momentBox?.width ?? 0) / 2)
    await expect(firstComment).toHaveAttribute('aria-pressed', 'false')
    await firstComment.click()
    await expect(firstComment).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: '赞', exact: true }).first().click()
    await expect(page.getByRole('button', { name: '取消赞', exact: true }).first()).toBeVisible()
    await expect(page.getByTestId('world-tab-shelf')).toHaveCount(0)
    for (const tabId of ['moments', 'wardrobe', 'culture', 'home', 'cast', 'footprints']) {
      await page.getByTestId(`world-tab-${tabId}`).click()
      await expect(page.getByTestId(`world-tab-${tabId}`)).toHaveAttribute('aria-selected', 'true')
    }
    await expect(page.getByTestId('world-shelf-fixture')).toHaveCount(0)

    await expect(nav.getByRole('button', { name: '业务状态', exact: true })).toHaveCount(0)

    await nav.getByRole('button', { name: '设置', exact: true }).click()
    await expect(page.getByTestId('settings-surface-candidate')).toBeVisible()
    await page.getByTestId('settings-candidate-nav-companion').click()
    await page.getByTestId('settings-candidate-open-role-shelf').click()
    await expect(page.getByTestId('settings-role-shelf-fixture')).toBeVisible()
    await expect(page.getByTestId('settings-role-shelf-fixture')).toContainText('当前主角')

    await page.getByTestId('settings-candidate-nav-memory').click()
    const memory = page.locator('[data-testid="memory-surface-candidate"]')
    await expect(memory).toBeVisible()
    await expect(page.getByTestId('memory-group-identity')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('memory-group-identity')).toContainText('3')
    await expect(page.getByTestId('memory-group-collaboration')).toContainText('4')
    await expect(page.getByTestId('memory-group-communication')).toContainText('3')
    await expect(page.getByTestId('memory-group-relationship')).toContainText('3')
  })

  for (const theme of ['porcelain-blue', 'yao-stone', 'song-smoke', 'deep-plum']) {
    for (const width of [1166, 600]) {
      test(`正式记忆四类搜索与独立草稿 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 731 })
        await installProductionElectronStub(page)
        await page.addInitScript((themeId) => {
          localStorage.setItem('theme', themeId)
          const state = { adds: 0, entries: ['identity', 'fact', 'workflow', 'voice', 'preference', 'feedback'].map((category) => ({
            id: category, category, content: `旧记忆 ${category}`, createdAt: 1, updatedAt: 1,
          })) }
          for (let index = 0; index < 24; index++) state.entries.push({ id: `long-${index}`, category: 'identity', content: `身份背景 ${index}：${'需要保留的长记忆内容。'.repeat(10)}`, createdAt: 1, updatedAt: 1 })
          ;(window as any).__memoryGroups = state
          const api = (window as any).electronAPI
          api.memory = {
            list: async () => state.entries.map((entry) => ({ ...entry })),
            add: async (category: string, content: string) => {
              state.adds++
              const entry = { id: 'group-added', category, content, createdAt: 1, updatedAt: 1 }
              state.entries.push(entry)
              return entry
            },
            update: async (id: string, content: string) => { state.entries.find((entry) => entry.id === id)!.content = content },
            delete: async (id: string) => { state.entries = state.entries.filter((entry) => entry.id !== id) },
          }
          api.mcp.status = async () => []
        }, theme)
        await page.goto('/')
        await page.locator('button[title="设置"]').click()
        await (width < 768 ? page.getByRole('tab', { name: '记忆', exact: true }) : page.getByTestId('settings-nav-memory')).click()
        const tabs = page.getByTestId('memory-group-tabs')
        const selectGroup = async (id: string) => { await page.getByTestId(`memory-group-${id}`).click() }
        await expect(tabs.getByRole('tab')).toHaveCount(4)
        await expect(page.getByTestId('memory-category-filters')).toHaveCount(0)
        await expect(page.getByRole('button', { name: '+ 添加', exact: true })).toHaveCount(0)
        await expect(page.getByTestId('memory-group-identity')).toHaveText('身份信息 26')
        await expect(page.getByTestId('memory-item-fact')).toBeVisible()
        const scroll = page.getByTestId('memory-list-scroll')
        expect(await scroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
        const toolbarBox = await page.getByTestId('memory-surface-toolbar').boundingBox()
        await scroll.evaluate((node) => { node.scrollTop = node.scrollHeight })
        expect(await page.getByTestId('memory-surface-toolbar').boundingBox()).toEqual(toolbarBox)
        await page.getByRole('button', { name: '添加一条记忆', exact: true }).click()
        const draft = page.getByLabel('新记忆内容', { exact: true })
        await draft.fill('身份分组的新草稿\n保留第二行')
        await draft.dispatchEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true })
        expect(await page.evaluate(() => (window as any).__memoryGroups.adds)).toBe(0)
        await selectGroup('collaboration')
        await expect(page.getByTestId('memory-item-workflow')).toBeVisible()
        await page.getByRole('button', { name: '添加一条记忆', exact: true }).click()
        await draft.fill('工作分组独立草稿')
        await selectGroup('identity')
        await expect(draft).toHaveValue('身份分组的新草稿\n保留第二行')
        await page.getByRole('button', { name: '保存新记忆', exact: true }).click()
        await expect(page.getByTestId('memory-group-identity')).toHaveText('身份信息 27')
        await expect(page.getByTestId('memory-item-group-added')).toContainText('保留第二行')
        await selectGroup('collaboration')
        await expect(draft).toHaveValue('工作分组独立草稿')
        await page.getByRole('button', { name: '取消新增记忆', exact: true }).click()
        await selectGroup('communication')
        await expect(page.getByTestId('memory-group-communication')).toHaveText('沟通偏好 2')
        const tabsBox = await tabs.boundingBox()
        await page.getByRole('button', { name: '搜索记忆', exact: true }).click()
        expect(await tabs.boundingBox()).toEqual(tabsBox)
        const search = page.getByRole('textbox', { name: '搜索记忆', exact: true })
        await search.fill('PREFERENCE')
        await expect(page.getByTestId('memory-item-preference')).toBeVisible()
        await expect(page.getByTestId('memory-item-voice')).toHaveCount(0)
        await expect(page.getByTestId('memory-group-communication')).toHaveText('沟通偏好 2')
        await search.fill('不存在的记忆')
        await expect(page.getByText('没有找到匹配的记忆。', { exact: true })).toBeVisible()
        await search.press('Escape')
        await expect(page.getByRole('button', { name: '搜索记忆', exact: true })).toBeFocused()
        await expect(page.getByTestId('memory-item-voice')).toBeVisible()
        const voice = page.getByTestId('memory-item-voice')
        await voice.hover()
        await voice.getByRole('button', { name: /^编辑记忆 / }).click()
        await voice.locator('input').fill('编辑中保留的沟通草稿')
        await voice.locator('input').dispatchEvent('keydown', { key: 'Enter', isComposing: true })
        await expect(voice.locator('input')).toHaveValue('编辑中保留的沟通草稿')
        await selectGroup('relationship')
        await expect(page.getByTestId('memory-item-feedback')).toBeVisible()
        await selectGroup('communication')
        await expect(voice.locator('input')).toHaveValue('编辑中保留的沟通草稿')
        await voice.locator('input').press('Escape')
        await expect(page.getByTestId('settings-panel')).toBeVisible()
        await expect(voice.locator('input')).toHaveCount(0)
        await page.getByRole('button', { name: '添加一条记忆', exact: true }).click()
        await draft.fill('取消新增不退出设置')
        await draft.press('Escape')
        await expect(draft).toHaveCount(0)
        await expect(page.getByTestId('settings-panel')).toBeVisible()
        await selectGroup('identity')
        const added = page.getByTestId('memory-item-group-added')
        await added.hover()
        await added.getByRole('button', { name: /^删除记忆 / }).click()
        await added.getByRole('button', { name: /^确认删除记忆 / }).click()
        await expect(page.getByTestId('memory-group-identity')).toHaveText('身份信息 26')
        await scroll.evaluate((node) => { node.scrollTop = 0 })
        expect(await page.getByTestId('settings-panel').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
        await page.screenshot({ path: testInfo.outputPath('memory-management.png'), animations: 'disabled' })
      })
    }
  }

  for (const theme of ['porcelain-blue', 'yao-stone', 'song-smoke', 'deep-plum']) {
    for (const width of [1166, 600]) {
      test(`正式记忆长文编辑与失败恢复 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 731 })
        await installProductionElectronStub(page)
        await page.addInitScript((themeId) => {
          localStorage.setItem('theme', themeId)
          const api = (window as any).electronAPI
          const harness = {
            entries: [{ id: 'long-memory', category: 'fact', content: '讨论产品时先把用户目标和真实边界讲清楚，再给建议。\n'.repeat(12), createdAt: 1788220800000, updatedAt: 1788220800000 }],
            updates: [] as string[],
            fail: true,
            release: null as null | (() => void),
          }
          ;(window as any).__memoryTest = harness
          api.memory = {
            list: async () => harness.entries.map((entry) => ({ ...entry })),
            update: async (_id: string, content: string) => {
              harness.updates.push(content)
              await new Promise<void>((resolve) => { harness.release = resolve })
              if (harness.fail) throw new Error('private storage failure')
              harness.entries[0].content = content
            },
          }
          api.mcp.status = async () => []
        }, theme)
        await page.goto('/')
        await page.locator('button[title="设置"]').click()
        await (width < 768 ? page.getByRole('tab', { name: '记忆', exact: true }) : page.getByTestId('settings-nav-memory')).click()
        const item = page.getByTestId('memory-item-long-memory')
        const controls = item.getByTestId('memory-item-controls-long-memory')
        const geometry = () => item.evaluate((node) => {
          const box = node.getBoundingClientRect()
          const slot = node.querySelector('[data-testid^="memory-item-controls-"]')!.getBoundingClientRect()
          return { width: box.width, height: box.height, slotX: slot.x, slotY: slot.y, slotWidth: slot.width, slotHeight: slot.height }
        })
        await page.mouse.move(0, 0)
        const beforeHover = await geometry()
        await item.hover()
        await expect(item.getByTestId('memory-item-date-long-memory')).toHaveCSS('opacity', '0')
        expect(await geometry()).toEqual(beforeHover)
        await item.getByRole('button', { name: /^编辑记忆 / }).click()
        const editor = item.locator('textarea')
        await expect(editor).toBeFocused()
        await editor.fill('缩短之后仍然保留多行编辑。\n第二行内容。')
        await expect(editor).toBeFocused()
        await expect(item.locator('input')).toHaveCount(0)
        const save = controls.getByRole('button', { name: /^保存记忆 / })
        const controlBox = await controls.boundingBox()
        await save.click()
        await expect(save).toBeDisabled()
        await expect(controls.getByRole('button', { name: /^取消编辑 / })).toBeDisabled()
        expect(await controls.boundingBox()).toEqual(controlBox)
        await page.evaluate(() => (window as any).__memoryTest.release())
        await expect(page.getByRole('alert')).toContainText('记忆未保存')
        await expect(page.getByRole('alert')).not.toContainText('private storage')
        await expect(editor).toHaveValue('缩短之后仍然保留多行编辑。\n第二行内容。')
        await expect(save).toBeEnabled()
        await page.screenshot({ path: testInfo.outputPath('memory-save-failed.png'), animations: 'disabled' })
        await page.evaluate(() => { (window as any).__memoryTest.fail = false })
        await save.click()
        await expect.poll(() => page.evaluate(() => (window as any).__memoryTest.updates.length)).toBe(2)
        await page.evaluate(() => (window as any).__memoryTest.release())
        await expect(editor).toHaveCount(0)
        await expect(item).toContainText('第二行内容。')
        await expect(page.getByRole('alert')).toHaveCount(0)
        expect(await item.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
        await page.screenshot({ path: testInfo.outputPath('memory-saved.png'), animations: 'disabled' })
      })
    }
  }

  test('正式记忆新增删除防重入与独立刷新', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      const state = { entries: [] as any[], failRead: true, failWrite: true, reads: 0, adds: 0, deletes: 0, release: null as null | (() => void) }
      ;(window as any).__memoryCrud = state
      api.memory = {
        list: async () => { state.reads++; if (state.failRead) throw new Error('private list error'); return state.entries.map((entry) => ({ ...entry })) },
        add: async (category: string, content: string) => {
          state.adds++
          await new Promise<void>((resolve) => { state.release = resolve })
          if (state.failWrite) throw new Error('private write error')
          const entry = { id: 'added-memory', category, content, createdAt: 1788220800000, updatedAt: 1788220800000 }
          state.entries.push(entry)
          state.failRead = true
          return entry
        },
        delete: async () => {
          state.deletes++
          await new Promise<void>((resolve) => { state.release = resolve })
          if (state.failWrite) throw new Error('private delete error')
          state.entries = []
        },
      }
      api.mcp.status = async () => []
    })
    await page.goto('/')
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-memory').click()
    await expect(page.getByRole('alert')).toContainText('记忆列表未能刷新')
    await expect(page.getByText('还没有任何记忆。和 Agent 对话后会自动提取，也可以手动添加。')).toHaveCount(0)
    await page.evaluate(() => { (window as any).__memoryCrud.failRead = false })
    await page.getByRole('button', { name: '重新读取', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.getByTestId('memory-group-relationship').click()
    await page.getByRole('button', { name: '添加一条记忆', exact: true }).click()
    const input = page.getByLabel('新记忆内容', { exact: true })
    await input.fill('每次讨论先给结论，再讲依据。')
    const save = page.getByRole('button', { name: '保存新记忆', exact: true })
    await page.evaluate(() => { (window as any).electronAPI.companion.getActive = async () => { throw new Error('private role failure') } })
    await save.click()
    await expect(page.getByRole('alert')).toContainText('记忆未添加')
    expect(await page.evaluate(() => (window as any).__memoryCrud.adds)).toBe(0)
    await expect(input).toHaveValue('每次讨论先给结论，再讲依据。')
    await page.evaluate(() => { (window as any).electronAPI.companion.getActive = async () => ({ id: 'lin' }) })
    await save.evaluate((node: HTMLButtonElement) => { node.click(); node.click() })
    await expect(save).toBeDisabled()
    expect(await page.evaluate(() => (window as any).__memoryCrud.adds)).toBe(1)
    await page.evaluate(() => (window as any).__memoryCrud.release())
    await expect(page.getByRole('alert')).toContainText('记忆未添加')
    await expect(input).toHaveValue('每次讨论先给结论，再讲依据。')
    await page.evaluate(() => { (window as any).__memoryCrud.failWrite = false })
    await save.click()
    await expect.poll(() => page.evaluate(() => (window as any).__memoryCrud.adds)).toBe(2)
    await page.evaluate(() => (window as any).__memoryCrud.release())
    const item = page.getByTestId('memory-item-added-memory')
    await expect(item).toContainText('每次讨论先给结论')
    await expect(page.getByRole('alert')).toContainText('记忆列表未能刷新')
    await expect(input).toHaveCount(0)
    await page.evaluate(() => { (window as any).__memoryCrud.failRead = false })
    await page.getByRole('button', { name: '重新读取', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__memoryCrud.adds)).toBe(2)
    await item.hover()
    await item.getByRole('button', { name: /^删除记忆 / }).click()
    const remove = item.getByRole('button', { name: /^确认删除记忆 / })
    await page.evaluate(() => { (window as any).__memoryCrud.failWrite = true })
    await remove.evaluate((node: HTMLButtonElement) => { node.click(); node.click() })
    await expect(remove).toBeDisabled()
    expect(await page.evaluate(() => (window as any).__memoryCrud.deletes)).toBe(1)
    await page.evaluate(() => (window as any).__memoryCrud.release())
    await expect(page.getByRole('alert')).toContainText('记忆未删除')
    await expect(item).toBeVisible()
    await item.getByRole('button', { name: /^取消删除 / }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await item.getByRole('button', { name: /^删除记忆 / }).click()
    await page.evaluate(() => { (window as any).__memoryCrud.failWrite = false })
    await remove.click()
    await expect.poll(() => page.evaluate(() => (window as any).__memoryCrud.deletes)).toBe(2)
    await page.evaluate(() => (window as any).__memoryCrud.release())
    await expect(item).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('正式敏感记忆确认随草稿修改、换组和取消失效', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const writes: unknown[] = []
      ;(window as any).__sensitiveWrites = writes
      ;(window as any).electronAPI.memory = {
        list: async () => [],
        add: async (...args: unknown[]) => { writes.push(args); return { id: 'sensitive', category: args[0], content: args[1], createdAt: 1, updatedAt: 1 } },
      }
    })
    await page.goto('/')
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-memory').click()
    await page.getByRole('button', { name: '添加一条记忆', exact: true }).click()
    const input = page.getByLabel('新记忆内容', { exact: true })
    const save = page.getByRole('button', { name: '保存新记忆', exact: true })
    const confirmation = page.getByRole('group', { name: '这条记忆包含敏感信息', exact: true })
    await input.fill('最近在调整处方药安排。')
    await save.click()
    await expect(confirmation).toContainText('健康')
    await input.fill('请记住银行卡相关的提醒。')
    await expect(confirmation).toHaveCount(0)
    await save.click()
    await expect(confirmation).toContainText('财务')
    await page.getByTestId('memory-group-collaboration').click()
    await expect(confirmation).toHaveCount(0)
    await page.getByTestId('memory-group-identity').click()
    await expect(input).toHaveValue('请记住银行卡相关的提醒。')
    await expect(confirmation).toHaveCount(0)
    await save.click()
    await page.getByRole('button', { name: '取消新增记忆', exact: true }).click()
    await expect(confirmation).toHaveCount(0)
    await expect(input).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__sensitiveWrites)).toEqual([])
  })

  test('正式敏感记忆确认提交快照、失败保留并可防重入', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const state = { writes: [] as unknown[], fail: true, release: null as null | (() => void), entries: [] as any[] }
      ;(window as any).__sensitiveConfirm = state
      ;(window as any).electronAPI.memory = {
        list: async () => state.entries.map((entry) => ({ ...entry })),
        add: async (...args: unknown[]) => {
          state.writes.push(args)
          await new Promise<void>((resolve) => { state.release = resolve })
          if (state.fail) throw new Error('private write error')
          const entry = { id: 'sensitive-saved', category: args[0], content: args[1], createdAt: 1, updatedAt: 1 }
          state.entries.push(entry)
          return entry
        },
      }
    })
    await page.goto('/')
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-memory').click()
    await page.getByRole('button', { name: '添加一条记忆', exact: true }).click()
    const input = page.getByLabel('新记忆内容', { exact: true })
    await input.fill('最近在调整处方药安排。')
    await page.getByRole('button', { name: '保存新记忆', exact: true }).click()
    const confirmation = page.getByRole('group', { name: '这条记忆包含敏感信息', exact: true })
    await expect(confirmation).toContainText('健康')
    const confirm = confirmation.getByRole('button', { name: '确认保存', exact: true })
    await confirm.evaluate((node: HTMLButtonElement) => { node.click(); node.click() })
    await expect(confirm).toBeDisabled()
    expect(await page.evaluate(() => (window as any).__sensitiveConfirm.writes.length)).toBe(1)
    await page.evaluate(() => (window as any).__sensitiveConfirm.release())
    await expect(page.getByRole('alert')).toContainText('记忆未添加')
    await expect(confirmation).toBeVisible()
    await expect(input).toHaveValue('最近在调整处方药安排。')
    await page.evaluate(() => { (window as any).__sensitiveConfirm.fail = false })
    await confirm.click()
    await expect.poll(() => page.evaluate(() => (window as any).__sensitiveConfirm.writes.length)).toBe(2)
    await page.evaluate(() => (window as any).__sensitiveConfirm.release())
    await expect(page.getByTestId('memory-item-sensitive-saved')).toContainText('处方药')
    await expect(confirmation).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__sensitiveConfirm.writes)).toEqual([
      ['identity', '最近在调整处方药安排。'],
      ['identity', '最近在调整处方药安排。'],
    ])
  })

  test('Playground 记忆候选不写真实敏感确认 IPC', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const writes: unknown[] = []
      ;(window as any).__playgroundMemoryWrites = writes
      ;(window as any).electronAPI.memory = {
        list: async () => [],
        add: async (...args: unknown[]) => { writes.push(args); return { id: 'should-not-write', category: args[0], content: args[1], createdAt: 1, updatedAt: 1 } },
      }
    })
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
    await page.getByTestId('playground-nav').getByRole('button', { name: '设置', exact: true }).click()
    await page.getByTestId('settings-candidate-nav-memory').click()
    const memory = page.getByTestId('memory-surface-candidate')
    await memory.getByRole('button', { name: '添加一条记忆', exact: true }).click()
    await memory.getByLabel('新记忆内容', { exact: true }).fill('最近在调整处方药安排。')
    await memory.getByRole('button', { name: '保存新记忆', exact: true }).click()
    await expect(page.getByRole('group', { name: '这条记忆包含敏感信息', exact: true })).toHaveCount(0)
    await expect(memory).toContainText('最近在调整处方药安排。')
    expect(await page.evaluate(() => (window as any).__playgroundMemoryWrites)).toEqual([])
  })

  test('Playground 生活面内存增改删不走真实 IPC', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const writes: unknown[] = []
      ;(window as any).__worldPreviewWrites = writes
      const api = (window as any).electronAPI.companion
      api.createAsset = async (...args: unknown[]) => { writes.push(['create', ...args]); return { ok: true, asset: { id: 'should-not-write', roleId: 'lin', kind: 'wardrobe', name: 'should-not-write', payload: {}, acquiredAt: 1, sourceEventId: null } } }
      api.updateAsset = async (...args: unknown[]) => { writes.push(['update', ...args]); return { ok: true, asset: { id: 'should-not-write', roleId: 'lin', kind: 'wardrobe', name: 'should-not-write', payload: {}, acquiredAt: 1, sourceEventId: null } } }
      api.deleteAsset = async (...args: unknown[]) => { writes.push(['delete', ...args]); return { ok: true } }
    })
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
    await page.getByTestId('playground-nav').getByRole('button', { name: '人物世界', exact: true }).click()
    await page.getByTestId('world-tab-wardrobe').click()
    const wardrobe = page.getByTestId('world-wardrobe-fixture')
    await expect(wardrobe.getByTestId('world-wardrobe-wearing')).toContainText('灰蓝薄外套')
    await wardrobe.getByRole('button', { name: '添加衣物', exact: true }).click()
    await wardrobe.getByLabel('名称', { exact: true }).fill('预览新外套')
    await wardrobe.getByRole('button', { name: '保存衣物', exact: true }).click()
    await expect(wardrobe).toContainText('预览新外套')
    await wardrobe.getByRole('button', { name: '编辑 预览新外套', exact: true }).click()
    await wardrobe.getByLabel('名称', { exact: true }).fill('预览更名外套')
    await wardrobe.getByRole('button', { name: '保存衣物', exact: true }).click()
    await expect(wardrobe).toContainText('预览更名外套')
    await wardrobe.getByRole('button', { name: '删除 预览更名外套', exact: true }).click()
    await page.getByRole('button', { name: '删除', exact: true }).click()
    await expect(wardrobe.getByText('预览更名外套', { exact: true })).toHaveCount(0)
    await page.getByTestId('world-tab-culture').click()
    const culture = page.getByTestId('world-culture-fixture')
    await culture.getByRole('button', { name: '添加文化记录', exact: true }).click()
    await culture.getByLabel('作品', { exact: true }).fill('预览新作品')
    await culture.getByRole('button', { name: '保存文化记录', exact: true }).click()
    await expect(culture).toContainText('预览新作品')
    expect(await page.evaluate(() => (window as any).__worldPreviewWrites)).toEqual([])
  })

  test('正式生活资产新增失败保留草稿', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const state = { creates: [] as Array<{ kind: string; name: string }>, fail: true, items: [] as Array<{ id: string; roleId: string; kind: string; name: string; payload: Record<string, unknown>; acquiredAt: number; sourceEventId: null }> }
      ;(window as any).__assetCreate = state
      const api = (window as any).electronAPI.companion
      api.getActive = async () => ({ id: 'lin', name: '测试伙伴', description: '' })
      api.getAssets = async () => ({ roleId: 'lin', items: state.items.map((item) => ({ ...item })) })
      api.getMoments = async () => ({ roleId: 'lin', items: [] })
      api.catchupStatus = async () => ({ roleId: 'lin', presence: '' })
      api.createAsset = async (input: { kind: string; name: string; payload?: Record<string, unknown> }) => {
        state.creates.push({ kind: input.kind, name: input.name })
        if (state.fail) return { ok: false, error: '添加失败', code: 'INVALID' }
        const asset = { id: `created-${state.items.length + 1}`, roleId: 'lin', kind: input.kind, name: input.name, payload: input.payload ?? {}, acquiredAt: 1, sourceEventId: null }
        state.items = [...state.items, asset]
        return { ok: true, asset }
      }
    })
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '人物世界', exact: true }).click()
    await page.getByTestId('world-tab-culture').click()
    const details = page.getByTestId('world-details')
    await details.getByRole('button', { name: '添加文化记录', exact: true }).click()
    await details.getByLabel('作品', { exact: true }).fill('正式新作品')
    await details.getByRole('button', { name: '保存文化记录', exact: true }).click()
    await expect(details.getByRole('alert')).toContainText('未添加')
    await expect(details.getByLabel('作品', { exact: true })).toHaveValue('正式新作品')
    await page.evaluate(() => { (window as any).__assetCreate.fail = false })
    await details.getByRole('button', { name: '保存文化记录', exact: true }).click()
    await expect(details).toContainText('正式新作品')
    await expect(details.getByTestId('world-asset-form')).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__assetCreate.creates)).toEqual([
      { kind: 'culture', name: '正式新作品' },
      { kind: 'culture', name: '正式新作品' },
    ])
  })

  test('正式衣柜删除确认失败保留且防重入', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const state = { deletes: [] as string[], fail: true, release: null as null | (() => void), items: [{ id: 'coat-1', roleId: 'lin', kind: 'wardrobe', name: '灰绿外套', payload: { color: '灰绿' }, acquiredAt: 1, sourceEventId: null }] }
      ;(window as any).__assetDelete = state
      const api = (window as any).electronAPI.companion
      api.catchupStatus = async () => ({ roleId: 'lin' })
      api.getActive = async () => ({ id: 'lin', name: '测试伙伴', description: '' })
      api.getAssets = async () => ({ roleId: 'lin', items: state.items.map((item) => ({ ...item })) })
      api.getMoments = async () => ({ roleId: 'lin', items: [] })
      api.deleteAsset = async (id: string) => {
        state.deletes.push(id)
        await new Promise<void>((resolve) => { state.release = resolve })
        if (state.fail) return { ok: false, error: '删除失败' }
        state.items = state.items.filter((item) => item.id !== id)
        return { ok: true }
      }
    })
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '人物世界', exact: true }).click()
    await page.getByTestId('world-tab-wardrobe').click()
    await expect(page.getByText('灰绿外套', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '删除 灰绿外套', exact: true }).click()
    const confirmation = page.getByRole('group', { name: '删除「灰绿外套」？', exact: true })
    await expect(confirmation).toBeVisible()
    const confirm = confirmation.getByRole('button', { name: '删除', exact: true })
    await confirm.evaluate((node: HTMLButtonElement) => { node.click(); node.click() })
    await expect(confirm).toBeDisabled()
    expect(await page.evaluate(() => (window as any).__assetDelete.deletes)).toEqual(['coat-1'])
    await page.evaluate(() => (window as any).__assetDelete.release())
    await expect(page.getByRole('alert').getByText('未删除，请重试或取消。', { exact: true })).toBeVisible()
    await expect(confirmation).toBeVisible()
    await page.evaluate(() => { (window as any).__assetDelete.fail = false })
    await confirm.click()
    await expect.poll(() => page.evaluate(() => (window as any).__assetDelete.deletes.length)).toBe(2)
    await page.evaluate(() => (window as any).__assetDelete.release())
    await expect(page.getByText('灰绿外套', { exact: true })).toHaveCount(0)
    await expect(confirmation).toHaveCount(0)
  })

  test('正式通讯录列表先展示忙闲且忙碌仍可开聊', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const state = { availability: [] as string[], summons: [] as Array<{ id: string; force?: boolean }> }
      ;(window as any).__castAvailability = state
      const api = (window as any).electronAPI.companion
      api.getActive = async () => ({ id: 'lin', name: '测试伙伴', description: '' })
      api.getRoster = async () => ({
        roleId: 'lin',
        lines: [
          { otherId: 'chen', otherName: '陈晨', relationType: 'friend', text: '经常一起讨论工作。' },
          { otherId: 'ayu', otherName: '阿雨', relationType: 'friend', text: '周末会一起散步。' },
        ],
        cast: [
          { id: 'chen', name: '陈晨', description: '朋友', summary: '朋友', canBeProtagonist: false, summonHint: '' },
          { id: 'ayu', name: '阿雨', description: '朋友', summary: '朋友', canBeProtagonist: false, summonHint: '' },
        ],
      })
      api.checkCastAvailability = async (id: string) => {
        state.availability.push(id)
        if (id === 'chen') {
          return { available: false, roleId: 'chen', name: '陈晨', reason: '陈晨正在忙', alternative: '可以晚点再聊', presence: '加班' }
        }
        return { available: true, roleId: 'ayu', name: '阿雨', presence: '在家看书' }
      }
      api.startSummon = async (id: string, force?: boolean) => {
        state.summons.push({ id, force: Boolean(force) })
        if (id === 'chen' && !force) return { ok: false, error: 'BUSY', reason: '陈晨正在忙', alternative: '可以晚点再聊', presence: '加班' }
        return { ok: true, sessionId: `summon-${id}`, roleId: id, name: id === 'chen' ? '陈晨' : '阿雨', sessionKind: 'summon', activeRoleId: 'lin' }
      }
    })
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '人物世界', exact: true }).click()
    await page.getByTestId('world-tab-cast').click()
    const chen = page.getByTestId('world-cast-card-chen')
    const ayu = page.getByTestId('world-cast-card-ayu')
    await expect(chen).toHaveAttribute('data-availability', 'busy')
    await expect(chen.getByTestId('world-cast-presence-chen')).toHaveText('现在忙碌')
    await expect(chen).toContainText('陈晨正在忙')
    await expect(ayu).toHaveAttribute('data-availability', 'available')
    await expect(ayu.getByTestId('world-cast-presence-ayu')).toHaveText('方便开聊')
    await expect.poll(() => page.evaluate(() => (window as any).__castAvailability.availability.slice().sort())).toEqual(['ayu', 'chen'])
    await chen.getByRole('button', { name: '开聊', exact: true }).click()
    await expect(page.getByRole('group', { name: '仍要强行与陈晨开聊吗？', exact: true })).toBeVisible()
    expect(await page.evaluate(() => (window as any).__castAvailability.summons)).toEqual([{ id: 'chen', force: false }])
  })

  test('正式通讯录强行开聊确认失败保留且防重入', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const state = { calls: [] as Array<{ id: string; force?: boolean }>, failForce: true, release: null as null | (() => void) }
      ;(window as any).__summonForce = state
      const api = (window as any).electronAPI.companion
      api.getActive = async () => ({ id: 'lin', name: '测试伙伴', description: '' })
      api.getRoster = async () => ({
        roleId: 'lin',
        lines: [{ otherId: 'chen', otherName: '陈晨', relationType: 'friend', text: '经常一起讨论工作。' }],
        cast: [{ id: 'chen', name: '陈晨', description: '朋友', summary: '朋友', canBeProtagonist: false, summonHint: '' }],
      })
      api.checkCastAvailability = async (id: string) => ({ available: false, roleId: id, name: '陈晨', reason: '陈晨正在忙', alternative: '可以晚点再聊' })
      api.startSummon = async (id: string, force?: boolean) => {
        state.calls.push({ id, force: Boolean(force) })
        if (!force) return { ok: false, error: 'BUSY', reason: '陈晨正在忙', alternative: '可以晚点再聊' }
        await new Promise<void>((resolve) => { state.release = resolve })
        if (state.failForce) return { ok: false, error: 'SUMMON_FAILED' }
        return { ok: true, sessionId: 'summon-1', roleId: id, name: '陈晨', sessionKind: 'summon', activeRoleId: 'lin' }
      }
    })
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '人物世界', exact: true }).click()
    await page.getByTestId('world-tab-cast').click()
    await page.getByRole('button', { name: '开聊', exact: true }).click()
    const confirmation = page.getByRole('group', { name: '仍要强行与陈晨开聊吗？', exact: true })
    await expect(confirmation).toContainText('陈晨正在忙')
    const confirm = confirmation.getByRole('button', { name: '强行开聊', exact: true })
    await confirm.evaluate((node: HTMLButtonElement) => { node.click(); node.click() })
    await expect(confirm).toBeDisabled()
    expect(await page.evaluate(() => (window as any).__summonForce.calls)).toEqual([{ id: 'chen', force: false }, { id: 'chen', force: true }])
    await page.evaluate(() => (window as any).__summonForce.release())
    await expect(confirmation).toBeVisible()
    await page.evaluate(() => { (window as any).__summonForce.failForce = false })
    await confirm.click()
    await expect.poll(() => page.evaluate(() => (window as any).__summonForce.calls.length)).toBe(3)
    await page.evaluate(() => (window as any).__summonForce.release())
    await expect(confirmation).toHaveCount(0)
  })


  test('正式记忆离页后的迟到保存不清空新草稿', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      const state = { reads: 0, release: null as null | (() => void) }
      ;(window as any).__lateMemory = state
      api.memory = {
        list: async () => { state.reads++; return [{ id: 'late', category: 'fact', content: '原有记忆内容', createdAt: 1, updatedAt: 1 }] },
        update: async () => new Promise<void>((resolve) => { state.release = resolve }),
      }
      api.mcp.status = async () => []
    })
    await page.goto('/')
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-memory').click()
    const item = page.getByTestId('memory-item-late')
    await item.hover()
    await item.getByRole('button', { name: /^编辑记忆 / }).click()
    await item.locator('input').fill('尚未返回的提交')
    await item.getByRole('button', { name: /^保存记忆 / }).click()
    await expect(item.getByRole('button', { name: /^保存记忆 / })).toBeDisabled()
    await page.getByTestId('settings-nav-appearance').click()
    await page.getByTestId('settings-nav-memory').click()
    await item.hover()
    await item.getByRole('button', { name: /^编辑记忆 / }).click()
    await item.locator('input').fill('重新进入后尚未提交的草稿')
    const reads = await page.evaluate(() => (window as any).__lateMemory.reads)
    await page.evaluate(async () => { (window as any).__lateMemory.release(); await new Promise((resolve) => setTimeout(resolve, 100)) })
    expect(await page.evaluate(() => (window as any).__lateMemory.reads)).toBe(reads)
    await expect(item.locator('input')).toHaveValue('重新进入后尚未提交的草稿')
  })

  test('Skills 管理页没有桌面连接时展示可重试错误', async ({ page }) => {
    await page.goto('/')

    await page.click('button[title="设置"]')
    await page.getByTestId('settings-nav-skills').click()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await expect(page.locator('[data-testid="skills-panel"]')).toBeVisible()
    await expect(page.getByText('管理伙伴可以按需使用的工作方法。', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ 新建 Skill', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '重试读取', exact: true })).toBeVisible()
  })

  for (const theme of ['porcelain-blue', 'yao-stone', 'song-smoke', 'deep-plum']) {
    for (const width of [1166, 600]) {
      test(`正式 Skills 完整管理流程 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 731 })
        await installProductionElectronStub(page)
        await page.addInitScript(({ theme }) => {
          localStorage.setItem('theme', theme)
          const api = (window as any).electronAPI
          const body = '---\nname: local-helper\ndescription: 本机工作方法\n---\n' + '长篇工作说明，需要完整阅读与编辑。\n'.repeat(120)
          const harness = { failSave: true, failDelete: true, failToggle: true, saves: 0, deletes: 0, toggles: 0, content: body, release: null as (() => void) | null, holdDelete: false }
          ;(window as any).__skills = harness
          let list = [{ name: 'local-helper', description: '本机工作方法', when_to_use: '用户请求整理时', author: '本机', version: '1.0', source: 'user', enabled: true }, { name: 'builtin-helper', description: '内置工作方法', source: 'builtin', enabled: true }]
          api.mcp.status = async () => []
          api.skills = {
            list: async () => list.map((item) => ({ ...item })),
            reload: async () => ({ success: true, count: list.length }),
            get: async (name: string) => name === 'local-helper' ? harness.content : '内置正文',
            validate: async () => ({ valid: true, name: 'local-helper', issues: [], meta: { name: 'local-helper', description: '本机工作方法' } }),
            save: async (_name: string, text: string) => { harness.saves++; if (harness.failSave) return { success: false, issues: [{ code: 'save.failed', severity: 'error', message: '测试写盘失败' }] }; harness.content = text; return { success: true, issues: [] } },
            delete: async (name: string) => { harness.deletes++; if (harness.holdDelete) await new Promise<void>((resolve) => { harness.release = resolve }); if (harness.failDelete) return { success: false }; list = list.filter((item) => item.name !== name); return { success: true } },
            setEnabled: async (name: string, enabled: boolean) => { harness.toggles++; if (harness.failToggle) throw new Error('toggle failed'); list = list.map((item) => item.name === name ? { ...item, enabled } : item); return { success: true, enabled } },
          }
        }, { theme })
        await page.goto('/')
        await page.locator('button[title="设置"]').click()
        await (width < 768 ? page.getByRole('tab', { name: 'Skills', exact: true }) : page.getByTestId('settings-nav-skills')).click()
        const panel = page.getByTestId('skills-panel')
        await expect(panel.getByTestId('skill-card-local-helper')).toBeVisible()
        await expect(panel.getByText('选择一个 Skill', { exact: true })).toHaveCount(0)
        await panel.getByRole('button', { name: 'builtin-helper', exact: true }).click()
        await expect(panel.getByTestId('skill-file-preview')).toHaveText('内置正文')
        await expect(panel.getByRole('button', { name: '删除 Skill', exact: true })).toHaveCount(0)
        await panel.getByRole('button', { name: '返回 Skills', exact: true }).click()
        await panel.getByRole('button', { name: 'local-helper', exact: true }).click()
        const detail = panel.getByTestId('skill-detail')
        const toggle = detail.getByRole('switch')
        await toggle.click()
        await expect(panel.getByRole('alert')).toContainText('未能更新')
        await expect(toggle).toHaveAttribute('aria-checked', 'true')
        await page.evaluate(() => { (window as any).__skills.failToggle = false })
        await toggle.click()
        await expect(toggle).toHaveAttribute('aria-checked', 'false')
        const file = detail.getByTestId('skill-file-preview')
        expect(await file.evaluate((node) => ({ scrolls: node.scrollHeight > node.clientHeight, bounded: node.clientHeight <= innerHeight * .48 + 1, fits: node.scrollWidth <= node.clientWidth }))).toEqual({ scrolls: true, bounded: true, fits: true })
        await page.screenshot({ path: testInfo.outputPath('skills-detail.png'), animations: 'disabled' })
        await detail.getByRole('button', { name: '编辑 Skill', exact: true }).click()
        const editor = detail.getByRole('textbox', { name: '编辑 SKILL.md', exact: true })
        expect((await editor.boundingBox())!.height).toBeGreaterThan(200)
        await editor.fill('不应保存的草稿')
        await detail.getByRole('button', { name: '取消编辑', exact: true }).click()
        await expect(file).not.toContainText('不应保存的草稿')
        await detail.getByRole('button', { name: '编辑 Skill', exact: true }).click()
        await editor.fill('编辑后的完整草稿')
        await detail.getByRole('button', { name: '校验并保存', exact: true }).click()
        await expect(editor).toHaveValue('编辑后的完整草稿')
        await expect(panel.getByRole('alert')).toContainText('草稿已保留')
        await page.evaluate(() => { (window as any).__skills.failSave = false })
        await detail.getByRole('button', { name: '校验并保存', exact: true }).click()
        await expect(file).toHaveText('编辑后的完整草稿')
        await detail.getByRole('button', { name: '删除 Skill', exact: true }).click()
        let confirmation = panel.getByRole('group', { name: '删除 Skill「local-helper」？', exact: true })
        await confirmation.getByRole('button', { name: '取消', exact: true }).click()
        expect(await page.evaluate(() => (window as any).__skills.deletes)).toBe(0)
        await detail.getByRole('button', { name: '删除 Skill', exact: true }).click()
        confirmation = panel.getByRole('group', { name: '删除 Skill「local-helper」？', exact: true })
        await confirmation.getByRole('button', { name: '删除 Skill', exact: true }).click()
        await expect(panel.getByRole('alert')).toBeVisible()
        await expect(confirmation).toBeVisible()
        await page.evaluate(() => { Object.assign((window as any).__skills, { failDelete: false, holdDelete: true }) })
        const confirm = confirmation.getByRole('button', { name: '删除 Skill', exact: true })
        const size = () => confirm.evaluate((node) => ({ width: node.clientWidth, height: node.clientHeight }))
        const before = await size()
        await confirm.click()
        await expect(confirm).toBeDisabled()
        expect(await size()).toEqual(before)
        await confirm.evaluate((node) => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
        expect(await page.evaluate(() => (window as any).__skills.deletes)).toBe(2)
        await page.screenshot({ path: testInfo.outputPath('skills-confirm-pending.png'), animations: 'disabled' })
        await page.evaluate(() => (window as any).__skills.release())
        await expect(panel.getByTestId('skill-card-local-helper')).toHaveCount(0)
        await expect(panel.getByTestId('skill-card-builtin-helper')).toBeVisible()
        expect(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      })
    }
  }

  test('Skills 离开页面后迟到的正文不覆盖新页面', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      api.mcp.status = async () => []
      api.skills = {
        list: async () => [{ name: 'slow-skill', description: '慢速读取样张', source: 'builtin', enabled: true }],
        get: async () => new Promise<string>((resolve) => { (window as any).__releaseSkill = () => resolve('迟到正文') }),
      }
    })
    await page.goto('/')
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-skills').click()
    await page.getByRole('button', { name: 'slow-skill', exact: true }).click()
    await expect(page.getByText('正在读取正文…', { exact: true })).toBeVisible()
    await page.getByTestId('settings-nav-appearance').click()
    await page.getByTestId('settings-nav-skills').click()
    await expect(page.getByTestId('skill-card-slow-skill')).toBeVisible()
    await page.evaluate(async () => { (window as any).__releaseSkill(); await new Promise((resolve) => setTimeout(resolve, 100)) })
    await expect(page.getByTestId('skill-detail')).toHaveCount(0)
    await expect(page.getByTestId('skill-card-slow-skill')).toBeVisible()
  })

  test('Foundation 页内确认包含可交互默认态与稳定处理中态', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Playground', exact: true }).click()
    await page.getByTestId('playground-nav').getByRole('button', { name: '基础组件', exact: true }).click()
    await page.getByRole('tab', { name: '状态反馈', exact: true }).click()
    const panels = page.getByRole('group', { name: '删除样张？', exact: true })
    await expect(panels).toHaveCount(2)
    const normal = panels.first().getByRole('button', { name: '删除', exact: true })
    const pending = panels.last().getByRole('button', { name: '删除', exact: true })
    expect(await normal.evaluate((node) => node.clientWidth)).toBe(await pending.evaluate((node) => node.clientWidth))
    await expect(pending).toBeDisabled()
    await panels.first().getByRole('button', { name: '取消', exact: true }).click()
    await expect(page.getByText('已取消', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '重置样张', exact: true }).click()
    await normal.click()
    await expect(page.getByText('已删除样张', { exact: true })).toBeVisible()
  })

  for (const theme of ['porcelain-blue', 'yao-stone', 'song-smoke', 'deep-plum']) {
    for (const width of [1166, 600]) {
      test(`正式权限页规则卡片与新增草稿 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 731 })
        await installProductionElectronStub(page)
        await page.addInitScript((themeId) => {
          localStorage.setItem('theme', themeId)
          const api = (window as any).electronAPI
          const stored: Record<string, string> = {
            llmApiKeyConfigured: 'true',
            llmModel: 'e2e-model',
            executionMode: 'confirm-all',
            permissionRules: JSON.stringify([
              { id: 'preview-publish', type: 'command', action: 'deny', pattern: 'npm publish', enabled: true },
            ]),
          }
          const harness = { fail: true, writes: [] as Array<[string, string]>, stored }
          ;(window as any).__permissionSettings = harness
          api.settings.get = async () => ({ ...stored })
          api.settings.set = async (key: string, value: string) => {
            harness.writes.push([key, value])
            if (key === 'permissionRules' && harness.fail) throw new Error('fixture save failure')
            stored[key] = value
          }
          api.mcp.status = async () => []
        }, theme)
        await page.goto('/')
        await page.locator('button[title="设置"]').click()
        await (width < 768 ? page.getByRole('tab', { name: '权限与自动化', exact: true }) : page.getByTestId('settings-nav-permissions')).click()
        const rules = page.getByTestId('settings-rules-existing')
        const toggle = page.getByTestId('settings-permission-rules-toggle')
        const add = page.getByTestId('settings-add-rule')
        const pattern = rules.getByLabel('规则匹配内容', { exact: true })
        const save = rules.getByTestId('settings-save-rule')
        const list = rules.getByRole('list', { name: '自定义规则列表' })
        await expect(toggle).toContainText('自定义规则')
        await expect(toggle).toHaveAttribute('aria-expanded', 'false')
        await expect(add).toHaveCount(0)
        await expect(list).toHaveCount(0)
        await toggle.click()
        await expect(toggle).toHaveAttribute('aria-expanded', 'true')
        await expect(list.getByRole('listitem')).toHaveCount(1)
        await expect(pattern).toHaveCount(0)
        await expect(add).toBeVisible()
        const measureRuleLayout = () => rules.evaluate((node) => {
          const card = node.getBoundingClientRect()
          const item = node.querySelector('li')!.getBoundingClientRect()
          const button = node.querySelector('[data-testid="settings-add-rule"]')!.getBoundingClientRect()
          return { x: item.x - card.x, y: item.y - card.y, width: item.width, height: item.height, buttonWidth: button.width, buttonHeight: button.height }
        })
        const measureAddPosition = () => add.evaluate((node) => {
          const section = node.closest('[data-testid="settings-rules-existing"]')!.getBoundingClientRect()
          const button = node.getBoundingClientRect()
          return { x: button.x - section.x, y: button.y - section.y }
        })
        const expectAddBelowList = async () => {
          expect(await rules.evaluate((node) => {
            const listNode = node.querySelector('ul')!
            const button = node.querySelector('[data-testid="settings-add-rule"]')!
            return Boolean(listNode.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING)
              && button.getBoundingClientRect().top >= listNode.getBoundingClientRect().bottom + 8
          })).toBe(true)
        }
        await expect(rules).toHaveCSS('border-top-width', '0px')
        await expect(rules).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
        const ruleCard = list.getByTestId('settings-rule-card').first()
        await expect(ruleCard).toHaveCSS('border-top-width', '1px')
        await expect(ruleCard).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
        await expectAddBelowList()
        const initialLayout = await measureRuleLayout()
        const initialAddPosition = await measureAddPosition()
        const cardBox = () => ruleCard.evaluate((node) => {
          const box = node.getBoundingClientRect()
          return { width: box.width, height: box.height }
        })
        const beforeHover = await cardBox()
        await ruleCard.hover()
        expect(await cardBox()).toEqual(beforeHover)
        await page.mouse.move(0, 0)
        expect(await measureRuleLayout()).toEqual(initialLayout)
        await add.click()
        await expect(add).toHaveAccessibleName('取消添加')
        await expect(add).toHaveAttribute('aria-expanded', 'true')
        expect(await measureRuleLayout()).toEqual(initialLayout)
        expect(await measureAddPosition()).toEqual(initialAddPosition)
        await expect(save).toBeDisabled()
        await pattern.fill('   ')
        await expect(save).toBeDisabled()
        await pattern.fill('cancelled-command')
        await rules.getByRole('button', { name: '取消', exact: true }).click()
        await expect(pattern).toHaveCount(0)
        expect(await page.evaluate(() => (window as any).__permissionSettings.writes)).toEqual([])
        expect(await measureRuleLayout()).toEqual(initialLayout)
        expect(await measureAddPosition()).toEqual(initialAddPosition)
        await add.click()
        await pattern.fill('git push')
        await rules.getByLabel('规则处理方式', { exact: true }).selectOption('需要确认')
        await save.click()
        await expect(page.getByRole('alert')).toContainText('规则未保存')
        await expect(pattern).toHaveValue('git push')
        await expect(list.getByRole('listitem')).toHaveCount(1)
        expect(await page.evaluate(() => (window as any).__permissionSettings.stored.permissionRules)).toContain('npm publish')
        expect(await page.evaluate(() => (window as any).__permissionSettings.writes)).toHaveLength(1)
        await save.click()
        await expect(page.getByRole('alert')).toContainText('规则未保存')
        expect(await page.evaluate(() => (window as any).__permissionSettings.writes)).toHaveLength(2)
        expect(JSON.parse(await page.evaluate(() => (window as any).__permissionSettings.stored.permissionRules))).toHaveLength(1)
        await page.evaluate(() => { (window as any).__permissionSettings.fail = false })
        await save.click()
        await expect(toggle).toContainText('2 条')
        await expect(pattern).toHaveCount(0)
        await expect(add).toHaveAccessibleName('添加')
        await expect(list.getByRole('listitem')).toHaveCount(2)
        await expect(list).toContainText('git push')
        await expect(list).not.toContainText('cancelled-command')
        expect(JSON.parse(await page.evaluate(() => (window as any).__permissionSettings.stored.permissionRules))).toHaveLength(2)
        expect(await page.evaluate(() => (window as any).__permissionSettings.writes.every(([key]: [string]) => key === 'permissionRules'))).toBe(true)
        expect(await measureRuleLayout()).toEqual(initialLayout)
        await expectAddBelowList()
        expect(await rules.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
        await page.screenshot({ path: testInfo.outputPath('permission-rules.png'), animations: 'disabled' })
      })
    }
  }

  for (const theme of ['song-smoke', 'yao-stone']) {
    for (const width of [1166, 600]) {
      test(`正式相处偏好保存失败与恢复 ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 731 })
        await installProductionElectronStub(page)
        await page.addInitScript((selectedTheme) => {
          localStorage.setItem('theme', selectedTheme)
          const api = (window as any).electronAPI
          const stored: Record<string, string> = { llmApiKeyConfigured: 'true', llmModel: 'test', systemPrompt: '旧提示词保持不变', companionResponseNote: '' }
          const harness = { fail: true, writes: [] as Array<[string, string]>, stored }
          ;(window as any).__companionSettings = harness
          api.settings.get = async () => ({ ...stored })
          api.settings.set = async (key: string, value: string) => {
            harness.writes.push([key, value])
            if (harness.fail) throw new Error('测试保存失败')
            stored[key] = value
          }
          api.mcp.status = async () => []
        }, theme)
        await page.goto('/')
        await page.locator('button[title="设置"]').click()
        const nav = width < 768 ? page.getByRole('tab', { name: '伙伴与相处', exact: true }) : page.getByTestId('settings-nav-companion')
        await nav.click()
        const note = page.getByRole('textbox', { name: '相处补充说明', exact: true })
        await expect(note).toHaveAttribute('maxlength', '4000')
        const status = page.getByTestId('settings-save-status')
        const size = () => status.evaluate((node) => ({ width: node.clientWidth, height: node.clientHeight }))
        const initialSize = await size()
        const text = '请先给结论，再解释依据。\n'.repeat(80)
        await note.fill(text)
        const retry = page.getByRole('button', { name: '重试保存', exact: true })
        await expect(retry).toBeVisible()
        await expect(page.getByText('设置自动保存失败，修改仍保留，请重试', { exact: true })).toHaveCount(0)
        expect(await size()).toEqual(initialSize)
        const back = page.getByTestId(width < 768 ? 'settings-back-mobile' : 'settings-back')
        await back.click()
        await expect(note).toHaveValue(text)
        await expect(page.getByTestId('settings-panel')).toBeVisible()
        expect(await note.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
        await retry.scrollIntoViewIfNeeded()
        await page.screenshot({ path: testInfo.outputPath('companion-save-failed.png') })
        await page.evaluate(() => { (window as any).__companionSettings.fail = false })
        await retry.click()
        await expect(retry).not.toBeVisible()
        expect(await size()).toEqual(initialSize)
        expect(await page.evaluate(() => (window as any).__companionSettings.stored.systemPrompt)).toBe('旧提示词保持不变')
        expect(await page.evaluate(() => (window as any).__companionSettings.writes.every(([key]: [string]) => key === 'companionResponseNote'))).toBe(true)
        await back.click()
        await page.locator('button[title="设置"]').click()
        await nav.click()
        await expect(note).toHaveValue(text)
        await note.fill('')
        await back.click()
        expect(await page.evaluate(() => (window as any).__companionSettings.stored.companionResponseNote)).toBe('')
      })
    }
  }

  test('设置快捷键离开失败保留草稿且保存成功后才新建会话', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.addInitScript(() => {
      const api = (window as any).electronAPI
      const state = { fail: true, created: 0, stored: { llmApiKeyConfigured: 'true', companionResponseNote: '' } as Record<string, string> }
      ;(window as any).__settingsExit = state
      api.settings.get = async () => ({ ...state.stored })
      api.settings.set = async (key: string, value: string) => {
        if (state.fail) throw new Error('test save failure')
        state.stored[key] = value
      }
      api.session.create = async () => ({ id: `exit-session-${++state.created}` })
    })
    await page.goto('/')
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-companion').click()
    const note = page.getByRole('textbox', { name: '相处补充说明', exact: true })
    await note.fill('保存失败时不要丢弃这条草稿')
    await expect(page.getByRole('button', { name: '重试保存', exact: true })).toBeVisible()
    for (const shortcut of ['Control+,', 'Control+Shift+P', 'Control+n', 'Escape', 'Control+Shift+M', 'Control+Shift+F', 'Control+Shift+K', 'Control+Shift+D']) {
      await page.keyboard.press(shortcut)
      await expect(page.getByTestId('settings-panel')).toBeVisible()
      await expect(note).toHaveValue('保存失败时不要丢弃这条草稿')
    }
    expect(await page.evaluate(() => (window as any).__settingsExit.created)).toBe(0)
    await page.evaluate(() => { (window as any).__settingsExit.fail = false })
    await page.keyboard.press('Control+n')
    await expect(page.getByTestId('settings-panel')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => (window as any).__settingsExit.created)).toBe(1)
    expect(await page.evaluate(() => (window as any).__settingsExit.stored.companionResponseNote)).toBe('保存失败时不要丢弃这条草稿')
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-companion').click()
    await expect(note).toHaveValue('保存失败时不要丢弃这条草稿')
  })

  test('设置高级模型参数自动保存并在离开时刷新', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      const writes: Array<[string, string]> = []
      ;(window as any).__settingsWrites = writes
      ;(window as any).electronAPI = {
        settings: {
          get: async () => ({ llmBaseUrl: 'https://api.openai.com/v1', llmModel: 'gpt-4o', modelConnections: '[]', modelRoutes: '[]' }),
          set: async (key: string, value: string) => { writes.push([key, value]) },
        },
        companion: { getActive: async () => ({ id: 'lin', name: '小林', description: '沉稳体贴的数字伙伴' }), listProtagonists: async () => [], getMutable: async () => ({ body: '' }), listMutableVersions: async () => [] },
        mcp: { status: async () => [] },
      }
    })
    await page.click('button[title="设置"]')
    await page.getByRole('button', { name: '模型', exact: true }).click()
    const advancedToggle = page.getByRole('button', { name: /高级设置/ })
    await advancedToggle.click()
    const budget = page.getByLabel('会话预算（Token）', { exact: true })
    await budget.fill('12000')
    await expect.poll(() => page.evaluate(() => (window as any).__settingsWrites.some(([key, value]: [string, string]) => key === 'sessionTokenBudget' && value === '12000'))).toBe(true)
    await budget.fill('13000')
    await page.locator('[data-testid="settings-back"]').click()
    await expect.poll(() => page.evaluate(() => (window as any).__settingsWrites.some(([key, value]: [string, string]) => key === 'sessionTokenBudget' && value === '13000'))).toBe(true)
  })
  test('设置面板无手动保存栏并可返回聊天', async ({ page }) => {
    await page.goto('/')
    await page.click('button[title="设置"]')
    const settingsPanel = page.locator('[data-testid="settings-panel"]')
    await expect(settingsPanel).toBeVisible()
    await expect(settingsPanel.getByRole('button', { name: '保存', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '模型', exact: true }).click()
    await expect(page.getByTestId('settings-model-routing')).toBeVisible()
    await expect(page.getByText('连接与模型清单', { exact: true })).toBeVisible()
    await expect(page.getByText('模型使用安排', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /高级设置/ })).toHaveAttribute('aria-expanded', 'false')
    await page.getByRole('button', { name: /高级设置/ }).click()
    await expect(page.getByTestId('settings-model-budget')).toBeVisible()
    await expect(page.getByLabel('会话预算（Token）', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Temperature', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '数据与隐私', exact: true }).click()
    await expect(page.getByRole('button', { name: /导出数据/ })).toContainText('生成一份本地备份')
    await expect(page.getByRole('button', { name: /导入数据/ })).toContainText('从本地备份恢复')
    await expect(page.getByText('生活资产与播种标记')).toBeVisible()
    await expect(page.getByText('API Key、MCP 密钥、权限规则与本机项目路径。')).toBeVisible()
    await page.locator('[data-testid="settings-back"]').click()
    await expect(settingsPanel).not.toBeVisible()
  })
})

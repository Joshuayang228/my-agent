/**
 * E2E 测试 — UI 交互测试（Vite dev server 环境）
 *
 * 这些测试通过浏览器验证 UI 渲染和交互逻辑。
 * IPC/LLM 相关功能在 electron.test.ts 中测试。
 */
import { test, expect } from '@playwright/test'

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

  test('侧边栏可见且可折叠', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('[data-testid="primary-sidebar"]')).toBeVisible()
    await expect(page.getByRole('button', { name: '新对话', exact: true })).toBeVisible()

    await page.getByTitle('收起侧栏 Ctrl+B').click()
    await expect(page.locator('[data-testid="primary-sidebar"]')).not.toBeVisible()

    await page.getByTitle('展开侧边栏 (Ctrl+B)').click()
    await expect(page.locator('[data-testid="primary-sidebar"]')).toBeVisible()
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
  })


  test('Playground 页面组合展示精修后的隔离候选态', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    await page.locator('[data-testid="playground-shell"] nav').getByRole('button', { name: '页面组合', exact: true }).click()

    const surfaceTabs = page.getByRole('tablist', { name: '页面基线分区' })
    const candidate = page.locator('[data-testid="surface-sidebar-candidate"]')
    await expect(candidate).toBeVisible()
    await expect(candidate.getByRole('button', { name: '记忆', exact: true })).toHaveCount(0)
    await expect(candidate.getByRole('button', { name: '人物世界', exact: true })).toBeVisible()
    await expect(candidate.getByRole('button', { name: '设置', exact: true })).toBeVisible()
    await expect(candidate.getByText('开发', { exact: true })).toBeHidden()
    await expect(candidate.getByText('产品', { exact: true })).toBeHidden()
    await expect(page.getByRole('button', { name: '二级页收起', exact: true })).toHaveCount(0)
    await expect(page.locator('[data-testid="surface-secondary-nav"]')).toHaveCount(0)

    const developerNav = candidate.locator('[data-testid="sidebar-developer-nav"]')
    const developerBox = await developerNav.boundingBox()
    const productBox = await candidate.getByRole('button', { name: '人物世界', exact: true }).boundingBox()
    const settingsBox = await candidate.getByRole('button', { name: '设置', exact: true }).boundingBox()
    const sidebarBox = await candidate.locator('[data-testid="primary-sidebar"]').boundingBox()
    const viewportBox = await page.locator('[data-testid="chat-surface-viewport"]').boundingBox()
    expect((developerBox?.y ?? 0) + (developerBox?.height ?? 0)).toBeLessThan(productBox?.y ?? 0)
    expect(Math.abs((sidebarBox?.y ?? 0) + (sidebarBox?.height ?? 0) - ((viewportBox?.y ?? 0) + (viewportBox?.height ?? 0)))).toBeLessThan(2)
    expect((settingsBox?.y ?? 0) + (settingsBox?.height ?? 0)).toBeLessThanOrEqual((sidebarBox?.y ?? 0) + (sidebarBox?.height ?? 0))

    await candidate.getByTitle('收起侧栏 Ctrl+B').click()
    await expect(page.locator('[data-testid="surface-sidebar-candidate"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="surface-sidebar-reopen"]')).toBeVisible()
    await page.locator('[data-testid="surface-sidebar-reopen"]').click()

    await surfaceTabs.getByRole('tab', { name: '设置', exact: true }).click()
    const settings = page.locator('[data-testid="settings-panel"]')
    await expect(settings).toBeVisible()
    await expect(settings.getByRole('button', { name: '记忆', exact: true })).toBeVisible()
    await expect(settings.getByRole('button', { name: '工具', exact: true })).toBeVisible()

    await surfaceTabs.getByRole('tab', { name: 'Right Dock', exact: true }).click()
    await expect(page.locator('[data-testid="chat-right-dock"]')).toContainText('my-agent · 样张项目')
    await expect(page.locator('[data-testid="file-browser"]')).toContainText('AppShell.tsx')
    await expect(page.locator('[data-testid="file-browser"]')).toContainText('export function AppShell')

    await surfaceTabs.getByRole('tab', { name: '人物世界', exact: true }).click()
    await expect(page.getByText('把窗帘拉开了一点，泡了杯乌龙茶，准备先把桌面清出一块。', { exact: true })).toBeVisible()
    await expect(page.getByText('路过河边的时候记下了一个想法：慢一点，反而能看见今天真正想做的事。', { exact: true })).toBeVisible()

    await surfaceTabs.getByRole('tab', { name: '记忆', exact: true }).click()
    const identityFilter = page.locator('[data-testid="memory-category-filters"]').getByRole('button', { name: '身份 (1)', exact: true })
    await expect(identityFilter).toBeVisible()
    expect(await identityFilter.evaluate((element) => ({
      display: getComputedStyle(element).display,
      whiteSpace: getComputedStyle(element).whiteSpace,
    }))).toEqual({ display: 'flex', whiteSpace: 'nowrap' })
  })

  test('Playground Toast 四态关闭按钮沿统一右边界对齐', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    await page.locator('[data-testid="playground-shell"] nav').getByRole('button', { name: '系统反馈', exact: true }).click()

    const toastStory = page.locator('section').filter({ hasText: 'Toast 四态' }).first()
    const closeButtons = toastStory.getByRole('button', { name: '关闭通知' })
    await expect(closeButtons).toHaveCount(4)
    const rightEdges = await closeButtons.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().right))
    expect(Math.max(...rightEdges) - Math.min(...rightEdges)).toBeLessThan(1)
  })

  test('Debug 与 Playground 采用一级任务导航', async ({ page }) => {
    await page.goto('/')

    const developerNav = page.locator('[data-testid="sidebar-developer-nav"]')
    const sessionList = page.locator('[data-testid="sidebar-session-list"]')
    await expect(developerNav).toBeVisible()
    await expect(sessionList).toBeVisible()
    expect(await sessionList.evaluate((element, dev) => Boolean(element.compareDocumentPosition(dev as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await developerNav.elementHandle())).toBe(true)

    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Debug', exact: true }).click()
    await expect(page.locator('[data-testid="dev-panel"]')).toBeVisible()
    const debugNav = page.locator('[data-testid="dev-panel"] nav')
    await expect(debugNav.getByRole('button', { name: '提示词管理器', exact: true })).toBeVisible()
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
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    const playgroundShell = page.locator('[data-testid="playground-shell"]')
    await expect(playgroundShell).toBeVisible()
    const playgroundBox = await playgroundShell.boundingBox()
    expect(playgroundBox?.y).toBeLessThan(4)
    await expect(page.locator('section[aria-label="设计"]')).toBeVisible()
    await expect(page.locator('section[aria-label="Agent 实验"]')).toBeVisible()
    const playgroundNav = page.locator('[data-testid="playground-shell"] nav')
    await expect(playgroundNav.getByRole('button', { name: 'Token 与主题', exact: true })).toBeVisible()
    await expect(playgroundNav.getByRole('button', { name: '模型能力', exact: true })).toBeVisible()
    await expect(playgroundNav.getByRole('button', { name: '人格场景说明', exact: true })).not.toBeVisible()
    await expect(playgroundNav.getByRole('button', { name: '体验夹具', exact: true })).not.toBeVisible()

    await expect(playgroundNav.getByRole('button', { name: '组件', exact: true })).toHaveCount(0)
    await playgroundNav.getByRole('button', { name: '组件目录', exact: true }).click()
    await expect(page.locator('[data-testid="component-inventory"]')).toBeVisible()
    await expect(page.getByPlaceholder('搜索中文、English、语义 key 或来源')).toBeVisible()
    await expect(page.getByText('behavior.dialog', { exact: true })).toBeVisible()
    await playgroundNav.getByRole('button', { name: '图标', exact: true }).click()
    await expect(page.locator('[data-testid="icon-inventory"]')).toBeVisible()
    await expect(page.getByPlaceholder('搜索中文、English、语义 key 或用途')).toBeVisible()
    await expect(page.getByText('navigation.search', { exact: true })).toBeVisible()
    await expect(page.locator('[data-testid="ui-controls-panel"] > div').first()).not.toContainText('组件与边缘态')
  })

  test('Playground 页面组合提供隔离的右坞、朋友圈和记忆样张', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()

    const playgroundNav = page.locator('[data-testid="playground-shell"] nav')
    await playgroundNav.getByRole('button', { name: '页面组合', exact: true }).click()
    const baseline = page.locator('[data-testid="surface-baseline-panel"]')
    await expect(baseline).toBeVisible()

    await baseline.getByRole('tab', { name: 'Right Dock', exact: true }).click()
    const dock = baseline.locator('[data-testid="chat-right-dock"]')
    await expect(dock.getByTestId('right-dock-tab-preview')).toBeVisible()
    await expect(dock.getByTestId('right-dock-tab-files')).toHaveCount(0)
    await expect(dock.getByTestId('right-dock-tab-review')).toHaveCount(0)
    await expect(dock.getByTestId('right-dock-tab-terminal')).toHaveCount(0)
    expect(await dock.getByTestId('right-dock-add-tab').evaluate((add, close) => Boolean(add.compareDocumentPosition(close as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await dock.getByTestId('right-dock-close-tab').elementHandle())).toBe(true)

    await dock.getByTestId('right-dock-add-tab').click()
    const addMenu = dock.getByRole('menu', { name: '添加右坞 Tab' })
    await expect(addMenu.getByRole('menuitem', { name: '文件', exact: true })).toBeVisible()
    await expect(addMenu.getByRole('menuitem', { name: '审阅', exact: true })).toBeVisible()
    await expect(addMenu.getByRole('menuitem', { name: '终端', exact: true })).toBeVisible()
    await addMenu.getByRole('menuitem', { name: '文件', exact: true }).click()
    await dock.getByTestId('right-dock-tab-files').click()
    const fileTree = dock.getByTestId('file-browser-tree')
    await fileTree.getByRole('button', { name: 'components', exact: true }).click()
    await expect(fileTree).toContainText('AppShell.tsx')
    await expect(dock.getByTestId('file-browser-preview')).toHaveCount(0)

    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '审阅', exact: true }).click()
    await expect(dock.getByTestId('dock-fixture-审阅')).toBeVisible()
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    await expect(dock.getByTestId('dock-fixture-终端')).toBeVisible()

    await baseline.getByRole('tab', { name: '人物世界', exact: true }).click()
    await expect(baseline.getByText('生活广播（非日志表）', { exact: false })).toHaveCount(0)
    await expect(baseline.getByText('CATCH-UP', { exact: true })).toHaveCount(0)
    await expect(baseline.getByText('把窗帘拉开了一点，泡了杯乌龙茶，准备先把桌面清出一块。', { exact: true })).toBeVisible()
    await expect(baseline.getByText('路过河边的时候记下了一个想法：慢一点，反而能看见今天真正想做的事。', { exact: true })).toBeVisible()
    await expect(baseline.getByText('仅展示近期动态 · 内容由主角的生活事件自然派生', { exact: true })).toBeVisible()

    await baseline.getByRole('tab', { name: '记忆', exact: true }).click()
    const memory = baseline.getByTestId('memory-surface-candidate')
    await expect(memory).toBeVisible()
    await expect(memory.getByRole('button', { name: /身份 \(1\)/ })).toBeVisible()
    await expect(memory.getByRole('button', { name: /工作方式 \(1\)/ })).toBeVisible()
    await expect(memory.getByRole('button', { name: /沟通风格 \(1\)/ })).toBeVisible()
    await expect(memory.getByRole('button', { name: /事实 \(0\)/ })).toBeVisible()
    await expect(memory.locator('[class*="bg-amber-"]')).toHaveCount(0)
    await expect(memory.locator('[class*="bg-rose-"]')).toHaveCount(0)
    await expect(memory.locator('[class*="bg-blue-"]')).toHaveCount(0)
  })

  test('Skills 管理页显示校验、版本和隔离试跑入口', async ({ page }) => {
    await page.goto('/')

    await page.click('button[title="设置"]')
    await page.locator('[data-testid="settings-nav"] button').filter({ hasText: '工具' }).click()
    await page.locator('[data-testid="settings-main"]').getByRole('button', { name: /打开 Skills 面板/ }).click()
    await expect(page.locator('[data-testid="skills-panel"]')).toBeVisible()
    await expect(page.getByText('创建、校验、回滚和隔离试跑 Skill', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ 新建 Skill', exact: true })).toBeVisible()
    await expect(page.getByText('选择或新建一个 Skill', { exact: true })).toBeVisible()
  })

  test('设置自动保存覆盖防抖与立即离开场景', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      const writes: Array<[string, string]> = []
      ;(window as any).__settingsWrites = writes
      ;(window as any).electronAPI = {
        settings: {
          get: async () => ({
            llmApiKeyConfigured: 'true',
            llmBaseUrl: 'https://api.openai.com/v1',
            llmModel: 'gpt-4o',
          }),
          set: async (key: string, value: string) => { writes.push([key, value]) },
        },
        companion: {
          getActive: async () => ({ id: 'lin', name: '小林', description: '沉稳体贴的数字伙伴' }),
          listProtagonists: async () => [],
          getMutable: async () => ({ body: '' }),
          listMutableVersions: async () => [],
        },
        mcp: { status: async () => [] },
      }
    })

    await page.click('button[title="设置"]')
    await page.getByRole('button', { name: '模型', exact: true }).click()
    const baseUrl = page.locator('input[placeholder="https://api.openai.com/v1"]')

    await baseUrl.fill('https://autosave.example/v1')
    await expect.poll(() => page.evaluate(() => (window as any).__settingsWrites.some(
      ([key, value]: [string, string]) => key === 'llmBaseUrl' && value === 'https://autosave.example/v1',
    ))).toBe(true)

    await page.evaluate(() => { (window as any).__settingsWrites.length = 0 })
    await baseUrl.fill('https://flush-on-close.example/v1')
    await page.locator('[data-testid="settings-back"]').click()
    await expect.poll(() => page.evaluate(() => (window as any).__settingsWrites.some(
      ([key, value]: [string, string]) => key === 'llmBaseUrl' && value === 'https://flush-on-close.example/v1',
    ))).toBe(true)
  })

  test('设置面板无手动保存栏并可返回聊天', async ({ page }) => {
    await page.goto('/')

    await page.click('button[title="设置"]')
    // Vite 模式下 electronAPI 不存在，但面板结构和自动保存交互文案仍可验收。
    const settingsPanel = page.locator('[data-testid="settings-panel"]')
    await expect(settingsPanel).toBeVisible()
    await expect(page.locator('[data-testid="settings-main"] > div').first()).not.toHaveClass(/border-b/)
    await expect(settingsPanel.getByRole('button', { name: '保存', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '模型', exact: true }).click()
    await expect(page.getByText('填写内容会自动保存在本机', { exact: false })).toBeVisible()
    await expect(page.locator('[data-testid="test-connection"]')).toBeVisible()

    await page.locator('[data-testid="settings-back"]').click()
    await expect(settingsPanel).not.toBeVisible()
  })
})

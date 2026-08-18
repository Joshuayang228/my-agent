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


  test('Playground 先验收 Sidebar 候选态与二级页恢复入口', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    await page.locator('[data-testid="playground-shell"] nav').getByRole('button', { name: '页面组合', exact: true }).click()

    const candidate = page.locator('[data-testid="surface-sidebar-candidate"]')
    await expect(candidate).toBeVisible()
    await expect(candidate.getByRole('button', { name: '记忆', exact: true })).toHaveCount(0)
    await expect(candidate.getByRole('button', { name: '人物世界', exact: true })).toBeVisible()
    await expect(candidate.getByRole('button', { name: '设置', exact: true })).toBeVisible()

    const developerNav = candidate.locator('[data-testid="sidebar-developer-nav"]')
    const developerBox = await developerNav.boundingBox()
    const productBox = await candidate.getByRole('button', { name: '人物世界', exact: true }).boundingBox()
    expect((developerBox?.y ?? 0) + (developerBox?.height ?? 0)).toBeLessThan(productBox?.y ?? 0)

    await page.getByRole('button', { name: '二级页收起', exact: true }).click()
    await expect(page.locator('[data-testid="surface-secondary-nav"]')).toBeVisible()
    await candidate.getByTitle('收起侧栏 Ctrl+B').click()
    await expect(page.locator('[data-testid="surface-sidebar-candidate"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="surface-sidebar-reopen"]')).toBeVisible()
    await page.locator('[data-testid="surface-sidebar-reopen"]').click()
    await expect(page.locator('[data-testid="surface-sidebar-candidate"]')).toBeVisible()
  })

  test('Debug 与 Playground 采用任务分组导航', async ({ page }) => {
    await page.goto('/')

    const developerNav = page.locator('[data-testid="sidebar-developer-nav"]')
    const sessionList = page.locator('[data-testid="sidebar-session-list"]')
    await expect(developerNav).toBeVisible()
    await expect(sessionList).toBeVisible()
    expect(await developerNav.evaluate((element, list) => Boolean(element.compareDocumentPosition(list as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await sessionList.elementHandle())).toBe(true)

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

    await playgroundNav.getByRole('button', { name: '组件', exact: true }).click()
    await page.getByRole('button', { name: '组件目录', exact: true }).click()
    await expect(page.locator('[data-testid="component-inventory"]')).toBeVisible()
    await expect(page.getByPlaceholder('搜索中文、English、语义 key 或来源')).toBeVisible()
    await expect(page.getByText('behavior.dialog', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '图标', exact: true }).click()
    await expect(page.locator('[data-testid="icon-inventory"]')).toBeVisible()
    await expect(page.getByPlaceholder('搜索中文、English、语义 key 或用途')).toBeVisible()
    await expect(page.getByText('navigation.search', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '伙伴与生活', exact: true }).click()
    await expect(page.getByText('companion.camera', { exact: true })).toBeVisible()
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

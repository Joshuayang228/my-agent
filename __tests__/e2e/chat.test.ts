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


  test('Debug 与 Playground 采用任务分组导航', async ({ page }) => {
    await page.goto('/')

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
    await expect(page.getByText('统一查看生产 Prompt、Tool schema、Skill、Eval Judge 与当前 MCP 工具。', { exact: false })).toBeVisible()
    const contextCategories = page.getByLabel('模型可见文本分类')
    await expect(contextCategories.getByRole('button', { name: '内置工具', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: 'Skills', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: 'Eval Judge', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: '外部 / MCP', exact: true })).toBeVisible()

    await debugNav.getByRole('button', { name: '质量 / Eval', exact: true }).click()
    await expect(page.locator('[data-testid="persona-eval-panel"]')).toBeVisible()
    await expect(page.getByText('还没有 Persona Eval 报告', { exact: true })).toBeVisible()

    await debugNav.getByRole('button', { name: '请求与运行', exact: true }).click()
    await expect(page.locator('[data-testid="request-runtime-panel"]')).toBeVisible()
    await expect(page.locator('h2:has-text("请求与运行")')).toBeVisible()

    await page.locator('[data-testid="dev-panel"] button[title="返回聊天"]').click()
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    await expect(page.locator('[data-testid="playground-shell"]')).toBeVisible()
    await expect(page.locator('section[aria-label="设计"]')).toBeVisible()
    await expect(page.locator('section[aria-label="Agent 实验"]')).toBeVisible()
    const playgroundNav = page.locator('[data-testid="playground-shell"] nav')
    await expect(playgroundNav.getByRole('button', { name: 'Token 与主题', exact: true })).toBeVisible()
    await expect(playgroundNav.getByRole('button', { name: '模型能力', exact: true })).toBeVisible()
    await expect(playgroundNav.getByRole('button', { name: '人格场景说明', exact: true })).not.toBeVisible()
    await expect(playgroundNav.getByRole('button', { name: '体验夹具', exact: true })).not.toBeVisible()
  })

  test('设置面板可打开和关闭', async ({ page }) => {
    await page.goto('/')

    await page.click('button[title="设置"]')
    // Vite 模式下 electronAPI 不存在，但面板基础 UI 仍可渲染
    await expect(page.locator('h2:has-text("设置")')).toBeVisible()
    await page.getByRole('button', { name: '模型', exact: true }).click()
    await expect(page.getByText('选择其它 Provider 预设', { exact: false })).toBeVisible()
    await expect(page.locator('[data-testid="test-connection"]')).toBeVisible()

    await page.locator('[data-testid="settings-back"]').click()
    await expect(page.locator('h2:has-text("设置")')).not.toBeVisible()
  })
})

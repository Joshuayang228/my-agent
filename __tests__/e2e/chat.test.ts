/**
 * E2E 测试 — 通过 Vite dev server 测试渲染层 UI
 *
 * 前提：`npm run dev` 已启动
 * 运行：npx playwright test __tests__/e2e/chat.test.ts
 *
 * 注意：这些测试通过 Vite dev server 访问 UI，
 *       IPC 相关的功能（会话持久化、LLM 调用）只在 Electron 内可用。
 *       这里只验证 UI 渲染和交互逻辑。
 */
import { test, expect } from '@playwright/test'

test.describe('My Agent UI', () => {
  test('应用标题和基础 UI 可见', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('h1')).toHaveText('My Agent')
    await expect(page.locator('text=有性格、有记忆、能成长的数字伙伴')).toBeVisible()

    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()
    await expect(textarea).toHaveAttribute('placeholder', /输入消息/)

    const sendBtn = page.locator('button', { hasText: '发送' })
    await expect(sendBtn).toBeVisible()
    await expect(sendBtn).toBeDisabled()
  })

  test('侧边栏可见且可折叠', async ({ page }) => {
    await page.goto('/')

    // 侧边栏可见
    await expect(page.locator('text=会话列表')).toBeVisible()
    await expect(page.locator('text=+ 新建')).toBeVisible()

    // 点击汉堡按钮折叠侧边栏
    await page.click('button:has-text("☰")')
    await expect(page.locator('text=会话列表')).not.toBeVisible()

    // 再点一次展开
    await page.click('button:has-text("☰")')
    await expect(page.locator('text=会话列表')).toBeVisible()
  })

  test('输入框支持文本输入和清除', async ({ page }) => {
    await page.goto('/')

    const textarea = page.locator('textarea')
    const sendBtn = page.locator('button', { hasText: '发送' })

    // 初始发送按钮禁用
    await expect(sendBtn).toBeDisabled()

    // 输入文字后按钮启用
    await textarea.fill('测试消息')
    await expect(sendBtn).toBeEnabled()

    // 清除后按钮再次禁用
    await textarea.fill('')
    await expect(sendBtn).toBeDisabled()
  })

  test('空白消息区显示欢迎内容', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('text=输入消息开始对话')).toBeVisible()
  })
})

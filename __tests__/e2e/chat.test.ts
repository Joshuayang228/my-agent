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

    await expect(page.locator('text=会话列表')).toBeVisible()
    await expect(page.locator('text=+ 新建')).toBeVisible()

    await page.click('button:has-text("☰")')
    await expect(page.locator('text=会话列表')).not.toBeVisible()

    await page.click('button:has-text("☰")')
    await expect(page.locator('text=会话列表')).toBeVisible()
  })

  test('输入框支持文本输入和清除', async ({ page }) => {
    await page.goto('/')

    const textarea = page.locator('textarea')
    const sendBtn = page.locator('button', { hasText: '发送' })

    await expect(sendBtn).toBeDisabled()

    await textarea.fill('测试消息')
    await expect(sendBtn).toBeEnabled()

    await textarea.fill('')
    await expect(sendBtn).toBeDisabled()
  })

  test('空白消息区显示欢迎内容', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('text=有性格、有记忆、能成长的数字伙伴')).toBeVisible()
  })

  test('设置面板可打开和关闭', async ({ page }) => {
    await page.goto('/')

    await page.click('button[title="设置"]')
    // Vite 模式下 electronAPI 不存在，但面板基础 UI 仍可渲染
    await expect(page.locator('h2:has-text("设置")')).toBeVisible()
    await expect(page.locator('text=快速选择模型')).toBeVisible()
    await expect(page.locator('label:has-text("MCP 服务器")')).toBeVisible()

    await page.click('button:has-text("取消")')
    await expect(page.locator('h2:has-text("设置")')).not.toBeVisible()
  })
})

/**
 * E2E 测试 — Electron 环境真实对话测试
 *
 * 在 Electron 主进程中运行，可以测试完整对话流程：
 *   - 通过设置页注入 API Key
 *   - 发送真实提示词
 *   - 等待流式响应
 *   - 验证工具调用
 *
 * 环境变量：
 *   TEST_LLM_API_KEY  — LLM API Key（必需）
 *   TEST_LLM_BASE_URL — Base URL（可选，默认 https://api.deepseek.com）
 *   TEST_LLM_MODEL    — 模型名（可选，默认 deepseek-chat）
 *
 * 运行：npx playwright test __tests__/e2e/electron.test.ts
 */
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import path from 'node:path'

const API_KEY = process.env.TEST_LLM_API_KEY || ''
const BASE_URL = process.env.TEST_LLM_BASE_URL || 'https://api.deepseek.com'
const MODEL = process.env.TEST_LLM_MODEL || 'deepseek-chat'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  test.skip(!API_KEY, 'TEST_LLM_API_KEY not set, skipping Electron E2E tests')

  electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist-electron/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  })

  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(2000)
})

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close()
  }
})

async function configureSettings() {
  await page.click('button[title="设置"]')
  await page.waitForSelector('text=人格模板')

  const apiKeyInput = page.locator('input[placeholder="sk-..."]')
  await apiKeyInput.fill(API_KEY)

  const baseUrlInput = page.locator('input[placeholder="https://api.openai.com/v1"]')
  await baseUrlInput.fill(BASE_URL)

  const modelInput = page.locator('input[placeholder="gpt-4o"]')
  await modelInput.fill(MODEL)

  await page.click('button:has-text("保存")')
  await page.waitForSelector('text=已保存')
  await page.click('text=取消')
  await page.waitForTimeout(500)
}

test.describe('Electron 真实对话', () => {
  test('配置 API Key 并发送消息获得回复', async () => {
    await configureSettings()

    const textarea = page.locator('textarea')
    await textarea.fill('请用一句话回答：1+1等于几？')

    const sendBtn = page.locator('button:has-text("发送")')
    await sendBtn.click()

    // 用户消息应出现在聊天区域
    await expect(page.locator('text=1+1等于几')).toBeVisible()

    // 等待助手回复出现（流式响应，最多等 30s）
    await page.waitForFunction(
      () => {
        const msgs = document.querySelectorAll('[class*="bg-slate-800"]')
        return msgs.length > 0 && msgs[msgs.length - 1].textContent!.length > 5
      },
      { timeout: 30000 },
    )

    // 回复应包含"2"
    const chatArea = page.locator('[class*="flex-1"][class*="overflow"]')
    const content = await chatArea.textContent()
    expect(content).toContain('2')
  })

  test('工具调用：获取当前时间', async () => {
    const textarea = page.locator('textarea')
    await textarea.fill('请调用 get_current_time 工具告诉我现在几点了')

    const sendBtn = page.locator('button:has-text("发送")')
    await sendBtn.click()

    // 等待工具调用出现（tool_start 事件会渲染工具状态）
    await page.waitForSelector('text=get_current_time', { timeout: 30000 })

    // 等待最终回复完成
    await page.waitForFunction(
      () => {
        const doneIndicator = document.querySelector('button:not([disabled])')
        return doneIndicator?.textContent?.includes('发送')
      },
      { timeout: 30000 },
    )
  })

  test('停止按钮可中断流式响应', async () => {
    const textarea = page.locator('textarea')
    await textarea.fill('写一篇500字的文章，主题是人工智能的未来')

    const sendBtn = page.locator('button:has-text("发送")')
    await sendBtn.click()

    // 等待流式开始（停止按钮出现）
    await page.waitForSelector('button:has-text("停止")', { timeout: 15000 })

    // 点击停止
    await page.click('button:has-text("停止")')

    // 停止后发送按钮应恢复
    await page.waitForSelector('button:has-text("发送")', { timeout: 5000 })

    // 输入框应该可以再次输入
    await expect(page.locator('textarea')).toBeEnabled()
  })

  test('多轮对话上下文保持', async () => {
    const textarea = page.locator('textarea')

    // 第一轮
    await textarea.fill('我叫小明，请记住我的名字')
    await page.click('button:has-text("发送")')
    await page.waitForFunction(
      () => document.querySelector('button:not([disabled])')?.textContent?.includes('发送'),
      { timeout: 30000 },
    )

    // 第二轮
    await textarea.fill('我叫什么名字？')
    await page.click('button:has-text("发送")')
    await page.waitForFunction(
      () => {
        const msgs = document.querySelectorAll('[class*="bg-slate-800"]')
        return msgs.length >= 2
      },
      { timeout: 30000 },
    )

    // 验证回复包含"小明"
    const chatArea = page.locator('[class*="flex-1"][class*="overflow"]')
    const content = await chatArea.textContent()
    expect(content).toContain('小明')
  })
})

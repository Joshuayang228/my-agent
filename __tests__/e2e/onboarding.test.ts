/**
 * 首次配置 Electron E2E。
 *
 * 背景：首次旅程必须经过真实 preload / IPC / LLM 路由，但不能依赖开发者的 API Key。
 * 设计意图：测试内启动本地 OpenAI 兼容 SSE 服务，并使用独立 user-data-dir 隔离真实应用数据。
 * 关键约束：不访问外网、不读取或覆盖用户设置；结束后关闭 Electron、HTTP 服务和临时目录。
 */
import { createServer, type IncomingMessage } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'

interface CapturedRequest {
  url: string
  authorization: string
  body: Record<string, unknown>
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let electronApp: ElectronApplication
let page: Page
let userDataDir = ''
let server: ReturnType<typeof createServer>
let baseUrl = ''
let capturedRequest: CapturedRequest | null = null

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
      response.writeHead(404).end()
      return
    }

    const rawBody = await readBody(request)
    capturedRequest = {
      url: request.url,
      authorization: request.headers.authorization ?? '',
      body: JSON.parse(rawBody) as Record<string, unknown>,
    }
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '连接成功' }, finish_reason: null }] })}\n\n`)
    response.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 8, completion_tokens: 2 } })}\n\n`)
    response.end('data: [DONE]\n\n')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('本地模型测试服务启动失败')
  baseUrl = `http://127.0.0.1:${address.port}/v1`

  userDataDir = await mkdtemp(path.join(os.tmpdir(), 'my-agent-onboarding-'))
  electronApp = await electron.launch({
    args: [
      path.join(__dirname, '../../dist-electron/index.js'),
      `--user-data-dir=${userDataDir}`,
      '--no-sandbox',
    ],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      LLM_API_KEY: '',
      LLM_BASE_URL: '',
      LLM_MODEL: '',
    },
  })
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  if (electronApp) await electronApp.close()
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
  if (userDataDir && path.basename(userDataDir).startsWith('my-agent-onboarding-')) {
    await rm(userDataDir, { recursive: true, force: true })
  }
})

test('首次进入可测试模型连接并保存后开始对话', async () => {
  await expect(page.locator('[data-testid="first-run-setup"]')).toBeVisible()
  await expect(page.getByText('先连接模型，再开始对话', { exact: true })).toBeVisible()
  await expect(page.locator('#startup-splash')).toBeHidden()

  await page.screenshot({ path: 'test-results/first-run-light-wide.png', fullPage: true })
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(820, 720))
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'test-results/first-run-light-narrow.png', fullPage: true })
  await page.evaluate(() => {
    localStorage.setItem('theme', 'dark')
    document.documentElement.dataset.theme = 'dark'
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/first-run-dark-narrow.png', fullPage: true })
  await page.evaluate(() => {
    localStorage.setItem('theme', 'mist')
    document.documentElement.dataset.theme = 'mist'
  })

  await page.locator('input[placeholder="sk-..."]').fill('local-test-key')
  await page.locator('input[placeholder="https://api.openai.com/v1"]').fill(baseUrl)
  await page.locator('input[placeholder="gpt-4o"]').fill('local-test-model')
  await expect(page.locator('[data-testid="save-and-start"]')).toBeDisabled()

  await page.locator('[data-testid="test-connection"]').click()
  await expect(page.getByText(/连接成功 · local-test-model/)).toBeVisible()
  await expect(page.locator('[data-testid="save-and-start"]')).toBeEnabled()
  expect(capturedRequest).toMatchObject({
    url: '/v1/chat/completions',
    authorization: 'Bearer local-test-key',
    body: { model: 'local-test-model', stream: true },
  })

  await page.locator('[data-testid="save-and-start"]').click()
  await expect(page.locator('[data-testid="settings-main"]')).not.toBeVisible()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
})

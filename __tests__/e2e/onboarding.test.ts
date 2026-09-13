/**
 * 首次配置 Electron E2E。
 *
 * 背景：首次旅程必须经过真实 preload / IPC / LLM 路由，但不能依赖开发者的 API Key。
 * 设计意图：测试内启动本地 OpenAI 兼容 SSE 服务，并使用独立 user-data-dir 隔离真实应用数据。
 * 关键约束：不访问外网、不读取或覆盖用户设置；结束后关闭 Electron、HTTP 服务和临时目录。
 */
import { createServer, type IncomingMessage } from 'node:http'
import { mkdtemp, mkdir, rm, unlink, writeFile } from 'node:fs/promises'
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
let heldStreamClosed = false
let mainOutput = ''
const fixtureReportName = '2099-01-01T00-00-00-000Z-persona-b02-b07-pass-1.json'
const fixtureReportPath = path.resolve(__dirname, '../../eval-reports', fixtureReportName)

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

test.beforeAll(async () => {
  await mkdir(path.dirname(fixtureReportPath), { recursive: true })
  await writeFile(fixtureReportPath, JSON.stringify({
    timestamp: '2099-01-01T00:00:00.000Z',
    mode: 'real',
    model: 'fixture-model',
    baseUrl: 'http://127.0.0.1/fixture',
    pass: true,
    totalScenarios: 1,
    passedScenarios: 1,
    k: 1,
    scenarios: [{
      id: 'B02',
      description: 'E2E 人工审阅夹具',
      pass: true,
      passes: 1,
      k: 1,
      trials: [{
        id: 'B02-trial',
        description: 'E2E 人工审阅 Trial',
        pass: true,
        durationMs: 12,
        graderResults: [],
        agentTexts: ['先接住你的感受，再一起想下一步。'],
        agentInput: {
          model: 'fixture-model',
          baseUrl: 'http://127.0.0.1/fixture',
          executionMode: 'auto',
          systemPrompt: 'fixture prompt',
          messages: [{ role: 'user', content: '我今天有点累。' }],
          toolNames: [],
        },
        judge: {
          graderName: 'fixture-judge',
          invocationMode: 'single-call',
          systemContext: 'fixture context',
          checks: [{ id: 'check-1', question: '是否先承接用户感受？' }],
        },
      }],
    }],
  }), 'utf8')
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
    const messages = capturedRequest.body.messages as Array<{ role: string; content: unknown }> | undefined
    if (messages?.some((message) => message.role === 'user' && JSON.stringify(message.content).includes('workspace-close-regression'))) {
      heldStreamClosed = false
      response.on('close', () => { heldStreamClosed = true })
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '正在等待关闭验证' }, finish_reason: null }] })}\n\n`)
      return
    }
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
  const collect = (chunk: Buffer) => { mainOutput = (mainOutput + chunk.toString()).slice(-100_000) }
  electronApp.process().stdout?.on('data', collect)
  electronApp.process().stderr?.on('data', collect)
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  if (electronApp) await electronApp.close()
  await unlink(fixtureReportPath).catch(() => undefined)
  if (server) {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
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
  await page.locator('input[placeholder="填写 Provider 控制台中的模型 ID"]').fill('local-test-model')

  await page.locator('[data-testid="test-connection"]').click()
  await expect(page.getByText(/连接成功 · local-test-model/)).toBeVisible()
  expect(capturedRequest).toMatchObject({
    url: '/v1/chat/completions',
    authorization: 'Bearer local-test-key',
    body: { model: 'local-test-model', stream: true },
  })

  await page.locator('[data-testid="settings-back"]').click()
  await expect(page.locator('[data-testid="settings-main"]')).not.toBeVisible()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
})


test('Debug 质量 Eval 可保存并重新载入真人格人工审阅', async () => {
  await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Debug', exact: true }).click()
  const debugNav = page.locator('[data-testid="dev-panel"] nav')
  await debugNav.getByRole('button', { name: '质量 / Eval', exact: true }).click()
  await expect(page.locator('[data-testid="persona-eval-report"]')).toBeVisible()
  await expect(page.locator('[data-testid="persona-eval-scenario-B02"]')).toBeVisible()

  await page.locator('[data-testid="persona-eval-scenario-B02"] > summary').click()
  await page.locator('[data-testid="persona-eval-trial-B02-trial-1"] > summary').click()
  const review = page.locator('[data-testid="persona-human-review"]')
  await review.locator('summary').click()
  await review.getByRole('button', { name: '活人感 / 自然度：5' }).click()
  await review.getByRole('button', { name: '角色一致性：4' }).click()
  await review.getByRole('button', { name: '情绪承接：5' }).click()
  await review.getByRole('button', { name: '强行乐观：无' }).click()
  await review.getByRole('button', { name: '立即推进计划：无' }).click()
  await review.getByRole('button', { name: '擅自心理诊断：无' }).click()
  await review.getByRole('button', { name: '模板化：无' }).click()
  await review.getByRole('button', { name: '总体结论：通过' }).click()
  await review.locator('textarea').fill('先承接疲惫，语气自然。')
  await review.getByRole('button', { name: '保存审阅' }).click()
  await expect(review.getByText('已审阅 · 通过', { exact: true })).toBeVisible()

  await page.locator('[data-testid="dev-panel"] button[title="刷新当前调试分区"]').click()
  await expect(page.locator('[data-testid="persona-human-review"] textarea')).toHaveValue('先承接疲惫，语气自然。')
})

test('真实 Electron workspace 会话创建、隔离与清理', async () => {
  const result = await page.evaluate(async () => {
    const created = await window.electronAPI.session.createWorkspace()
    const loaded = await window.electronAPI.session.get(created.id)
    const listed = await window.electronAPI.session.list()
    await window.electronAPI.session.delete(created.id)
    const afterDelete = await window.electronAPI.session.get(created.id)
    return { created, loaded, listed, afterDelete }
  })

  expect(result.created.sessionKind).toBe('workspace')
  expect(result.loaded?.sessionKind).toBe('workspace')
  expect(result.listed.some((session) => session.id === result.created.id)).toBe(false)
  expect(result.afterDelete).toBeNull()
})

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const logPath = testInfo.outputPath('electron-main.log')
    await writeFile(logPath, mainOutput, 'utf8')
    await testInfo.attach('electron-main-log', { path: logPath, contentType: 'text/plain' })
  }
})

test('正式工作区读取真实文件，流式生成中关闭侧聊终止请求并删除会话', async () => {
  const projectPath = path.join(userDataDir, 'workspace-fixture')
  await mkdir(projectPath)
  await writeFile(path.join(projectPath, 'workspace.txt'), 'real workspace file content', 'utf8')
  // 仅替换操作系统目录选择器；正式 project IPC 仍执行授权、设置与文件读取。
  await electronApp.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] })
  }, projectPath)
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1280, 850))
  await page.getByRole('navigation', { name: '调试分区' }).getByRole('button', { name: '返回', exact: true }).click()
  await page.getByTestId('primary-sidebar').getByRole('button', { name: '新对话', exact: true }).click()
  await page.getByRole('button', { name: '未选择项目', exact: true }).click()
  await page.getByRole('button', { name: '添加新项目', exact: true }).click()
  await page.getByRole('button', { name: '打开工作区', exact: true }).click()
  const dock = page.getByTestId('chat-right-dock')
  await dock.getByText('workspace.txt', { exact: true }).click()
  await expect(dock.getByText('real workspace file content', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    const observed = { sessionId: '', events: [] as string[] }
    const unsubscribe = window.electronAPI.chat.onEvent((event) => {
      if ('sessionId' in event) observed.sessionId = String(event.sessionId)
      observed.events.push(event.type)
    })
    Object.assign(window, { __workspaceObserved: observed, __workspaceUnsubscribe: unsubscribe })
  })
  await dock.getByRole('button', { name: '添加工作区内容' }).click()
  await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
  const sidechat = dock.getByTestId('workspace-sidechat-panel')
  await sidechat.getByRole('textbox', { name: '侧边聊天消息' }).fill('workspace-close-regression')
  await sidechat.getByRole('button', { name: '发送消息', exact: true }).click()
  await expect(sidechat.getByText('正在等待关闭验证', { exact: true }).or(sidechat.getByRole('alert'))).toBeVisible({ timeout: 30_000 })
  await expect(sidechat.getByRole('alert')).toHaveCount(0)
  const sessionId = await page.evaluate(() => (window as any).__workspaceObserved.sessionId as string)
  expect(sessionId).not.toBe('')
  expect(await page.evaluate((id) => window.electronAPI.session.get(id), sessionId)).toMatchObject({ sessionKind: 'workspace' })
  await page.screenshot({ path: 'test-results/workspace-electron-streaming.png', fullPage: true })
  await dock.getByRole('button', { name: '关闭侧边聊天', exact: true }).click()
  await expect(sidechat).toHaveCount(0)
  await expect.poll(() => heldStreamClosed).toBe(true)
  await expect.poll(() => page.evaluate((id) => window.electronAPI.session.get(id), sessionId)).toBeNull()
  expect(await page.evaluate(() => (window as any).__workspaceObserved.events)).toContain('done')
  expect((await page.evaluate(() => window.electronAPI.session.list())).some((session) => session.id === sessionId)).toBe(false)
  await expect(dock.getByText('real workspace file content', { exact: true })).toBeVisible()

  await dock.getByRole('button', { name: '添加工作区内容' }).click()
  await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
  await expect(sidechat.getByRole('textbox', { name: '侧边聊天消息' })).toBeEnabled()
  await sidechat.getByRole('textbox', { name: '侧边聊天消息' }).fill('重新打开后继续')
  await sidechat.getByRole('button', { name: '发送消息', exact: true }).click()
  await expect(sidechat.getByText('连接成功', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(sidechat.getByRole('button', { name: '停止生成' })).toHaveCount(0)
  await expect(sidechat.getByText('workspace-close-regression', { exact: true })).toHaveCount(0)
  await dock.getByRole('button', { name: '关闭侧边聊天', exact: true }).click()
  await page.evaluate(() => (window as any).__workspaceUnsubscribe())
})
